const express = require('express');
const router = express.Router();
const { requireManager, requireOwnLocation, requireKiosk, kioskLocationId } = require('../middleware/auth');
const ms = require('../lib/mystudio');
const { addToBoard } = require('../lib/boardCheckIn');

// The check-in kiosk.
//
// The kiosk runs in a browser tab beside a signed-in director's own session,
// on a screen staff can see or a tablet held to that one tab (Guided Access).
// A locked mode that swapped the device's session for a kiosk-only one was
// built and then removed at the owner's request (22 Sep 2026), so nothing here
// stops a family reaching DojoLink behind the kiosk except how the screen is
// set up. The kiosk signs itself in to MyStudio's
// check-in portal from the center's saved MyStudio login (ensureKiosk).
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
            k.portal_token, k.status, k.connected_at, k.last_used_at, k.flow, k.color, k.show_names,
            k.class_window_minutes,
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
  // MyStudio itself is not connected, or its connection ran out.
  if (kiosk && kiosk.blocked) return { connected: false, blocked: kiosk.blocked };
  if (!kiosk || kiosk.status === 'off') return { connected: false, off: Boolean(kiosk) };
  return {
    connected: true,
    status: kiosk.status,
    companyName: kiosk.company_name,
    loginEmail: kiosk.login_email,
    connectedAt: kiosk.connected_at,
    connectedByName: kiosk.connected_by_name || null,
    lastUsedAt: kiosk.last_used_at,
    flow: kiosk.flow === 'class' ? 'class' : 'name',
    color: kiosk.color || null,
    showNames: kiosk.show_names !== false,
    classWindowMinutes: kiosk.class_window_minutes || null,
  };
}

async function markExpired(pool, id) {
  await pool.query(`UPDATE mystudio_kiosks SET status = 'expired' WHERE id = $1`, [id]);
}

async function saveKiosk(pool, { locationId, userId, branch, email }) {
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
    [locationId, userId, branch.companyId, branch.companyName, email, ms.encryptCookie(branch.token)]
  );
  forgetMembers(locationId);
}

// The center's MyStudio connection, when it holds a saved login the kiosk can
// sign in with. The check-in portal has no emailed code, so a director who
// connected MyStudio with their password never has to sign the kiosk in too.
async function savedLogin(pool, locationId) {
  const { rows } = await pool.query(
    `SELECT company_id, login_email, login_secret, connected_by
       FROM mystudio_connections WHERE location_id = $1`,
    [locationId]
  );
  const conn = rows[0];
  return conn && conn.login_email && conn.login_secret ? conn : null;
}

// The center's own MyStudio connection: 'none', 'off', 'expired' or 'connected'.
// 'off' is a director switching the kiosk off in the connection's settings.
//
// The kiosk only runs while that connection does (the owner's call). Its
// check-in portal token would carry on regardless, but a center whose
// connection has lapsed is one whose director needs to sign back in, and a
// kiosk quietly working on the side hides that. Read the same way the board
// reads it: the stored status, and the expiry the credential states itself.
async function connectionState(pool, locationId) {
  const { rows } = await pool.query(
    'SELECT status, session_cookie, feature_kiosk FROM mystudio_connections WHERE location_id = $1',
    [locationId]
  );
  const conn = rows[0];
  if (!conn) return 'none';
  if (conn.feature_kiosk === false) return 'off';
  if (conn.status === 'expired') return 'expired';
  try {
    const expiresAt = ms.readCookieExpiry(ms.decryptCookie(conn.session_cookie));
    if (expiresAt && expiresAt <= new Date()) return 'expired';
  } catch {
    // An unreadable expiry is not evidence of one; the board decides the same.
  }
  return 'connected';
}

// A failed automatic sign-in is not retried for a while, or a wrong saved
// password would be sent to MyStudio on every keystroke at the kiosk.
const AUTO_RETRY_MS = 10 * 60 * 1000;
const autoFailedAt = new Map();

