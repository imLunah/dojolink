const express = require('express');
const router = express.Router();
const { requireAuth, requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');
const { ALL_BELTS, isValidBelt, validateSublevel } = require('../lib/belts');
const { reactionsSubquery } = require('../lib/reactions');
const { memberOf, addMembership, archiveOrRemove } = require('../lib/studentScope');

// Code.AI (Code.org) login sticker set — must match the students.codeorg_sticker
// DB CHECK list and CODEORG_STICKERS in client/src/utils/stickers.js.
const CODEORG_STICKERS = [
  'alien', 'bat', 'bird', 'cat', 'dinosaur', 'dog', 'dragon', 'ghost', 'knight',
  'monster', 'ninja', 'ninja2', 'octopus', 'penguin', 'pirate', 'princess',
  'robot', 'spacebot', 'squirrel', 'unicorn', 'witch', 'wizard', 'zombie',
];

const PROGRAMS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(
      json_build_object(
        'id', sp.id,
        'program', sp.program,
        'belt_level', sp.belt_level,
        'belt_sublevel', sp.belt_sublevel,
        'current_project', sp.current_project,
        'project_status', sp.project_status,
        'last_sub_program', sp.last_sub_program,
        'last_module_name', sp.last_module_name,
        'last_lesson_name', sp.last_lesson_name,
        'last_session_date', sp.last_session_date,
        'percent_complete', sp.percent_complete
      ) ORDER BY sp.created_at
    ) FROM student_programs sp WHERE sp.student_id = s.id),
    '[]'::json
  ) AS programs
`;

// GET /api/students
router.get('/', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  const { search, program, belt, sort } = req.query;
  const fetchAll = req.query.all === 'true';
  const limit = fetchAll ? null : Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = fetchAll ? null : Math.max(parseInt(req.query.offset) || 0, 0);
  const showInactive = req.query.inactive === 'true' && ['manager', 'admin'].includes(req.session.role);

  const SORT_ORDERS = {
    last_active: `(SELECT MAX(pl2.session_date) FROM progress_logs pl2 WHERE pl2.student_id = s.id AND pl2.notes IS DISTINCT FROM 'Marked complete from roadmap') DESC NULLS LAST, s.full_name ASC`,
    joined: `s.created_at DESC, s.full_name ASC`,
    name: `s.full_name ASC`,
  };
  const orderClause = SORT_ORDERS[sort] || SORT_ORDERS.name;
  const params = [req.session.activeLocationId, !showInactive];
  let paramCount = 2;

  let query = `
    SELECT s.*,
      COUNT(*) OVER() AS total_count,
      (SELECT MAX(pl.session_date) FROM progress_logs pl WHERE pl.student_id = s.id AND pl.notes IS DISTINCT FROM 'Marked complete from roadmap') AS last_activity,
      ${PROGRAMS_SUBQUERY}
    FROM students s
    WHERE s.active = $2 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1)
  `;

  if (search) {
    paramCount++;
    query += ` AND s.full_name ILIKE $${paramCount}`;
    params.push(`%${search}%`);
  }
  if (program) {
    paramCount++;
    query += ` AND EXISTS (SELECT 1 FROM student_programs sp2 WHERE sp2.student_id = s.id AND sp2.program = $${paramCount})`;
    params.push(program);
  }
  if (belt) {
    paramCount++;
    query += ` AND EXISTS (SELECT 1 FROM student_programs sp2 WHERE sp2.student_id = s.id AND sp2.belt_level = $${paramCount})`;
    params.push(belt);
  }

  query += ` ORDER BY ${orderClause}`;
  if (!fetchAll) {
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(limit);
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);
  }

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(query, params),
      pool.query(
        `SELECT sp.program, COUNT(DISTINCT sp.student_id)::int AS count
         FROM student_programs sp
         JOIN students s ON sp.student_id = s.id
         WHERE s.active = $2 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1)
         GROUP BY sp.program`,
        [req.session.activeLocationId, !showInactive]
      ),
    ]);
    const total = rows[0]?.total_count ?? 0;
    const programCounts = countRows.reduce((acc, r) => ({ ...acc, [r.program]: r.count }), {});
    res.json({ students: rows, total, programCounts });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/birthdays — active ninjas at this location who have a
// birthday on file. Must stay above /:id or Express matches this as an id.
// Month/day are sent separately so the client can rank upcoming birthdays
// without re-parsing a date in the browser's timezone.
router.get('/birthdays', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.full_name,
             to_char(s.birthday, 'YYYY-MM-DD') AS birthday,
             EXTRACT(MONTH FROM s.birthday)::int AS month,
             EXTRACT(DAY   FROM s.birthday)::int AS day
      FROM students s
      WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $1) AND s.active = true AND s.birthday IS NOT NULL
      ORDER BY s.full_name ASC
    `, [req.session.activeLocationId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching birthdays:', err);
    res.status(500).json({ error: 'Failed to fetch birthdays' });
  }
});

