const express = require('express');
const router = express.Router();
const { requireSensei, requireOwnLocation } = require('../middleware/auth');
const { ALL_BELTS, isValidBelt, validateSublevel } = require('../lib/belts');
const { toggleReaction } = require('../lib/reactions');

const REACTION_TABLE = { table: 'progress_log_reactions', fk: 'log_id' };

// Free-text curriculum/progress fields are intentionally freeform (senseis log custom
// lesson/module names not in the curriculum tables), so they're bounded by length
// rather than a closed vocabulary — same defense-in-depth as the notes cap.
const MAX_FIELD = 200;

// Log comments are prose, so they get the same ceiling as notes rather than MAX_FIELD.
const MAX_COMMENT = 2000;

// The status a session can carry. Freeform on the write path (a sensei may log a
// custom project), but the edit path offers a fixed set of buttons, so anything
// outside this list on a PATCH is junk rather than a sensei's own wording.
const STATUSES = ['Started', 'Working On', 'Completed'];

// percent_complete = distinct lessons marked Completed in a module / lessons in
// that module. Called after any write that can change which lessons are done —
// a new log, or an edit that flips a lesson's status.
async function recomputePercentComplete(client, { student_id, program, module_name, sub_program }) {
  if (program === 'CREATE' || !module_name) return;
  const { rows: doneRows } = await client.query(
    "SELECT COUNT(DISTINCT lesson_name) AS cnt FROM progress_logs WHERE student_id = $1 AND program = $2 AND module_name = $3 AND lesson_name IS NOT NULL AND status_at = 'Completed'",
    [student_id, program, module_name]
  );
  const { rows: totalRows } = await client.query(
    `SELECT COUNT(cl.id) AS total
     FROM curriculum_lessons cl
     JOIN curriculum_modules cm ON cl.module_id = cm.id
     WHERE cm.program = $1 AND cm.module_name = $2
       AND (cm.sub_program = $3 OR (cm.sub_program IS NULL AND $3::text IS NULL))`,
    [program, module_name, sub_program || null]
  );
  const totalLessons = parseInt(totalRows[0].total);
  if (totalLessons > 0) {
    const pct = Math.min(100, Math.round((parseInt(doneRows[0].cnt) / totalLessons) * 100));
    await client.query(
      'UPDATE student_programs SET percent_complete = $1 WHERE student_id = $2 AND program = $3',
      [pct, student_id, program]
    );
  }
}

