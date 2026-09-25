const express = require('express');
const router = express.Router();
const { requireManager, requireSensei } = require('../middleware/auth');

// The Reports section: Overview, Attendance, Students, Progress. Every route
// below takes the same filters so the page can keep one filter bar across its
// tabs:
//
//   center   a location id, or 'all'. Defaults to the active center. A director
//            may READ any active center (the location switcher already allows
//            it), so 'all' is every active center and not only their own.
//   from/to  the period, YYYY-MM-DD, both inclusive, in center time. The
//            comparison period is the same number of days immediately before.
//   program  optional; narrows check-ins, logs and enrollment to one program.
//
// A ninja belongs to a center through student_locations, and a check-in row has
// no location of its own, so a ninja enrolled at two centers counts at both.
// That is the rule the rest of the app already uses.

const CENTER_TZ = 'America/Los_Angeles';
const PROGRAMS = ['CREATE', 'Robotics Academy', 'AI Academy', 'JR', 'VR Coding'];
const BELT_ORDER = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black', 'Bronze', 'Silver', 'Platinum', 'Gold'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// All time runs from 9 May 2026, so the cap only guards against nonsense.
const MAX_SPAN_DAYS = 3660;

// Opening hours, the same at every center: 3-7 PM on weekdays, 10 AM-2 PM on
// Saturday, closed Sunday. Keyed by getDay()/EXTRACT(DOW), [open, close) in
// whole hours. A visit is clipped to these, so a 6:30 check-in does not put a
// ninja in the room at 7:15, and an early 2:50 arrival counts in the first hour
// rather than an hour the center is not open. A check-in after close (typed
// late) still counts as an arrival in the last open hour.
const CENTER_HOURS = { 0: null, 1: [15, 19], 2: [15, 19], 3: [15, 19], 4: [15, 19], 5: [15, 19], 6: [10, 14] };
const openHourSql = (col, i) => `CASE EXTRACT(DOW FROM ${col})::int ${
  Object.entries(CENTER_HOURS).filter(([, h]) => h).map(([d, h]) => `WHEN ${d} THEN ${h[i]}`).join(' ')
} END`;

// A ninja is in scope when they belong to one of the centers in $1.
const inScope = (col) => `EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = ${col} AND sl.location_id = ANY($1::int[]))`;

// A VISIT is one ninja at a center on one day, however they came: checked in on
// Today's Board, or marked present at a club. Some ninjas only ever come for a
// club, and counting the board alone listed them as having stopped coming.
// UNION (not UNION ALL) makes a ninja who did both one visit, not two.
//
// A club belongs to the center it ran at (club_sessions.location_id), which is
// where the ninja was that day. Clubs are not a program, so a program filter
// leaves them out. `locs` is the SQL for the int[] of centers in scope.
const visitsSql = ({ from, to, program, locs = '$1::int[]' }) => `
  SELECT da.student_id, da.session_date AS day
  FROM daily_assignments da
  WHERE da.session_date BETWEEN ${from}::date AND ${to}::date
    AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = da.student_id AND sl.location_id = ANY(${locs}))
    AND (${program}::text IS NULL OR da.program = ${program}::text)
  UNION
  SELECT ca.student_id, cs.session_date AS day
  FROM club_attendees ca
  JOIN club_sessions cs ON cs.id = ca.club_session_id
  WHERE cs.session_date BETWEEN ${from}::date AND ${to}::date
    AND cs.location_id = ANY(${locs})
    AND ${program}::text IS NULL
`;

// A belt-up is the first log a ninja ever has at a belt, in a program, when
// they already had logs in that program at lower belts and none at this belt or
// above. Without the earlier-log half, every ninja's first log after the import
// would count as a belt-up; without the "lower" half, logging a project from an
// earlier belt (allowed since session 44) would.
const BELT_ARRAY = `ARRAY[${BELT_ORDER.map((b) => `'${b}'`).join(',')}]`;
const beltUpsSql = (extraWhere) => `
  WITH firsts AS (
    SELECT pl.student_id, pl.program, pl.belt_level_at, MIN(pl.session_date) AS d
    FROM progress_logs pl
    WHERE pl.belt_level_at = ANY(${BELT_ARRAY}) AND ${inScope('pl.student_id')}
      AND ($4::text IS NULL OR pl.program = $4::text)
    GROUP BY 1, 2, 3
  )
  SELECT f.*
  FROM firsts f
  WHERE ${extraWhere}
    AND (
      SELECT MAX(array_position(${BELT_ARRAY}, e.belt_level_at))
      FROM progress_logs e
      WHERE e.student_id = f.student_id AND e.program = f.program AND e.session_date < f.d
    ) < array_position(${BELT_ARRAY}, f.belt_level_at)
`;

function centerToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: CENTER_TZ });
}
function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isDate(v) {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));
}
function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Reads the shared filters off the query string, or throws a 400.
async function readFilters(req, { period = true, allowAll = true } = {}) {
  const pool = req.app.get('db');
  const raw = req.query.center;
  let centerIds;
  if (raw === 'all') {
    if (!allowAll) throw badRequest('Pick one center');
    centerIds = (await pool.query('SELECT id FROM locations WHERE active = true')).rows.map((r) => r.id);
  } else {
    const id = raw == null || raw === '' ? req.session.activeLocationId : Number(raw);
    if (!Number.isInteger(id)) throw badRequest('Invalid center');
    const { rows } = await pool.query('SELECT 1 FROM locations WHERE id = $1 AND active = true', [id]);
    if (!rows[0]) throw badRequest('Invalid center');
    centerIds = [id];
  }

  const program = req.query.program ? String(req.query.program) : null;
  if (program && !PROGRAMS.includes(program)) throw badRequest('Invalid program');

  if (!period) return { centerIds, program };

  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to) || from > to || to > centerToday()) throw badRequest('Invalid period');
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > MAX_SPAN_DAYS) throw badRequest('Period is too long');
  return {
    centerIds, program, from, to, days,
    prevFrom: addDays(from, -days),
    prevTo: addDays(from, -1),
  };
}

const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(`Error fetching ${label}:`, err);
    res.status(500).json({ error: `Failed to fetch ${label}` });
  }
};

// The first day any check-in was recorded at the LATEST-starting center in
// scope. A comparison period that begins before this is comparing against days
// DojoLink was not in use yet, so the page shows no change for it.
async function dataSince(pool, centerIds) {
  const { rows } = await pool.query(`
    SELECT to_char(MAX(first_day), 'YYYY-MM-DD') AS since FROM (
      SELECT sl.location_id, MIN(da.session_date) AS first_day
      FROM daily_assignments da
      JOIN student_locations sl ON sl.student_id = da.student_id
      WHERE sl.location_id = ANY($1::int[])
      GROUP BY sl.location_id
    ) f
  `, [centerIds]);
  return rows[0]?.since || null;
}

// GET /api/reports/summary — the Overview tab.
router.get('/summary', requireManager, handle('report summary', async (req, res) => {
  const pool = req.app.get('db');
  const f = await readFilters(req);
  const base = [f.centerIds, f.prevFrom, f.to, f.program, f.from];
  const visits2 = visitsSql({ from: '$2', to: '$3', program: '$4' });

  const [daily, seen, beltUps, roster, inactive, since, perCenter] = await Promise.all([
    pool.query(`
      SELECT to_char(v.day, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM (${visits2}) v
      GROUP BY v.day ORDER BY v.day
    `, base.slice(0, 4)),
    pool.query(`
      SELECT COUNT(DISTINCT v.student_id) FILTER (WHERE v.day >= $5::date)::int AS cur,
             COUNT(DISTINCT v.student_id) FILTER (WHERE v.day < $5::date)::int AS prev
      FROM (${visits2}) v
    `, base),
    pool.query(`
      SELECT COUNT(*) FILTER (WHERE d >= $5::date)::int AS cur,
             COUNT(*) FILTER (WHERE d < $5::date)::int AS prev
      FROM (${beltUpsSql('f.d BETWEEN $2::date AND $3::date')}) b
    `, base),
    pool.query(`
      SELECT COUNT(*)::int AS count FROM students s
      WHERE s.active = true AND ${inScope('s.id')}
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM student_programs sp WHERE sp.student_id = s.id AND sp.program = $2::text))
    `, [f.centerIds, f.program]),
    // Not seen in the last 30 days, counted from today and not from the period,
    // because "who has gone quiet" is a question about now.
    pool.query(`
      SELECT COUNT(*)::int AS count FROM students s
      WHERE s.active = true AND ${inScope('s.id')}
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM student_programs sp WHERE sp.student_id = s.id AND sp.program = $2::text))
        AND NOT EXISTS (SELECT 1 FROM daily_assignments da WHERE da.student_id = s.id AND da.session_date >= $3::date - 29)
        AND NOT EXISTS (SELECT 1 FROM club_attendees ca JOIN club_sessions cs ON ca.club_session_id = cs.id
                        WHERE ca.student_id = s.id AND cs.session_date >= $3::date - 29)
    `, [f.centerIds, f.program, centerToday()]),
    dataSince(pool, f.centerIds),
    f.centerIds.length > 1 ? pool.query(`
      SELECT l.id, l.name,
        (SELECT COUNT(*) FROM students s WHERE s.active = true
           AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = l.id))::int AS roster,
        (SELECT COUNT(DISTINCT v.student_id) FROM (${visitsSql({ from: '$2', to: '$3', program: '$4', locs: 'ARRAY[l.id]' })}) v)::int AS seen,
        (SELECT COUNT(*) FROM (${visitsSql({ from: '$2', to: '$3', program: '$4', locs: 'ARRAY[l.id]' })}) v)::int AS visits
      FROM locations l
      WHERE l.id = ANY($1::int[])
      ORDER BY l.name
    `, [f.centerIds, f.from, f.to, f.program]) : null,
  ]);

  const visits = { cur: 0, prev: 0 };
  for (const r of daily.rows) visits[r.day >= f.from ? 'cur' : 'prev'] += r.count;

  res.json({
    period: { from: f.from, to: f.to, prevFrom: f.prevFrom, prevTo: f.prevTo, days: f.days },
    dataSince: since,
    daily: daily.rows,
    kpis: {
      ninjasSeen: seen.rows[0],
      visits,
      beltUps: beltUps.rows[0],
      roster: roster.rows[0].count,
      inactive30: inactive.rows[0].count,
    },
    perCenter: perCenter ? perCenter.rows : null,
  });
}));

