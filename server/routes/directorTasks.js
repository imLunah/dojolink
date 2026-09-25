const express = require('express');
const router = express.Router();
const { requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');

// One shared task board per location. Directors see the whole board and may
// assign cards to any active staff member there. Senseis get a private slice:
// only cards assigned directly to them, with carrier rights rather than owner
// rights. Writes also add requireOwnLocation so a director browsing another
// center gets it read-only.

const COLUMNS = ['todo', 'doing', 'done'];
const COLORS = ['none', 'blue', 'amber', 'green', 'purple', 'red'];

const TITLE_MAX = 200;
// Bodies are freeform markdown. The cap is a denial-of-service guard, not a
// content rule — same reasoning as the 2000-char cap on pinned notes.
const BODY_MAX = 4000;

// A checklist is a handful of sub-steps, not a second task list. The cap is
// what stops a card becoming a project, and it matches the CHECK on the column.
const CHECKLIST_MAX = 20;
const CHECKLIST_TEXT_MAX = 200;

const SELECT = `
  SELECT t.id, t.title, t.body, t.column_key, t.color, t.position,
         to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
         t.assignee_id, t.assignee_center, t.checklist, t.archived_at,
         t.created_at, t.updated_at, t.created_by,
         (SELECT COUNT(*)::int FROM director_task_comments c
         WHERE c.task_id = t.id) AS comment_count,
         u.display_name AS created_by_name,
         a.display_name AS assignee_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', ta.user_id,
             'display_name', assigned.display_name,
             'role', assigned.role
           ) ORDER BY assigned.display_name)
           FROM director_task_assignees ta
           JOIN users assigned ON assigned.id = ta.user_id
           WHERE ta.task_id = t.id
         ), '[]'::json) AS assignees,
         l.name AS location_name
  FROM director_tasks t
  LEFT JOIN users u ON u.id = t.created_by
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN locations l ON l.id = t.location_id
`;

// Staff at this center, by membership rather than home center, so someone
// covering two locations appears on both boards. Admins are included because
// acting anywhere is the whole point of the role.
const ASSIGNEE_SELECT = `
  SELECT u.id, u.display_name, u.username, u.role
  FROM users u
  WHERE u.active = true
    AND u.role IN ('manager', 'sensei', 'admin')
    AND u.id IN (SELECT user_id FROM user_locations WHERE location_id = $1)
  ORDER BY u.display_name ASC
`;

// Who is carrying a card: nobody, the center, or one or more staff members.
// Center remains exclusive with named people; the server decides rather than
// trusting two payload fields to agree.
//
// Absent means "leave it alone". A named director has to be one who is actually
// at this center: without that check the board would be a way to write a row
// naming any user in the system and read their display name back out of it.
async function readAssignees(pool, body, locationId) {
  const rawIds = body?.assignee_ids;
  const rawId = body?.assignee_id;
  const center = body?.assignee_center;
  if (rawIds === undefined && rawId === undefined && center === undefined) return { skip: true };
  if (center === true) return { ids: [], legacyId: null, center: true };

  const values = rawIds === undefined
    ? (rawId === null || rawId === undefined || rawId === '' ? [] : [rawId])
    : rawIds;
  if (!Array.isArray(values) || values.length > 50) return { error: 'Invalid staff assignment' };
  const ids = [...new Set(values.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) return { error: 'Unknown staff member' };
  if (ids.length === 0) return { ids: [], legacyId: null, center: false };

  const { rows } = await pool.query(
    `SELECT u.id FROM users u
     WHERE u.id = ANY($1::int[]) AND u.active = true
       AND u.role IN ('manager', 'sensei', 'admin')
       AND u.id IN (SELECT user_id FROM user_locations WHERE location_id = $2)`,
    [ids, locationId]
  );
  if (rows.length !== ids.length) return { error: 'A selected staff member is not at this center' };
  return { ids, legacyId: ids[0], center: false };
}

// Sets who is on a card by difference, not by wiping and rewriting: a row is
// also a notification ("Sam assigned you"), so somebody already on the card
// must keep their row, and with it whether they have read it, or every edit
// to the card would notify its people again. Only the newly added get a fresh
// unread row, stamped with who added them; adding yourself is born read.
async function replaceAssignees(client, taskId, ids, actorId) {
  await client.query(
    'DELETE FROM director_task_assignees WHERE task_id = $1 AND NOT (user_id = ANY($2::int[]))',
    [taskId, ids]
  );
  if (ids.length === 0) return;
  await client.query(
    `INSERT INTO director_task_assignees (task_id, user_id, assigned_by, read_at)
     SELECT $1, uid, $3, CASE WHEN uid = $3 THEN now() END FROM unnest($2::int[]) AS uid
     ON CONFLICT (task_id, user_id) DO NOTHING`,
    [taskId, ids, actorId]
  );
}

/* ------------------------------------------------------------- who may -- */
// The board is shared reading, not shared writing. A card's words belong to
// whoever wrote them; what everyone else may do depends on where they stand:
//   owner   — made the card (or the card predates authorship, or admin, since
//             acting anywhere is that role's whole point). Edits everything,
//             deletes, restores.
//   carrier — named on the card, or any director here while the center holds
//             it. Moves it between stages, edits the checklist, comments.
//   viewer  — any other director at the center. Reads.
// The client draws the same three tiers; these two checks are what make them
// true rather than drawn.
const ownsTask = (t, session) =>
  session.role === 'admin'
  || t.created_by === session.userId
  || (t.created_by == null && session.role === 'manager');
const carriesTask = (t, session) =>
  ownsTask(t, session)
  || t.assigned === true
  || (t.assignee_center === true && ['manager', 'admin'].includes(session.role));
const mayReadTask = (t, session) =>
  ['manager', 'admin'].includes(session.role)
  || t.assigned === true
  || t.assignee_center === true
  || t.mentioned === true;

// The row a permission decision is made against, fetched fresh: the client's
// copy of a card is whatever it last saw, not what is true.
async function taskRow(pool, id, locationId, userId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.created_by, t.assignee_center, t.column_key, t.archived_at,
       EXISTS (
         SELECT 1 FROM director_task_assignees ta
         WHERE ta.task_id = t.id AND ta.user_id = $3
       ) AS assigned,
       EXISTS (
         SELECT 1
         FROM director_task_comment_mentions m
         JOIN director_task_comments c ON c.id = m.comment_id
         WHERE c.task_id = t.id AND m.user_id = $3
       ) AS mentioned
     FROM director_tasks t WHERE t.id = $1 AND t.location_id = $2`,
    [id, locationId, userId]
  );
  return rows[0] || null;
}

const NOT_YOURS = 'Only the person who made this task can change that.';

// pg serializes a DATE as UTC midnight, which a browser in a negative offset
// reads as the day before. to_char keeps it a plain calendar string all the way
// to the card, which is the same fix club session dates needed.

// Stored as jsonb, so a bad array would land in the database as-is and come
// back to the card as a crash rather than a 400. Its own function because a
// carrier's save validates the checklist and nothing else.
function readChecklist(body) {
  if (body.checklist === undefined) return { checklist: undefined };
  if (!Array.isArray(body.checklist)) return { error: 'Invalid checklist' };
  if (body.checklist.length > CHECKLIST_MAX) return { error: `A card can hold ${CHECKLIST_MAX} checklist items` };
  const checklist = [];
  for (const item of body.checklist) {
    const text = typeof item?.text === 'string' ? item.text.trim() : '';
    if (!text) continue; // a blank row is somebody mid-typing, not an item
    if (text.length > CHECKLIST_TEXT_MAX) return { error: `Checklist item max ${CHECKLIST_TEXT_MAX} characters` };
    checklist.push({ text, done: item.done === true });
  }
  return { checklist };
}

function validate(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length > TITLE_MAX) return { error: `Title max ${TITLE_MAX} characters` };

  const note = body.body;
  if (note != null && typeof note !== 'string') return { error: 'Invalid note' };
  if (note && note.length > BODY_MAX) return { error: `Note max ${BODY_MAX} characters` };

  // A card must say something, but it chooses whether that is a title or a
  // body. Everything carried over from the sticky wall is a paragraph with no
  // title, and demanding one would have made those cards unsaveable the moment
  // anyone opened them. Mirrors the has_content CHECK on the table.
  if (!title && !note?.trim()) return { error: 'Give the task a title or a note' };

  const column_key = body.column_key ?? 'todo';
  if (!COLUMNS.includes(column_key)) return { error: 'Invalid column' };

  const color = body.color ?? 'none';
  if (!COLORS.includes(color)) return { error: 'Invalid color' };

  // Absent means "leave it alone"; anything present has to be the real shape.
  const read = readChecklist(body);
  if (read.error) return { error: read.error };
  const checklist = read.checklist;

  // Empty string comes back from a cleared <input type="date">; both it and an
  // absent field mean "no due date".
  const due = body.due_date;
  if (due != null && due !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return { error: 'Invalid due date' };
  }

  return {
    title: title || null,
    body: note?.trim() || null,
    column_key,
    color,
    due_date: due || null,
    checklist,
  };
}

// GET /api/director-tasks/assignees — the staff a card can be handed to.
// Above every /:id route, or Express reads 'assignees' as an id.
router.get('/assignees', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(ASSIGNEE_SELECT, [req.session.activeLocationId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching assignees:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// GET /api/director-tasks/mentionables — staff who can be addressed from a
// comment at this center. It deliberately uses membership, not home location:
// a staff member covering Yorba Linda is part of Yorba Linda for mentions.
router.get('/mentionables', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(ASSIGNEE_SELECT, [req.session.activeLocationId]);
    res.json(rows.filter((staff) => staff.id !== req.session.userId));
  } catch (err) {
    console.error('Error fetching task mentionables:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// How long a deleted card is kept before the database forgets it. `archived_at`
// is the day it was deleted; the column predates the name and is left alone
// rather than migrated, since renaming it would rewrite every query here to say
// the same thing.
const KEEP_DELETED_DAYS = 14;

// The retention sweep, run when the board is asked for rather than on a
// schedule. This app has no scheduler — it is serverless functions and nothing
// else — and a Vercel cron would be a second moving part to keep alive for a
// query that costs nothing here: it touches only rows that are already two
// weeks past being deleted, on a table holding a few dozen per center. Being
// late by however long nobody opens the board is the correct amount of late,
// because nobody is looking at what it would have removed.
async function purgeExpired(pool) {
  try {
    await pool.query(
      `DELETE FROM director_tasks
       WHERE archived_at IS NOT NULL
         AND archived_at < now() - ($1 || ' days')::interval`,
      [KEEP_DELETED_DAYS]
    );
  } catch (err) {
    // A failed sweep must not take the board down with it. The rows simply
    // stay another few minutes.
    console.error('Error purging deleted tasks:', err);
  }
}

// GET /api/director-tasks — the whole live board for the active location.
// ?archived=true returns what has been deleted instead, newest first, which is
// a different question and a different order: a deleted card has no place on a
// board, only a date it left one.
router.get('/', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const archived = req.query.archived === 'true';
  const mine = req.query.mine === 'true' || req.session.role === 'sensei';
  try {
    await purgeExpired(pool);
    const { rows } = await pool.query(
      `${SELECT} WHERE t.location_id = $1
       AND (
         $2::boolean
         OR EXISTS (
           SELECT 1 FROM director_task_assignees ta
           WHERE ta.task_id = t.id AND ta.user_id = $3
         )
         OR ($4::boolean AND (
           t.assignee_center = true
           OR EXISTS (
             SELECT 1
             FROM director_task_comment_mentions m
             JOIN director_task_comments c ON c.id = m.comment_id
             WHERE c.task_id = t.id AND m.user_id = $3
           )
         ))
       )
       AND t.archived_at IS ${archived ? 'NOT NULL' : 'NULL'}
       ORDER BY ${archived ? 't.archived_at DESC' : 't.position ASC'}, t.id ASC`,
      [
        req.session.activeLocationId,
        ['manager', 'admin'].includes(req.session.role) && !mine,
        req.session.userId,
        req.session.role === 'sensei',
      ]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/director-tasks — new card, appended to the end of its column.
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const fields = validate(req.body);
  if (fields.error) return res.status(400).json({ error: fields.error });

  let client;
  try {
    const assignee = await readAssignees(pool, req.body, req.session.activeLocationId);
    if (assignee.error) return res.status(400).json({ error: assignee.error });

    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO director_tasks
         (location_id, title, body, column_key, color, due_date, assignee_id, assignee_center, checklist, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
         COALESCE((SELECT MAX(position) + 1 FROM director_tasks
                   WHERE location_id = $1 AND column_key = $4 AND archived_at IS NULL), 0),
         $10)
       RETURNING id`,
      [
        req.session.activeLocationId,
        fields.title,
        fields.body,
        fields.column_key,
        fields.color,
        fields.due_date,
        assignee.skip ? null : assignee.legacyId,
        assignee.skip ? false : assignee.center,
        JSON.stringify(fields.checklist ?? []),
        req.session.userId,
      ]
    );
    if (!assignee.skip) await replaceAssignees(client, rows[0].id, assignee.ids, req.session.userId);
    // Re-read through SELECT so the response carries created_by_name and the
    // to_char'd date, exactly like the list endpoint.
    const { rows: full } = await client.query(`${SELECT} WHERE t.id = $1`, [rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json(full[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client?.release();
  }
});

// POST /api/director-tasks/archive-done — clear the finished column.
//
// One statement rather than one PATCH per card: a dropped connection halfway
// through a fan-out leaves a board half-cleared, and there is no reason for the
// client to enumerate rows the server can select for itself. MUST stay above
// the /:id routes, or Express reads 'archive-done' as an id.
router.post('/archive-done', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    // Your own finished cards, not the column. A card someone else made
    // leaves the board when they say it does, and Clear All saying otherwise
    // would be the bulk route around the rule the single-card routes keep.
    const { rows } = await pool.query(
      `UPDATE director_tasks SET archived_at = now(), updated_at = now()
       WHERE location_id = $1 AND column_key = 'done' AND archived_at IS NULL
         AND ($2 OR created_by IS NULL OR created_by = $3)
       RETURNING id`,
      [req.session.activeLocationId, req.session.role === 'admin', req.session.userId]
    );
    res.json({ archived: rows.map((r) => r.id) });
  } catch (err) {
    console.error('Error clearing finished tasks:', err);
    res.status(500).json({ error: 'Failed to clear finished tasks' });
  }
});

// POST /api/director-tasks/:id/archive — take a card off the board.
// Not a delete: the work happened, and a center's record of what it did should
// not depend on nobody having tidied up. location_id in the WHERE is the
// authorization, same as every other write here.
router.post('/:id/archive', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const current = await taskRow(pool, req.params.id, req.session.activeLocationId, req.session.userId);
    if (!current) return res.status(404).json({ error: 'Task not found' });
    if (!ownsTask(current, req.session)) {
      return res.status(403).json({ error: 'Only the person who made this task can delete it.' });
    }
    const { rows } = await pool.query(
      `UPDATE director_tasks SET archived_at = now(), updated_at = now()
       WHERE id = $1 AND location_id = $2 AND archived_at IS NULL
       RETURNING id`,
      [req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error archiving task:', err);
    res.status(500).json({ error: 'Failed to archive task' });
  }
});

// POST /api/director-tasks/:id/restore — put it back, at the end of whichever
// column it left from. Its old position belonged to a board that has moved on.
router.post('/:id/restore', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const current = await taskRow(pool, req.params.id, req.session.activeLocationId, req.session.userId);
    if (!current) return res.status(404).json({ error: 'Task not found' });
    if (!ownsTask(current, req.session)) {
      return res.status(403).json({ error: 'Only the person who made this task can put it back.' });
    }
    const { rows } = await pool.query(
      `UPDATE director_tasks t
       SET archived_at = NULL, updated_at = now(),
           position = COALESCE((SELECT MAX(d.position) + 1 FROM director_tasks d
                                WHERE d.location_id = t.location_id
                                  AND d.column_key = t.column_key
                                  AND d.archived_at IS NULL), 0)
       WHERE t.id = $1 AND t.location_id = $2 AND t.archived_at IS NOT NULL
       RETURNING t.id`,
      [req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    const { rows: full } = await pool.query(`${SELECT} WHERE t.id = $1`, [rows[0].id]);
    res.json(full[0]);
  } catch (err) {
    console.error('Error restoring task:', err);
    res.status(500).json({ error: 'Failed to restore task' });
  }
});

// PATCH /api/director-tasks/reorder — persist a drag.
//
// MUST stay above PATCH /:id. Express matches the literal segment as an id, so
// declared after it this route is simply unreachable — the same trap that
// /students/birthdays and the old /director-notes/reorder had to dodge.
//
// Takes the full board as [{ id, column_key, position }]. The client already
// knows the arrangement it just drew; sending it whole means a dropped card and
// the cards that shifted under it commit in one transaction rather than as a
// burst of PATCHes that can half-apply.
// Fit one person's order of their own cards into the whole board.
//
// Per column, the slots are the positions the person's cards already occupy
// there, lowest first. Their cards in that column, in the order they left
// them, take those slots in turn. A card arriving from another column has no
// slot here yet, so it gets a fresh one past the end of the column. The cards
// they cannot see are never written, so they cannot move.
function fitPartialOrder(board, items) {
  const byId = new Map(board.map((r) => [r.id, r]));
  const out = [];
  for (const col of COLUMNS) {
    const mine = items
      .filter((it) => it.column_key === col && byId.has(it.id))
      .sort((a, b) => a.position - b.position);
    if (!mine.length) continue;
    const slots = mine
      .map((it) => byId.get(it.id))
      .filter((r) => r.column_key === col)
      .map((r) => r.position)
      .sort((a, b) => a - b);
    let end = Math.max(-1, ...board.filter((r) => r.column_key === col).map((r) => r.position));
    while (slots.length < mine.length) slots.push(++end);
    mine.forEach((it, i) => out.push({ id: it.id, column_key: col, position: slots[i] }));
  }
  return out;
}

router.patch('/reorder', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  let { items } = req.body;
  // A PARTIAL board is one person's slice of it: My Tasks shows a sensei only
  // the cards assigned to them, and numbering that slice 0, 1, 2 would collide
  // with the cards they cannot see. So a partial order is not written as sent.
  // It is fitted into the slots those same cards already hold, column by
  // column (see fitPartialOrder), and every card nobody moved keeps its place.
  // Anyone who is not a director is partial whether they say so or not.
  const partial = req.body.partial === true || !['manager', 'admin'].includes(req.session.role);

  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  if (items.length > 500) return res.status(400).json({ error: 'Too many items' });
  for (const it of items) {
    if (!Number.isInteger(it?.id)) return res.status(400).json({ error: 'Invalid id' });
    if (!COLUMNS.includes(it?.column_key)) return res.status(400).json({ error: 'Invalid column' });
    if (!Number.isInteger(it?.position)) return res.status(400).json({ error: 'Invalid position' });
  }

  // Positions renumber freely: every drop shuffles the neighbours of the
  // dropped card, and those cards did not change meaning. Changing COLUMN is
  // the write that belongs to somebody, so it is checked per card against the
  // stored row rather than the payload's claim of one.
  try {
    const { rows: current } = await pool.query(
      `SELECT t.id, t.created_by, t.assignee_center, t.column_key,
              EXISTS (
                SELECT 1 FROM director_task_assignees ta
                WHERE ta.task_id = t.id AND ta.user_id = $3
              ) AS assigned
       FROM director_tasks t WHERE t.id = ANY($1::int[]) AND t.location_id = $2`,
      [items.map((it) => it.id), req.session.activeLocationId, req.session.userId]
    );
    const byId = new Map(current.map((r) => [r.id, r]));
    for (const it of items) {
      const row = byId.get(it.id);
      if (!row || !mayReadTask(row, req.session)) {
        return res.status(403).json({ error: 'You can only arrange tasks assigned to you.' });
      }
      if (row && row.column_key !== it.column_key && !carriesTask(row, req.session)) {
        return res.status(403).json({ error: 'That card moves only by whoever made it or is carrying it.' });
      }
    }
  } catch (err) {
    console.error('Error checking reorder permissions:', err);
    return res.status(500).json({ error: 'Failed to reorder tasks' });
  }

  if (partial) {
    try {
      const { rows: board } = await pool.query(
        `SELECT id, column_key, position FROM director_tasks
         WHERE location_id = $1 AND archived_at IS NULL`,
        [req.session.activeLocationId]
      );
      items = fitPartialOrder(board, items);
    } catch (err) {
      console.error('Error fitting a partial reorder:', err);
      return res.status(500).json({ error: 'Failed to reorder tasks' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      // location_id in the WHERE is the authorization: ids from another center
      // match nothing and update nothing, so a forged payload can't reshuffle a
      // board the caller can't see.
      await client.query(
        `UPDATE director_tasks
         SET column_key = $1, position = $2, updated_at = now()
         WHERE id = $3 AND location_id = $4`,
        [it.column_key, it.position, it.id, req.session.activeLocationId]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error reordering tasks:', err);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  } finally {
    client.release();
  }
});

// PATCH /api/director-tasks/:id — edit a card.
//
// This USED to be deliberately un-gated, on the theory that the board belongs
// to the center. Three directors sharing one board found the edge of that
// theory: a card is a thing somebody said, and anyone being able to rewrite it
// means nobody is on record as having said anything. So the owner edits the
// card; a carrier's save changes the stage and the checklist and nothing
// else. The client sends the whole card either way — this has always been a
// whole-card write — so the locked fields are not compared against the
// payload, they are simply never read from it: whatever a stale or creative
// request says about the title, the stored words stay the stored words.
router.patch('/:id', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');

  try {
    const current = await taskRow(pool, req.params.id, req.session.activeLocationId, req.session.userId);
    if (!current) return res.status(404).json({ error: 'Task not found' });

    if (!ownsTask(current, req.session)) {
      if (!carriesTask(current, req.session)) return res.status(403).json({ error: NOT_YOURS });

      const column_key = req.body.column_key ?? current.column_key;
      if (!COLUMNS.includes(column_key)) return res.status(400).json({ error: 'Invalid column' });
      const read = readChecklist(req.body);
      if (read.error) return res.status(400).json({ error: read.error });

      // Same position rule as the full edit below: a changed column re-ranks
      // to the end of the destination, staying put keeps the drag's rank.
      const { rows } = await pool.query(
        `UPDATE director_tasks t
         SET column_key = $1,
             checklist = COALESCE($2::jsonb, t.checklist),
             position = CASE
               WHEN t.column_key = $1 THEN t.position
               ELSE COALESCE((SELECT MAX(d.position) + 1 FROM director_tasks d
                              WHERE d.location_id = t.location_id AND d.column_key = $1
                                AND d.archived_at IS NULL), 0)
             END,
             updated_at = now()
         WHERE t.id = $3 AND t.location_id = $4
         RETURNING id`,
        [
          column_key,
          read.checklist === undefined ? null : JSON.stringify(read.checklist),
          req.params.id,
          req.session.activeLocationId,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
      const { rows: full } = await pool.query(`${SELECT} WHERE t.id = $1`, [rows[0].id]);
      return res.json(full[0]);
    }

    const fields = validate(req.body);
    if (fields.error) return res.status(400).json({ error: fields.error });

    const assignee = await readAssignees(pool, req.body, req.session.activeLocationId);
    if (assignee.error) return res.status(400).json({ error: assignee.error });

    // The editor can move a card between columns, and a card carrying its old
    // rank into a new column lands at an arbitrary spot among cards that never
    // moved. Changing column re-ranks to the end of the destination; staying
    // put keeps the rank a drag gave it. In an UPDATE, the column references on
    // the right of SET still read the OLD row, so this is one atomic statement
    // rather than a read-then-write that another director could interleave.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE director_tasks t
         SET title = $1, body = $2, column_key = $3, color = $4, due_date = $5,
             assignee_id = CASE WHEN $6::boolean THEN t.assignee_id ELSE $7 END,
             assignee_center = CASE WHEN $6::boolean THEN t.assignee_center ELSE $10 END,
             checklist = COALESCE($11::jsonb, t.checklist),
             position = CASE
               WHEN t.column_key = $3 THEN t.position
               ELSE COALESCE((SELECT MAX(d.position) + 1 FROM director_tasks d
                              WHERE d.location_id = t.location_id AND d.column_key = $3
                                AND d.archived_at IS NULL), 0)
             END,
             updated_at = now()
         WHERE t.id = $8 AND t.location_id = $9
         RETURNING id`,
        [
          fields.title,
          fields.body,
          fields.column_key,
          fields.color,
          fields.due_date,
          !!assignee.skip,
          assignee.skip ? null : assignee.legacyId,
          req.params.id,
          req.session.activeLocationId,
          assignee.skip ? false : assignee.center,
          fields.checklist === undefined ? null : JSON.stringify(fields.checklist),
        ]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Task not found' });
      }
      if (!assignee.skip) await replaceAssignees(client, rows[0].id, assignee.ids, req.session.userId);
      const { rows: full } = await client.query(`${SELECT} WHERE t.id = $1`, [rows[0].id]);
      await client.query('COMMIT');
      res.json(full[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/director-tasks/deleted — empty Recently deleted for this center.
//
// ABOVE /:id, and it has to stay there: Express takes the first route that
// matches, so below it this path would be read as a task with the id "deleted".
router.delete('/deleted', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    // The bin shows everyone's deleted cards; emptying it takes only yours.
    // Someone else's card waiting out its fortnight is still theirs to save.
    const { rows } = await pool.query(
      `DELETE FROM director_tasks
       WHERE location_id = $1 AND archived_at IS NOT NULL
         AND ($2 OR created_by IS NULL OR created_by = $3)
       RETURNING id`,
      [req.session.activeLocationId, req.session.role === 'admin', req.session.userId]
    );
    res.json({ deleted: rows.map((r) => r.id) });
  } catch (err) {
    console.error('Error emptying deleted tasks:', err);
    res.status(500).json({ error: 'Failed to empty Recently deleted' });
  }
});

// DELETE /api/director-tasks/:id
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const current = await taskRow(pool, req.params.id, req.session.activeLocationId, req.session.userId);
    if (!current) return res.status(404).json({ error: 'Task not found' });
    if (!ownsTask(current, req.session)) {
      return res.status(403).json({ error: 'Only the person who made this task can delete it for good.' });
    }
    const { rows } = await pool.query(
      'DELETE FROM director_tasks WHERE id = $1 AND location_id = $2 RETURNING id',
      [req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/* ------------------------------------------------------------ comments -- */

const COMMENT_MAX = 2000;
const COMMENT_SELECT = `
  SELECT c.id, c.task_id, c.author_id, c.body, c.created_at,
         u.display_name AS author_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'user_id', m.user_id,
             'display_name', mentioned.display_name,
             'username', mentioned.username
           ) ORDER BY mentioned.display_name)
           FROM director_task_comment_mentions m
           JOIN users mentioned ON mentioned.id = m.user_id
           WHERE m.comment_id = c.id
         ), '[]'::json) AS mentions
  FROM director_task_comments c
  LEFT JOIN users u ON u.id = c.author_id
`;

function readMentionIds(value) {
  if (value === undefined) return { ids: [] };
  if (!Array.isArray(value) || value.length > 50) return { error: 'Invalid mentions' };
  const ids = [...new Set(value.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) return { error: 'Invalid mentions' };
  return { ids };
}

// GET /api/director-tasks/mentions — unread comment mentions for the signed-in
// staff member. A mention also grants the recipient read access to that card,
// so a notification never sends somebody to work they cannot open.
router.get('/mentions', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.created_at, c.body, t.id AS task_id, t.title,
              u.display_name AS author_name
       FROM director_task_comment_mentions m
       JOIN director_task_comments c ON c.id = m.comment_id
       JOIN director_tasks t ON t.id = c.task_id
       LEFT JOIN users u ON u.id = c.author_id
       WHERE m.user_id = $1 AND m.read_at IS NULL
         AND t.location_id = $2 AND t.archived_at IS NULL
       ORDER BY m.created_at DESC`,
      [req.session.userId, req.session.activeLocationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching task mentions:', err);
    res.status(500).json({ error: 'Failed to fetch task mentions' });
  }
});

// POST /api/director-tasks/mentions/task/:id/read — opening a card reads the
// whole thread, so every unread mention on that card clears together. A badge
// saying "3" that turns into "2" after reading the task would be counting
// rows in the database rather than things the person still needs to see.
router.post('/mentions/task/:id/read', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    // Being assigned to the card is read by opening it, too.
    await pool.query(
      `UPDATE director_task_assignees a SET read_at = now()
       FROM director_tasks t
       WHERE a.user_id = $1 AND a.read_at IS NULL AND a.task_id = $2
         AND t.id = a.task_id AND t.location_id = $3`,
      [req.session.userId, req.params.id, req.session.activeLocationId]
    );
    const { rows } = await pool.query(
      `UPDATE director_task_comment_mentions m
       SET read_at = COALESCE(m.read_at, now())
       FROM director_task_comments c, director_tasks t
       WHERE m.user_id = $1 AND m.read_at IS NULL
         AND c.id = m.comment_id AND t.id = c.task_id
         AND t.id = $2 AND t.location_id = $3
       RETURNING m.id`,
      [req.session.userId, req.params.id, req.session.activeLocationId]
    );
    res.json({ read: rows.length });
  } catch (err) {
    console.error('Error reading task mentions:', err);
    res.status(500).json({ error: 'Failed to update task mentions' });
  }
});