// POST /api/progress
// Accepts either single-lesson fields OR lesson_entries array for multi-lesson sessions.
router.post('/', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const {
    student_id,
    program,
    session_date,
    notes,
    belt_level_at,
    belt_sublevel_at,
    project_at,
    status_at,
    update_student,
    sub_program,
    module_name,
    lesson_name,
    lesson_entries, // array of { sub_program, module_name, lesson_name } for multi-lesson sessions
                    // A CREATE session may also carry belt_level_at / belt_sublevel_at per entry,
                    // for a class where the ninja finished a level or a belt and carried on.
  } = req.body;

  if (!student_id || !program || !notes) {
    return res.status(400).json({ error: 'student_id, program, and notes are required' });
  }
  if (notes.length > 2000) return res.status(400).json({ error: 'Notes too long (max 2000 chars)' });

  // Build the list of lesson entries to insert — fall back to single-lesson fields if no array
  const entries = (Array.isArray(lesson_entries) && lesson_entries.length > 0)
    ? lesson_entries
    : [{ sub_program: sub_program || null, module_name: module_name || null, lesson_name: lesson_name || null }];

  // belt_level_at must be a real belt label (or absent) — block junk stored verbatim
  // in the log row. The overwrite path below applies the same ALL_BELTS whitelist.
  if (!isValidBelt(belt_level_at)) {
    return res.status(400).json({ error: 'Invalid belt level' });
  }
  // Bound every free-text curriculum/progress field (top-level + per-entry) by length.
  const cappedFields = [
    sub_program, module_name, lesson_name, project_at, status_at,
    ...entries.flatMap((e) => [e.sub_program, e.module_name, e.lesson_name, e.project_at, e.status]),
  ];
  if (cappedFields.some((v) => typeof v === 'string' && v.length > MAX_FIELD)) {
    return res.status(400).json({ error: `Field too long (max ${MAX_FIELD} chars)` });
  }

  // session_date (when provided) is written straight into progress_logs, so it must
  // be a real calendar date — not the future, not absurdly old. Without this an
  // authenticated sensei can backdate/post-date a log to any year (e.g. 2030).
  const pacificToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  if (session_date != null) {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(session_date) && !Number.isNaN(Date.parse(session_date));
    if (!validFormat || session_date > pacificToday || session_date < '2020-01-01') {
      return res.status(400).json({ error: 'Invalid session date' });
    }
  }

  const senseiId = req.session.userId;

  try {
    // Bound belt_sublevel_at against the real max for the belt (blocks values like 1000).
    const subError = await validateSublevel(pool, belt_level_at ?? null, belt_sublevel_at ?? null);
    if (subError) return res.status(400).json({ error: subError });

    // A per-entry belt and level is a second way into the same two columns, so
    // it gets the same two checks. Validating only the top level values would
    // hand back the out-of-range write session 27 closed, one nesting deeper.
    // Each entry's level is bounded against that entry's OWN belt.
    for (const entry of entries) {
      if (entry.belt_level_at !== undefined && !isValidBelt(entry.belt_level_at)) {
        return res.status(400).json({ error: 'Invalid belt level' });
      }
      const entrySubError = await validateSublevel(
        pool,
        entry.belt_level_at ?? belt_level_at ?? null,
        entry.belt_sublevel_at ?? null
      );
      if (entrySubError) return res.status(400).json({ error: entrySubError });
    }

    // Prefer today's pending assignment so logging clears the kid from the board.
    // A generic check-in (program IS NULL) is also eligible — the sensei picking a
    // class here claims it. Exact program matches win over a generic row.
    const { rows: assignmentRows } = await pool.query(
      `SELECT id, session_date FROM daily_assignments
       WHERE student_id = $1 AND completed = false AND (program = $2 OR program IS NULL)
       ORDER BY (CASE WHEN program = $2 THEN 0 ELSE 1 END),
                (session_date = $3::date) DESC, session_date ASC, created_at ASC LIMIT 1`,
      [student_id, program, pacificToday]
    );
    const date = assignmentRows[0]
      ? new Date(assignmentRows[0].session_date).toISOString().split('T')[0]
      : (session_date || new Date().toISOString().split('T')[0]);
    const assignmentId = assignmentRows[0]?.id || null;

    const { rows: studentRows } = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND active = true AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2)',
      [student_id, req.session.activeLocationId]
    );
    if (!studentRows[0]) return res.status(404).json({ error: 'Student not found' });

    // Reject anything that isn't a program the student is actually enrolled in.
    // Without this, an arbitrary `program` string lands in progress_logs and
    // daily_assignments and then pollutes the TodayBoard program filter.
    const { rows: enrollRows } = await pool.query(
      'SELECT 1 FROM student_programs WHERE student_id = $1 AND program = $2',
      [student_id, program]
    );
    if (!enrollRows[0]) return res.status(400).json({ error: 'Student not enrolled in this program' });

    let lastLogId = null;
    let lastEntry = entries[entries.length - 1];
    const client = await pool.connect();

    // Insert one progress_log row per lesson entry
    try {
      await client.query('BEGIN');
    for (const entry of entries) {
      const { rows: logRows } = await client.query(`
        INSERT INTO progress_logs (student_id, program, sensei_id, session_date, belt_level_at, belt_sublevel_at, project_at, status_at, notes, sub_program, module_name, lesson_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        student_id,
        program,
        senseiId,
        date,
        entry.belt_level_at ?? belt_level_at ?? null,
        entry.belt_sublevel_at ?? belt_sublevel_at ?? null,
        entry.project_at ?? project_at ?? null,
        entry.status ?? status_at ?? null,
        notes,
        entry.sub_program || null,
        entry.module_name || null,
        entry.lesson_name || null,
      ]);
      lastLogId = logRows[0].id;
    }

    // Always update last_sub_program, last_module_name, last_lesson_name, last_session_date
    const { rows: enrollmentRows } = await client.query(
      'SELECT * FROM student_programs WHERE student_id = $1 AND program = $2',
      [student_id, program]
    );
    const enrollment = enrollmentRows[0];
    if (enrollment) {
      if (update_student) {
        await client.query(`
          UPDATE student_programs
          SET belt_level = $1, belt_sublevel = $2, current_project = $3, project_status = $4,
              last_sub_program = $5, last_module_name = $6, last_lesson_name = $7, last_session_date = $8
          WHERE student_id = $9 AND program = $10
        `, [
          // Any real belt (incl. Bronze/Silver/Platinum/Gold — they're full ladder
          // belts since the restructure) may overwrite the tracked belt. isValidBelt
          // already 400s anything else, so only real labels reach this point.
          (belt_level_at !== undefined && (belt_level_at === null || ALL_BELTS.has(belt_level_at))) ? belt_level_at : enrollment.belt_level,
          belt_sublevel_at !== undefined ? belt_sublevel_at : enrollment.belt_sublevel,
          project_at !== undefined ? project_at : enrollment.current_project,
          status_at !== undefined ? status_at : enrollment.project_status,
          lastEntry.sub_program || enrollment.last_sub_program,
          lastEntry.module_name || enrollment.last_module_name,
          lastEntry.lesson_name || enrollment.last_lesson_name,
          date,
          student_id,
          program,
        ]);
      } else {
        await client.query(`
          UPDATE student_programs
          SET last_sub_program = COALESCE($1, last_sub_program),
              last_module_name = COALESCE($2, last_module_name),
              last_lesson_name = COALESCE($3, last_lesson_name),
              last_session_date = $4
          WHERE student_id = $5 AND program = $6
        `, [
          lastEntry.sub_program || null,
          lastEntry.module_name || null,
          lastEntry.lesson_name || null,
          date,
          student_id,
          program,
        ]);
      }
    }

    // Mark only the oldest pending assignment complete (not all — there may be multiple check-ins).
    // If the ninja was never checked in (no assignment), create one already-completed so the
    // logged session still lands on Today's Board under "Logged" instead of vanishing.
    if (assignmentId) {
      // Also stamp the program — this claims a generic (null-program) check-in for
      // the class the sensei chose; harmless when the row already had this program.
      await client.query(
        'UPDATE daily_assignments SET completed = true, program = $2 WHERE id = $1',
        [assignmentId, program]
      );
    } else {
      await client.query(
        'INSERT INTO daily_assignments (student_id, program, session_date, sensei_id, completed) VALUES ($1, $2, $3, $4, true)',
        [student_id, program, date, senseiId]
      );
    }

    // Auto-compute percent_complete: lessons done in current module / total lessons in that module
    if (lastEntry.lesson_name) {
      await recomputePercentComplete(client, {
        student_id,
        program,
        module_name: lastEntry.module_name,
        sub_program: lastEntry.sub_program,
      });
    }

    await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const { rows } = await pool.query(`
      SELECT pl.*, u.display_name as sensei_name
      FROM progress_logs pl
      LEFT JOIN users u ON pl.sensei_id = u.id
      WHERE pl.id = $1
    `, [lastLogId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating progress log:', err.message, '| code:', err.code, '| detail:', err.detail);
    res.status(500).json({ error: 'Failed to create progress log' });
  }
});

// Every column of a log the editor may rewrite, paired with the enrollment
// column it mirrors onto when the log is the ninja's most recent for a program.
// A key absent from the body is left alone, so a caller sending only notes
// still behaves as it always did. `keepWhenNull` marks the columns the write
// path only ever fills in, never blanks (a CREATE log carries no lesson, and
// posting one shouldn't erase the last lesson the ninja did) — an edit mirrors
// on the same terms.
const EDITABLE_FIELDS = {
  program: {},
  session_date: {},
  belt_level_at: { column: 'belt_level' },
  belt_sublevel_at: { column: 'belt_sublevel' },
  project_at: { column: 'current_project' },
  status_at: { column: 'project_status' },
  sub_program: { column: 'last_sub_program', keepWhenNull: true },
  module_name: { column: 'last_module_name', keepWhenNull: true },
  lesson_name: { column: 'last_lesson_name', keepWhenNull: true },
};

// PATCH /api/progress/:id — managers edit any log; senseis edit only their own.
// Takes notes plus any of EDITABLE_FIELDS. An edit carries the same side effects
// the original write did (the tracked enrollment, percent_complete), so
// correcting a log doesn't leave the rest of the ninja's record contradicting it.
router.patch('/:id', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { notes, program, session_date, belt_level_at, belt_sublevel_at, status_at } = req.body;
  if (!notes?.trim()) return res.status(400).json({ error: 'Notes are required' });
  if (notes.length > 2000) return res.status(400).json({ error: 'Notes too long (max 2000 chars)' });

  const given = (field) => req.body[field] !== undefined;

  if (status_at !== undefined && status_at !== null && !STATUSES.includes(status_at)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  // Same whitelist the write path applies — a log's belt is a snapshot, not free text.
  if (given('belt_level_at') && !isValidBelt(belt_level_at)) {
    return res.status(400).json({ error: 'Invalid belt level' });
  }
  if (given('program') && (typeof program !== 'string' || !program)) {
    return res.status(400).json({ error: 'Invalid program' });
  }
  const pacificToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  if (given('session_date')) {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(session_date || '') && !Number.isNaN(Date.parse(session_date));
    if (!validFormat || session_date > pacificToday || session_date < '2020-01-01') {
      return res.status(400).json({ error: 'Invalid session date' });
    }
  }
  const capped = ['project_at', 'status_at', 'sub_program', 'module_name', 'lesson_name']
    .map((f) => req.body[f]);
  if (capped.some((v) => typeof v === 'string' && v.length > MAX_FIELD)) {
    return res.status(400).json({ error: `Field too long (max ${MAX_FIELD} chars)` });
  }

  const isManager = ['manager', 'admin'].includes(req.session.role);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read the row under its lock first: the old program/module decide which
    // enrollment a move has to leave behind, and the ownership + location scope
    // is the same gate the update itself would have carried.
    const lookup = [req.params.id, req.session.activeLocationId];
    if (!isManager) lookup.push(req.session.userId);
    const { rows: before } = await client.query(
      `SELECT pl.* FROM progress_logs pl
       JOIN students s ON pl.student_id = s.id
       WHERE pl.id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)
       ${isManager ? '' : 'AND pl.sensei_id = $3'}
       FOR UPDATE OF pl`,
      lookup
    );
    const old = before[0];
    if (!old) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Log not found or not yours' });
    }

    const nextProgram = given('program') ? program : old.program;
    // A log may only sit on a program the ninja is actually enrolled in — the
    // same rule the write path enforces, which is what keeps junk out of the
    // TodayBoard filter and the program CHECK constraints.
    if (given('program') && program !== old.program) {
      const { rows: enrolled } = await client.query(
        'SELECT 1 FROM student_programs WHERE student_id = $1 AND program = $2',
        [old.student_id, program]
      );
      if (!enrolled[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Student not enrolled in this program' });
      }
    }
    if (given('belt_sublevel_at')) {
      const subError = await validateSublevel(
        client,
        given('belt_level_at') ? (belt_level_at ?? null) : (old.belt_level_at ?? null),
        belt_sublevel_at ?? null
      );
      if (subError) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: subError });
      }
    }

    const sets = ['notes = $1'];
    const params = [notes.trim()];
    for (const field of Object.keys(EDITABLE_FIELDS)) {
      if (!given(field)) continue;
      params.push(req.body[field]);
      sets.push(`${field} = $${params.length}`);
    }
    params.push(req.params.id);
    await client.query(
      `UPDATE progress_logs SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );

    // The enrollment follows only when this is the newest log for the program —
    // fixing a session from two weeks ago shouldn't rewind the ninja to where
    // they were then.
    const { rows: newest } = await client.query(
      `SELECT id FROM progress_logs
       WHERE student_id = $1 AND program = $2
       ORDER BY session_date DESC, created_at DESC, id DESC LIMIT 1`,
      [old.student_id, nextProgram]
    );
    if (newest[0]?.id === old.id) {
      const mirrorSets = [];
      const mirrorParams = [];
      for (const [field, { column, keepWhenNull }] of Object.entries(EDITABLE_FIELDS)) {
        if (!column || !given(field)) continue;
        if (keepWhenNull && req.body[field] == null) continue;
        mirrorParams.push(req.body[field]);
        mirrorSets.push(`${column} = $${mirrorParams.length}`);
      }
      if (mirrorSets.length) {
        mirrorParams.push(old.student_id, nextProgram);
        await client.query(
          `UPDATE student_programs SET ${mirrorSets.join(', ')}
           WHERE student_id = $${mirrorParams.length - 1} AND program = $${mirrorParams.length}`,
          mirrorParams
        );
      }
    }

    // Which lessons count as done can change on both sides of a move, so the
    // program the log left is recomputed alongside the one it landed on.
    const after = {
      program: nextProgram,
      module_name: given('module_name') ? req.body.module_name : old.module_name,
      sub_program: given('sub_program') ? req.body.sub_program : old.sub_program,
    };
    await recomputePercentComplete(client, { student_id: old.student_id, ...after });
    if (after.program !== old.program || after.module_name !== old.module_name) {
      await recomputePercentComplete(client, {
        student_id: old.student_id,
        program: old.program,
        module_name: old.module_name,
        sub_program: old.sub_program,
      });
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Progress log update error:', err);
    res.status(500).json({ error: 'Failed to update log' });
  } finally {
    client.release();
  }
});