// The kiosk for a center, signing it in from the saved MyStudio login when it
// has never been set up or its token has stopped working. A kiosk a director
// switched off stays off. Returns whatever is there otherwise, and never
// throws: a kiosk that cannot sign in reads as unavailable, not as an error.
async function ensureKiosk(pool, locationId, { force = false } = {}) {
  // Blocked reads as not connected to every caller, so no route has to know
  // about it: they all refuse a kiosk whose status is not 'connected'.
  const connection = await connectionState(pool, locationId);
  if (connection !== 'connected') {
    const existing = await loadKiosk(pool, locationId);
    return { ...(existing || {}), status: 'blocked', blocked: connection };
  }
  const kiosk = await loadKiosk(pool, locationId);
  if (kiosk && kiosk.status === 'connected') return kiosk;
  if (kiosk && kiosk.status === 'off' && !force) return kiosk;
  if (!ms.isConfigured()) return kiosk;
  if (!force && Date.now() - (autoFailedAt.get(locationId) || 0) < AUTO_RETRY_MS) return kiosk;

  const conn = await savedLogin(pool, locationId);
  if (!conn) return kiosk;

  try {
    const branches = await ms.portalLogin({
      email: conn.login_email,
      password: ms.decryptCookie(conn.login_secret),
    });
    const branch =
      branches.find((b) => b.companyId === String(conn.company_id)) ||
      (branches.length === 1 ? branches[0] : null);
    if (!branch) throw new Error('No matching center on the saved login');
    await ms.portalClassList(branch.token, todayDate());
    await saveKiosk(pool, { locationId, userId: conn.connected_by, branch, email: conn.login_email });
    autoFailedAt.delete(locationId);
    return loadKiosk(pool, locationId);
  } catch (err) {
    // Never the upstream body: the request carried a password.
    console.error('Kiosk automatic sign-in failed:', err.message);
    autoFailedAt.set(locationId, Date.now());
    return kiosk;
  }
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

// How long a kiosk check-in can be taken back from the tablet. Long enough to
// notice the wrong class was tapped, short enough that it cannot be used later
// to quietly undo somebody else's attendance.
const UNDO_WINDOW_MINUTES = 30;

// The most recent check-in THIS kiosk made for a child and class that can
// still be undone, or null.
async function undoableCheckIn(pool, locationId, participantId, classKey) {
  const { rows } = await pool.query(
    `SELECT id, result, assignment_id
       FROM mystudio_kiosk_checkins
      WHERE location_id = $1 AND participant_id = $2 AND class_key = $3
        AND result IN ('checked_in', 'registered') AND undone_at IS NULL
        AND created_at > now() - make_interval(mins => $4)
      ORDER BY created_at DESC
      LIMIT 1`,
    [locationId, participantId, classKey, UNDO_WINDOW_MINUTES]
  );
  return rows[0] || null;
}

// A name matches a search when the first name, the last name, or "first
// last" starts with it.
function nameMatches(first, last, q) {
  const f = String(first || '').toLowerCase();
  const l = String(last || '').toLowerCase();
  return f.startsWith(q) || l.startsWith(q) || `${f} ${l}`.startsWith(q);
}

// With names hidden, nobody is listed until a search has this many letters.
const HIDDEN_MIN_LETTERS = 2;

// A class's roster, briefly remembered: with names hidden the kiosk asks again
// on every search, and MyStudio should be asked once in a while.
const ROSTER_TTL_MS = 45 * 1000;
const rosterCache = new Map();

function forgetMembers(locationId) {
  for (const k of rosterCache.keys()) if (k.startsWith(`${locationId}:`)) rosterCache.delete(k);
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
// already put on today's board for this class.
//
// Every kiosk check-in is its own session, so a ninja checked in for CREATE and
// then for Robotics gets two rows. A row only stands in for this check-in when
// a sensei made it (no kiosk check-in claims it) and it is for the same program;
// for a class with no program, any such row will do.
async function addKioskCheckInToBoard(pool, locationId, booking) {
  if (booking.isClub) return { studentId: null, assignmentId: null };

  const studentId = await matchStudent(pool, locationId, booking);
  if (!studentId) return { studentId: null, assignmentId: null };

  let program = null;
  if (booking.program) {
    const { rows } = await pool.query(
      'SELECT 1 FROM student_programs WHERE student_id = $1 AND program = $2',
      [studentId, booking.program]
    );
    if (rows[0]) program = booking.program;
  }

  const date = todayDate();
  const { rows: onBoard } = await pool.query(
    `SELECT 1 FROM daily_assignments d
      WHERE d.student_id = $1 AND d.session_date = $2
        AND ($3::text IS NULL OR d.program = $3)
        AND NOT EXISTS (
          SELECT 1 FROM mystudio_kiosk_checkins k
           WHERE k.assignment_id = d.id AND k.undone_at IS NULL
        )
      LIMIT 1`,
    [studentId, date, program]
  );
  if (onBoard[0]) return { studentId, assignmentId: null };

  const assignmentId = await addToBoard(pool, { studentId, program, date });
  return { studentId, assignmentId };
}

// ---------------------------------------------------------------------------
// Setting a kiosk up (directors)
// ---------------------------------------------------------------------------

// GET /api/kiosk/setup
router.get('/setup', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const locationId = req.session.activeLocationId;
    const kiosk = await ensureKiosk(pool, locationId);
    res.json({
      configured: ms.isConfigured(),
      canUseSavedLogin: Boolean(await savedLogin(pool, locationId)),
      ...publicShape(kiosk),
    });
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
  // No credentials: turn the kiosk on from the center's saved MyStudio login.
  if (!email && !password) {
    try {
      if (!(await savedLogin(pool, locationId))) {
        return res.status(400).json({ error: 'Enter the MyStudio email and password.' });
      }
      const kiosk = await ensureKiosk(pool, locationId, { force: true });
      if (!kiosk || kiosk.status !== 'connected') {
        return res.status(502).json({ error: 'Signing in with your saved MyStudio login did not work. Enter the email and password instead.' });
      }
      return res.json({ configured: true, canUseSavedLogin: true, ...publicShape(kiosk) });
    } catch (err) {
      console.error('Kiosk saved sign-in failed:', err.message);
      return res.status(500).json({ error: 'Failed to turn the kiosk on' });
    }
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

    await saveKiosk(pool, { locationId, userId: req.session.userId, branch, email });

    const kiosk = await ensureKiosk(pool, locationId);
    res.json({ configured: true, canUseSavedLogin: Boolean(await savedLogin(pool, locationId)), ...publicShape(kiosk) });
  } catch (err) {
    console.error('Kiosk setup save failed:', err.message);
    res.status(500).json({ error: 'Failed to save the kiosk' });
  }
});

// PATCH /api/kiosk/setup  { flow?, color?, showNames?, classWindowMinutes?: number | null }
//
// The kiosk's settings: how it starts (find your ninja then pick a class, or
// pick the class then find your ninja in it) and its color (null is
// DojoLink's own blue).
router.patch('/setup', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const body = req.body || {};
  const sets = [];
  const params = [req.session.activeLocationId];

  if (body.flow !== undefined) {
    if (!['name', 'class'].includes(body.flow)) return res.status(400).json({ error: 'Pick how the kiosk starts.' });
    params.push(body.flow);
    sets.push(`flow = $${params.length}`);
  }
  if (body.classWindowMinutes !== undefined) {
    const w = body.classWindowMinutes;
    if (w !== null && !(Number.isInteger(w) && w >= 5 && w <= 720)) {
      return res.status(400).json({ error: 'Pick a window between 5 and 720 minutes.' });
    }
    params.push(w);
    sets.push(`class_window_minutes = $${params.length}`);
  }
  if (body.showNames !== undefined) {
    if (typeof body.showNames !== 'boolean') return res.status(400).json({ error: 'Pick whether names show.' });
    params.push(body.showNames);
    sets.push(`show_names = $${params.length}`);
  }
  if (body.color !== undefined) {
    const color = body.color === null ? null : String(body.color).toLowerCase();
    if (color !== null && !/^#[0-9a-f]{6}$/.test(color)) return res.status(400).json({ error: 'Pick a color.' });
    params.push(color);
    sets.push(`color = $${params.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to change.' });

  try {
    const locationId = req.session.activeLocationId;
    const { rowCount } = await pool.query(
      `UPDATE mystudio_kiosks SET ${sets.join(', ')} WHERE location_id = $1`,
      params
    );
    if (!rowCount) return res.status(400).json({ error: 'Turn the kiosk on first.' });
    const kiosk = await loadKiosk(pool, locationId);
    res.json({ configured: true, canUseSavedLogin: Boolean(await savedLogin(pool, locationId)), ...publicShape(kiosk) });
  } catch (err) {
    console.error('Kiosk settings save failed:', err.message);
    res.status(500).json({ error: 'Failed to save the kiosk setting' });
  }
});

// DELETE /api/kiosk/setup
router.delete('/setup', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    // Switched off, not deleted: a deleted row would be signed straight back in
    // from the saved MyStudio login on the next page load.
    const locationId = req.session.activeLocationId;
    await pool.query(
      `UPDATE mystudio_kiosks SET status = 'off', portal_token = NULL WHERE location_id = $1`,
      [locationId]
    );
    forgetMembers(locationId);
    res.json({ connected: false, off: true, canUseSavedLogin: Boolean(await savedLogin(pool, locationId)) });
  } catch (err) {
    console.error('Kiosk disconnect failed:', err.message);
    res.status(500).json({ error: 'Failed to disconnect the kiosk' });
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
  const locationId = kioskLocationId(req);
  if (!locationId) return res.json(null);
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query('SELECT name FROM locations WHERE id = $1 AND active = true', [locationId]);
    if (!rows[0]) return res.json(null);
    const kiosk = await ensureKiosk(pool, locationId);
    res.json({
      centerName: rows[0].name,
      ready: Boolean(kiosk && kiosk.status === 'connected'),
      // Whether families start from their ninja's name or from the class.
      flow: kiosk && kiosk.flow === 'class' ? 'class' : 'name',
      color: (kiosk && kiosk.color) || null,
      showNames: !kiosk || kiosk.show_names !== false,
    });
  } catch (err) {
    console.error('Kiosk me failed:', err.message);
    res.status(500).json({ error: 'Failed to load the kiosk' });
  }
});

// GET /api/kiosk/search?q=
//
// Every active member at the center, not only today's bookings, because a
// family may not have booked. With no query it is the whole list, which the
// kiosk shows before anyone types (the owner's call, like MyStudio's own
// kiosk), with full first and last names.
router.get('/search', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.kioskLocationId;
  const q = String(req.query.q || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);

  try {
    const kiosk = await ensureKiosk(pool, locationId);
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

    // Names hidden: nothing until a real search. Refused here rather than
    // only on screen, so the list never reaches the tablet.
    if (kiosk.show_names === false && q.length < HIDDEN_MIN_LETTERS) return res.json({ results: [] });

    const results = members
      .filter((m) => !q || nameMatches(m.firstName, m.lastName, q))
      .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
      .map((m) => ({
        participantId: m.participantId,
        firstName: m.firstName,
        lastName: m.lastName,
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
  const locationId = req.kioskLocationId;
  const participantId = String(req.query.participantId || '').trim();
  if (!/^\d{1,20}$/.test(participantId)) return res.status(400).json({ error: 'Something went wrong. Please try again.' });

  try {
    const kiosk = await ensureKiosk(pool, locationId);
    if (!kiosk || kiosk.status !== 'connected') {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    const member = await findMember(kiosk, locationId, participantId);
    if (!member) return res.status(404).json({ error: 'Please see the front desk to check in.' });

    const classes = await ms.getKioskClassesFor(
      ms.decryptCookie(kiosk.portal_token),
      member,
      todayDate(),
      nowMinutes(),
      kiosk.class_window_minutes || null
    );
    const { rows: recent } = await pool.query(
      `SELECT DISTINCT class_key FROM mystudio_kiosk_checkins
        WHERE location_id = $1 AND participant_id = $2
          AND result IN ('checked_in', 'registered') AND undone_at IS NULL
          AND created_at > now() - make_interval(mins => $3)`,
      [locationId, participantId, UNDO_WINDOW_MINUTES]
    );
    const undoable = new Set(recent.map((r) => r.class_key));
    res.json({ classes: classes.map((c) => ({ ...c, undoable: c.checkedIn && undoable.has(c.classKey) })) });
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    console.error('Kiosk classes failed:', err.message);
    res.status(502).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
});

// Class keys this kiosk checked a child into that can still be undone.
async function undoableKeys(pool, locationId, { participantId = null, classKey = null } = {}) {
  const { rows } = await pool.query(
    `SELECT DISTINCT participant_id, class_key FROM mystudio_kiosk_checkins
      WHERE location_id = $1
        AND ($2::text IS NULL OR participant_id = $2)
        AND ($3::text IS NULL OR class_key = $3)
        AND result IN ('checked_in', 'registered') AND undone_at IS NULL
        AND created_at > now() - make_interval(mins => $4)`,
    [locationId, participantId, classKey, UNDO_WINDOW_MINUTES]
  );
  return new Set(rows.map((r) => `${r.participant_id}|${r.class_key}`));
}

// GET /api/kiosk/schedule
//
// Today's classes that have not ended (and, when the center set one, that
// start within its window of now), for a kiosk that starts from the class.
router.get('/schedule', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.kioskLocationId;
  try {
    const kiosk = await ensureKiosk(pool, locationId);
    if (!kiosk || kiosk.status !== 'connected') return res.json({ unavailable: true, classes: [] });
    const classes = await ms.getKioskSchedule(ms.decryptCookie(kiosk.portal_token), todayDate(), nowMinutes(), kiosk.class_window_minutes || null);
    res.json({ classes });
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) return res.json({ unavailable: true, classes: [] });
    console.error('Kiosk schedule failed:', err.message);
    res.status(502).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
});

// GET /api/kiosk/roster?classKey=
//
// The children who can be checked into one class: booked first, then everyone
// whose membership covers it.
router.get('/roster', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.kioskLocationId;
  const classKey = String(req.query.classKey || '').trim();
  if (!/^\d+:\d+:\d+$/.test(classKey)) return res.status(400).json({ error: 'Something went wrong. Please try again.' });

  try {
    const kiosk = await ensureKiosk(pool, locationId);
    if (!kiosk || kiosk.status !== 'connected') {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    const q = String(req.query.q || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    const cacheKey = `${locationId}:${todayDate()}:${classKey}:${kiosk.class_window_minutes || 'day'}`;
    let found = null;
    const hit = rosterCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      found = hit.found;
    } else {
      found = await ms.getKioskRosterFor(ms.decryptCookie(kiosk.portal_token), {
        date: todayDate(),
        classKey,
        nowMinutes: nowMinutes(),
        windowMinutes: kiosk.class_window_minutes || null,
      });
      if (found) rosterCache.set(cacheKey, { found, expiresAt: Date.now() + ROSTER_TTL_MS });
    }
    if (!found) return res.status(409).json({ error: "That class isn't open for check-in. Please see the front desk." });

    // Names hidden: the roster is only ever the matches for a real search.
    const hidden = kiosk.show_names === false;
    if (hidden && q.length < HIDDEN_MIN_LETTERS) return res.json({ class: found.class, roster: [], hidden: true });
    const kids = q ? found.roster.filter((r) => nameMatches(r.firstName, r.lastName, q)) : found.roster;

    const undoable = await undoableKeys(pool, locationId, { classKey });
    res.json({
      class: found.class,
      hidden,
      roster: kids.map((r) => ({
        ...r,
        undoable: r.checkedIn && undoable.has(`${r.participantId}|${classKey}`),
      })),
    });
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }
    console.error('Kiosk roster failed:', err.message);
    res.status(502).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
});

// POST /api/kiosk/checkin  { participantId, classKey }
router.post('/checkin', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.kioskLocationId;
  const participantId = String((req.body && req.body.participantId) || '').trim();
  const classKey = String((req.body && req.body.classKey) || '').trim();

  if (!/^\d{1,20}$/.test(participantId) || !/^\d+:\d+:\d+$/.test(classKey)) {
    return res.status(400).json({ error: 'Something went wrong. Please try again.' });
  }

  const log = { locationId, participantId, classKey };

  let kiosk;
  try {
    kiosk = await ensureKiosk(pool, locationId);
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
      windowMinutes: kiosk.class_window_minutes || null,
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

  // The cached roster and name list now say the wrong thing about this kid.
  forgetMembers(locationId);
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

// POST /api/kiosk/undo  { participantId, classKey }
//
// Takes back a check-in this kiosk made in the last half hour. When the kiosk
// also made the booking, the booking goes too; a child who was booked before
// they arrived is only checked back out and keeps their place. The ninja comes
// off Today's Board if the kiosk put them there and nobody has logged the
// session yet.
router.post('/undo', requireKiosk, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.kioskLocationId;
  const participantId = String((req.body && req.body.participantId) || '').trim();
  const classKey = String((req.body && req.body.classKey) || '').trim();

  if (!/^\d{1,20}$/.test(participantId) || !/^\d+:\d+:\d+$/.test(classKey)) {
    return res.status(400).json({ error: 'Something went wrong. Please try again.' });
  }

  try {
    const kiosk = await ensureKiosk(pool, locationId);
    if (!kiosk || kiosk.status !== 'connected') {
      return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
    }

    const entry = await undoableCheckIn(pool, locationId, participantId, classKey);
    if (!entry) {
      return res.status(409).json({ error: "This check-in can't be undone here. Please see the front desk." });
    }

    const member = await findMember(kiosk, locationId, participantId);
    const registered = entry.result === 'registered';

    let undone;
    try {
      undone = await ms.kioskUndo(ms.decryptCookie(kiosk.portal_token), {
        date: todayDate(),
        classKey,
        participantId,
        cancelRegistration: registered,
      });
    } catch (err) {
      if (err instanceof ms.MyStudioCheckInRefused) return res.status(409).json({ error: err.message });
      if (err instanceof ms.MyStudioAuthError) {
        await markExpired(pool, kiosk.id);
        return res.status(503).json({ error: 'Check-in is unavailable right now. Please see the front desk.' });
      }
      console.error('Kiosk undo failed:', err.message);
      return res.status(502).json({
        error: err.uncertain
          ? "We couldn't confirm the undo. Please see the front desk."
          : 'Check-in is having trouble right now. Please see the front desk.',
      });
    }

    await pool.query('UPDATE mystudio_kiosk_checkins SET undone_at = now() WHERE id = $1', [entry.id]);
    forgetMembers(locationId);
    if (entry.assignment_id) {
      // Only an untouched row: a session a sensei has logged is not the
      // kiosk's to remove.
      await pool.query(
        'DELETE FROM daily_assignments WHERE id = $1 AND completed = false',
        [entry.assignment_id]
      ).catch((err) => console.error('Kiosk undo board cleanup failed:', err.message));
    }

    res.json({
      ok: true,
      unregistered: registered,
      firstName: member ? member.firstName : '',
      className: undone.className,
      startTime: undone.startTime,
    });
  } catch (err) {
    console.error('Kiosk undo failed:', err.message);
    res.status(500).json({ error: 'Check-in is having trouble right now. Please see the front desk.' });
  }
});

module.exports = router;
