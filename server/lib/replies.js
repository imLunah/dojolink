// Replies on progress logs and club sessions, which behave like chat messages:
// @mentions, emoji reactions, an edited mark. The two kinds of reply live in
// their own tables (see migration 054), and everything that treats them the
// same way lives here so the two routes cannot drift apart.

const { reactionsSubquery } = require('./reactions');

// Code-controlled table names per kind of reply. Never request input.
const KINDS = {
  progress: {
    comments: 'progress_log_comments',
    mentions: 'progress_log_comment_mentions',
    reactions: 'progress_log_comment_reactions',
  },
  club: {
    comments: 'club_session_comments',
    mentions: 'club_session_comment_mentions',
    reactions: 'club_session_comment_reactions',
  },
};

// The JSON a client draws for one reply. `c` is the reply row; `userParam` is
// the placeholder holding the viewer's id, for "did I react".
function replyJson(kind, userParam) {
  const k = KINDS[kind];
  return `json_build_object(
    'id', c.id,
    'user_id', c.user_id,
    'user_name', c.user_name,
    'user_pic', cu.profile_pic_url,
    'body', c.body,
    'created_at', c.created_at,
    'edited_at', c.edited_at,
    'mentions', ${mentionsSubquery(kind)},
    'reactions', ${reactionsSubquery({ table: k.reactions, fk: 'comment_id', subject: 'c.id', userParam })}
  )`;
}

// Who a reply addressed, by the username and name they carry today. The
// client highlights only these, so an "@" typed by hand never looks like a
// mention it is not.
function mentionsSubquery(kind) {
  return `COALESCE((
    SELECT json_agg(json_build_object('user_id', m.user_id, 'display_name', mu.display_name, 'username', mu.username) ORDER BY mu.display_name)
    FROM ${KINDS[kind].mentions} m JOIN users mu ON mu.id = m.user_id
    WHERE m.comment_id = c.id
  ), '[]'::json)`;
}

// One reply, shaped exactly as it is inside a thread, for the responses to a
// post or an edit.
async function readReply(pool, kind, id, viewerId) {
  const { rows } = await pool.query(
    `SELECT ${replyJson(kind, '$2')} AS reply
     FROM ${KINDS[kind].comments} c LEFT JOIN users cu ON cu.id = c.user_id
     WHERE c.id = $1`,
    [id, viewerId]
  );
  return rows[0]?.reply ?? null;
}

function readMentionIds(value) {
  if (value === undefined) return { ids: [] };
  if (!Array.isArray(value) || value.length > 50) return { error: 'Invalid mentions' };
  const ids = [...new Set(value.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) return { error: 'Invalid mentions' };
  return { ids };
}

// Records who a reply addresses. Every recipient is re-checked here: the
// picker is a convenience, and a crafted request must not reach somebody
// outside the center or let a person mention themselves. `replace` is for an
// edit, where a name taken out of the words stops being a mention; one left
// in keeps its row, and with it whether it was read.
async function saveMentions(pool, kind, { commentId, ids, authorId, locationId, replace = false }) {
  const table = KINDS[kind].mentions;
  if (replace) {
    await pool.query(`DELETE FROM ${table} WHERE comment_id = $1 AND NOT (user_id = ANY($2::int[]))`, [commentId, ids]);
  }
  if (!ids.length) return;
  await pool.query(
    `INSERT INTO ${table} (comment_id, user_id)
     SELECT $1, u.id FROM users u
     WHERE u.id = ANY($2::int[]) AND u.active = true AND u.id <> $3
       AND u.id IN (SELECT user_id FROM user_locations WHERE location_id = $4)
     ON CONFLICT (comment_id, user_id) DO NOTHING`,
    [commentId, ids, authorId, locationId]
  );
}

// Who may change a reply. Editing is the author's alone (the words go out in
// their name); deleting is also open to a director, who keeps the threads at
// their center clean. Admin passes both, as everywhere.
const mayEditReply = (session, authorId) =>
  session.role === 'admin' || (authorId != null && authorId === session.userId);
const mayDeleteReply = (session, authorId) =>
  mayEditReply(session, authorId) || session.role === 'manager';

module.exports = { KINDS, replyJson, readReply, readMentionIds, saveMentions, mayEditReply, mayDeleteReply };