// DELETE /api/progress/:id — managers delete any log in their center; senseis delete only their own
router.delete('/:id', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const isManager = ['manager', 'admin'].includes(req.session.role);
  try {
    const ownershipClause = isManager ? '' : 'AND progress_logs.sensei_id = $3';
    const params = isManager
      ? [req.params.id, req.session.activeLocationId]
      : [req.params.id, req.session.activeLocationId, req.session.userId];

    const { rows } = await pool.query(
      `DELETE FROM progress_logs
       USING students s
       WHERE progress_logs.id = $1 AND progress_logs.student_id = s.id AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)
       ${ownershipClause}
       RETURNING progress_logs.id`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Log not found or not yours' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Progress log delete error:', err);
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

// POST /api/progress/:id/comments — any staff member can comment on a log entry.
// requireOwnLocation is load-bearing: managers may switch activeLocationId to any
// center to VIEW it, so scoping the lookup below to activeLocationId picks the
// target, it does not authorize the write. Without this gate a director could
// comment into a center they aren't assigned to (the club equivalent at
// clubs.js POST /:id/comments has always had it). The UI hides the box via
// isReadOnly, but that is a browser-side affordance, not a boundary.
router.post('/:id/comments', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { body } = req.body;
  if (body != null && typeof body !== 'string') return res.status(400).json({ error: 'Invalid comment' });
  if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (body.length > MAX_COMMENT) {
    return res.status(400).json({ error: `Comment too long (max ${MAX_COMMENT} characters)` });
  }

  try {
    const { rows: logRows } = await pool.query(
      `SELECT pl.id FROM progress_logs pl
       JOIN students s ON pl.student_id = s.id
       WHERE pl.id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)`,
      [req.params.id, req.session.activeLocationId]
    );
    if (!logRows[0]) return res.status(404).json({ error: 'Log not found' });

    const { rows } = await pool.query(
      `INSERT INTO progress_log_comments (log_id, user_id, user_name, body)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.session.userId, req.session.displayName, body.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Progress log comment error:', err);
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

// POST /api/progress/:id/reactions — toggle one emoji on a log entry.
// requireOwnLocation is load-bearing for exactly the reason the comment route
// above spells out: activeLocationId picks the target, it does not authorize
// writing to it. Reacting is not editing, so this is not gated on whose log it
// is; any staff member at that center can react to any log there.
router.post('/:id/reactions', requireSensei, requireOwnLocation, async (req, res) => {
  try {
    const result = await toggleReaction(req.app.get('db'), {
      ...REACTION_TABLE,
      emoji: req.body.emoji,
      userId: req.session.userId,
      verify: async (client) => {
        const { rows } = await client.query(
          `SELECT pl.id FROM progress_logs pl
           JOIN students s ON pl.student_id = s.id
           WHERE pl.id = $1 AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = s.id AND sl_m.location_id = $2)`,
          [req.params.id, req.session.activeLocationId]
        );
        return rows[0]?.id ?? null;
      },
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ reactions: result.reactions });
  } catch (err) {
    console.error('Progress log reaction error:', err);
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

module.exports = router;