// POST /api/director-tasks/mentions/:id/read — only the notified staff member
// can clear their own notification, and the task join scopes it to this center.
router.post('/mentions/:id/read', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `UPDATE director_task_comment_mentions m
       SET read_at = COALESCE(m.read_at, now())
       FROM director_task_comments c, director_tasks t
       WHERE m.id = $1 AND m.user_id = $2
         AND c.id = m.comment_id AND t.id = c.task_id AND t.location_id = $3
       RETURNING m.id`,
      [req.params.id, req.session.userId, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Mention not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error reading task mention:', err);
    res.status(500).json({ error: 'Failed to update task mention' });
  }
});

// GET /api/director-tasks/:id/comments — the thread under a card, oldest
// first. Reading is the center's, same as the board itself.
router.get('/:id/comments', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const task = await taskRow(pool, req.params.id, req.session.activeLocationId, req.session.userId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!mayReadTask(task, req.session)) return res.status(404).json({ error: 'Task not found' });
    const { rows } = await pool.query(
      `${COMMENT_SELECT} WHERE c.task_id = $1 ORDER BY c.created_at ASC, c.id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching task comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/director-tasks/:id/comments — what a carrier has instead of the
// note: the words under the card are signed, where words edited into someone
// else's prose would not be. Owners can too, because a thread with the answer
// missing is half a conversation.
router.post('/:id/comments', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const mentions = readMentionIds(req.body?.mention_ids);
  if (!body) return res.status(400).json({ error: 'Say something first' });
  if (body.length > COMMENT_MAX) return res.status(400).json({ error: `Comment max ${COMMENT_MAX} characters` });
  if (mentions.error) return res.status(400).json({ error: mentions.error });
  try {
    const task = await taskRow(pool, req.params.id, req.session.activeLocationId, req.session.userId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!carriesTask(task, req.session)) {
      return res.status(403).json({ error: 'Comments are for the people on the card.' });
    }
    const { rows } = await pool.query(
      'INSERT INTO director_task_comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING id',
      [task.id, req.session.userId, body]
    );
    if (mentions.ids.length > 0) {
      // Re-check every recipient at the write boundary. The picker is only a
      // convenience; a crafted request must not notify somebody outside this
      // center, and a person cannot notify themselves.
      await pool.query(
        `INSERT INTO director_task_comment_mentions (comment_id, user_id)
         SELECT $1, u.id
         FROM users u
         WHERE u.id = ANY($2::int[]) AND u.active = true AND u.id <> $3
           AND u.id IN (SELECT user_id FROM user_locations WHERE location_id = $4)
         ON CONFLICT (comment_id, user_id) DO NOTHING`,
        [rows[0].id, mentions.ids, req.session.userId, req.session.activeLocationId]
      );
    }
    const { rows: full } = await pool.query(`${COMMENT_SELECT} WHERE c.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    console.error('Error adding task comment:', err);
    res.status(500).json({ error: 'Failed to add the comment' });
  }
});

// DELETE /api/director-tasks/:id/comments/:commentId — your own words only,
// admin excepted. The join to the task is the location check.
router.delete('/:id/comments/:commentId', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `DELETE FROM director_task_comments c
       USING director_tasks t
       WHERE c.id = $1 AND c.task_id = t.id AND t.id = $2 AND t.location_id = $3
         AND ($4 OR c.author_id = $5)
         AND ($6 OR EXISTS (
           SELECT 1 FROM director_task_assignees ta
           WHERE ta.task_id = t.id AND ta.user_id = $5
         ))
       RETURNING c.id`,
      [req.params.commentId, req.params.id, req.session.activeLocationId,
       req.session.role === 'admin', req.session.userId,
       ['manager', 'admin'].includes(req.session.role)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting task comment:', err);
    res.status(500).json({ error: 'Failed to delete the comment' });
  }
});

module.exports = router;
