// Hard-delete a staff account inside an open transaction. Used by the
// director's permanent delete of a sensei and by a staff member deleting
// their own account, so the two can never disagree about what goes.
//
// The work outlives the worker. Logs and comments are a ninja's real session
// history, so the author is nulled out rather than the row deleted, and the
// UI reads a null author as "Deleted user". user_name is nulled too: it is
// the one place a removed staff member's name would otherwise survive.
// Every FK listed here is NO ACTION, so a missed table fails the delete; the
// later tables (tasks, event listings, MyStudio connections, student
// locations, user_locations) were created ON DELETE SET NULL / CASCADE and
// look after themselves.
async function deleteStaffUser(client, id) {
  await client.query('UPDATE progress_logs SET sensei_id = NULL WHERE sensei_id = $1', [id]);
  await client.query('UPDATE progress_log_comments SET user_id = NULL, user_name = NULL WHERE user_id = $1', [id]);
  await client.query('UPDATE club_session_comments SET user_id = NULL, user_name = NULL WHERE user_id = $1', [id]);
  await client.query('UPDATE daily_assignments SET sensei_id = NULL WHERE sensei_id = $1', [id]);
  await client.query('UPDATE club_sessions SET sensei_id = NULL WHERE sensei_id = $1', [id]);
  await client.query('UPDATE club_definitions SET created_by = NULL WHERE created_by = $1', [id]);
  await client.query('UPDATE club_resources SET created_by = NULL WHERE created_by = $1', [id]);
  await client.query('UPDATE announcements SET created_by = NULL WHERE created_by = $1', [id]);
  await client.query('UPDATE releases SET created_by = NULL WHERE created_by = $1', [id]);
  await client.query('UPDATE app_settings SET updated_by = NULL WHERE updated_by = $1', [id]);
  // Reactions carry no attribution worth keeping and cascade on their own.
  await client.query('DELETE FROM users WHERE id = $1', [id]);
}

// The reasons a person can give for leaving. Mirrored in
// client/src/lib/deletionReasons.js; the DB CHECK on account_deletions.reason
// is the third copy and the one that wins.
const DELETION_REASONS = ['leaving', 'not_useful', 'privacy', 'broken', 'other'];

function cleanDetails(v) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, 500) : null;
}

module.exports = { deleteStaffUser, DELETION_REASONS, cleanDetails };
