const express = require('express');
const router = express.Router();
const { requireSensei, requireOwnLocation } = require('../middleware/auth');

// Notifications: every place somebody @mentioned you, and every task somebody
// put you on, in one list.
//
// There is no notifications table. A mention already is one: each kind of
// comment keeps its own mention rows (038 for task comments, 054 for replies on
// progress logs and club sessions), with who was addressed and when they read
// it; and a task assignment row (055) carries who assigned it and when it was
// read. This route reads them together; marking one read writes the row it
// came from. A second table would be a copy of those rows that could disagree
// with them. Whole-center tasks notify nobody: quick add makes every card
// center-wide, and the bell would ring for the whole staff on every one.
//
// Scoped to the ACTIVE center, like everything else a staff member sees: a
// mention at another center shows once they switch to it, and never sends
// them to a page this center cannot open.

// How far back the list reaches. Unread ones older than this still count and
// still show; this only trims what has already been read.
const READ_WINDOW_DAYS = 30;
const LIST_LIMIT = 40;

// kind -> the mention table, and the join that scopes a row of it to a center.
// Code-controlled identifiers only; `kind` from a request is checked against
// these keys before anything is built from it.
const SCOPES = {
  task: {
    table: 'director_task_comment_mentions',
    join: `JOIN director_task_comments c ON c.id = m.comment_id
           JOIN director_tasks t ON t.id = c.task_id AND t.archived_at IS NULL AND t.location_id = $LOC`,
  },
  log: {
    table: 'progress_log_comment_mentions',
    join: `JOIN progress_log_comments c ON c.id = m.comment_id
           JOIN progress_logs pl ON pl.id = c.log_id
           JOIN students s ON s.id = pl.student_id
             AND EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = $LOC)`,
  },
  // Assignment rows have no id of their own (the key is task + person), so the
  // notification's id is the task's.
  // Only assignments with a known assigner are notifications: rows from before
  // 055 recorded nobody, and "Someone assigned you" says nothing. Those were
  // all marked read by the migration and stay out of the list.
  assign: {
    table: 'director_task_assignees',
    idColumn: 'task_id',
    join: `JOIN director_tasks t ON t.id = m.task_id AND t.archived_at IS NULL AND t.location_id = $LOC
           AND m.assigned_by IS NOT NULL`,
  },
  club: {
    table: 'club_session_comment_mentions',
    join: `JOIN club_session_comments c ON c.id = m.comment_id
           JOIN club_sessions cs ON cs.id = c.session_id AND cs.location_id = $LOC`,
  },
};

const scoped = (kind, locParam) => SCOPES[kind].join.replace(/\$LOC/g, locParam);

// One row per mention, whichever kind, in the shape the bell draws. `place`
// is what it was on; the ids are what the client needs to link to it.
const FEED_SQL = `
  SELECT * FROM (
    SELECT 'task' AS kind, m.id, m.created_at, m.read_at, c.body,
           u.display_name AS author_name, u.profile_pic_url AS author_pic,
           t.title AS place, t.id AS task_id, NULL::int AS student_id, NULL::int AS log_id,
           NULL::int AS session_id, NULL::text AS club_name,
           (SELECT json_agg(json_build_object('display_name', mu.display_name, 'username', mu.username))
            FROM director_task_comment_mentions mm JOIN users mu ON mu.id = mm.user_id WHERE mm.comment_id = c.id) AS mentions
    FROM director_task_comment_mentions m ${scoped('task', '$2')}
    LEFT JOIN users u ON u.id = c.author_id
    WHERE m.user_id = $1

    UNION ALL

    SELECT 'log', m.id, m.created_at, m.read_at, c.body,
           COALESCE(u.display_name, c.user_name), u.profile_pic_url,
           s.full_name, NULL, s.id, pl.id, NULL, NULL,
           (SELECT json_agg(json_build_object('display_name', mu.display_name, 'username', mu.username))
            FROM progress_log_comment_mentions mm JOIN users mu ON mu.id = mm.user_id WHERE mm.comment_id = c.id)
    FROM progress_log_comment_mentions m ${scoped('log', '$2')}
    LEFT JOIN users u ON u.id = c.user_id
    WHERE m.user_id = $1

    UNION ALL

    SELECT 'club', m.id, m.created_at, m.read_at, c.body,
           COALESCE(u.display_name, c.user_name), u.profile_pic_url,
           cs.club_name, NULL, NULL, NULL, cs.id, cs.club_name,
           (SELECT json_agg(json_build_object('display_name', mu.display_name, 'username', mu.username))
            FROM club_session_comment_mentions mm JOIN users mu ON mu.id = mm.user_id WHERE mm.comment_id = c.id)
    FROM club_session_comment_mentions m ${scoped('club', '$2')}
    LEFT JOIN users u ON u.id = c.user_id
    WHERE m.user_id = $1

    UNION ALL

    SELECT 'assign', m.task_id, m.assigned_at, m.read_at, NULL,
           u.display_name, u.profile_pic_url,
           t.title, t.id, NULL, NULL, NULL, NULL, NULL::json
    FROM director_task_assignees m ${scoped('assign', '$2')}
    LEFT JOIN users u ON u.id = m.assigned_by
    WHERE m.user_id = $1
  ) feed
  WHERE feed.read_at IS NULL OR feed.created_at > now() - interval '${READ_WINDOW_DAYS} days'
  ORDER BY (feed.read_at IS NULL) DESC, feed.created_at DESC
  LIMIT ${LIST_LIMIT}
`;