// GET /api/students/:id
router.get('/:id', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const isManager = ['manager', 'admin'].includes(req.session.role);

  try {
    const params = isManager ? [id] : [id, req.session.activeLocationId];
    const locationClause = isManager ? '' : 'AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)';
    const activeClause  = isManager ? '' : 'AND s.active = true';
    const { rows } = await pool.query(
      `SELECT s.*, ${PROGRAMS_SUBQUERY} FROM students s WHERE s.id = $1 ${activeClause} ${locationClause}`,
      params
    );
    const student = rows[0];
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { rows: progressLogs } = await pool.query(`
      SELECT pl.*, u.display_name AS sensei_name,
        COALESCE(
          (SELECT json_agg(json_build_object('id', c.id, 'user_name', c.user_name, 'body', c.body, 'created_at', c.created_at) ORDER BY c.created_at ASC)
           FROM progress_log_comments c WHERE c.log_id = pl.id),
          '[]'::json
        ) AS comments,
        ${reactionsSubquery({ table: 'progress_log_reactions', fk: 'log_id', subject: 'pl.id', userParam: '$2' })} AS reactions
      FROM progress_logs pl
      LEFT JOIN users u ON pl.sensei_id = u.id
      WHERE pl.student_id = $1
      ORDER BY pl.session_date DESC, pl.created_at DESC
    `, [id, req.session.userId]);

    // Club attendance — counts as activity sessions alongside progress logs
    const { rows: clubSessions } = await pool.query(`
      SELECT cs.id, cs.club_name, cs.session_date
      FROM club_attendees ca
      JOIN club_sessions cs ON ca.club_session_id = cs.id
      WHERE ca.student_id = $1
      ORDER BY cs.session_date DESC, cs.created_at DESC
    `, [id]);

    // Strip parent contact fields for senseis
    if (!isManager) {
      delete student.parent_name;
      delete student.parent_email;
      delete student.parent_phone;
    }

    // Most recent pending check-in date — used by LogEntryForm to display the correct session date
    const { rows: assignmentRows } = await pool.query(
      `SELECT session_date FROM daily_assignments
       WHERE student_id = $1 AND completed = false
       ORDER BY session_date ASC, created_at ASC LIMIT 1`,
      [id]
    );
    const pending_checkin_date = assignmentRows[0]
      ? new Date(assignmentRows[0].session_date).toISOString().split('T')[0]
      : null;

    res.json({ ...student, progress_logs: progressLogs, club_sessions: clubSessions, pending_checkin_date });
  } catch (err) {
    console.error('Error fetching student:', err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// POST /api/students
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { full_name, birthday } = req.body;

  if (!full_name) return res.status(400).json({ error: 'Full name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO students (full_name, birthday, location_id) VALUES ($1, $2, $3) RETURNING *',
      [full_name, birthday || null, req.session.activeLocationId]
    );
    // Home and membership are written together: the creating center is where
    // the ninja lives, and every read from here on trusts student_locations.
    await addMembership(client, rows[0].id, req.session.activeLocationId, req.session.userId);
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], programs: [] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating student:', err);
    res.status(500).json({ error: 'Failed to create student' });
  } finally {
    client.release();
  }
});

