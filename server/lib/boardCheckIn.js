// Putting a ninja on Today's Board.
//
// One function, used by POST /api/daily and by the check-in kiosk, so the
// overdue-reuse rule below lives in one place. Callers validate first (the
// ninja is active at the center, and enrolled in `program` when one is given);
// this only writes.
async function addToBoard(pool, { studentId, program, date }) {
  if (program) {
    // If the ninja already has an OVERDUE (past-date) unlogged session for this
    // program, reuse it and move it to today instead of stacking a duplicate —
    // checking them in shouldn't pile an extra session onto the overdue. A same-
    // day incomplete is left alone so a second check-in today creates a second
    // loggable session.
    const { rows: existing } = await pool.query(
      `SELECT id FROM daily_assignments
       WHERE student_id = $1 AND program = $2 AND completed = false AND session_date < $3
       ORDER BY session_date ASC LIMIT 1`,
      [studentId, program, date]
    );

    if (existing[0]) {
      // checked_in_at follows the ninja to today: the parent portal's live
      // schedule reads the arrival, and this row's created_at is the old one.
      await pool.query(
        'UPDATE daily_assignments SET session_date = $1, checked_in_at = NOW() WHERE id = $2',
        [date, existing[0].id]
      );
      return existing[0].id;
    }

    const { rows: inserted } = await pool.query(
      'INSERT INTO daily_assignments (student_id, program, session_date) VALUES ($1, $2, $3) RETURNING id',
      [studentId, program, date]
    );
    return inserted[0].id;
  }

  // Generic check-in — no class chosen. Sensei picks the class when logging,
  // which claims this row (sets its program) via the progress route.
  const { rows: inserted } = await pool.query(
    'INSERT INTO daily_assignments (student_id, program, session_date) VALUES ($1, NULL, $2) RETURNING id',
    [studentId, date]
  );
  return inserted[0].id;
}

module.exports = { addToBoard };
