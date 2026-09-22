const express = require('express');
const router = express.Router();
const { requireSensei, requireManager, requireOwnLocation } = require('../middleware/auth');

// Center calendar events. Any CD/admin at the center can add/edit/delete them
// (center-wide operational data, like announcements — not author-gated); every
// staff member at the center can read them so instructors see what's coming.

const MAX_TITLE = 200;
const MAX_DESC = 2000;
const MAX_TIME = 40;

// Event types are the center's own (table event_types). The palette is fixed
// so every chip keeps white text readable; mirrored by TYPE_PALETTE in
// client/src/lib/eventTypes.js.
const MAX_TYPE = 40;
const TYPE_PALETTE = [
  '#2563eb', '#0284c7', '#4f46e5', '#059669', '#65a30d', '#ca8a04',
  '#ea580c', '#dc2626', '#e11d48', '#db2777', '#92400e', '#64748b',
];
const DEFAULT_TYPES = [
  ['Create Game Building', '#2563eb'],
  ['JR Game Building', '#0284c7'],
  ["Parents' Night Out", '#db2777'],
  ['Tournament', '#ca8a04'],
  ['Holiday', '#dc2626'],
  ['Other', '#64748b'],
];

// The canonical spelling of a type at this center, or null if it has none.
async function canonicalType(pool, locationId, type) {
  if (typeof type !== 'string' || !type.trim()) return null;
  const { rows } = await pool.query(
    'SELECT label FROM event_types WHERE location_id = $1 AND lower(label) = lower($2)',
    [locationId, type.trim()]
  );
  return rows[0]?.label || null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (s) => DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());

// to_char keeps event_date a plain YYYY-MM-DD — a raw pg DATE serializes as a
// UTC-midnight ISO string, which reads back a day early in western timezones.
const SELECT = `
  SELECT e.id, e.title, e.description, e.event_time, e.type, e.created_by,
         to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
         e.created_at, e.updated_at,
         u.display_name AS created_by_name
  FROM events e
  LEFT JOIN users u ON u.id = e.created_by
`;

// Validates + normalizes the writable fields. Returns { error } or { data }.
function parseBody(body) {
  const { title, description, event_date, event_time, type } = body || {};
  if (typeof title !== 'string' || !title.trim()) return { error: 'Title is required' };
  if (title.length > MAX_TITLE) return { error: `Title max ${MAX_TITLE} characters` };
  if (typeof event_date !== 'string' || !isValidDate(event_date)) return { error: 'A valid date is required' };
  if (description != null && (typeof description !== 'string' || description.length > MAX_DESC)) {
    return { error: `Description max ${MAX_DESC} characters` };
  }
  if (event_time != null && (typeof event_time !== 'string' || event_time.length > MAX_TIME)) {
    return { error: `Time max ${MAX_TIME} characters` };
  }
  return {
    data: {
      title: title.trim(),
      description: description && description.trim() ? description.trim() : null,
      event_date,
      event_time: event_time && event_time.trim() ? event_time.trim() : null,
      type,
    },
  };
}

// GET /api/events — all events at the active location (client windows by month)
router.get('/', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `${SELECT} WHERE e.location_id = $1 ORDER BY e.event_date ASC, e.event_time ASC NULLS FIRST`,
      [req.session.activeLocationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/types — this center's event types. A center that has none
// yet (created after migration 040) gets the defaults on first ask.
router.get('/types', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const loc = req.session.activeLocationId;
  try {
    let { rows } = await pool.query(
      'SELECT id, label, color FROM event_types WHERE location_id = $1 ORDER BY id',
      [loc]
    );
    if (rows.length === 0 && loc) {
      await pool.query(
        `INSERT INTO event_types (location_id, label, color)
         SELECT $1, d.label, d.color FROM unnest($2::text[], $3::text[]) AS d(label, color)
         ON CONFLICT DO NOTHING`,
        [loc, DEFAULT_TYPES.map((t) => t[0]), DEFAULT_TYPES.map((t) => t[1])]
      );
      ({ rows } = await pool.query(
        'SELECT id, label, color FROM event_types WHERE location_id = $1 ORDER BY id',
        [loc]
      ));
    }
    res.json(rows);
  } catch (err) {
    console.error('Error fetching event types:', err);
    res.status(500).json({ error: 'Failed to fetch event types' });
  }
});

// POST /api/events/types — add a type at the active location
router.post('/types', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { label, color } = req.body || {};
  if (typeof label !== 'string' || !label.trim()) return res.status(400).json({ error: 'Name the type' });
  if (label.trim().length > MAX_TYPE) return res.status(400).json({ error: `Type max ${MAX_TYPE} characters` });
  if (!TYPE_PALETTE.includes(color)) return res.status(400).json({ error: 'Pick a color' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO event_types (location_id, label, color) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING id, label, color`,
      [req.session.activeLocationId, label.trim(), color]
    );
    if (!rows[0]) return res.status(409).json({ error: 'That type already exists' });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating event type:', err);
    res.status(500).json({ error: 'Failed to create event type' });
  }
});

// PATCH /api/events/types/:id — recolor a type
router.patch('/types/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { color } = req.body || {};
  if (!TYPE_PALETTE.includes(color)) return res.status(400).json({ error: 'Pick a color' });
  try {
    const { rows } = await pool.query(
      'UPDATE event_types SET color = $1 WHERE id = $2 AND location_id = $3 RETURNING id, label, color',
      [color, req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Type not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating event type:', err);
    res.status(500).json({ error: 'Failed to update event type' });
  }
});

// DELETE /api/events/types/:id — events already filed under it keep the label
// and are drawn grey.
router.delete('/types/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM event_types WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Type not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting event type:', err);
    res.status(500).json({ error: 'Failed to delete event type' });
  }
});

// POST /api/events — create an event at the active location
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const parsed = parseBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { title, description, event_date, event_time } = parsed.data;
  try {
    const type = await canonicalType(pool, req.session.activeLocationId, parsed.data.type);
    if (!type) return res.status(400).json({ error: 'Pick an event type' });
    const { rows } = await pool.query(
      `WITH ins AS (
         INSERT INTO events (location_id, created_by, title, description, event_date, event_time, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *
       )
       ${SELECT.replace('FROM events e', 'FROM ins e')} WHERE true`,
      [req.session.activeLocationId, req.session.userId, title, description, event_date, event_time, type]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PATCH /api/events/:id — edit an event at the active location
router.patch('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const parsed = parseBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { title, description, event_date, event_time } = parsed.data;
  try {
    const type = await canonicalType(pool, req.session.activeLocationId, parsed.data.type);
    if (!type) return res.status(400).json({ error: 'Pick an event type' });
    const { rows: found } = await pool.query(
      'SELECT id FROM events WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Event not found' });
    const { rows } = await pool.query(
      `WITH upd AS (
         UPDATE events SET title=$1, description=$2, event_date=$3, event_time=$4, type=$5, updated_at=now()
         WHERE id=$6 RETURNING *
       )
       ${SELECT.replace('FROM events e', 'FROM upd e')} WHERE true`,
      [title, description, event_date, event_time, type, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id — remove an event at the active location
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM events WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Event not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