// POST /api/students/:id/programs — add a program enrollment
router.post('/:id/programs', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { program, belt_level, belt_sublevel, current_project, project_status } = req.body;

  if (!program) return res.status(400).json({ error: 'program is required' });

  // belt_level must be a real belt label (or absent); belt_sublevel must be a
  // sane in-range integer. Without this a manager can store an arbitrary belt
  // string or an out-of-range sublevel (e.g. 1000) — belt_level has no DB CHECK.
  if (!isValidBelt(belt_level || null)) return res.status(400).json({ error: 'Invalid belt level' });

  try {
    const subError = await validateSublevel(pool, belt_level || null, belt_sublevel ?? null);
    if (subError) return res.status(400).json({ error: subError });

    const { rows: studentRows } = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [id, req.session.activeLocationId]
    );
    if (!studentRows[0]) return res.status(404).json({ error: 'Student not found' });

    const { rows } = await pool.query(`
      INSERT INTO student_programs (student_id, program, belt_level, belt_sublevel, current_project, project_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, program, belt_level || null, belt_sublevel || null, current_project || null, project_status || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Student already enrolled in this program' });
    console.error('Error adding program:', err);
    res.status(500).json({ error: 'Failed to add program' });
  }
});

// PATCH /api/students/:id/programs/:program — update enrollment details
router.patch('/:id/programs/:program', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id, program } = req.params;
  const { belt_level, belt_sublevel, current_project, project_status } = req.body;

  if (belt_level !== undefined && !isValidBelt(belt_level)) {
    return res.status(400).json({ error: 'Invalid belt level' });
  }

  try {
    const subError = await validateSublevel(
      pool,
      belt_level !== undefined ? belt_level : null,
      belt_sublevel !== undefined ? belt_sublevel : null
    );
    if (subError) return res.status(400).json({ error: subError });

    const { rows } = await pool.query(`
      UPDATE student_programs sp
      SET belt_level = $1, belt_sublevel = $2, current_project = $3, project_status = $4
      FROM students s
      WHERE sp.student_id = $5 AND sp.program = $6
        AND sp.student_id = s.id AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $7)
      RETURNING sp.*
    `, [
      belt_level !== undefined ? belt_level : null,
      belt_sublevel !== undefined ? belt_sublevel : null,
      current_project !== undefined ? current_project : null,
      project_status !== undefined ? project_status : null,
      id,
      decodeURIComponent(program),
      req.session.activeLocationId,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Enrollment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating program:', err);
    res.status(500).json({ error: 'Failed to update program' });
  }
});

// DELETE /api/students/:id/programs/:program — remove an enrollment
router.delete('/:id/programs/:program', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id, program } = req.params;

  try {
    const { rows } = await pool.query(
      `DELETE FROM student_programs sp
       USING students s
       WHERE sp.student_id = $1 AND sp.program = $2
         AND sp.student_id = s.id AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $3)
       RETURNING sp.id`,
      [id, decodeURIComponent(program), req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ message: 'Program removed' });
  } catch (err) {
    console.error('Error removing program:', err);
    res.status(500).json({ error: 'Failed to remove program' });
  }
});

// PATCH /api/students/:id
router.patch('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { full_name, birthday, parent_name, parent_email, parent_phone } = req.body;

  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM students WHERE id = $1 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [id, req.session.activeLocationId]
    );
    const student = existing[0];
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const newParentEmail = parent_email !== undefined ? parent_email : student.parent_email;
    const newParentName = parent_name !== undefined ? parent_name : student.parent_name;
    const newParentPhone = parent_phone !== undefined ? parent_phone : student.parent_phone;

    const { rows } = await pool.query(
      `UPDATE students SET
        full_name = $1, birthday = $2,
        parent_name = $3, parent_email = $4, parent_phone = $5
       WHERE id = $6 RETURNING *`,
      [
        full_name ?? student.full_name,
        birthday !== undefined ? birthday : student.birthday,
        newParentName,
        newParentEmail,
        newParentPhone,
        id,
      ]
    );

    // If parent contact changed, sync siblings (same old email, same location)
    const emailChanged = parent_email !== undefined && parent_email !== student.parent_email;
    if (emailChanged && student.parent_email) {
      await pool.query(
        `UPDATE students SET parent_name = $1, parent_email = $2, parent_phone = $3
         WHERE LOWER(parent_email) = LOWER($4) AND location_id = $5 AND active = true AND id != $6`,
        [newParentName, newParentEmail, newParentPhone, student.parent_email, req.session.activeLocationId, id]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// PATCH /api/students/:id/parent-note
router.patch('/:id/parent-note', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { parent_note } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE students SET parent_note = $1 WHERE id = $2 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $3) RETURNING parent_note',
      [parent_note || null, id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating parent note:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// PATCH /api/students/:id/note
router.patch('/:id/note', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { pinned_note } = req.body;

  if (pinned_note != null && typeof pinned_note !== 'string') {
    return res.status(400).json({ error: 'Invalid note' });
  }
  if (typeof pinned_note === 'string' && pinned_note.length > 2000) {
    return res.status(400).json({ error: 'Note too long (max 2000 characters)' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE students SET pinned_note = $1 WHERE id = $2 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $3) RETURNING pinned_note',
      [pinned_note || null, id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating pinned note:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// PATCH /api/students/:id/sticker — assign a Code.AI login sticker (JR only)
router.patch('/:id/sticker', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { codeorg_sticker } = req.body;

  if (codeorg_sticker != null && !CODEORG_STICKERS.includes(codeorg_sticker)) {
    return res.status(400).json({ error: 'Invalid sticker' });
  }

  try {
    if (codeorg_sticker != null) {
      // Scope to the active location so the response can't be used to probe
      // enrollment of students at other centers (400 vs 404 oracle)
      const { rows: enrolled } = await pool.query(
        `SELECT 1 FROM student_programs sp
           JOIN students s ON s.id = sp.student_id
          WHERE sp.student_id = $1 AND sp.program = 'JR'
            AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2) AND s.active = true`,
        [id, req.session.activeLocationId]
      );
      if (!enrolled[0]) {
        return res.status(400).json({ error: 'Stickers are only for ninjas enrolled in JR' });
      }
    }
    const { rows } = await pool.query(
      'UPDATE students SET codeorg_sticker = $1 WHERE id = $2 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $3) RETURNING codeorg_sticker',
      [codeorg_sticker || null, id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating sticker:', err);
    res.status(500).json({ error: 'Failed to update sticker' });
  }
});

// DELETE /api/students/:id (soft delete)
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });

    // At the ninja's home this archives them. At a center that only shares
    // them it removes the share, and the ninja carries on everywhere else.
    const outcome = await archiveOrRemove(pool, id, req.session.activeLocationId);
    if (!outcome) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: outcome === 'archived' ? 'Student deactivated' : 'Student removed from this center', outcome });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// DELETE /api/students/:id/permanent — hard delete, cascades all related data
router.delete('/:id/permanent', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, location_id AS home FROM students WHERE id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [id, req.session.activeLocationId]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Student not found' }); }

    // A center that only shares the ninja cannot destroy a record that belongs
    // to another center. For them, permanent delete means "remove the share".
    if (Number(rows[0].home) !== Number(req.session.activeLocationId)) {
      await client.query('DELETE FROM student_locations WHERE student_id = $1 AND location_id = $2', [id, req.session.activeLocationId]);
      await client.query('COMMIT');
      return res.json({ ok: true, outcome: 'removed' });
    }

    await client.query(`DELETE FROM progress_log_comments WHERE log_id IN (SELECT id FROM progress_logs WHERE student_id = $1)`, [id]);
    await client.query('DELETE FROM progress_logs WHERE student_id = $1', [id]);
    await client.query('DELETE FROM daily_assignments WHERE student_id = $1', [id]);
    await client.query('DELETE FROM student_programs WHERE student_id = $1', [id]);
    // club_attendees and club_members cascade automatically
    await client.query('DELETE FROM students WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error permanently deleting student:', err);
    res.status(500).json({ error: 'Failed to delete student' });
  } finally {
    client.release();
  }
});

// PATCH /api/students/:id/restore
router.patch('/:id/restore', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND active = false AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Archived student not found' });
    await pool.query('UPDATE students SET active = true WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error restoring student:', err);
    res.status(500).json({ error: 'Failed to restore student' });
  }
});

// GET /api/students/:id/roadmap — full curriculum with per-lesson completion flags
router.get('/:id/roadmap', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { program, sub_program } = req.query;
  if (!program) return res.status(400).json({ error: 'program is required' });

  try {
    const isManager = ['manager', 'admin'].includes(req.session.role);
    const { rows: studentRows } = await pool.query(
      isManager
        ? 'SELECT id FROM students WHERE id = $1'
        : 'SELECT id FROM students WHERE id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2) AND active = true',
      isManager ? [req.params.id] : [req.params.id, req.session.activeLocationId]
    );
    if (!studentRows[0]) return res.status(404).json({ error: 'Student not found' });

    const { rows: modules } = await pool.query(`
      SELECT m.id, m.module_name, m.module_order,
        COALESCE(json_agg(
          json_build_object('id', l.id, 'lesson_name', l.lesson_name, 'lesson_order', l.lesson_order)
          ORDER BY l.lesson_order ASC
        ) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
      FROM curriculum_modules m
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      WHERE m.program = $1
        AND (m.sub_program = $2 OR (m.sub_program IS NULL AND $2::text IS NULL))
      GROUP BY m.id
      ORDER BY m.module_order ASC
    `, [program, sub_program || null]);

    if (!modules.length) return res.status(404).json({ error: 'No curriculum found for this program' });

    const subParam = sub_program || null;
    const { rows: completedRows } = await pool.query(
      `SELECT DISTINCT module_name, lesson_name FROM progress_logs
       WHERE student_id = $1 AND program = $2
         AND module_name IS NOT NULL AND lesson_name IS NOT NULL
         AND status_at = 'Completed'
         ${subParam ? 'AND sub_program = $3' : ''}`,
      subParam ? [req.params.id, program, subParam] : [req.params.id, program]
    );
    const completedSet = new Set(completedRows.map(r => `${r.module_name}\x00${r.lesson_name}`));

    res.json(modules.map(m => ({
      id: m.id,
      module_name: m.module_name,
      module_order: m.module_order,
      lessons: m.lessons.map(l => ({
        id: l.id,
        lesson_name: l.lesson_name,
        lesson_order: l.lesson_order,
        completed: completedSet.has(`${m.module_name}\x00${l.lesson_name}`),
      })),
    })));
  } catch (err) {
    console.error('Roadmap fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch roadmap' });
  }
});

// POST /api/students/:id/roadmap/complete — batch-mark lessons complete from roadmap
router.post('/:id/roadmap/complete', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { program, sub_program, entries } = req.body;
  if (!program || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'program and entries array are required' });
  }

  try {
    const { rows: studentRows } = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [req.params.id, req.session.activeLocationId]
    );
    if (!studentRows[0]) return res.status(404).json({ error: 'Student not found' });

    // Dedup: skip lessons already completed (status_at = 'Completed') for this student+program
    const { rows: existingRows } = await pool.query(
      "SELECT DISTINCT module_name, lesson_name FROM progress_logs WHERE student_id = $1 AND program = $2 AND module_name IS NOT NULL AND lesson_name IS NOT NULL AND status_at = 'Completed'",
      [req.params.id, program]
    );
    const existingSet = new Set(existingRows.map(r => `${r.module_name}\x00${r.lesson_name}`));
    const newEntries = entries.filter(e => !existingSet.has(`${e.module_name}\x00${e.lesson_name}`));
    if (!newEntries.length) return res.json({ inserted: 0 });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of newEntries) {
        await client.query(
          `INSERT INTO progress_logs (student_id, program, sensei_id, session_date, notes, status_at, sub_program, module_name, lesson_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.params.id, program, req.session.userId, today, 'Marked complete from roadmap', 'Completed', sub_program || null, entry.module_name, entry.lesson_name]
        );
      }

      // Recompute percent_complete for current module
      const { rows: spRows } = await client.query(
        'SELECT last_module_name, last_sub_program FROM student_programs WHERE student_id = $1 AND program = $2',
        [req.params.id, program]
      );
      const currentModule = spRows[0]?.last_module_name;
      const currentSubProgram = spRows[0]?.last_sub_program;
      if (currentModule) {
        const { rows: doneRows } = await client.query(
          "SELECT COUNT(DISTINCT lesson_name) AS cnt FROM progress_logs WHERE student_id = $1 AND program = $2 AND module_name = $3 AND lesson_name IS NOT NULL AND status_at = 'Completed'",
          [req.params.id, program, currentModule]
        );
        const { rows: totalRows } = await client.query(
          `SELECT COUNT(cl.id) AS total FROM curriculum_lessons cl
           JOIN curriculum_modules cm ON cl.module_id = cm.id
           WHERE cm.program = $1 AND cm.module_name = $2
             AND (cm.sub_program = $3 OR (cm.sub_program IS NULL AND $3::text IS NULL))`,
          [program, currentModule, currentSubProgram || null]
        );
        const totalLessons = parseInt(totalRows[0].total);
        if (totalLessons > 0) {
          const pct = Math.min(100, Math.round((parseInt(doneRows[0].cnt) / totalLessons) * 100));
          await client.query(
            'UPDATE student_programs SET percent_complete = $1 WHERE student_id = $2 AND program = $3',
            [pct, req.params.id, program]
          );
        }
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ inserted: newEntries.length });
  } catch (err) {
    console.error('Roadmap complete error:', err);
    res.status(500).json({ error: 'Failed to mark lessons complete' });
  }
});

