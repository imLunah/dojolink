const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Skin tones for the ninja art. Must match the students.ninja_skin_tone CHECK
// and NINJA_TONES in client/src/utils/ninjas.js.
const NINJA_TONES = ['light', 'medium', 'dark'];
const { requireParent } = require('../middleware/auth');
const { DELETION_REASONS, cleanDetails } = require('../lib/deleteStaffUser');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Matches the staff-side pinned-note ceiling in students.js.
const MAX_INSTRUCTIONS = 2000;

const RELATIONSHIPS = ['Mom', 'Dad', 'Guardian', 'Grandparent', 'Other'];

// The version a parent is agreeing to, recorded with their acceptance.
//
// It is the "Last Updated" line on /terms and /privacy, and it lives on the
// SERVER on purpose: the client says "I agree", the server decides what it is
// they agreed to. A version posted by the browser would be a consent record
// the consenting party wrote. Bump this when those pages change, and the old
// value is what tells you who has not seen the new one.
const TERMS_VERSION = '2026-05-21';

// What the client knows about the signed-in parent. A parent_profiles row is
// what onboarding writes, and having one is what "onboarded" means; without
// one the payload carries what the desk has on file as a starting point for
// the form (the name and phone typed onto a ninja's record), and the portal
// sends them to /parent/welcome. Called by login, /me and the profile save so
// the three never disagree about the shape.
async function parentPayload(pool, session) {
  const email = session.parentEmail;
  // The center code is the other half of how a parent signs in; it prints on
  // the back of their family pass so it is somewhere they can find it again.
  const { rows: [loc] } = await pool.query('SELECT center_code, address FROM locations WHERE id = $1', [session.parentLocationId]);
  const base = {
    email,
    role: 'parent',
    centerName: session.parentLocationName || null,
    centerCode: loc?.center_code || null,
    // Null until a director fills it in. Every reader falls back to the
    // center's name, so an empty one is a slightly worse map pin and not a
    // missing feature.
    centerAddress: loc?.address || null,
  };
  const { rows: [profile] } = await pool.query(
    'SELECT first_name, last_name, phone, relationship, terms_accepted_at, terms_version FROM parent_profiles WHERE email = $1',
    [email]
  );
  // The phone is the desk's, off the ninja's record: onboarding does not ask
  // for it, since the center already has it.
  const { rows: [onFile] } = await pool.query(
    `SELECT parent_name, parent_phone FROM students
      WHERE LOWER(parent_email) = $1 AND active = true
        AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)
      ORDER BY (parent_phone IS NULL), (parent_name IS NULL), id
      LIMIT 1`,
    [email, session.parentLocationId]
  );
  const phone = onFile?.parent_phone || null;
  if (profile) {
    return {
      ...base,
      onboarded: true,
      parentName: `${profile.first_name} ${profile.last_name}`.trim(),
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone,
      relationship: profile.relationship,
      // Null for anyone who onboarded before acceptance was recorded. The
      // portal does not gate on this today; it is here so it can.
      termsAcceptedAt: profile.terms_accepted_at,
      termsVersion: profile.terms_version,
    };
  }
  return {
    ...base,
    onboarded: false,
    parentName: onFile?.parent_name || null,
    phone,
    prefill: { name: onFile?.parent_name || '' },
  };
}

function cleanText(v, max) {
  return String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

const STUDENT_PROGRAMS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(
      json_build_object(
        'id', sp.id,
        'program', sp.program,
        'belt_level', sp.belt_level,
        'belt_sublevel', sp.belt_sublevel,
        'current_project', sp.current_project,
        'project_status', sp.project_status,
        'last_session_date', sp.last_session_date,
        'last_sub_program', sp.last_sub_program,
        'last_module_name', sp.last_module_name,
        'percent_complete', sp.percent_complete
      ) ORDER BY sp.created_at
    ) FROM student_programs sp WHERE sp.student_id = s.id),
    '[]'::json
  ) AS programs
