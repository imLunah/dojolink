const express = require('express');
const router = express.Router();
const { requireAuth, requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');
const { addToBoard } = require('../lib/boardCheckIn');

function todayDate() {
  // All locations are in California — use Pacific time so the board doesn't flip at midnight UTC
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

const ASSIGNMENT_SELECT = `
  SELECT
    da.id,
    da.student_id,
    da.sensei_id,
    da.session_date,
    da.completed,
    da.program,
    s.full_name as student_name,
    s.birthday,
    s.pinned_note,
    s.special_instructions,
    sp.belt_level,
    sp.belt_sublevel,
    sp.current_project,
    sp.project_status,
    u.display_name as sensei_name,
    ARRAY(SELECT sp2.program FROM student_programs sp2
          WHERE sp2.student_id = da.student_id ORDER BY sp2.program) AS enrolled_programs,
    (SELECT COUNT(*) FROM daily_assignments da2
     WHERE da2.student_id = da.student_id
       AND da2.session_date = da.session_date
       AND da2.created_at <= da.created_at) AS session_number
  FROM daily_assignments da
  JOIN students s ON da.student_id = s.id
  LEFT JOIN student_programs sp ON sp.student_id = da.student_id AND sp.program = da.program
  LEFT JOIN users u ON da.sensei_id = u.id
`;

// GET /api/daily?date=YYYY-MM-DD
// When fetching today's board, also includes incomplete assignments from past days.
router.get('/', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  const date = req.query.date || todayDate();
  const isToday = date === todayDate();

  try {
    const query = isToday
      ? ASSIGNMENT_SELECT + ' WHERE (da.session_date = $1 OR (da.session_date < $1 AND da.completed = false)) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2) ORDER BY da.session_date ASC, da.created_at ASC'
      : ASSIGNMENT_SELECT + ' WHERE da.session_date = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2) ORDER BY da.created_at ASC';
    const { rows } = await pool.query(query, [date, req.session.activeLocationId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching daily assignments:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET /api/daily/my — logged-in sensei's assignments for today
router.get('/my', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const date = req.query.date || todayDate();
  const senseiId = req.session.userId;

  try {
    const { rows } = await pool.query(
      ASSIGNMENT_SELECT + ' WHERE da.session_date = $1 AND da.sensei_id = $2 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $3) ORDER BY da.created_at ASC',
      [date, senseiId, req.session.activeLocationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching sensei assignments:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// POST /api/daily
router.post('/', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { student_id, program, session_date } = req.body;

  // program is OPTIONAL — omitting it is a "generic" check-in (no class chosen yet).
  // The sensei picks the actual class at log time. Only student_id is required.
  if (!student_id) {
    return res.status(400).json({ error: 'student_id is required' });
  }

  // session_date (when provided) must be a real calendar date — not the future,
  // not absurdly old. It lands in daily_assignments and flows into progress_logs.
  if (session_date != null) {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(session_date) && !Number.isNaN(Date.parse(session_date));
    if (!validFormat || session_date > todayDate() || session_date < '2020-01-01') {
      return res.status(400).json({ error: 'Invalid session date' });
    }
  }

  const date = session_date || todayDate();

  try {
    // Validate the ninja exists, is active, and belongs to this location (both paths).
    const { rows: studentRows } = await pool.query(
      `SELECT s.id FROM students s WHERE s.id = $1 AND s.active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)`,
      [student_id, req.session.activeLocationId]
    );
    if (!studentRows[0]) return res.status(404).json({ error: 'Ninja not found at this location' });

    if (program) {
      const { rows: enrollmentRows } = await pool.query(
        `SELECT sp.id FROM student_programs sp WHERE sp.student_id = $1 AND sp.program = $2`,
        [student_id, program]
      );
      if (!enrollmentRows[0]) return res.status(404).json({ error: 'Ninja not enrolled in this program' });
    }

    const assignmentId = await addToBoard(pool, { studentId: student_id, program: program || null, date });

    const { rows } = await pool.query(
      ASSIGNMENT_SELECT + ' WHERE da.id = $1',
      [assignmentId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding assignment:', err);
    res.status(500).json({ error: 'Failed to add assignment' });
  }
});

// PATCH /api/daily/:id/assign
router.patch('/:id/assign', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { sensei_id } = req.body;

  try {
    const { rows: existing } = await pool.query(`
      SELECT da.id FROM daily_assignments da
      JOIN students s ON da.student_id = s.id
      WHERE da.id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)
    `, [id, req.session.activeLocationId]);
    if (!existing[0]) return res.status(404).json({ error: 'Assignment not found' });

    if (sensei_id) {
      const { rows: senseiCheck } = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND location_id = $2 AND active = true',
        [sensei_id, req.session.activeLocationId]
      );
      if (!senseiCheck[0]) return res.status(400).json({ error: 'Sensei not found at this location' });
    }

    await pool.query(
      'UPDATE daily_assignments SET sensei_id = $1 WHERE id = $2',
      [sensei_id || null, id]
    );

    const { rows } = await pool.query(ASSIGNMENT_SELECT + ' WHERE da.id = $1', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error assigning sensei:', err);
    res.status(500).json({ error: 'Failed to assign sensei' });
  }
});

// PATCH /api/daily/:id/program
// Change which class a check-in is for, before it is logged. Senseis can do
// this too: whoever is in the room is the one who sees the director picked the
// wrong class. A logged check-in is left alone, its class belongs to the log.
router.patch('/:id/program', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { program } = req.body;
  if (typeof program !== 'string' || !program) {
    return res.status(400).json({ error: 'program is required' });
  }

  try {
    const { rows: existing } = await pool.query(`
      SELECT da.id, da.student_id, da.completed FROM daily_assignments da
      JOIN students s ON da.student_id = s.id
      WHERE da.id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)
    `, [id, req.session.activeLocationId]);
    if (!existing[0]) return res.status(404).json({ error: 'Assignment not found' });
    if (existing[0].completed) return res.status(409).json({ error: 'Already logged' });

    // Same rule as checking in: the class has to be one the ninja is enrolled in.
    const { rows: enrollmentRows } = await pool.query(
      'SELECT 1 FROM student_programs WHERE student_id = $1 AND program = $2',
      [existing[0].student_id, program]
    );
    if (!enrollmentRows[0]) return res.status(400).json({ error: 'Ninja not enrolled in this program' });

    // completed is checked again here: a log saved since the read above owns
    // its class now.
    const { rowCount } = await pool.query(
      'UPDATE daily_assignments SET program = $1 WHERE id = $2 AND completed = false',
      [program, id]
    );
    if (!rowCount) return res.status(409).json({ error: 'Already logged' });

    const { rows } = await pool.query(ASSIGNMENT_SELECT + ' WHERE da.id = $1', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error changing class:', err);
    res.status(500).json({ error: 'Failed to change class' });
  }
});

// DELETE /api/daily/:id
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const { rows } = await pool.query(`
      SELECT da.id FROM daily_assignments da
      JOIN students s ON da.student_id = s.id
      WHERE da.id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)
    `, [id, req.session.activeLocationId]);
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' });

    await pool.query('DELETE FROM daily_assignments WHERE id = $1', [id]);
    res.json({ message: 'Assignment removed' });
  } catch (err) {
    console.error('Error removing assignment:', err);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

module.exports = router;