// POST /api/students/:id/roadmap/uncomplete — batch-remove completed lessons
router.post('/:id/roadmap/uncomplete', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { program, sub_program, entries } = req.body;
  if (!program || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'program and entries array are required' });
  }

  try {
    const { rows: studentRows } = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [req.params.id, req.session.activeLocationId]
    );
    if (!studentRows[0]) return res.status(404).json({ error: 'Student not found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of entries) {
        await client.query(
          "DELETE FROM progress_logs WHERE student_id = $1 AND program = $2 AND module_name = $3 AND lesson_name = $4 AND status_at = 'Completed'",
          [req.params.id, program, entry.module_name, entry.lesson_name]
        );
      }

      // Recompute percent_complete for current module
      const { rows: spRows } = await client.query(
        'SELECT last_module_name, last_sub_program FROM student_programs WHERE student_id = $1 AND program = $2',
        [req.params.id, program]
      );
      const currentModule = spRows[0]?.last_module_name;
      const currentSubProgram = spRows[0]?.last_sub_program;
      if (currentModule) {
        const { rows: doneRows } = await client.query(
          "SELECT COUNT(DISTINCT lesson_name) AS cnt FROM progress_logs WHERE student_id = $1 AND program = $2 AND module_name = $3 AND lesson_name IS NOT NULL AND status_at = 'Completed'",
          [req.params.id, program, currentModule]
        );
        const { rows: totalRows } = await client.query(
          `SELECT COUNT(cl.id) AS total FROM curriculum_lessons cl
           JOIN curriculum_modules cm ON cl.module_id = cm.id
           WHERE cm.program = $1 AND cm.module_name = $2
             AND (cm.sub_program = $3 OR (cm.sub_program IS NULL AND $3::text IS NULL))`,
          [program, currentModule, currentSubProgram || null]
        );
        const totalLessons = parseInt(totalRows[0].total);
        if (totalLessons > 0) {
          const pct = Math.min(100, Math.round((parseInt(doneRows[0].cnt) / totalLessons) * 100));
          await client.query(
            'UPDATE student_programs SET percent_complete = $1 WHERE student_id = $2 AND program = $3',
            [pct, req.params.id, program]
          );
        }
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ removed: entries.length });
  } catch (err) {
    console.error('Roadmap uncomplete error:', err);
    res.status(500).json({ error: 'Failed to remove lessons' });
  }
});