`;

// What Home shows for each child without opening them: the last handful of
// sessions (with the sensei's display name, which is what the child calls
// them), the last few club days, and which days this week they were checked in.
// The full history is on the child's own route; this is the glance.
const RECENT_SESSIONS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(r ORDER BY r.session_date DESC, r.created_at DESC) FROM (
      SELECT pl.session_date, pl.created_at, pl.program, pl.sub_program, pl.module_name, pl.lesson_name,
             pl.belt_level_at, pl.belt_sublevel_at, pl.project_at, pl.status_at,
             u.display_name AS sensei_name
        FROM progress_logs pl
        LEFT JOIN users u ON u.id = pl.sensei_id
       WHERE pl.student_id = s.id AND pl.notes IS DISTINCT FROM 'Marked complete from roadmap'
       ORDER BY pl.session_date DESC, pl.created_at DESC
       LIMIT 6
    ) r),
    '[]'::json
  ) AS recent_sessions
`;

const RECENT_CLUBS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(c ORDER BY c.session_date DESC) FROM (
      SELECT cs.club_name, cs.session_date
        FROM club_attendees ca
        JOIN club_sessions cs ON cs.id = ca.club_session_id
       WHERE ca.student_id = s.id
       ORDER BY cs.session_date DESC
       LIMIT 3
    ) c),
    '[]'::json
  ) AS recent_clubs
