const express = require('express');
const router = express.Router();
const { requireManager, requireSensei } = require('../middleware/auth');

// GET /api/reports/overview — enrollment counts, belt distribution, activity stats
router.get('/overview', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;
  try {
    const [totalStudents, enrollment, belts, inactive, beltLog] = await Promise.all([
      // Distinct active students at this location (not double-counted across programs)
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM students s
        WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1) AND s.active = true
      `, [locationId]),

      // Students per program
      pool.query(`
        SELECT sp.program, COUNT(DISTINCT sp.student_id)::int AS count
        FROM student_programs sp
        JOIN students s ON sp.student_id = s.id
        WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1) AND s.active = true
        GROUP BY sp.program
        ORDER BY sp.program ASC
      `, [locationId]),

      // Belt distribution (CREATE only)
      pool.query(`
        SELECT sp.belt_level, COUNT(*)::int AS count
        FROM student_programs sp
        JOIN students s ON sp.student_id = s.id
        WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1) AND s.active = true AND sp.program = 'CREATE' AND sp.belt_level IS NOT NULL
        GROUP BY sp.belt_level
        ORDER BY sp.belt_level ASC
      `, [locationId]),

      // Students with no activity in the last 30 days.
      // Activity = a progress log OR being marked present in a club session.
      pool.query(`
        SELECT s.id, s.full_name,
               GREATEST(
                 (SELECT MAX(pl.session_date) FROM progress_logs pl WHERE pl.student_id = s.id),
                 (SELECT MAX(cs.session_date) FROM club_attendees ca
                    JOIN club_sessions cs ON ca.club_session_id = cs.id
                    WHERE ca.student_id = s.id)
               ) AS last_session
        FROM students s
        WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1) AND s.active = true
          AND NOT EXISTS (
            SELECT 1 FROM progress_logs pl
            WHERE pl.student_id = s.id AND pl.session_date >= CURRENT_DATE - INTERVAL '30 days'
          )
          AND NOT EXISTS (
            SELECT 1 FROM club_attendees ca
            JOIN club_sessions cs ON ca.club_session_id = cs.id
            WHERE ca.student_id = s.id AND cs.session_date >= CURRENT_DATE - INTERVAL '30 days'
          )
        ORDER BY last_session ASC NULLS FIRST
      `, [locationId]),

      // Belt advancements in the last 30 days
      pool.query(`
        SELECT DISTINCT ON (pl.student_id, pl.program, pl.belt_level_at)
               s.full_name, pl.belt_level_at, pl.belt_sublevel_at, pl.session_date,
               u.display_name AS sensei_name
        FROM progress_logs pl
        JOIN students s ON pl.student_id = s.id
        -- LEFT, so a belt-up logged by someone who has since been deleted still
        -- appears. An inner join would drop the advancement, not just the name.
        LEFT JOIN users u ON pl.sensei_id = u.id
        WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1)
          AND pl.belt_level_at IN ('White','Yellow','Orange','Green','Blue','Purple','Brown','Red','Black')
          AND pl.session_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY pl.student_id, pl.program, pl.belt_level_at, pl.session_date DESC
      `, [locationId]),
    ]);

    res.json({
      totalStudents: totalStudents.rows[0].count,
      enrollment: enrollment.rows,
      belts: belts.rows,
      inactive: inactive.rows,
      beltLog: beltLog.rows,
    });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch report data' });
  }
});

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
    const { rows } = await pool.query(`
      SELECT to_char(da.session_date, 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT da.student_id)::int AS count
      FROM daily_assignments da
      JOIN students s ON da.student_id = s.id
      WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1)
        AND da.session_date <= CURRENT_DATE
        ${all ? '' : 'AND da.session_date >= CURRENT_DATE - ($2::int - 1)'}
      GROUP BY da.session_date
      ORDER BY da.session_date ASC
    `, params);
    res.json({ range: all ? 'all' : String(days), attendance: rows });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// GET /api/reports/checkins-by-hour — the hour-by-hour load on the floor, for
// staffing. Two shapes off one query:
//   ?date=YYYY-MM-DD           one day
//   ?weekday=0-6&weeks=N       that weekday over the last N weeks, today excluded
//                              because it is not over yet
//
// Per ninja per day there is one VISIT: from their first check-in until an hour
// after their last, stretched to an hour per class when they checked into
// several at once (two classes back to back is two hours in the room). There is
// no check-out, so the hour is an assumption, and the page says so.
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
const CENTER_TZ = 'America/Los_Angeles';
const VALID_WEEKS = [4, 8, 12];

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
router.get('/checkins-by-hour', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;

  let range;
  if (req.query.date != null) {
    const date = String(req.query.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    range = { where: 'da.session_date = $3::date', params: [date], weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
  } else {
    const weekday = Number(req.query.weekday);
    const weeks = Number(req.query.weeks);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !VALID_WEEKS.includes(weeks)) {
      return res.status(400).json({ error: 'Invalid weekday or weeks' });
    }
    range = {
      where: `da.session_date >= (now() AT TIME ZONE $2)::date - ($3::int * 7)
              AND da.session_date < (now() AT TIME ZONE $2)::date
              AND EXTRACT(DOW FROM da.session_date) = $4`,
      params: [weeks, weekday],
      weekday,
    };
  }

  try {
    const { rows } = await pool.query(`
      WITH checkins AS (
        SELECT da.student_id, da.session_date, da.checked_in_at AT TIME ZONE $2 AS t
        FROM daily_assignments da
        WHERE ${range.where}
          AND (da.checked_in_at AT TIME ZONE $2)::date = da.session_date
          AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = da.student_id AND sl.location_id = $1)
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
    `, [locationId, CENTER_TZ, ...range.params]);

    const days = [...new Set(rows.map((r) => r.day))];
    res.json({ days, hours: rows, open: CENTER_HOURS[range.weekday] });
  } catch (err) {
    console.error('Error fetching check-ins by hour:', err);
    res.status(500).json({ error: 'Failed to fetch check-ins by hour' });
  }
});

module.exports = router;
