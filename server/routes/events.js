const express = require('express');
const router = express.Router();
const { requireSensei, requireManager, requireOwnLocation } = require('../middleware/auth');

// Center calendar events. Any CD/admin at the center can add/edit/delete them
// (center-wide operational data, like announcements — not author-gated); every
// staff member at the center can read them so instructors see what's coming.

const MAX_TITLE = 200;
const MAX_DESC = 2000;
const MAX_TIME = 40;

// Mirrors EVENT_TYPES in client/src/lib/eventTypes.js. Free text produced
// "gb", "Game Building" and "JR Game Building" for two kinds of event, which
// nothing can report on. Matched case-insensitively, stored in this spelling.
const EVENT_TYPES = [
  'Game Building',
  'JR Game Building',
  'Walk-in Game Building',
  "Parents' Night Out",
  'Tournament',
  'Field Trip',
  'Holiday',
  'Other',
];
const TYPE_BY_KEY = new Map(EVENT_TYPES.map((t) => [t.toLowerCase(), t]));

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
  const canonicalType = typeof type === 'string' ? TYPE_BY_KEY.get(type.trim().toLowerCase()) : null;
  if (!canonicalType) return { error: 'Pick an event type' };
  return {
    data: {
      title: title.trim(),
      description: description && description.trim() ? description.trim() : null,
      event_date,
      event_time: event_time && event_time.trim() ? event_time.trim() : null,
      type: canonicalType,
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

// POST /api/events — create an event at the active location
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const parsed = parseBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { title, description, event_date, event_time, type } = parsed.data;
  try {
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
  const { title, description, event_date, event_time, type } = parsed.data;
  try {
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