// GET /api/reports/checkins-by-hour — the hour-by-hour load on the floor, for
// staffing. One center at a time: ninjas "in the room at once" across three
// buildings is not a number anybody can staff to, so 'all' is refused and the
// page asks per center instead.
//   ?center&date=YYYY-MM-DD              one day
//   ?center&from&to[&program]            every day in the period; the page
//                                        groups them by weekday
//
// Per ninja per day there is one VISIT: from their first check-in until an hour
// after their last, stretched to an hour per class when they checked into
// several at once (two classes back to back is two hours in the room), and
// clipped to opening hours. There is no check-out, so the hour is an
// assumption, and the page says so.
//
// Per hour the answer is two numbers:
//   arrivals — visits that began in that clock hour. A 5:35 arrival is 5-6 PM.
//   peak     — the most ninjas in the room at once during the hour, read off
//              five-minute slots. This is the staffing number: a 3:40 arrival
//              is still at a table at 4:30 and arrivals alone never show it.
//
// Rows whose check-in happened on a different day than their session (added
// after the fact) are left out: that timestamp says when someone typed.
//
// The response is per-day rows plus the list of days the center had any
// check-in. The client fills the zero hours and takes median and max; a day
// with no check-ins at all is a closed day and is not counted as a zero.
router.get('/checkins-by-hour', requireManager, handle('check-ins by hour', async (req, res) => {
  const pool = req.app.get('db');
  let where;
  let params;
  let range;
  if (req.query.date != null) {
    const { centerIds } = await readFilters(req, { period: false, allowAll: false });
    if (!isDate(req.query.date)) throw badRequest('Invalid date');
    where = 'da.session_date = $3::date';
    params = [centerIds, CENTER_TZ, req.query.date, null];
    range = [centerIds, req.query.date, req.query.date, null];
  } else {
    const f = await readFilters(req, { allowAll: false });
    where = 'da.session_date BETWEEN $3::date AND $5::date';
    params = [f.centerIds, CENTER_TZ, f.from, f.program, f.to];
    range = [f.centerIds, f.from, f.to, f.program];
  }

  // Ninjas who came only for a club that day. A club session records its date
  // but not its hour (its timestamp is when a sensei logged it, which runs from
  // 3 to 7 PM for the same club), so they cannot be put in an hour. They are
  // returned per day so the page counts them in the day and says so, rather
  // than leaving them out without a word.
  const clubOnly = pool.query(`
    SELECT to_char(cs.session_date, 'YYYY-MM-DD') AS day, COUNT(DISTINCT ca.student_id)::int AS count
    FROM club_attendees ca
    JOIN club_sessions cs ON cs.id = ca.club_session_id
    WHERE cs.session_date BETWEEN $2::date AND $3::date
      AND cs.location_id = ANY($1::int[])
      AND $4::text IS NULL
      AND NOT EXISTS (SELECT 1 FROM daily_assignments da WHERE da.student_id = ca.student_id AND da.session_date = cs.session_date)
    GROUP BY cs.session_date
  `, range);

  const { rows } = await pool.query(`
    WITH checkins AS (
      SELECT da.student_id, da.session_date, da.checked_in_at AT TIME ZONE $2 AS t
      FROM daily_assignments da
      WHERE ${where}
        AND ($4::text IS NULL OR da.program = $4::text)
        AND (da.checked_in_at AT TIME ZONE $2)::date = da.session_date
        AND ${inScope('da.student_id')}
    ),
    raw AS (
      SELECT session_date, MIN(t) AS arrived,
             GREATEST(MAX(t), MIN(t) + (COUNT(*) - 1) * INTERVAL '1 hour') + INTERVAL '1 hour' AS left_at,
             session_date + ${openHourSql('session_date', 0)} * INTERVAL '1 hour' AS opens,
             session_date + ${openHourSql('session_date', 1)} * INTERVAL '1 hour' AS closes
      FROM checkins
      GROUP BY student_id, session_date
    ),
    visits AS (
      SELECT session_date, arrived, opens, closes,
             GREATEST(arrived, opens) AS from_t, LEAST(left_at, closes) AS to_t
      FROM raw
      WHERE opens IS NOT NULL
    ),
    slots AS (
      SELECT v.session_date, slot
      FROM visits v,
           generate_series(
             date_trunc('hour', v.from_t) + FLOOR(EXTRACT(MINUTE FROM v.from_t) / 5) * INTERVAL '5 minutes',
             v.to_t - INTERVAL '1 second',
             INTERVAL '5 minutes'
           ) AS slot
      WHERE v.to_t > v.from_t
    ),
    peaks AS (
      SELECT session_date, EXTRACT(HOUR FROM slot)::int AS hour, MAX(n)::int AS peak
      FROM (SELECT session_date, slot, COUNT(*) AS n FROM slots GROUP BY 1, 2) c
      GROUP BY 1, 2
    ),
    arrivals AS (
      SELECT session_date,
             LEAST(GREATEST(EXTRACT(HOUR FROM arrived)::int, EXTRACT(HOUR FROM opens)::int),
                   EXTRACT(HOUR FROM closes)::int - 1) AS hour,
             COUNT(*)::int AS arrivals
      FROM visits
      GROUP BY 1, 2
    )
    SELECT to_char(COALESCE(p.session_date, a.session_date), 'YYYY-MM-DD') AS day,
           COALESCE(p.hour, a.hour) AS hour,
           COALESCE(a.arrivals, 0) AS arrivals, COALESCE(p.peak, 0) AS peak
    FROM peaks p
    FULL JOIN arrivals a ON a.session_date = p.session_date AND a.hour = p.hour
    ORDER BY 1, 2
  `, params);

  const days = [...new Set(rows.map((r) => r.day))];
  res.json({ days, hours: rows, clubOnly: (await clubOnly).rows, openHours: CENTER_HOURS });
}));

