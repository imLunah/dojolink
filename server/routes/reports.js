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

// GET /api/reports/checkins-by-hour?date=YYYY-MM-DD — how many ninjas arrived
// in each clock hour of one day, for staffing. A 5:35 arrival counts in 5-6 PM.
// A ninja counts once, at their first check-in of the day: two classes back to
// back are two board rows but one arrival. Rows whose check-in happened on a
// different day than their session (a session added after the fact) are left
// out, because their timestamp says when someone typed, not when a kid walked in.
const CENTER_TZ = 'America/Los_Angeles';
router.get('/checkins-by-hour', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  try {
    const { rows } = await pool.query(`
      WITH firsts AS (
        SELECT da.student_id, MIN(da.checked_in_at AT TIME ZONE $3) AS arrived
        FROM daily_assignments da
        WHERE da.session_date = $2::date
          AND (da.checked_in_at AT TIME ZONE $3)::date = da.session_date
          AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = da.student_id AND sl.location_id = $1)
        GROUP BY da.student_id
      )
      SELECT EXTRACT(HOUR FROM arrived)::int AS hour, COUNT(*)::int AS count
      FROM firsts
      GROUP BY 1
      ORDER BY 1
    `, [locationId, date, CENTER_TZ]);
    res.json({ date, hours: rows });
  } catch (err) {
    console.error('Error fetching check-ins by hour:', err);
    res.status(500).json({ error: 'Failed to fetch check-ins by hour' });
  }
});

module.exports = router;