`;


// POST /api/parent/login
// Center code first, then the email.
//
// There is no password here and there never has been: knowing an address that
// appears in students.parent_email was, on its own, full access to that child's
// record. The code is therefore not "an extra layer" on a credential, it is the
// second half of the only one. It is not a secret either — it goes on a flyer
// and into a group chat — but it means a harvested address is useless without
// knowing which center it belongs to, and that one center's parents cannot
// probe another's.
//
// It also fixes something quieter. The lookup used to run across every student
// row in the database, so a parent with children at two centers got both at
// once with no way to say which they meant, and a deactivated center's parents
// carried on regardless. The session now carries a center, and every route
// below is scoped to it.
router.post('/login', loginLimiter, async (req, res) => {
  const pool = req.app.get('db');
  const email = String((req.body && req.body.email) || '').trim();
  const centerCode = String((req.body && req.body.centerCode) || '').trim().toUpperCase();

  if (!centerCode || !email) {
    return res.status(400).json({ error: 'Center code and email are required.' });
  }

  try {
    const { rows: centers } = await pool.query(
      'SELECT id, name FROM locations WHERE UPPER(center_code) = $1 AND active = true',
      [centerCode]
    );

    // One message for a wrong code and a wrong email, deliberately. Telling
    // somebody the code was right narrows the guess for them.
    const denied = { error: 'That center code and email do not match an account.' };
    if (!centers.length) return res.status(401).json(denied);

    const center = centers[0];
    const { rows } = await pool.query(
      `SELECT parent_name FROM students
        WHERE LOWER(parent_email) = LOWER($1) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2) AND active = true
        LIMIT 1`,
      [email, center.id]
    );
    if (!rows.length) return res.status(401).json(denied);

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.parentEmail = email.toLowerCase();
    req.session.role = 'parent';
    req.session.parentLocationId = center.id;
    req.session.parentLocationName = center.name;
    const payload = await parentPayload(pool, req.session);
    req.session.parentName = payload.parentName;
    // Same rule as staff: thirty days when asked for, otherwise the cookie
    // dies with the browser. A family checking progress on a shared tablet
    // is exactly who should be able to say no to this.
    req.session.cookie.maxAge = req.body && req.body.keep_signed_in
      ? 30 * 24 * 60 * 60 * 1000
      : null;

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.json(payload);
  } catch (err) {
    console.error('Parent login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/parent/me
router.get('/me', async (req, res) => {
  // A session made before centers existed has no location and cannot be scoped,
  // so it is treated as signed out rather than silently given the old
  // cross-center reach.
  if (!req.session.parentEmail || !req.session.parentLocationId) return res.json(null);
  try {
    const payload = await parentPayload(req.app.get('db'), req.session);
    req.session.parentName = payload.parentName;
    res.json(payload);
  } catch (err) {
    console.error('Parent me error:', err);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

// POST /api/parent/profile — onboarding's save and the settings page's, the
// only write to a parent's own record. First and last name are required,
// relationship optional. Phone is not asked for: the center already has it
// on the ninja's record, and that copy is what the pass prints.
//
// Email is the parent's sign-in identity and lives on every ninja's record,
// so changing it moves those records too, in one transaction: the ninja rows
// carrying the old address, the profile row, and the session. An address
// already on another family's records is refused outright — accepting it
// would hand this parent that family's ninjas at the next sign-in, and hand
// that family these.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
router.post('/profile', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const body = req.body || {};
  const firstName = cleanText(body.first_name, 60);
  const lastName = cleanText(body.last_name, 60);
  const relationship = RELATIONSHIPS.includes(body.relationship) ? body.relationship : null;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Please enter your first and last name.' });

  const oldEmail = req.session.parentEmail;
  const newEmail = body.email === undefined ? oldEmail : cleanText(body.email, 254).toLowerCase();
  const emailChanging = newEmail !== oldEmail;
  if (emailChanging && !EMAIL_RE.test(newEmail)) return res.status(400).json({ error: 'That email address does not look right.' });

  // Agreeing to the Terms is part of CREATING the account, not of editing it.
  // Onboarding is the only path that reaches this route without a profile row,
  // so "no row yet" is the same question as "is this the first sign-in", and
  // it is asked of the database rather than of a flag the client sends. The
  // settings page saves through this same route and must keep working without
  // re-asking, which is why the check is on the row and not on the body.
  const { rows: existing } = await pool.query(
    'SELECT terms_accepted_at FROM parent_profiles WHERE email = $1',
    [oldEmail]
  );
  const firstSave = existing.length === 0;
  if (firstSave && body.accepted_terms !== true) {
    return res.status(400).json({ error: 'Please agree to the Terms and Privacy Policy to finish setting up your account.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (emailChanging) {
      const { rows: taken } = await client.query(
        `SELECT 1 FROM students WHERE LOWER(parent_email) = $1
         UNION ALL
         SELECT 1 FROM parent_profiles WHERE email = $1
         LIMIT 1`,
        [newEmail]
      );
      if (taken.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: "That email is already on another family's account. Ask the front desk if it should be yours." });
      }
      await client.query('UPDATE students SET parent_email = $1 WHERE LOWER(parent_email) = $2', [newEmail, oldEmail]);
      await client.query('UPDATE parent_profiles SET email = $1, updated_at = now() WHERE email = $2', [newEmail, oldEmail]);
    }
    // COALESCE on both consent columns, and it is the whole safety of this
    // write: an acceptance is stamped once and never moved. A parent editing
    // their name in settings sends no `accepted_terms`, and without COALESCE
    // the upsert would blank the date they actually agreed on; re-stamping it
    // with now() would be just as wrong, since it would record a consent that
    // never happened. Keep what is there, fill it only when it is empty.
    await client.query(
      `INSERT INTO parent_profiles (email, first_name, last_name, relationship, terms_accepted_at, terms_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
         SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
             relationship = EXCLUDED.relationship, updated_at = now(),
             terms_accepted_at = COALESCE(parent_profiles.terms_accepted_at, EXCLUDED.terms_accepted_at),
             terms_version = COALESCE(parent_profiles.terms_version, EXCLUDED.terms_version)`,
      [
        newEmail, firstName, lastName, relationship,
        body.accepted_terms === true ? new Date() : null,
        body.accepted_terms === true ? TERMS_VERSION : null,
      ]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Parent profile error:', err);
    return res.status(500).json({ error: 'Failed to save your profile' });
  } finally {
    client.release();
  }

  try {
    req.session.parentEmail = newEmail;
    const payload = await parentPayload(pool, req.session);
    req.session.parentName = payload.parentName;
    await new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    res.json(payload);
  } catch (err) {
    console.error('Parent profile error:', err);
    res.status(500).json({ error: 'Failed to save your profile' });
  }
});

// POST /api/parent/delete-account — a parent deletes their own account.
//
// Center code and email again, typed, as the confirmation: a parent has no
// password, and these two are the whole of how they sign in. What goes is
// the parent's own data: the profile row, and their name, email, phone and
// the note they wrote for senseis, off every ninja record that carried
// their address — at every center, since the address is the identity. The
// ninjas' own records (belts, classes, progress) belong to the center and
// stay. With no email left on the records there is nothing to sign in with,
// which is the point. Only the reason survives, in account_deletions,
// without a name on it.
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});
router.post('/delete-account', requireParent, deleteLimiter, async (req, res) => {
  const pool = req.app.get('db');
  const { centerCode, email, reason, details } = req.body || {};
  if (!centerCode || !email) return res.status(400).json({ error: 'Enter your center code and email to confirm.' });
  if (!DELETION_REASONS.includes(reason)) return res.status(400).json({ error: 'Choose a reason.' });

  try {
    const { rows: [loc] } = await pool.query('SELECT center_code FROM locations WHERE id = $1', [req.session.parentLocationId]);
    const codeOk = loc && String(centerCode).trim().toUpperCase() === String(loc.center_code).toUpperCase();
    const emailOk = String(email).trim().toLowerCase() === req.session.parentEmail;
    if (!codeOk || !emailOk) return res.status(401).json({ error: "That center code and email don't match this account." });

    const parentEmail = req.session.parentEmail;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO account_deletions (role, location_id, reason, details) VALUES ($1, $2, $3, $4)',
        ['parent', req.session.parentLocationId, reason, cleanDetails(details)]
      );
      await client.query('DELETE FROM parent_profiles WHERE email = $1', [parentEmail]);
      await client.query(
        `UPDATE students
            SET parent_email = NULL, parent_name = NULL, parent_phone = NULL, special_instructions = NULL
          WHERE LOWER(parent_email) = $1`,
        [parentEmail]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    req.session.destroy(() => res.json({ ok: true }));
  } catch (err) {
    console.error('Parent delete account error:', err);
    res.status(500).json({ error: 'Failed to delete your account' });
  }
});

// POST /api/parent/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// The fields a family is allowed to see of a listing. No `published`, no
// `created_by`, no timestamps: a parent gets the poster, not the record.
//
// to_char keeps event_date a plain YYYY-MM-DD — a raw pg DATE serializes as a
// UTC-midnight ISO string, which reads back a day early in western timezones.
const LISTING_FIELDS = `
  l.id, l.title, l.subtitle, l.description, l.event_url, l.image_url, l.event_time,
  to_char(l.event_date, 'YYYY-MM-DD') AS event_date
`;

// GET /api/parent/events?today=YYYY-MM-DD&limit=N — the center's published
// event listings: authored for families on the manager Events page, unlike
// calendar events, which are staff-facing. Dated listings come soonest first
// and drop off once their day passes; undated ones are evergreen and follow
// by recency. `today` is the parent's local date: the server clock is UTC,
// which is already tomorrow every California evening, and an event must stay
// visible for the whole of its own evening. A bad or missing value falls back
// to the server's date — the parent can only widen or narrow which PUBLISHED
// listings they see, nothing else.
//
// `limit` is for the two callers, not for the caller's convenience: the home
// billboard rotates through a handful and takes the default 6, the Events
// page is the complete list and asks for more. Clamped rather than trusted,
// because it is a page-size knob on a query with no cursor.
const MAX_LISTINGS = 50;
router.get('/events', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || '')) ? req.query.today : null;
  const asked = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), MAX_LISTINGS) : 6;
  try {
    const { rows } = await pool.query(`
      SELECT ${LISTING_FIELDS}
      FROM event_listings l
      WHERE l.location_id = $1 AND l.published = true
        AND (l.event_date IS NULL OR l.event_date >= COALESCE($2::date, CURRENT_DATE))
      ORDER BY l.event_date ASC NULLS LAST, l.created_at DESC
      LIMIT $3
    `, [req.session.parentLocationId, today, limit]);
    res.json(rows);
  } catch (err) {
    console.error('Parent events error:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// GET /api/parent/events/:id — one listing, for its own page.
//
// Scoped to the parent's own center and to published rows, the same two
// conditions as the list: an id is guessable, and without them this would
// hand any signed-in parent every center's drafts.
//
// It deliberately does NOT filter on the date. The list drops a listing the
// day after it happens, but a link to one that has passed should still open
// and say so rather than 404 — a parent following a link from a message sent
// last week is not a lost page, and the page prints "This event has passed"
// off the date it gets back.
router.get('/events/:id', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Event not found' });
  try {
    const { rows } = await pool.query(`
      SELECT ${LISTING_FIELDS}
      FROM event_listings l
      WHERE l.id = $1 AND l.location_id = $2 AND l.published = true
    `, [id, req.session.parentLocationId]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Parent event error:', err);
    res.status(500).json({ error: 'Failed to load the event' });
  }
});

// GET /api/parent/schedule?today=YYYY-MM-DD
//
// How busy the center is, for the week around `today`: every check-in at the
// center (not just this family's) bucketed by the FIVE MINUTES it happened
// in, as minutes since midnight. Counts only, no names.
//
// Five minutes rather than the hour it used to be, because a check-in is an
// hour of a ninja in the building and an hourly bucket cannot say when that
// hour ends. At 4:21 the ninjas who arrived at half three are still here, and
// the old shape had already filed them under 3 and moved on. Minutes let the
// client work out who is actually in the room; five of them is fine enough to
// do that and coarse enough that this never reports the exact moment a named
// child walked in.
//
// Hours are read in the centers' own zone. All three are in California and
// the server clock is UTC, so without the conversion a 4 PM arrival would
// report as 11 PM. `today` is the parent's local date for the same reason
// as /events: the server's CURRENT_DATE is already tomorrow every evening.
//
// daily_assignments has no location: a ninja's check-in is attributed to the
// centers they belong to, which double-counts the rare ninja at two centers.
// How long one check-in keeps a ninja in the building.
//
// It is here for ONE reason: to recognise the same ninja checked in twice.
// `daily_assignments` collects duplicates — Joah park has two rows twelve
// minutes apart, Alexander Tehuitzil two in the same minute, student 149 two
// one second apart — and every one of them made the chart draw a body that was
// not in the room. A second check-in arriving while the first stay is still
// running is the same child, so it is dropped; one far enough after it that the
// first stay is over is a genuine second visit and is kept.
//
// It is NOT the chart's stay length. The client owns that (STAY_MIN in
// ParentHome), and the two happening to agree at sixty minutes is a
// coincidence of the same fact, not a constant shared across the wire. If the
// chart ever draws a different stay, this number does not follow it: the
// question here is only "is this the same arrival twice".
const STAY_MIN = 60;
const CENTER_TZ = 'America/Los_Angeles';
router.get('/schedule', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || '')) ? req.query.today : null;
  try {
    const { rows } = await pool.query(`
      WITH wk AS (SELECT date_trunc('week', COALESCE($2::date, CURRENT_DATE))::date AS start),
      ins AS (
        SELECT da.student_id, da.session_date,
               (EXTRACT(HOUR FROM (da.checked_in_at AT TIME ZONE $3))::int * 60
                 + EXTRACT(MINUTE FROM (da.checked_in_at AT TIME ZONE $3))::int) AS at_min
        FROM daily_assignments da, wk
        WHERE da.session_date >= wk.start AND da.session_date < wk.start + 7
          AND da.checked_in_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = da.student_id AND sl.location_id = $1)
      ),
      spaced AS (
        SELECT ins.*, LAG(at_min) OVER (PARTITION BY student_id, session_date ORDER BY at_min) AS prev
        FROM ins
      )
      SELECT to_char(wk.start, 'YYYY-MM-DD') AS week_start,
             to_char(spaced.session_date, 'YYYY-MM-DD') AS day,
             FLOOR(spaced.at_min / 5)::int * 5 AS minute,
             COUNT(*)::int AS count
      FROM spaced, wk
      WHERE prev IS NULL OR at_min - prev >= $4
      GROUP BY 1, 2, 3
      ORDER BY 2, 3
    `, [req.session.parentLocationId, today, CENTER_TZ, STAY_MIN]);
    res.json({ slots: rows.map(({ day, minute, count }) => ({ day, minute, count })) });
  } catch (err) {
    console.error('Parent schedule error:', err);
    res.status(500).json({ error: 'Failed to load schedule' });
  }
});

// GET /api/parent/sticker-rarity
//
// Where every CREATE ninja is standing on the belt ladder, as a histogram of
// (belt, level) -> how many are there. The sticker book turns that into a
// rarity for each sticker: a sticker is rare when few ninjas have walked past
// the level it celebrates.
//
// The counting itself stays on the client, because the two things it needs are
// already there and nowhere else: the belt order (utils/beltConfig) and which
// levels each sticker covers (lib/createStickers). This route knows nothing
// about stickers, so adding one never means touching it.
//
// Every active CREATE ninja, all centers, not just the parent's. "How rare is
// this sticker" is a question about the whole dojo, and one center on its own
// has too few Brown belts to divide into four tiers without the answer
// flipping week to week. Counts only: no names, no ids, nothing that resolves
// to a child, and the totals are never sent as raw numbers to the page (the
// book prints a percentage).
//
// THE OTHER PROGRAMS RIDE ALONG. Their stickers are earned per lesson and per
// module rather than off a belt ladder, so their half of the payload is a
// different shape: how many active ninjas are enrolled in each program (the
// cohort a rarity is measured against), how many distinct ninjas have each
// lesson logged Completed, and how many have completed EVERY curriculum
// lesson of each module. The module count has to be computed here — it is a
// per-ninja AND across lessons, which per-lesson counts cannot reconstruct.
// Roadmap bulk-marks count, the same way they count toward earning the
// sticker itself. Still counts only, and still no sticker knowledge: the
// rows are keyed by curriculum facts, and the client maps them onto its book.
router.get('/sticker-rarity', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  try {
    // belt_sublevel is nullable on a belt a ninja has only just started, and
    // "no level yet" is the first one.
    const { rows } = await pool.query(`
      SELECT sp.belt_level AS belt, COALESCE(sp.belt_sublevel, 1) AS level, COUNT(*)::int AS count
        FROM student_programs sp
        JOIN students s ON s.id = sp.student_id
       WHERE sp.program = 'CREATE' AND s.active = true AND sp.belt_level IS NOT NULL
       GROUP BY 1, 2
    `);
    const ninjas = rows.reduce((sum, row) => sum + row.count, 0);

    const { rows: programRows } = await pool.query(`
      SELECT sp.program, COUNT(*)::int AS count
        FROM student_programs sp
        JOIN students s ON s.id = sp.student_id
       WHERE s.active = true AND sp.program <> 'CREATE'
       GROUP BY 1
    `);

    const { rows: lessons } = await pool.query(`
      SELECT pl.program, pl.sub_program, pl.module_name, pl.lesson_name,
             COUNT(DISTINCT pl.student_id)::int AS count
        FROM progress_logs pl
        JOIN students s ON s.id = pl.student_id
       WHERE s.active = true AND pl.program <> 'CREATE'
         AND pl.status_at = 'Completed'
         AND pl.module_name IS NOT NULL AND pl.lesson_name IS NOT NULL
       GROUP BY 1, 2, 3, 4
    `);

    const { rows: modules } = await pool.query(`
      WITH per_ninja AS (
        SELECT cm.id AS module_id, cm.program, cm.sub_program, cm.module_name,
               pl.student_id, COUNT(DISTINCT cl.id) AS done
          FROM curriculum_modules cm
          JOIN curriculum_lessons cl ON cl.module_id = cm.id
          JOIN progress_logs pl
            ON pl.program = cm.program
           AND pl.sub_program IS NOT DISTINCT FROM cm.sub_program
           AND pl.module_name = cm.module_name
           AND pl.lesson_name = cl.lesson_name
           AND pl.status_at = 'Completed'
          JOIN students s ON s.id = pl.student_id AND s.active = true
         WHERE cm.program <> 'CREATE'
         GROUP BY 1, 2, 3, 4, 5
      )
      SELECT p.program, p.sub_program, p.module_name, COUNT(*)::int AS count
        FROM per_ninja p
       WHERE p.done = (SELECT COUNT(*) FROM curriculum_lessons cl2 WHERE cl2.module_id = p.module_id)
       GROUP BY 1, 2, 3
    `);

    res.json({
      ninjas,
      positions: rows,
      programs: Object.fromEntries(programRows.map((r) => [r.program, r.count])),
      lessons,
      modules,
    });
  } catch (err) {
    console.error('Parent sticker rarity error:', err);
    res.status(500).json({ error: 'Failed to load sticker rarity' });
  }
});

// GET /api/parent/students
router.get('/students', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.full_name, s.birthday, s.created_at, s.ninja_skin_tone,
        ${STUDENT_PROGRAMS_SUBQUERY},
        (SELECT MAX(pl.session_date) FROM progress_logs pl WHERE pl.student_id = s.id AND pl.notes IS DISTINCT FROM 'Marked complete from roadmap') AS last_activity,
        ${RECENT_SESSIONS_SUBQUERY},
        ${RECENT_CLUBS_SUBQUERY}
      FROM students s
      WHERE LOWER(s.parent_email) = LOWER($1) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2) AND s.active = true
      ORDER BY s.full_name
    `, [req.session.parentEmail, req.session.parentLocationId]);
    res.json(rows);
  } catch (err) {
    console.error('Parent students error:', err);
    res.status(500).json({ error: 'Failed to load students' });
  }
});