// POST /api/students/import — bulk import from CSV data
router.post('/import', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { students: incoming } = req.body;
  // Dry run: classify rows (added / duplicate / conflict / missing) WITHOUT
  // writing anything, so the caller can confirm before the real import.
  const dryRun = req.body.dryRun === true;
  const locationId = req.session.activeLocationId;

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'No student data provided' });
  }

  // Tolerant belt parse: match any known belt name appearing anywhere in the
  // raw Rank string, case-insensitive. Handles "White Belt", "White Belt 4",
  // "CREATE - White", "yellow belt", etc. Longest names first to avoid any
  // partial-substring collisions.
  const BELT_NAMES = [
    'Platinum', 'Bronze', 'Silver', 'Yellow', 'Orange', 'Purple',
    'Brown', 'Green', 'Black', 'White', 'Blue', 'Gold', 'Red',
  ];
  const parseBelt = (raw) => {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    return BELT_NAMES.find((name) => s.includes(name.toLowerCase())) || null;
  };

  const added = [];
  const duplicates = [];
  const conflicts = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of incoming) {
      const fullName = row.full_name?.trim();
      const program = row.program?.trim();
      if (!fullName || !program) continue;

      const beltLevel = parseBelt(row.belt_raw);

      // Check for existing student with same name + program at this location
      const { rows: existing } = await client.query(
        `SELECT s.id, sp.belt_level FROM students s
         JOIN student_programs sp ON sp.student_id = s.id
         WHERE LOWER(s.full_name) = LOWER($1) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2) AND sp.program = $3 AND s.active = true`,
        [fullName, locationId, program]
      );

      if (existing.length) {
        const currentBelt = existing[0].belt_level;
        // Same name+program already enrolled. If the CSV carries a belt that
        // differs from what's on file for THIS program, surface it as a change
        // the caller can choose to apply, scoped to this one program, never
        // touching others.
        if (beltLevel && beltLevel !== currentBelt) {
          conflicts.push({
            id: existing[0].id,
            full_name: fullName,
            program,
            current_belt: currentBelt || null,
            new_belt: beltLevel,
          });
        } else {
          duplicates.push({ id: existing[0].id, full_name: fullName });
        }
        continue;
      }

      // New enrollment. On a dry run, just record what WOULD be added and skip
      // every write (no real student id exists yet).
      if (dryRun) {
        added.push({ full_name: fullName, program });
        continue;
      }

      // Find or create the student (they may exist but not in this program yet)
      const { rows: existingStudent } = await client.query(
        'SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2) AND active = true',
        [fullName, locationId]
      );

      let studentId;
      if (existingStudent.length) {
        studentId = existingStudent[0].id;
      } else {
        const birthday = row.birthday ? (() => {
          const d = new Date(row.birthday);
          return isNaN(d) ? null : d.toISOString().split('T')[0];
        })() : null;

        const { rows: inserted } = await client.query(
          `INSERT INTO students (full_name, birthday, location_id, parent_name, parent_email, parent_phone)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [fullName, birthday, locationId, row.parent_name || null, row.parent_email || null, row.parent_phone || null]
        );
        studentId = inserted[0].id;
        await addMembership(client, studentId, locationId, req.session.userId);
      }

      await client.query(
        `INSERT INTO student_programs (student_id, program, belt_level, belt_sublevel)
         VALUES ($1, $2, $3, $4) ON CONFLICT (student_id, program) DO NOTHING`,
        [studentId, program, beltLevel, beltLevel ? 1 : null]
      );

      added.push({ id: studentId, full_name: fullName, program });
    }

    // Dry run never persists — roll back so the preview leaves no trace.
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Active roster students at this location who are NOT in the uploaded CSV
  // (matched by full name) — the caller can prompt to keep or remove them.
  const incomingNames = new Set(
    incoming.map((r) => r.full_name?.trim().toLowerCase()).filter(Boolean)
  );
  const { rows: activeRoster } = await pool.query(
    'SELECT id, full_name FROM students WHERE EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $1) AND active = true',
    [locationId]
  );
  const missing = activeRoster.filter(
    (s) => !incomingNames.has(s.full_name.trim().toLowerCase())
  );

  res.json({ added: added.length, added_students: added, duplicates, conflicts, missing, preview: dryRun });
});

// POST /api/students/import/apply-belts: override belt for chosen programs
// (used after import surfaces belt conflicts). Scoped per program so other
// programs (Robotics, AI, etc.) are never touched.
router.post('/import/apply-belts', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { updates } = req.body; // [{ id, program, belt_level }]
  const locationId = req.session.activeLocationId;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No belt updates provided' });
  }

  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      if (!u.id || !u.program || !u.belt_level) continue;
      // Skip any row whose belt isn't a real belt label — never store junk
      // (belt_level has no DB CHECK to fall back on).
      if (!ALL_BELTS.has(u.belt_level)) continue;
      const { rowCount } = await client.query(
        `UPDATE student_programs sp
         SET belt_level = $1, belt_sublevel = 1
         FROM students s
         WHERE sp.student_id = s.id
           AND sp.student_id = $2 AND sp.program = $3 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $4)`,
        [u.belt_level, u.id, u.program, locationId]
      );
      updated += rowCount;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ updated });
});

// POST /api/students/bulk-archive — archive (soft-delete) many students at once
router.post('/bulk-archive', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { ids } = req.body;
  const locationId = req.session.activeLocationId;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No student ids provided' });
  }
  const cleanIds = ids.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n));
  if (cleanIds.length === 0) {
    return res.status(400).json({ error: 'No valid student ids' });
  }

  // Absent from the file at this center. A ninja whose home is here is
  // archived; one this center only shares is removed from this center and
  // left alone everywhere else. The count the client shows is of both.
  let archived = 0;
  let removed = 0;
  const { rows: members } = await pool.query(
    'SELECT id FROM students WHERE id = ANY($1::int[]) AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
    [cleanIds, locationId]
  );
  for (const { id } of members) {
    const outcome = await archiveOrRemove(pool, id, locationId);
    if (outcome === 'archived') archived += 1;
    if (outcome === 'removed') removed += 1;
  }
  res.json({ archived: archived + removed, archivedOutright: archived, removedFromCenter: removed });
});

module.exports = router;
