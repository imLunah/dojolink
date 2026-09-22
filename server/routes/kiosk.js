const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { requireManager, requireOwnLocation, requireKiosk } = require('../middleware/auth');
const ms = require('../lib/mystudio');
const { addToBoard } = require('../lib/boardCheckIn');

// The check-in kiosk.
//
// A director signs this center into MyStudio's check-in portal once, then turns
// a tablet into a kiosk. Starting the kiosk REPLACES the staff session on that
// device with a kiosk session: it carries a center and nothing else, so every
// staff route answers 401 and a family at the tablet cannot reach the app behind
// it. Leaving takes any staff member's DojoLink username and password.
//
// A family searches for their ninja by name, picks one of today's classes and
// taps to check in. A child with no place in that class is booked into it
// first, the way MyStudio's own kiosk does (see the kiosk section of
// lib/mystudio.js for what is and is not allowed). The check-in goes to
// MyStudio first, because that is the system of record and the one that can
// say no. Only once it has accepted does the ninja go on Today's Board,
// through the same addToBoard that POST /api/daily uses.

function todayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// Minutes since midnight in Pacific time, to compare against class times.
function nowMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return get('hour') * 60 + get('minute');
}

async function loadKiosk(pool, locationId) {
  const { rows } = await pool.query(
    `SELECT k.id, k.location_id, k.company_id, k.company_name, k.login_email,
            k.portal_token, k.status, k.connected_at, k.last_used_at,
            u.display_name AS connected_by_name
       FROM mystudio_kiosks k
       LEFT JOIN users u ON u.id = k.connected_by
      WHERE k.location_id = $1`,
    [locationId]
  );
  return rows[0] || null;
}

// Built field by field so the token cannot leave by being forgotten here.
function publicShape(kiosk) {
  if (!kiosk) return { connected: false };
  return {
    connected: true,
    status: kiosk.status,
    companyName: kiosk.company_name,
    loginEmail: kiosk.login_email,
    connectedAt: kiosk.connected_at,
    connectedByName: kiosk.connected_by_name || null,
    lastUsedAt: kiosk.last_used_at,
  };
}

async function markExpired(pool, id) {
  await pool.query(`UPDATE mystudio_kiosks SET status = 'expired' WHERE id = $1`, [id]);
}

// Today's members, briefly remembered per center. A family typing a name asks
// once per keystroke; MyStudio should be asked once in a while.
const MEMBERS_TTL_MS = 60 * 1000;
const membersCache = new Map();

async function membersFor(kiosk, locationId, { fresh = false } = {}) {
  const date = todayDate();
  const key = `${locationId}:${date}`;
  const hit = membersCache.get(key);
  if (!fresh && hit && hit.expiresAt > Date.now()) return hit.members;

  const members = await ms.getKioskMembers(ms.decryptCookie(kiosk.portal_token), date);
  membersCache.set(key, { members, expiresAt: Date.now() + MEMBERS_TTL_MS });
  for (const [k, v] of membersCache) if (v.expiresAt <= Date.now()) membersCache.delete(k);
  return members;
}

// The member a request names, looked up on our side so the client never
// supplies the membership ids that go to MyStudio.
async function findMember(kiosk, locationId, participantId) {
  let members = await membersFor(kiosk, locationId);
  let member = members.find((m) => m.participantId === participantId);
  if (!member) {
    members = await membersFor(kiosk, locationId, { fresh: true });
    member = members.find((m) => m.participantId === participantId);
  }
  return member || null;
}

function forgetMembers(locationId) {
  for (const k of membersCache.keys()) if (k.startsWith(`${locationId}:`)) membersCache.delete(k);
}