// GET /api/parent/students/:id
router.get('/students/:id', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.full_name, s.birthday, s.created_at, s.special_instructions, s.parent_note, s.ninja_skin_tone,
        ${STUDENT_PROGRAMS_SUBQUERY}
      FROM students s
      WHERE s.id = $1 AND LOWER(s.parent_email) = LOWER($2) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $3) AND s.active = true
    `, [id, req.session.parentEmail, req.session.parentLocationId]);

    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });

    const { rows: logs } = await pool.query(`
      SELECT pl.session_date, pl.program, pl.sub_program, pl.module_name, pl.lesson_name,
        pl.belt_level_at, pl.belt_sublevel_at, pl.project_at, pl.status_at,
        (pl.notes = 'Marked complete from roadmap') AS from_roadmap,
        u.display_name AS sensei_name
      FROM progress_logs pl
      LEFT JOIN users u ON u.id = pl.sensei_id
      WHERE pl.student_id = $1
      ORDER BY pl.session_date DESC, pl.created_at DESC
    `, [id]);

    const { rows: clubs } = await pool.query(`
      SELECT cs.club_name, cs.session_date
      FROM club_attendees ca
      JOIN club_sessions cs ON ca.club_session_id = cs.id
      WHERE ca.student_id = $1
      ORDER BY cs.session_date DESC
    `, [id]);

    // Today's check-ins, so the portal can say "checked in at 4:12" the
    // moment it happens. Program and time only; nothing a parent could not
    // already see standing at the front desk.
    const { rows: today } = await pool.query(`
      SELECT da.program, da.created_at, da.completed
        FROM daily_assignments da
       WHERE da.student_id = $1 AND da.session_date = CURRENT_DATE
       ORDER BY da.created_at ASC
    `, [id]);

    res.json({ ...rows[0], session_logs: logs, club_attendance: clubs, today_checkins: today });
  } catch (err) {
    console.error('Parent student detail error:', err);
    res.status(500).json({ error: 'Failed to load student' });
  }
});

// PATCH /api/parent/students/:id/instructions — parent saves special instructions for their child
router.patch('/students/:id/instructions', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { special_instructions } = req.body;

  // Parent-authored text rendered in staff context — capped like the staff-side
  // pinned note rather than left bounded only by the 10mb JSON body limit.
  if (special_instructions != null && typeof special_instructions !== 'string') {
    return res.status(400).json({ error: 'Invalid note' });
  }
  if (typeof special_instructions === 'string' && special_instructions.length > MAX_INSTRUCTIONS) {
    return res.status(400).json({ error: `Note too long (max ${MAX_INSTRUCTIONS} characters)` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE students SET special_instructions = $1
        WHERE id = $2 AND LOWER(parent_email) = LOWER($3) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $4) AND active = true
        RETURNING special_instructions`,
      [special_instructions?.trim() || null, id, req.session.parentEmail, req.session.parentLocationId]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Special instructions error:', err);
    res.status(500).json({ error: 'Failed to save instructions' });
  }
});

// PATCH /api/parent/students/:id/ninja-tone — a family chooses the skin tone
// of their own ninja.
//
// This is the one thing in the portal a family changes about their child
// rather than about themselves, and it belongs to them: it is what their kid
// looks like, and a parent should not have to ask a sensei to change it. It is
// still narrow — three values, on their own child, and it decides a picture
// and nothing else. No staff-facing text, no progress, no enrolment.
//
// Same ownership check as the note above: the row must be this parent's child,
// at this parent's location, and active. A miss is 403 rather than 404, so the
// route cannot be used to find out which student ids exist.
router.patch('/students/:id/ninja-tone', requireParent, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { ninja_skin_tone } = req.body;

  if (ninja_skin_tone != null && !NINJA_TONES.includes(ninja_skin_tone)) {
    return res.status(400).json({ error: 'Invalid skin tone' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE students SET ninja_skin_tone = $1
        WHERE id = $2 AND LOWER(parent_email) = LOWER($3) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $4) AND active = true
        RETURNING ninja_skin_tone`,
      [ninja_skin_tone || null, id, req.session.parentEmail, req.session.parentLocationId]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Ninja skin tone error:', err);
    res.status(500).json({ error: 'Failed to save skin tone' });
  }
});

module.exports = router;
