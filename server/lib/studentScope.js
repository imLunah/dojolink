// Which center a ninja belongs to, in SQL.
//
// A student has a HOME center in students.location_id and may belong to more
// besides, through student_locations (migration 027). "Is this ninja at this
// center" therefore means membership, not the home column, and every route that
// asks the question builds the clause here so they cannot drift apart. The
// backfill in 027 guarantees the home row exists in student_locations, so a
// membership check alone is complete: nothing needs to also test location_id.
//
// `alias` is the students table alias in the surrounding query ("s", or
// "students" when there is none). `param` is the placeholder holding the
// location id ("$2"), or a fragment such as "cs.location_id" when the location
// comes from another row in the same query.

function memberOf(alias, param) {
  return `EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = ${alias}.id AND sl_m.location_id = ${param})`;
}

// The one write every creation path must make: a new ninja is a member of the
// center that made them. Home and membership are written together so no ninja
// can exist without a membership row, which is what lets every read trust the
// table alone.
async function addMembership(client, studentId, locationId, addedBy = null) {
  await client.query(
    `INSERT INTO student_locations (student_id, location_id, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_id, location_id) DO NOTHING`,
    [studentId, locationId, addedBy]
  );
}

// Removing a ninja from a center means one of two things, and which one is not
// the caller's choice.
//
// At the ninja's HOME center it archives them outright, as it always has. At any
// other center it only removes that center's membership row: the ninja goes on
// existing, and stays on their home roster and every other roster they belong
// to. Without this rule a director at Fullerton archiving a ninja they share
// with Yorba Linda would make the child disappear from Yorba Linda's board.
//
// Returns 'archived', 'removed', or null when the ninja is not at this center
// at all (which the caller should report as not found).
async function archiveOrRemove(client, studentId, locationId) {
  const { rows } = await client.query(
    'SELECT location_id AS home FROM students WHERE id = $1',
    [studentId]
  );
  if (!rows[0]) return null;

  if (Number(rows[0].home) === Number(locationId)) {
    const { rowCount } = await client.query(
      'UPDATE students SET active = false WHERE id = $1 AND active = true',
      [studentId]
    );
    return rowCount ? 'archived' : null;
  }

  const { rowCount } = await client.query(
    'DELETE FROM student_locations WHERE student_id = $1 AND location_id = $2',
    [studentId, locationId]
  );
  return rowCount ? 'removed' : null;
}

module.exports = { memberOf, addMembership, archiveOrRemove };