async function logCheckIn(pool, row) {
  try {
    await pool.query(
      `INSERT INTO mystudio_kiosk_checkins
         (location_id, participant_id, class_key, class_name, start_time,
          student_id, assignment_id, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.locationId,
        row.participantId,
        row.classKey,
        row.className || null,
        row.startTime || null,
        row.studentId || null,
        row.assignmentId || null,
        row.result,
      ]
    );
  } catch (err) {
    // The check-in already happened; losing its log line is not worth failing it.
    console.error('Kiosk check-in log failed:', err.message);
  }
}

// The DojoLink ninja a MyStudio booking belongs to: the linked id first, then an
// exact name match only when exactly one active ninja at the center has it.
async function matchStudent(pool, locationId, booking) {
  const { rows: linked } = await pool.query(
    `SELECT s.id FROM students s
      WHERE s.mystudio_participant_id = $1 AND s.active = true
        AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = $2)
      LIMIT 2`,
    [booking.participantId, locationId]
  );
  if (linked.length === 1) return linked[0].id;

  const { rows: named } = await pool.query(
    `SELECT s.id FROM students s
      WHERE LOWER(TRIM(s.full_name)) = LOWER($1) AND s.active = true
        AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = $2)
      LIMIT 2`,
    [booking.fullName, locationId]
  );
  return named.length === 1 ? named[0].id : null;
}

// Puts a kiosk check-in on Today's Board. Returns the assignment id, or null
// when it is right to leave the board alone: a club (clubs are never board
// check-ins), a ninja DojoLink cannot place with certainty, or one a sensei has
// already put on today's board.
async function addKioskCheckInToBoard(pool, locationId, booking) {
  if (booking.isClub) return { studentId: null, assignmentId: null };

  const studentId = await matchStudent(pool, locationId, booking);
  if (!studentId) return { studentId: null, assignmentId: null };

  const date = todayDate();
  const { rows: onBoard } = await pool.query(
    'SELECT 1 FROM daily_assignments WHERE student_id = $1 AND session_date = $2 LIMIT 1',
    [studentId, date]
  );
  if (onBoard[0]) return { studentId, assignmentId: null };

  let program = null;
  if (booking.program) {
    const { rows } = await pool.query(
      'SELECT 1 FROM student_programs WHERE student_id = $1 AND program = $2',
      [studentId, booking.program]
    );
    if (rows[0]) program = booking.program;
  }

  const assignmentId = await addToBoard(pool, { studentId, program, date });
  return { studentId, assignmentId };
}

function regenerate(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function save(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// Setting a kiosk up (directors)
// ---------------------------------------------------------------------------

// GET /api/kiosk/setup
router.get('/setup', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const kiosk = await loadKiosk(pool, req.session.activeLocationId);
    res.json({ configured: ms.isConfigured(), ...publicShape(kiosk) });
  } catch (err) {
    console.error('Kiosk setup read failed:', err.message);
    res.status(500).json({ error: 'Failed to load the kiosk' });
  }
});

// POST /api/kiosk/setup  { email, password, companyId? }
//
// Signs this center into MyStudio's check-in portal. The password is used once
// and not kept: the portal's token is what lasts.
router.post('/setup', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;
  const email = String((req.body && req.body.email) || '').trim();
  const password = String((req.body && req.body.password) || '');
  const pickedCompanyId = req.body && req.body.companyId ? String(req.body.companyId) : null;

  if (!ms.isConfigured()) {
    return res.status(503).json({ error: 'MyStudio is not set up on this server.' });
  }
  if (!email || !password) {
    return res.status(400).json({ error: 'Enter the MyStudio email and password.' });
  }

  let branches;
  try {
    branches = await ms.portalLogin({ email, password });
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) return res.status(400).json({ error: err.message });
    if (err instanceof ms.MyStudioSignInUnavailable) {
      return res.status(503).json({ error: 'MyStudio changed their check-in portal, so this needs updating.' });
    }
    console.error('Kiosk sign-in failed:', err.message);
    return res.status(502).json({ error: 'Could not reach MyStudio. Try again shortly.' });
  }

  try {
    // Which center. One account is normally one center; when it is more, the
    // center this location is already connected as wins, else the director picks.
    let branch = branches.length === 1 ? branches[0] : null;
    if (!branch && pickedCompanyId) {
      branch = branches.find((b) => b.companyId === pickedCompanyId) || null;
    }
    if (!branch) {
      const { rows } = await pool.query(
        'SELECT company_id FROM mystudio_connections WHERE location_id = $1',
        [locationId]
      );
      const known = rows[0] && String(rows[0].company_id);
      if (known) branch = branches.find((b) => b.companyId === known) || null;
    }
    if (!branch) {
      return res.status(409).json({
        error: 'Pick which center this kiosk is for.',
        branches: branches.map((b) => ({ companyId: b.companyId, companyName: b.companyName })),
      });
    }

    // Proven before it is stored: the token has to answer the call the kiosk
    // depends on.
    try {
      await ms.portalClassList(branch.token, todayDate());
    } catch (err) {
      console.error('Kiosk token check failed:', err.message);
      return res.status(502).json({ error: 'Signed in, but MyStudio would not show the schedule. Try again shortly.' });
    }

    await pool.query(
      `INSERT INTO mystudio_kiosks
         (location_id, connected_by, company_id, company_name, login_email, portal_token, status, connected_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'connected', now())
       ON CONFLICT (location_id) DO UPDATE SET
         connected_by = EXCLUDED.connected_by,
         company_id = EXCLUDED.company_id,
         company_name = EXCLUDED.company_name,
         login_email = EXCLUDED.login_email,
         portal_token = EXCLUDED.portal_token,
         status = 'connected',
         connected_at = now()`,
      [
        locationId,
        req.session.userId,
        branch.companyId,
        branch.companyName,
        email,
        ms.encryptCookie(branch.token),
      ]
    );
    forgetMembers(locationId);

    const kiosk = await loadKiosk(pool, locationId);
    res.json({ configured: true, ...publicShape(kiosk) });
  } catch (err) {
    console.error('Kiosk setup save failed:', err.message);
    res.status(500).json({ error: 'Failed to save the kiosk' });
  }
});

// DELETE /api/kiosk/setup
router.delete('/setup', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    await pool.query('DELETE FROM mystudio_kiosks WHERE location_id = $1', [req.session.activeLocationId]);
    forgetMembers(req.session.activeLocationId);
    res.json({ connected: false });
  } catch (err) {
    console.error('Kiosk disconnect failed:', err.message);
    res.status(500).json({ error: 'Failed to disconnect the kiosk' });
  }
});

// POST /api/kiosk/start
//
// Turns THIS device into the kiosk. The staff session is replaced, not kept
// alongside, so there is nothing signed in behind the kiosk to reach.
router.post('/start', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;
  try {
    const kiosk = await loadKiosk(pool, locationId);
    if (!kiosk) return res.status(400).json({ error: 'Sign in to the MyStudio check-in portal first.' });
    if (kiosk.status === 'expired') {
      return res.status(400).json({ error: 'The check-in portal sign-in has expired. Sign in again first.' });
    }

    const startedBy = req.session.userId;
    await regenerate(req);
    req.session.kiosk = { locationId, startedBy, startedAt: Date.now() };
    // A kiosk is a tablet on a counter for months. It stays a kiosk until staff
    // take it out of kiosk mode.
    req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
    await save(req);
    res.json({ ok: true });
  } catch (err) {
    console.error('Kiosk start failed:', err.message);
    res.status(500).json({ error: 'Failed to start the kiosk' });
  }
});

// ---------------------------------------------------------------------------
// The kiosk itself
// ---------------------------------------------------------------------------

// GET /api/kiosk/me
//
// 200 with null when this device is not a kiosk, like /api/parent/me, so a
// first visit never reads as an expired session.
router.get('/me', async (req, res) => {
  const k = req.session && req.session.kiosk;
  if (!k || !k.locationId) return res.json(null);
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query('SELECT name FROM locations WHERE id = $1 AND active = true', [k.locationId]);
    if (!rows[0]) return res.json(null);
    const kiosk = await loadKiosk(pool, k.locationId);
    res.json({
      centerName: rows[0].name,
      ready: Boolean(kiosk && kiosk.status === 'connected'),
    });
  } catch (err) {
    console.error('Kiosk me failed:', err.message);
    res.status(500).json({ error: 'Failed to load the kiosk' });
  }
});

// GET /api/kiosk/search?q=
//
// Every active member at the center, not only today's bookings, because a
// family may not have booked. Only after two letters, and only a first name and
// last initial, so the tablet never lists the center's children to whoever
// walks up to it.
router.get('/search', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.kiosk.locationId;
  const q = String(req.query.q || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.length < 2) return res.json({ results: [] });

  try {
    const kiosk = await loadKiosk(pool, locationId);
    if (!kiosk || kiosk.status !== 'connected') return res.json({ unavailable: true, results: [] });

    let members;
    try {
      members = await membersFor(kiosk, locationId);
    } catch (err) {
      if (err instanceof ms.MyStudioAuthError) {
        await markExpired(pool, kiosk.id);
        return res.json({ unavailable: true, results: [] });
      }
      console.error('Kiosk members pull failed:', err.message);
      return res.status(502).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
    }

    const words = q.split(' ');
    const results = members
      .filter((m) => {
        const first = m.firstName.toLowerCase();
        const last = m.lastName.toLowerCase();
        if (words.length > 1) return `${first} ${last}`.startsWith(q);
        return first.startsWith(q) || last.startsWith(q);
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
      .slice(0, 8)
      .map((m) => ({
        participantId: m.participantId,
        firstName: m.firstName,
        lastInitial: m.lastName ? `${m.lastName[0].toUpperCase()}.` : '',
      }));

    res.json({ results });
  } catch (err) {
    console.error('Kiosk search failed:', err.message);
    res.status(500).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
});

// GET /api/kiosk/classes?participantId=
//
// Today's classes this child can be checked into: the ones they are booked in,
// and the ones their membership covers.
router.get('/classes', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.kiosk.locationId;
  const participantId = String(req.query.participantId || '').trim();
  if (!/^\d{1,20}$/.test(participantId)) return res.status(400).json({ error: 'Something went wrong. Please try again.' });

  try {
    const kiosk = await loadKiosk(pool, locationId);
    if (!kiosk || kiosk.status !== 'connected') {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    const member = await findMember(kiosk, locationId, participantId);
    if (!member) return res.status(404).json({ error: 'Please see the front desk to check in.' });

    const classes = await ms.getKioskClassesFor(
      ms.decryptCookie(kiosk.portal_token),
      member,
      todayDate(),
      nowMinutes()
    );
    res.json({ classes });
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    console.error('Kiosk classes failed:', err.message);
    res.status(502).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
});

// POST /api/kiosk/checkin  { participantId, classKey }
router.post('/checkin', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.kiosk.locationId;
  const participantId = String((req.body && req.body.participantId) || '').trim();
  const classKey = String((req.body && req.body.classKey) || '').trim();

  if (!/^\d{1,20}$/.test(participantId) || !/^\d+:\d+:\d+$/.test(classKey)) {
    return res.status(400).json({ error: 'Something went wrong. Please try again.' });
  }

  const log = { locationId, participantId, classKey };

  let kiosk;
  try {
    kiosk = await loadKiosk(pool, locationId);
  } catch (err) {
    console.error('Kiosk check-in load failed:', err.message);
    return res.status(500).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
  if (!kiosk || kiosk.status !== 'connected') {
    return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
  }

  let outcome;
  try {
    const member = await findMember(kiosk, locationId, participantId);
    if (!member) throw new ms.MyStudioCheckInRefused('Please see the front desk to check in.');
    outcome = await ms.kioskCheckIn(ms.decryptCookie(kiosk.portal_token), {
      date: todayDate(),
      classKey,
      member,
      nowMinutes: nowMinutes(),
    });
  } catch (err) {
    if (err instanceof ms.MyStudioCheckInRefused) {
      await logCheckIn(pool, { ...log, result: 'refused' });
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof ms.MyStudioAuthError) {
      await markExpired(pool, kiosk.id);
      await logCheckIn(pool, { ...log, result: 'failed' });
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    // A timeout on the write itself may still have landed, so this never
    // invites a second press.
    await logCheckIn(pool, { ...log, result: err.uncertain ? 'uncertain' : 'failed' });
    console.error('Kiosk check-in failed:', err.message);
    return res.status(502).json({
      error: err.uncertain
        ? "We couldn't confirm the check-in. Please see the front desk."
        : 'Check-in is having trouble right now. Please see the front desk.',
    });
  }

  const { already, registered } = outcome;
  const base = { ...log, className: outcome.className, startTime: outcome.startTime };

  // MyStudio has the check-in. The board is DojoLink's own copy and a failure
  // here is logged and survived, not reported as a failed check-in.
  let board = { studentId: null, assignmentId: null };
  try {
    board = await addKioskCheckInToBoard(pool, locationId, outcome);
  } catch (err) {
    console.error('Kiosk board check-in failed:', err.message);
  }

  await logCheckIn(pool, {
    ...base,
    ...board,
    result: already ? 'already' : registered ? 'registered' : 'checked_in',
  });
  pool.query('UPDATE mystudio_kiosks SET last_used_at = now() WHERE id = $1', [kiosk.id]).catch(() => {});

  res.json({
    ok: true,
    already,
    firstName: outcome.firstName,
    className: outcome.className,
    startTime: outcome.startTime,
  });
});

// POST /api/kiosk/exit  { username, password }
//
// Any staff member at this center, or an admin. Ends the kiosk session so the
// device is back at the sign-in page.
router.post('/exit', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.kiosk.locationId;
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');
  if (!username || !password) return res.status(400).json({ error: 'Enter a staff username and password.' });

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.role, u.password_hash
         FROM users u
        WHERE LOWER(u.username) = LOWER($1) AND u.active = true
          AND (u.role = 'admin' OR u.location_id = $2
               OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = $2))`,
      [username, locationId]
    );
    const user = rows[0];
    const match = user ? await bcrypt.compare(password, user.password_hash) : false;
    // 400, not 401: a 401 reads to the client as the kiosk session ending.
    if (!match) return res.status(400).json({ error: 'That staff login did not work.' });

    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  } catch (err) {
    console.error('Kiosk exit failed:', err.message);
    res.status(500).json({ error: 'Failed to leave kiosk mode' });
  }
});

module.exports = router;
