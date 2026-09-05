const express = require('express');
const router = express.Router();
const { requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');
const ms = require('../lib/mystudio');
const { addMembership } = require('../lib/studentScope');

// Experimental: read today's booked roster out of the studio management system
// so the check-in board starts populated.
//
// Read-only upstream. There is deliberately no route here that creates a
// check-in: accepting a suggestion goes through the existing POST /api/daily,
// which already owns the overdue-reuse rule, the enrollment check and the
// program constraint. A second write path would be a second place for those to
// drift.
//
// The stored cookie never appears in a response from this file.

function todayDate() {
  // Matches daily.js. All centers are in California, so Pacific keeps the board
  // from flipping at UTC midnight.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

async function loadConnection(pool, locationId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.location_id, c.company_id, c.company_name, c.session_cookie,
            c.status, c.last_verified_at, c.last_synced_at,
            c.login_email, c.login_secret, c.login_saved_at,
            c.feature_booked, c.feature_import,
            u.display_name AS connected_by_name
       FROM mystudio_connections c
       LEFT JOIN users u ON u.id = c.connected_by
      WHERE c.location_id = $1`,
    [locationId]
  );
  return rows[0] || null;
}

// When this connection's credential runs out, or null if it cannot be read.
//
// kc_refresh carries a hard twenty four hour expiry that nothing on our side
// can extend, so this is the single most useful thing we know about a
// connection and until now we were not looking at it.
function expiryOf(conn) {
  if (!conn || !conn.session_cookie) return null;
  try {
    return ms.readCookieExpiry(ms.decryptCookie(conn.session_cookie));
  } catch {
    return null;
  }
}

// What the client is allowed to know about a connection.
//
// login_secret is absent by construction rather than by deletion: nothing that
// leaves this file is built from the row wholesale, so a column added later
// cannot leak by being forgotten here.
function publicShape(conn) {
  if (!conn) return { connected: false };
  // Read off the stored token rather than a column, so it cannot drift from the
  // credential it describes. Null means unreadable, which the UI shows as
  // nothing rather than as trouble.
  const expiresAt = expiryOf(conn);
  return {
    connected: true,
    status: expiresAt && expiresAt <= new Date() ? 'expired' : conn.status,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    companyName: conn.company_name,
    companyId: conn.company_id,
    connectedByName: conn.connected_by_name || null,
    lastVerifiedAt: conn.last_verified_at,
    lastSyncedAt: conn.last_synced_at,
    loginEmail: conn.login_email || null,
    hasSavedPassword: Boolean(conn.login_secret),
    // What this connection is allowed to power at this center.
    features: {
      booked: conn.feature_booked !== false,
      import: conn.feature_import !== false,
    },
  };
}

const SAVE_RETURNING = `RETURNING id, location_id, company_id, company_name, status,
                 last_verified_at, last_synced_at, login_email, login_secret,
                 feature_booked, feature_import`;

// One place that writes a connection, used by both ways of making one.
//
// `login` is only present when the credential came from a sign-in here. Passing
// it null leaves any saved password untouched, so reconnecting with a pasted
// cookie does not silently forget the password that makes renewals quick.
async function saveConnection(pool, { locationId, userId, companyId, companyName, cookie, login }) {
  const { rows } = await pool.query(
    `INSERT INTO mystudio_connections
       (location_id, connected_by, company_id, company_name, session_cookie,
        status, last_verified_at, login_email, login_secret, login_saved_at)
     VALUES ($1, $2, $3, $4, $5, 'connected', now(), $6, $7,
             CASE WHEN $7::text IS NULL THEN NULL ELSE now() END)
     ON CONFLICT (location_id) DO UPDATE SET
       connected_by = EXCLUDED.connected_by,
       company_id = EXCLUDED.company_id,
       company_name = EXCLUDED.company_name,
       session_cookie = EXCLUDED.session_cookie,
       status = 'connected',
       last_verified_at = now(),
       login_email = COALESCE(EXCLUDED.login_email, mystudio_connections.login_email),
       login_secret = COALESCE(EXCLUDED.login_secret, mystudio_connections.login_secret),
       login_saved_at = CASE
         WHEN EXCLUDED.login_secret IS NULL THEN mystudio_connections.login_saved_at
         ELSE now()
       END
     ${SAVE_RETURNING}`,
    [
      locationId,
      userId,
      companyId,
      companyName,
      ms.encryptCookie(cookie),
      login ? login.email : null,
      login ? ms.encryptCookie(login.password) : null,
    ]
  );
  return rows[0];
}

// Whatever was typed, else the sign-in already in flight, else what was saved.
// This is what makes a renewal six digits instead of a form.
//
// The pending entry has to come before the saved password: during a first
// connect there is no saved password at all, and it is the only thing that
// remembers what was typed before the person left to fetch their code.
function loginCredentials(conn, body, pending) {
  const typedEmail = String((body && body.email) || '').trim();
  const typedPassword = String((body && body.password) || '');

  const email =
    typedEmail || (pending && pending.email) || (conn && conn.login_email) || '';

  let password = typedPassword;
  if (!password && pending) password = ms.decryptCookie(pending.secret);
  if (!password && conn && conn.login_secret) password = ms.decryptCookie(conn.login_secret);

  return { email, password };
}

// Sign-in failures are told apart so the UI can react differently: a wrong
// password is the person's to fix, a changed login page is ours.
function sendLoginError(res, err, context) {
  if (err instanceof ms.MyStudioSignInUnavailable) {
    console.error(`MyStudio ${context} unavailable:`, err.message);
    return res.status(503).json({ error: err.message, signInUnavailable: true });
  }
  if (err instanceof ms.MyStudioAuthError) {
    // Logged as well as returned. A 400 in a browser console says nothing about
    // which of these went wrong, and the body is the only place the answer was.
    console.error(`MyStudio ${context} rejected:`, err.message);
    return res.status(400).json({ error: err.message });
  }
  // Never the body: an upstream error can quote back what was sent to it, and
  // what was sent to it here is a password.
  console.error(`MyStudio ${context} failed:`, err.message);
  return res.status(502).json({ error: 'Could not reach MyStudio. Try again shortly.' });
}

// The upstream pull, briefly remembered.
//
// One pull is a request per booked class, so the cost is not in serving the
// board, it is in asking MyStudio. Two directors with the board open, or one
// person switching tabs, should not multiply that. Sixty seconds is short enough
// that a sign-up shows up while somebody is still standing at the desk, and long
// enough that the fan-out happens once no matter how many people are watching.
//
// Only the upstream half is cached. Roster matching and the "already on the
// board" check are redone every time, because those change the moment a sensei
// checks a ninja in and must never be stale.
//
// Per lambda instance, which is the right amount of reliable for a cache whose
// worst failure is doing the work it would have done anyway.
const PULL_TTL_MS = 60 * 1000;
const pullCache = new Map();

function cachedPull(locationId, date) {
  const hit = pullCache.get(`${locationId}:${date}`);
  return hit && hit.expiresAt > Date.now() ? hit.pulled : null;
}

function rememberPull(locationId, date, pulled) {
  pullCache.set(`${locationId}:${date}`, { pulled, expiresAt: Date.now() + PULL_TTL_MS });
  // The map is keyed by location and date, so it is bounded by the number of
  // centers times the days anyone looked at, but a long-lived instance should
  // not accumulate yesterday forever.
  for (const [key, value] of pullCache) {
    if (value.expiresAt <= Date.now()) pullCache.delete(key);
  }
}

function forgetPull(locationId) {
  for (const key of pullCache.keys()) {
    if (key.startsWith(`${locationId}:`)) pullCache.delete(key);
  }
}

async function markExpired(pool, id) {
  await pool.query(
    `UPDATE mystudio_connections SET status = 'expired' WHERE id = $1`,
    [id]
  );
}

// A sign-in waiting on its emailed code.
//
// This has to outlive the panel. The code arrives by email, so the flow demands
// the one thing that used to destroy it: leaving the page. The panel closes on
// an outside click, closing reset the step back to the form, and the first
// person to try it came back holding a code with nowhere to type it.
//
// So the half-finished sign-in lives in the DojoLink session instead of in
// component state, and survives closing the panel, navigating away and
// reloading. It is server side (the session table), the password inside it is
// encrypted with the same key as everything else rather than sitting in session
// JSON as plaintext, and it is thrown away the moment it is used.
const PENDING_TTL_MS = 15 * 60 * 1000;

// `cookie` is what MyStudio handed back when it sent the code. The exchange that
// follows completes the sign-in that call started, and fails without it.
function setPending(req, { email, password, cookie = '' }) {
  req.session.mystudioPending = {
    email,
    secret: ms.encryptCookie(password),
    cookie,
    locationId: req.session.activeLocationId,
    expiresAt: Date.now() + PENDING_TTL_MS,
  };
}

// Only for the center it was started for: switching centers mid-flow should not
// aim a half-finished sign-in at a different studio.
function readPending(req) {
  const pending = req.session.mystudioPending;
  if (!pending) return null;
  if (pending.locationId !== req.session.activeLocationId) return null;
  if (!pending.expiresAt || pending.expiresAt < Date.now()) return null;
  return pending;
}

function clearPending(req) {
  delete req.session.mystudioPending;
}

// GET /api/mystudio/status
router.get('/status', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const conn = await loadConnection(pool, req.session.activeLocationId);
    const pending = readPending(req);
    res.json({
      configured: ms.isConfigured(),
      ...publicShape(conn),
      // Lets the panel reopen on the code step rather than back at the form.
      awaitingCode: Boolean(pending),
      awaitingCodeEmail: pending ? pending.email : null,
    });
  } catch (err) {
    console.error('Error reading MyStudio connection:', err.message);
    res.status(500).json({ error: 'Failed to read connection' });
  }
});

// POST /api/mystudio/connect  { cookie }
router.post('/connect', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');

  if (!ms.isConfigured()) {
    return res.status(503).json({
      error: 'MyStudio is not set up on the server yet. MYSTUDIO_ENC_KEY is missing.',
    });
  }

  // The paste may be a whole cURL command, so pull the cookie out before it is
  // stored: what goes in the column has to be a usable cookie header. The limit
  // is checked after extraction for the same reason, since a cURL command is
  // much longer than the cookie inside it.
  const cookie = ms.extractCookie(req.body && req.body.cookie);
  if (!cookie || cookie.length > 8000) {
    return res.status(400).json({ error: 'Paste the MyStudio cookie to connect.' });
  }

  let session;
  try {
    session = await ms.verifySession(cookie);
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) {
      // Pass the message through. Every MyStudioAuthError message is written
      // here for the person connecting, and the useful ones say which mistake
      // was made: a request copied from the embedded chat widget rather than
      // from MyStudio, a cookie with no companyId, a paste missing the httpOnly
      // tokens. Replacing all of that with "that cookie did not work" was the
      // difference between a fixable problem and a dead end.
      return res.status(400).json({
        error: err.message || 'That cookie did not work. Copy it again, then retry.',
      });
    }
    console.error('MyStudio connect failed:', err.message);
    return res.status(502).json({ error: 'Could not reach MyStudio. Try again shortly.' });
  }

  try {
    const row = await saveConnection(pool, {
      locationId: req.session.activeLocationId,
      userId: req.session.userId,
      companyId: session.companyId,
      companyName: session.companyName,
      cookie,
      login: null,
    });
    // A new credential must not serve a pull taken with the old one.
    forgetPull(req.session.activeLocationId);
    res.status(201).json({ configured: true, ...publicShape(row) });
  } catch (err) {
    console.error('Error saving MyStudio connection:', err.message);
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

// POST /api/mystudio/login/start  { email?, password? }
//
// Asks MyStudio to email the six digit code. Both fields fall back to what was
// saved, so the everyday case is an empty body and a button.
router.post('/login/start', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');

  if (!ms.isConfigured()) {
    return res.status(503).json({
      error: 'MyStudio is not set up on the server yet. MYSTUDIO_ENC_KEY is missing.',
    });
  }

  try {
    const conn = await loadConnection(pool, req.session.activeLocationId);
    const { email, password } = loginCredentials(conn, req.body, readPending(req));
    if (!email || !password) {
      return res.status(400).json({ error: 'Enter your MyStudio email and password.' });
    }

    const started = await ms.startLogin({ email, password });
    // Only once MyStudio has actually sent the code, so a rejected password
    // does not leave a sign-in hanging around waiting for one.
    setPending(req, { email, password, cookie: started.cookie });
    res.json({ otpSent: true, email });
  } catch (err) {
    sendLoginError(res, err, 'sign-in');
  }
});

// POST /api/mystudio/login/resend  { email?, password? }
router.post('/login/resend', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const conn = await loadConnection(pool, req.session.activeLocationId);
    const { email, password } = loginCredentials(conn, req.body, readPending(req));
    if (!email || !password) {
      return res.status(400).json({ error: 'Enter your MyStudio email and password.' });
    }

    const resent = await ms.resendOtp({ email, password });
    setPending(req, { email, password, cookie: resent.cookie });
    res.json({ otpSent: true, email });
  } catch (err) {
    sendLoginError(res, err, 'code resend');
  }
});

// DELETE /api/mystudio/login/pending
//
// Backing out of a half-finished sign-in. Without this, closing the panel would
// leave it waiting and every reopen would land on the code step.
router.delete('/login/pending', requireManager, requireOwnLocation, (req, res) => {
  clearPending(req);
  res.json({ awaitingCode: false });
});

// POST /api/mystudio/login/verify  { code, email?, password? }
//
// Exchanges the code for a session and stores it. The password is written only
// once the session it produced has been proven to work, so a typo is never kept.
router.post('/login/verify', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');

  if (!ms.isConfigured()) {
    return res.status(503).json({
      error: 'MyStudio is not set up on the server yet. MYSTUDIO_ENC_KEY is missing.',
    });
  }

  // Six digits exactly. Anything else cannot be a MyStudio passcode, and
  // forwarding it would spend one of their attempts to be told so.
  const code = String((req.body && req.body.code) || '').trim();
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the six digit code MyStudio emailed you.' });
  }

  try {
    const conn = await loadConnection(pool, req.session.activeLocationId);
    const pending = readPending(req);
    const { email, password } = loginCredentials(conn, req.body, pending);
    if (!email || !password) {
      return res.status(400).json({
        error: 'That sign-in timed out. Enter your MyStudio password and ask for a new code.',
      });
    }

    let signedIn;
    let verified;
    try {
      signedIn = await ms.completeLogin({
        email,
        password,
        otpCode: code,
        // What the code request was handed back. This exchange completes the
        // sign-in that call started, and a correct code fails without it.
        cookie: pending ? pending.cookie : '',
        // Reconnecting should land on the same center the roster is matched
        // against, not on whichever one the account happens to list first.
        preferredCompanyId: conn ? conn.company_id : null,
      });
      verified = await ms.verifySession(signedIn.cookie);
    } catch (err) {
      return sendLoginError(res, err, 'code exchange');
    }

    const row = await saveConnection(pool, {
      locationId: req.session.activeLocationId,
      userId: req.session.userId,
      companyId: verified.companyId,
      companyName: verified.companyName,
      cookie: signedIn.cookie,
      login: { email, password },
    });

    // Used, so it goes. The password lives in the row now, encrypted.
    clearPending(req);

    // A new credential must not serve a pull taken with the old one.
    forgetPull(req.session.activeLocationId);
    res.status(201).json({ configured: true, ...publicShape(row) });
  } catch (err) {
    console.error('Error saving MyStudio sign-in:', err.message);
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

// DELETE /api/mystudio/login/saved
//
// Forgets the password without touching the connection. Renewals go back to
// asking for it; today's roster keeps working.
router.delete('/login/saved', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    await pool.query(
      `UPDATE mystudio_connections
          SET login_email = NULL, login_secret = NULL, login_saved_at = NULL
        WHERE location_id = $1`,
      [req.session.activeLocationId]
    );
    const conn = await loadConnection(pool, req.session.activeLocationId);
    res.json({ configured: ms.isConfigured(), ...publicShape(conn) });
  } catch (err) {
    console.error('Error clearing MyStudio sign-in:', err.message);
    res.status(500).json({ error: 'Failed to forget the saved password' });
  }
});

// DELETE /api/mystudio/connect
router.delete('/connect', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    forgetPull(req.session.activeLocationId);
    await pool.query('DELETE FROM mystudio_connections WHERE location_id = $1', [
      req.session.activeLocationId,
    ]);
    res.json({ configured: ms.isConfigured(), connected: false });
  } catch (err) {
    console.error('Error removing MyStudio connection:', err.message);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// GET /api/mystudio/today?date=YYYY-MM-DD
//
// Returns who is booked upstream, already matched against this center's roster
// and against today's board, so the client only has to render and post.
// Senseis too: knowing who is coming to the four o'clock is the whole point
// of the thing for the person actually teaching it. Reading the roster is not
// a director's privilege. Managing the connection still is, so every other
// route in this file stays requireManager.
router.get('/today', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;

  const date = req.query.date || todayDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'Invalid date' });
  }

  try {
    const conn = await loadConnection(pool, locationId);
    // Not connected is a normal state, not a failure. Centers that never
    // connect should see nothing rather than an error.
    if (!conn) return res.json({ connected: false, expected: [] });
    if (!ms.isConfigured()) {
      return res.json({ connected: true, configured: false, expected: [] });
    }
    // Enforced here rather than only hidden in the UI, so a tab left open
    // before a director switched it off cannot keep pulling.
    if (conn.feature_booked === false) {
      return res.json({ connected: true, configured: true, disabled: true, expected: [] });
    }
    // The credential states its own expiry, so a dead one is knowable here
    // rather than by asking MyStudio and being bounced to a sign-in page. Saves
    // a round trip and, more to the point, gives the board an instant and
    // correct answer instead of a spinner that resolves into a shrug.
    const expiresAt = expiryOf(conn);
    if (expiresAt && expiresAt <= new Date()) {
      if (conn.status !== 'expired') await markExpired(pool, conn.id);
      return res.json({ connected: true, status: 'expired', expiresAt: expiresAt.toISOString(), expected: [] });
    }

    // Held across the pull so any token MyStudio refreshes along the way can be
    // written back below. Without this the stored cookie stays frozen at the
    // moment it was pasted while the real session moves on without it.
    let session;

    let pulled = cachedPull(locationId, date);
    const fromCache = Boolean(pulled);

    try {
      if (!pulled) {
        session = ms.createSession(ms.decryptCookie(conn.session_cookie));
        pulled = await ms.getExpectedForDate(session, conn.company_id, date);
        rememberPull(locationId, date, pulled);
      }
    } catch (err) {
      if (err instanceof ms.MyStudioAuthError) {
        await markExpired(pool, conn.id);
        return res.json({ connected: true, status: 'expired', expected: [] });
      }
      console.error('MyStudio pull failed:', err.message);
      return res.status(502).json({ error: 'Could not reach MyStudio. Try again shortly.' });
    }

    // One pass over this center's active roster, rather than a query per kid.
    const { rows: students } = await pool.query(
      `SELECT id, full_name, mystudio_participant_id
         FROM students
        WHERE location_id = $1 AND active = true`,
      [locationId]
    );

    const byParticipantId = new Map();
    const byName = new Map();
    for (const s of students) {
      if (s.mystudio_participant_id) {
        byParticipantId.set(String(s.mystudio_participant_id), s);
      }
      const key = String(s.full_name || '').trim().toLowerCase();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(s);
    }

    const studentIds = students.map((s) => s.id);

    // Programs each ninja is actually enrolled in. POST /api/daily rejects a
    // check-in for a program the ninja is not enrolled in, so a program the
    // roster claims but DojoLink does not know about is downgraded to a generic
    // check-in instead of being sent and failing.
    const enrolled = new Map();
    // Ninjas already on today's board, so a suggestion is never a duplicate.
    const onBoard = new Set();
    if (studentIds.length) {
      const [{ rows: programRows }, { rows: boardRows }] = await Promise.all([
        pool.query(
          'SELECT student_id, program FROM student_programs WHERE student_id = ANY($1::int[])',
          [studentIds]
        ),
        pool.query(
          `SELECT DISTINCT student_id FROM daily_assignments
            WHERE session_date = $1 AND student_id = ANY($2::int[])`,
          [date, studentIds]
        ),
      ]);
      for (const r of programRows) {
        if (!enrolled.has(r.student_id)) enrolled.set(r.student_id, new Set());
        enrolled.get(r.student_id).add(r.program);
      }
      for (const r of boardRows) onBoard.add(r.student_id);
    }

    const expected = pulled.expected.map((row) => {
      let student = byParticipantId.get(row.participantId) || null;
      let matchStatus = student ? 'linked' : null;

      if (!student) {
        const candidates = byName.get(row.fullName.toLowerCase()) || [];
        if (candidates.length === 1) {
          student = candidates[0];
          matchStatus = 'name';
        } else if (candidates.length > 1) {
          matchStatus = 'ambiguous';
        } else {
          matchStatus = 'unknown';
        }
      }

      const program =
        student && row.program && enrolled.get(student.id)?.has(row.program)
          ? row.program
          : null;

      return {
        participantId: row.participantId,
        fullName: row.fullName,
        rankName: row.rankName,
        className: row.className,
        startTime: row.startTime,
        checkedInUpstream: row.checkedInUpstream,
        match: matchStatus,
        studentId: student ? student.id : null,
        studentName: student ? student.full_name : null,
        program,
        alreadyOnBoard: student ? onBoard.has(student.id) : false,
      };
    });

    // A cached read did not touch MyStudio, so it is not evidence the session is
    // still good and must not restamp last_verified_at.
    if (fromCache) {
      return res.json({
        connected: true,
        configured: true,
        status: 'connected',
        companyName: conn.company_name,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        date: pulled.date,
        classCount: pulled.classCount,
        bookedClassCount: pulled.bookedClassCount,
        expected,
      });
    }

    // Fold a refreshed cookie into the same statement rather than adding a round
    // trip, and only when one actually arrived, so an ordinary pull stays a
    // timestamp update.
    if (session.rotated) {
      await pool.query(
        `UPDATE mystudio_connections
            SET last_synced_at = now(), last_verified_at = now(),
                status = 'connected', session_cookie = $2
          WHERE id = $1`,
        [conn.id, ms.encryptCookie(session.cookie)]
      );
    } else {
      await pool.query(
        `UPDATE mystudio_connections
            SET last_synced_at = now(), last_verified_at = now(), status = 'connected'
          WHERE id = $1`,
        [conn.id]
      );
    }

    res.json({
      connected: true,
      configured: true,
      status: 'connected',
      companyName: conn.company_name,
      // Recomputed: a rotation would have moved it, and this is the response
      // the board decides on.
      expiresAt: (session.rotated ? ms.readCookieExpiry(session.cookie) : expiresAt)?.toISOString() || null,
      date: pulled.date,
      classCount: pulled.classCount,
      bookedClassCount: pulled.bookedClassCount,
      expected,
    });
  } catch (err) {
    console.error('Error building MyStudio roster:', err.message);
    res.status(500).json({ error: 'Failed to load the MyStudio roster' });
  }
});

// Same tolerant belt parse the CSV import uses, so a rank string resolves to
// the same belt whichever way a roster arrives. Longest names first so a partial
// substring cannot win.
const BELT_NAMES = [
  'Platinum', 'Bronze', 'Silver', 'Yellow', 'Orange', 'Purple',
  'Brown', 'Green', 'Black', 'White', 'Blue', 'Gold', 'Red',
];

function parseBeltName(raw) {
  if (!raw) return null;
  const text = String(raw).toLowerCase();
  return BELT_NAMES.find((name) => text.includes(name.toLowerCase())) || null;
}

// PATCH /api/mystudio/features  { booked?, import? }
//
// Which parts of a connection are live at this center. Separate from the user's
// own experimental toggle, which answers whether somebody wants to see
// in-progress work at all; these answer whether a piece is trusted enough to
// leave switched on here, and one director's answer applies to their center.
router.patch('/features', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const body = req.body || {};

  const updates = [];
  const values = [req.session.activeLocationId];
  for (const [key, column] of [['booked', 'feature_booked'], ['import', 'feature_import']]) {
    if (typeof body[key] !== 'boolean') continue;
    values.push(body[key]);
    updates.push(`${column} = $${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'Nothing to change.' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE mystudio_connections SET ${updates.join(', ')} WHERE location_id = $1`,
      values
    );
    if (!rowCount) {
      return res.status(400).json({ error: 'This center is not connected to MyStudio.' });
    }

    // A switched-off feature must stop immediately, not in up to a minute.
    forgetPull(req.session.activeLocationId);

    const conn = await loadConnection(pool, req.session.activeLocationId);
    res.json({ configured: ms.isConfigured(), ...publicShape(conn) });
  } catch (err) {
    console.error('Error updating MyStudio features:', err.message);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// POST /api/mystudio/import   { dryRun } | { belt_ids, enroll_ids }
//
// Pulls this center's member list from MyStudio and adds the ninjas DojoLink
// does not have yet.
//
// Additive by default and by design. It never archives, never deactivates, and
// never edits a ninja who already exists — the CSV import proposes archiving
// everyone absent from the file, and a live pull that did the same would empty a
// roster the first time MyStudio had a bad day. Changes to existing ninjas are
// listed and applied only for the ids the director ticks.
//
// Two passes, like the CSV import: dryRun classifies and rolls back, then the
// same classification runs again for real. The preview has to be built from the
// same code that does the work, or it is a description of something else.
router.post('/import', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;
  const dryRun = req.body && req.body.dryRun === true;

  // Ids the director ticked in the preview. Empty on a dry run, and empty means
  // nothing existing is touched.
  const beltIds = new Set((req.body && req.body.belt_ids) || []);
  const enrollIds = new Set((req.body && req.body.enroll_ids) || []);
  const detailIds = new Set((req.body && req.body.detail_ids) || []);
  // Which of the new ninjas to actually create. Absent means all of them, so
  // a caller that does not care still works; an empty array means none, which
  // is a director having unticked every one and must not be read as all.
  const addIds = Array.isArray(req.body && req.body.add_ids)
    ? new Set(req.body.add_ids.map(String))
    : null;

  const date = todayDate();

  try {
    const conn = await loadConnection(pool, locationId);
    if (!conn) return res.status(400).json({ error: 'This center is not connected to MyStudio.' });
    if (!ms.isConfigured()) {
      return res.status(503).json({ error: 'MyStudio is not set up on the server yet.' });
    }
    if (conn.feature_import === false) {
      return res.status(403).json({ error: 'The MyStudio roster import is switched off for this center.' });
    }

    let members;
    try {
      const session = ms.createSession(ms.decryptCookie(conn.session_cookie));
      members = await ms.getCenterRoster(session, conn.company_id, date);
    } catch (err) {
      if (err instanceof ms.MyStudioAuthError) {
        await markExpired(pool, conn.id);
        return res.status(400).json({ error: 'The MyStudio session ran out. Sign in again first.' });
      }
      console.error('MyStudio roster pull failed:', err.message);
      return res.status(502).json({ error: err.message || 'Could not reach MyStudio.' });
    }

    // The center's ninjas, by upstream id and by name, in one pass.
    const { rows: students } = await pool.query(
      `SELECT s.id, s.full_name, s.mystudio_participant_id,
              s.birthday, s.parent_name, s.parent_email, s.parent_phone,
              COALESCE(
                json_agg(json_build_object('program', sp.program, 'belt', sp.belt_level))
                  FILTER (WHERE sp.program IS NOT NULL),
                '[]'
              ) AS programs
         FROM students s
         LEFT JOIN student_programs sp ON sp.student_id = s.id
        WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1) AND s.active = true
        GROUP BY s.id`,
      [locationId]
    );

    const byParticipantId = new Map();
    const byName = new Map();
    for (const s of students) {
      if (s.mystudio_participant_id) byParticipantId.set(String(s.mystudio_participant_id), s);
      const key = String(s.full_name || '').trim().toLowerCase();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(s);
    }

    const toAdd = [];
    const linkTargets = [];
    const beltChanges = [];
    const newEnrollments = [];
    const detailFills = [];
    const unchanged = [];
    const ambiguous = [];

    for (const member of members) {
      const program = ms.programForMembership(member.membershipTitle, member.categoryTitle);
      const belt = parseBeltName(member.rankName);

      const linked = byParticipantId.get(member.participantId);
      const named = byName.get(member.fullName.toLowerCase()) || [];

      // Two ninjas with one name cannot be told apart from here, and picking one
      // would attach a stranger's upstream id to a child's record.
      if (!linked && named.length > 1) {
        ambiguous.push({ participant_id: member.participantId, full_name: member.fullName });
        continue;
      }

      const student = linked || named[0] || null;

      if (!student) {
        toAdd.push({
          participant_id: member.participantId,
          full_name: member.fullName,
          program,
          belt,
          membership: member.membershipTitle,
          // Not sent to the client. See the note on the preview below.
          _details: {
            birthday: member.birthday,
            parent_name: member.parentName,
            parent_email: member.parentEmail,
            parent_phone: member.parentPhone,
          },
        });
        continue;
      }

      // Whoever this member turned out to be, remember which upstream row
      // they are, so the next pull does not have to match on a name again.
      linkTargets.push({ id: student.id, participant_id: member.participantId });

      // Blanks MyStudio can fill. Only blanks: a value already in DojoLink was
      // put there by somebody at this center and is not ours to replace.
      const fillable = {};
      if (!student.birthday && member.birthday) fillable.birthday = member.birthday;
      if (!student.parent_name && member.parentName) fillable.parent_name = member.parentName;
      if (!student.parent_email && member.parentEmail) fillable.parent_email = member.parentEmail;
      if (!student.parent_phone && member.parentPhone) fillable.parent_phone = member.parentPhone;

      if (Object.keys(fillable).length) {
        detailFills.push({
          id: student.id,
          full_name: student.full_name,
          // The names of the fields, never the values. A preview does not need
          // to quote a child's date of birth back over the wire to say it found
          // one, and this response goes to a browser.
          fields: Object.keys(fillable),
          _values: fillable,
        });
      }

      const enrolled = (student.programs || []).find((p) => p.program === program);

      if (program && !enrolled) {
        newEnrollments.push({
          id: student.id,
          participant_id: member.participantId,
          full_name: student.full_name,
          program,
          belt,
        });
      } else if (program && enrolled && belt && enrolled.belt !== belt) {
        beltChanges.push({
          id: student.id,
          participant_id: member.participantId,
          full_name: student.full_name,
          program,
          current_belt: enrolled.belt || null,
          new_belt: belt,
        });
      } else {
        unchanged.push({ id: student.id, full_name: student.full_name });
      }
    }

    if (dryRun) {
      return res.json({
        preview: true,
        date,
        member_count: members.length,
        // _details and _values never leave the server.
        to_add: toAdd.map(({ _details, ...row }) => ({
          ...row,
          fills: Object.entries(_details)
            .filter(([, value]) => value)
            .map(([field]) => field),
        })),
        belt_changes: beltChanges,
        new_enrollments: newEnrollments,
        detail_fills: detailFills.map(({ _values, ...row }) => row),
        unchanged_count: unchanged.length,
        ambiguous,
      });
    }

    const client = await pool.connect();
    let added = 0;
    let enrolled = 0;
    let belted = 0;
    let filled = 0;
    let linkedCount = 0;

    try {
      await client.query('BEGIN');

      for (const row of toAdd) {
        if (addIds && !addIds.has(String(row.participant_id))) continue;
        const { rows: inserted } = await client.query(
          `INSERT INTO students
             (full_name, location_id, mystudio_participant_id,
              birthday, parent_name, parent_email, parent_phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            row.full_name,
            locationId,
            row.participant_id,
            row._details.birthday,
            row._details.parent_name,
            row._details.parent_email,
            row._details.parent_phone,
          ]
        );
        await addMembership(client, inserted[0].id, locationId, req.session.userId);
        added += 1;

        // A ninja with no resolvable program is still worth having. The director
        // enrols them in ten seconds; a guessed program is wrong for a term.
        if (row.program) {
          await client.query(
            `INSERT INTO student_programs (student_id, program, belt_level, belt_sublevel)
             VALUES ($1, $2, $3, $4) ON CONFLICT (student_id, program) DO NOTHING`,
            [inserted[0].id, row.program, row.belt, row.belt ? 1 : null]
          );
        }
      }

      // Only what was ticked.
      for (const row of newEnrollments) {
        if (!enrollIds.has(row.id)) continue;
        await client.query(
          `INSERT INTO student_programs (student_id, program, belt_level, belt_sublevel)
           VALUES ($1, $2, $3, $4) ON CONFLICT (student_id, program) DO NOTHING`,
          [row.id, row.program, row.belt, row.belt ? 1 : null]
        );
        enrolled += 1;
      }

      // Ticked only, and COALESCE so a value somebody typed here always wins
      // over the one upstream. This can fill a blank and can never overwrite.
      for (const row of detailFills) {
        if (!detailIds.has(row.id)) continue;
        const v = row._values;
        await client.query(
          `UPDATE students
              SET birthday = COALESCE(birthday, $2),
                  parent_name = COALESCE(NULLIF(parent_name, ''), $3),
                  parent_email = COALESCE(NULLIF(parent_email, ''), $4),
                  parent_phone = COALESCE(NULLIF(parent_phone, ''), $5)
            WHERE id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $6)`,
          [row.id, v.birthday || null, v.parent_name || null, v.parent_email || null, v.parent_phone || null, locationId]
        );
        filled += 1;
      }

      for (const row of beltChanges) {
        if (!beltIds.has(row.id)) continue;
        // Scoped to the one program, and the sublevel resets, exactly as the CSV
        // import's belt override does.
        await client.query(
          `UPDATE student_programs SET belt_level = $1, belt_sublevel = 1
            WHERE student_id = $2 AND program = $3`,
          [row.new_belt, row.id, row.program]
        );
        belted += 1;
      }

      // Remembering the upstream id is plumbing, not a change to a ninja: it is
      // an internal mapping nobody sees, and it is what stops every later pull
      // guessing from a name.
      for (const row of linkTargets) {
        if (!row.participant_id || !row.id) continue;
        const { rowCount } = await client.query(
          `UPDATE students SET mystudio_participant_id = $1
            WHERE id = $2 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $3) AND mystudio_participant_id IS DISTINCT FROM $1`,
          [row.participant_id, row.id, locationId]
        );
        linkedCount += rowCount;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      added,
      enrolled,
      belts_changed: belted,
      details_filled: filled,
      linked: linkedCount,
      member_count: members.length,
    });
  } catch (err) {
    console.error('MyStudio roster import failed:', err.message);
    res.status(500).json({ error: 'Failed to import the MyStudio roster' });
  }
});

// POST /api/mystudio/link  { participant_id, student_id }
//
// Promotes an accepted name match to a durable id so later pulls stop guessing.
router.post('/link', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const participantId = String((req.body && req.body.participant_id) || '').trim();
  const studentId = Number(req.body && req.body.student_id);

  if (!participantId || participantId.length > 64 || !Number.isInteger(studentId)) {
    return res.status(400).json({ error: 'participant_id and student_id are required' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE students SET mystudio_participant_id = $1
        WHERE id = $2 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $3) AND active = true`,
      [participantId, studentId, req.session.activeLocationId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Ninja not found at this location' });
    res.json({ linked: true });
  } catch (err) {
    console.error('Error linking MyStudio participant:', err.message);
    res.status(500).json({ error: 'Failed to link ninja' });
  }
});

module.exports = router;