// GET /api/reports/students — the Students tab: who the roster is, how often
// they come, and who has gone quiet.
router.get('/students', requireManager, handle('student report', async (req, res) => {
  const pool = req.app.get('db');
  const f = await readFilters(req);
  const multi = f.centerIds.length > 1;
  const centersOf = `(SELECT string_agg(l.name, ', ' ORDER BY l.name) FROM student_locations sl2
                       JOIN locations l ON l.id = sl2.location_id
                       WHERE sl2.student_id = s.id AND sl2.location_id = ANY($1::int[]))`;

  const [roster, enrollment, belts, frequency, inactive] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)::int AS count FROM students s
      WHERE s.active = true AND ${inScope('s.id')}
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM student_programs sp WHERE sp.student_id = s.id AND sp.program = $2::text))
    `, [f.centerIds, f.program]),
    pool.query(`
      SELECT sp.program, COUNT(DISTINCT sp.student_id)::int AS count
      FROM student_programs sp JOIN students s ON s.id = sp.student_id
      WHERE s.active = true AND ${inScope('s.id')}
      GROUP BY sp.program ORDER BY sp.program
    `, [f.centerIds]),
    pool.query(`
      SELECT sp.belt_level, COUNT(*)::int AS count
      FROM student_programs sp JOIN students s ON s.id = sp.student_id
      WHERE s.active = true AND ${inScope('s.id')} AND sp.program = 'CREATE' AND sp.belt_level IS NOT NULL
      GROUP BY sp.belt_level
    `, [f.centerIds]),
    // Visits in the period for each ninja who came at least once, board or club.
    pool.query(`
      SELECT v.student_id, COUNT(*)::int AS visits
      FROM (${visitsSql({ from: '$2', to: '$3', program: '$4' })}) v
      GROUP BY v.student_id
    `, [f.centerIds, f.from, f.to, f.program]),
    // Not seen in 30+ days: on the roster, no visit or club in the last 30
    // days, counted from today. The most recently seen come first, because a
    // ninja gone five weeks is the call to make this week and one gone since
    // May (or never seen) is a membership question. A program filter narrows
    // the roster; any visit, in any class, counts as being seen.
    pool.query(`
      SELECT s.id, s.full_name, ${multi ? centersOf : 'NULL'} AS centers,
             to_char(GREATEST(
               (SELECT MAX(da.session_date) FROM daily_assignments da WHERE da.student_id = s.id),
               (SELECT MAX(cs.session_date) FROM club_attendees ca JOIN club_sessions cs ON ca.club_session_id = cs.id
                  WHERE ca.student_id = s.id)
             ), 'YYYY-MM-DD') AS last_seen
      FROM students s
      WHERE s.active = true AND ${inScope('s.id')}
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM student_programs sp WHERE sp.student_id = s.id AND sp.program = $2::text))
        AND NOT EXISTS (SELECT 1 FROM daily_assignments da WHERE da.student_id = s.id AND da.session_date >= $3::date - 29)
        AND NOT EXISTS (SELECT 1 FROM club_attendees ca JOIN club_sessions cs ON ca.club_session_id = cs.id
                        WHERE ca.student_id = s.id AND cs.session_date >= $3::date - 29)
      ORDER BY last_seen DESC NULLS LAST, s.full_name
    `, [f.centerIds, f.program, centerToday()]),
  ]);

  res.json({
    period: { from: f.from, to: f.to, prevFrom: f.prevFrom, prevTo: f.prevTo, days: f.days },
    dataSince: await dataSince(pool, f.centerIds),
    roster: roster.rows[0].count,
    enrollment: enrollment.rows,
    belts: belts.rows,
    visitsPerNinja: frequency.rows.map((r) => r.visits),
    inactive: inactive.rows,
  });
}));

// GET /api/reports/progress — the Progress tab: belt-ups, and the sessions
// each sensei logged. The sensei table is a workload picture, not a ranking:
// a sensei on the JR table logs shorter, simpler sessions than one on Brown
// belt, and the page does not sort it by anything but name.
router.get('/progress', requireManager, handle('progress report', async (req, res) => {
  const pool = req.app.get('db');
  const f = await readFilters(req);
  const multi = f.centerIds.length > 1;
  const base = [f.centerIds, f.from, f.to, f.program];

  const [beltUps, weekly, senseis, clubs] = await Promise.all([
    pool.query(`
      SELECT b.student_id, s.full_name, b.program, b.belt_level_at AS belt, to_char(b.d, 'YYYY-MM-DD') AS day,
             ${multi ? `(SELECT string_agg(l.name, ', ' ORDER BY l.name) FROM student_locations sl2
                         JOIN locations l ON l.id = sl2.location_id
                         WHERE sl2.student_id = s.id AND sl2.location_id = ANY($1::int[]))` : 'NULL'} AS centers,
             (SELECT u.display_name FROM progress_logs pl JOIN users u ON u.id = pl.sensei_id
               WHERE pl.student_id = b.student_id AND pl.program = b.program AND pl.belt_level_at = b.belt_level_at
                 AND pl.session_date = b.d ORDER BY pl.id LIMIT 1) AS sensei_name
      FROM (${beltUpsSql('f.d BETWEEN $2::date AND $3::date')}) b
      JOIN students s ON s.id = b.student_id
      ORDER BY b.d DESC, s.full_name
    `, base),
    pool.query(`
      WITH weeks AS (
        SELECT generate_series(date_trunc('week', $2::date), date_trunc('week', $3::date), INTERVAL '1 week')::date AS week
      ),
      logs AS (
        SELECT date_trunc('week', pl.session_date)::date AS week, COUNT(DISTINCT (pl.student_id, pl.session_date, pl.program))::int AS sessions
        FROM progress_logs pl
        WHERE pl.session_date BETWEEN $2::date AND $3::date AND ${inScope('pl.student_id')}
          AND ($4::text IS NULL OR pl.program = $4::text)
        GROUP BY 1
      ),
      ups AS (
        SELECT date_trunc('week', b.d)::date AS week, COUNT(*)::int AS belt_ups
        FROM (${beltUpsSql('f.d BETWEEN $2::date AND $3::date')}) b
        GROUP BY 1
      )
      SELECT to_char(w.week, 'YYYY-MM-DD') AS week, COALESCE(l.sessions, 0) AS sessions, COALESCE(u.belt_ups, 0) AS belt_ups
      FROM weeks w LEFT JOIN logs l ON l.week = w.week LEFT JOIN ups u ON u.week = w.week
      ORDER BY w.week
    `, base),
    pool.query(`
      SELECT pl.sensei_id, u.display_name,
             COUNT(DISTINCT (pl.student_id, pl.session_date, pl.program))::int AS sessions,
             COUNT(DISTINCT pl.student_id)::int AS ninjas,
             COUNT(DISTINCT pl.session_date)::int AS days
      FROM progress_logs pl
      LEFT JOIN users u ON u.id = pl.sensei_id
      WHERE pl.session_date BETWEEN $2::date AND $3::date AND ${inScope('pl.student_id')}
        AND ($4::text IS NULL OR pl.program = $4::text)
      GROUP BY pl.sensei_id, u.display_name
      ORDER BY u.display_name NULLS LAST
    `, base),
    // Club sessions each sensei ran, so a sensei who mostly runs clubs does not
    // read as idle. Clubs are not a program, so a program filter leaves them out.
    pool.query(`
      SELECT cs.sensei_id, u.display_name, COUNT(*)::int AS clubs,
             COUNT(DISTINCT ca.student_id)::int AS club_ninjas
      FROM club_sessions cs
      LEFT JOIN club_attendees ca ON ca.club_session_id = cs.id
      LEFT JOIN users u ON u.id = cs.sensei_id
      WHERE cs.session_date BETWEEN $2::date AND $3::date AND cs.location_id = ANY($1::int[])
        AND $4::text IS NULL
      GROUP BY cs.sensei_id, u.display_name
    `, base),
  ]);

  // One row per sensei: logged sessions and clubs run side by side. A club's
  // count is sessions, not attendees, so both columns count the same thing.
  const bySensei = new Map();
  for (const r of senseis.rows) bySensei.set(r.sensei_id, { ...r, clubs: 0 });
  for (const c of clubs.rows) {
    const row = bySensei.get(c.sensei_id) || { sensei_id: c.sensei_id, display_name: c.display_name, sessions: 0, ninjas: 0, days: 0 };
    row.clubs = c.clubs;
    bySensei.set(c.sensei_id, row);
  }
  const senseiRows = [...bySensei.values()].sort((a, b) =>
    String(a.display_name ?? '\uffff').localeCompare(String(b.display_name ?? '\uffff')));

  res.json({
    period: { from: f.from, to: f.to, prevFrom: f.prevFrom, prevTo: f.prevTo, days: f.days },
    beltUps: beltUps.rows,
    weekly: weekly.rows,
    senseis: senseiRows,
  });
}));

// GET /api/reports/classes — the Classes tab: which programs and clubs the
// visits go to. A visit here is a ninja in one class on one day, so a ninja
// who did CREATE and Robotics on the same afternoon counts once in each. A
// check-in with no program is its own row (''). A program filter narrows the
// programs to that one and leaves clubs out, as it does on every other tab.
router.get('/classes', requireManager, handle('classes report', async (req, res) => {
  const pool = req.app.get('db');
  const f = await readFilters(req);
  const base = [f.centerIds, f.prevFrom, f.to, f.from, f.program];
  const classVisits = `
    SELECT da.student_id, da.session_date AS day, COALESCE(da.program, '') AS cls
    FROM daily_assignments da
    WHERE da.session_date BETWEEN $2::date AND $3::date AND ${inScope('da.student_id')}
      AND ($5::text IS NULL OR da.program = $5::text)
    UNION
    SELECT ca.student_id, cs.session_date AS day, 'Clubs' AS cls
    FROM club_attendees ca
    JOIN club_sessions cs ON cs.id = ca.club_session_id
    WHERE cs.session_date BETWEEN $2::date AND $3::date AND cs.location_id = ANY($1::int[])
      AND $5::text IS NULL
  `;

  const [programs, weekly, clubs, since] = await Promise.all([
    pool.query(`
      WITH v AS (${classVisits}),
      visits AS (
        SELECT cls,
          COUNT(*) FILTER (WHERE day >= $4::date)::int AS cur,
          COUNT(*) FILTER (WHERE day < $4::date)::int AS prev,
          COUNT(DISTINCT student_id) FILTER (WHERE day >= $4::date)::int AS ninjas
        FROM v WHERE cls <> 'Clubs' GROUP BY cls
      ),
      enrolled AS (
        SELECT sp.program AS cls, COUNT(DISTINCT sp.student_id)::int AS enrolled
        FROM student_programs sp JOIN students s ON s.id = sp.student_id
        WHERE s.active = true AND ${inScope('s.id')} AND ($5::text IS NULL OR sp.program = $5::text)
        GROUP BY sp.program
      )
      SELECT COALESCE(v.cls, e.cls) AS cls, COALESCE(v.cur, 0) AS cur, COALESCE(v.prev, 0) AS prev,
             COALESCE(v.ninjas, 0) AS ninjas, COALESCE(e.enrolled, 0) AS enrolled
      FROM visits v FULL JOIN enrolled e ON e.cls = v.cls
    `, base),
    pool.query(`
      WITH v AS (${classVisits})
      SELECT to_char(date_trunc('week', day)::date, 'YYYY-MM-DD') AS week, cls, COUNT(*)::int AS visits
      FROM v WHERE day >= $4::date
      GROUP BY 1, 2 ORDER BY 1
    `, base),
    f.program ? null : pool.query(`
      SELECT cs.club_name AS name,
        COUNT(DISTINCT cs.id) FILTER (WHERE cs.session_date >= $4::date)::int AS sessions,
        COUNT(ca.id) FILTER (WHERE cs.session_date >= $4::date)::int AS cur,
        COUNT(ca.id) FILTER (WHERE cs.session_date < $4::date)::int AS prev,
        COUNT(DISTINCT ca.student_id) FILTER (WHERE cs.session_date >= $4::date)::int AS ninjas,
        to_char(MAX(cs.session_date) FILTER (WHERE cs.session_date >= $4::date), 'YYYY-MM-DD') AS last
      FROM club_sessions cs
      LEFT JOIN club_attendees ca ON ca.club_session_id = cs.id
      WHERE cs.session_date BETWEEN $2::date AND $3::date AND cs.location_id = ANY($1::int[])
      GROUP BY cs.club_name
      ORDER BY cs.club_name
    `, base.slice(0, 4)),
    dataSince(pool, f.centerIds),
  ]);

  res.json({
    period: { from: f.from, to: f.to, prevFrom: f.prevFrom, prevTo: f.prevTo, days: f.days },
    dataSince: since,
    programs: programs.rows,
    weekly: weekly.rows,
    clubs: clubs ? clubs.rows : null,
  });
}));

// GET /api/reports/attendance — ninjas checked in per day at this location.
// One row per day that had any check-in; the client fills the gaps and slices
// it into whatever range is on screen. `range=all` drops the lower bound so the
// client can offer an all-time view off a single fetch. `to_char` keeps the DATE
// a plain YYYY-MM-DD string instead of a UTC-midnight timestamp.
router.get('/attendance', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;
  const all = req.query.range === 'all';
  const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 120));
  const params = all ? [locationId] : [locationId, days];
  try {
    // A check-in is a visit, board or club, counted the same way Reports
    // counts it (visitsSql), so the dashboard and Reports never disagree
    // about how many ninjas came on a day.
    const visits = visitsSql({
      from: all ? "'2000-01-01'" : '(CURRENT_DATE - ($2::int - 1))',
      to: 'CURRENT_DATE',
      program: 'NULL',
      locs: 'ARRAY[$1::int]',
    });
    const { rows } = await pool.query(`
      SELECT to_char(v.day, 'YYYY-MM-DD') AS day, COUNT(DISTINCT v.student_id)::int AS count
      FROM (${visits}) v
      GROUP BY v.day
      ORDER BY v.day ASC
    `, params);
    res.json({ range: all ? 'all' : String(days), attendance: rows });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

module.exports = router;