// GET /api/notifications — the list, unread first, plus the unread count.
router.get('/', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(FEED_SQL, [req.session.userId, req.session.activeLocationId]);
    const { rows: count } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM director_task_comment_mentions m ${scoped('task', '$2')} WHERE m.user_id = $1 AND m.read_at IS NULL)
       + (SELECT COUNT(*) FROM progress_log_comment_mentions m ${scoped('log', '$2')} WHERE m.user_id = $1 AND m.read_at IS NULL)
       + (SELECT COUNT(*) FROM club_session_comment_mentions m ${scoped('club', '$2')} WHERE m.user_id = $1 AND m.read_at IS NULL)
       + (SELECT COUNT(*) FROM director_task_assignees m ${scoped('assign', '$2')} WHERE m.user_id = $1 AND m.read_at IS NULL)
       AS unread`,
      [req.session.userId, req.session.activeLocationId]
    );
    res.json({ items: rows, unread: Number(count[0].unread) });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/read-all — clears every unread one at this center.
// Declared before /:kind/:id/read so the literal path is never read as a kind.
router.post('/read-all', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    let read = 0;
    for (const kind of Object.keys(SCOPES)) {
      const idCol = SCOPES[kind].idColumn || 'id';
      const { rowCount } = await pool.query(
        `UPDATE ${SCOPES[kind].table} SET read_at = now()
         WHERE user_id = $1 AND read_at IS NULL
           AND ${idCol} IN (SELECT m.${idCol} FROM ${SCOPES[kind].table} m ${scoped(kind, '$2')} WHERE m.user_id = $1)`,
        [req.session.userId, req.session.activeLocationId]
      );
      read += rowCount;
    }
    res.json({ read });
  } catch (err) {
    console.error('Notifications read-all error:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// POST /api/notifications/:kind/:id/read — only the person notified can clear
// their own, and only for a mention at this center.
router.post('/:kind/:id/read', requireSensei, requireOwnLocation, async (req, res) => {
  const { kind } = req.params;
  if (!Object.prototype.hasOwnProperty.call(SCOPES, kind)) return res.status(400).json({ error: 'Unknown notification' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Unknown notification' });
  const pool = req.app.get('db');
  try {
    const idCol = SCOPES[kind].idColumn || 'id';
    const { rows } = await pool.query(
      `UPDATE ${SCOPES[kind].table} SET read_at = COALESCE(read_at, now())
       WHERE ${idCol} = $1 AND user_id = $2
         AND ${idCol} IN (SELECT m.${idCol} FROM ${SCOPES[kind].table} m ${scoped(kind, '$3')} WHERE m.${idCol} = $1 AND m.user_id = $2)
       RETURNING ${idCol}`,
      [id, req.session.userId, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;
