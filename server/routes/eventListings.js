const express = require('express');
const router = express.Router();
const { requireManager, requireOwnLocation } = require('../middleware/auth');
const storage = require('../lib/storage');

// Event listings: what a center is promoting to families, authored for
// families on the manager Events page. The parent portal home shows the
// published ones as a slideshow (that read lives in routes/parent.js).
// Everything here is per-location, CD/admin only — center-wide promotional
// data, like announcements, not author-gated.

const BUCKET = 'club-resources';
const MAX_TITLE = 200;
const MAX_SUBTITLE = 200;
const MAX_DESC = 2000;
const MAX_URL = 500;
const MAX_TIME = 40;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (s) => DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());

// to_char keeps event_date a plain YYYY-MM-DD — a raw pg DATE serializes as a
// UTC-midnight ISO string, which reads back a day early in western timezones.
const SELECT = `
  SELECT l.id, l.title, l.subtitle, l.description, l.event_url, l.image_url,
         to_char(l.event_date, 'YYYY-MM-DD') AS event_date,
         l.event_time, l.published, l.created_by, l.created_at, l.updated_at,
         u.display_name AS created_by_name
  FROM event_listings l
  LEFT JOIN users u ON u.id = l.created_by
`;

// Validates + normalizes the writable fields. Returns { error } or { data }.
// image_url is deliberately NOT writable here — it only moves through the
// /:id/image route, where the server signs the read URL itself.
function parseBody(body) {
  const { title, subtitle, description, event_url, event_date, event_time, published } = body || {};
  if (typeof title !== 'string' || !title.trim()) return { error: 'Title is required' };
  if (title.length > MAX_TITLE) return { error: `Title max ${MAX_TITLE} characters` };
  if (subtitle != null && (typeof subtitle !== 'string' || subtitle.length > MAX_SUBTITLE)) {
    return { error: `Subtitle max ${MAX_SUBTITLE} characters` };
  }
  if (description != null && (typeof description !== 'string' || description.length > MAX_DESC)) {
    return { error: `Description max ${MAX_DESC} characters` };
  }
  if (event_url != null && event_url !== '') {
    if (typeof event_url !== 'string' || event_url.length > MAX_URL) return { error: `Link max ${MAX_URL} characters` };
    // Families click this from their portal: only web URLs, nothing that can
    // smuggle a javascript: or data: scheme into an <a href>.
    if (!/^https?:\/\//i.test(event_url.trim())) return { error: 'The link must start with http:// or https://' };
  }
  if (event_date != null && event_date !== '' && (typeof event_date !== 'string' || !isValidDate(event_date))) {
    return { error: 'A valid date is required' };
  }
  if (event_time != null && (typeof event_time !== 'string' || event_time.length > MAX_TIME)) {
    return { error: `Time max ${MAX_TIME} characters` };
  }
  if (published != null && typeof published !== 'boolean') {
    return { error: 'Published must be true or false' };
  }
  return {
    data: {
      title: title.trim(),
      subtitle: subtitle && subtitle.trim() ? subtitle.trim() : null,
      description: description && description.trim() ? description.trim() : null,
      event_url: event_url && event_url.trim() ? event_url.trim() : null,
      event_date: event_date || null,
      event_time: event_time && event_time.trim() ? event_time.trim() : null,
      published: published !== false,
    },
  };
}

// GET /api/event-listings — all listings at the active location, the ones
// with a date soonest first, evergreen ones after by recency.
router.get('/', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `${SELECT} WHERE l.location_id = $1 ORDER BY l.event_date ASC NULLS LAST, l.created_at DESC`,
      [req.session.activeLocationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching event listings:', err);
    res.status(500).json({ error: 'Failed to fetch event listings' });
  }
});

// POST /api/event-listings — create a listing at the active location
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const parsed = parseBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const d = parsed.data;
  try {
    const { rows } = await pool.query(
      `WITH ins AS (
         INSERT INTO event_listings (location_id, created_by, title, subtitle, description, event_url, event_date, event_time, published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *
       )
       ${SELECT.replace('FROM event_listings l', 'FROM ins l')} WHERE true`,
      [req.session.activeLocationId, req.session.userId, d.title, d.subtitle, d.description, d.event_url, d.event_date, d.event_time, d.published]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating event listing:', err);
    res.status(500).json({ error: 'Failed to create event listing' });
  }
});

// PATCH /api/event-listings/:id/image — set/clear the banner image.
// Body: { path } just uploaded via /api/storage/event-image, or { path: null }
// to clear. The read URL is signed server-side; clients never sign. Declared
// above the generic PATCH so /:id never swallows it.
router.patch('/:id/image', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { path } = req.body || {};
  if (path != null) {
    if (typeof path !== 'string' || !path.startsWith(`event-listings/${req.session.activeLocationId}/`) || path.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
  }
  try {
    const { rows: existing } = await pool.query(
      'SELECT id, image_url FROM event_listings WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Listing not found' });
    const newUrl = path ? await storage.createSignedReadUrl(BUCKET, path) : null;
    const { rows } = await pool.query(
      'UPDATE event_listings SET image_url = $1, updated_at = now() WHERE id = $2 RETURNING image_url',
      [newUrl, req.params.id]
    );
    // Old image is now orphaned — best-effort delete.
    if (existing[0].image_url) await storage.removeByUrl(BUCKET, existing[0].image_url);
    res.json(rows[0]);
  } catch (err) {
    console.error('Event listing image error:', err);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// PATCH /api/event-listings/:id — edit a listing at the active location
router.patch('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const parsed = parseBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const d = parsed.data;
  try {
    const { rows: found } = await pool.query(
      'SELECT id FROM event_listings WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Listing not found' });
    const { rows } = await pool.query(
      `WITH upd AS (
         UPDATE event_listings
         SET title=$1, subtitle=$2, description=$3, event_url=$4, event_date=$5, event_time=$6, published=$7, updated_at=now()
         WHERE id=$8 RETURNING *
       )
       ${SELECT.replace('FROM event_listings l', 'FROM upd l')} WHERE true`,
      [d.title, d.subtitle, d.description, d.event_url, d.event_date, d.event_time, d.published, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating event listing:', err);
    res.status(500).json({ error: 'Failed to update event listing' });
  }
});

// DELETE /api/event-listings/:id — remove a listing (and its image object)
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      'DELETE FROM event_listings WHERE id = $1 AND location_id = $2 RETURNING image_url',
      [req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Listing not found' });
    if (rows[0].image_url) await storage.removeByUrl(BUCKET, rows[0].image_url);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting event listing:', err);
    res.status(500).json({ error: 'Failed to delete event listing' });
  }
});

module.exports = router;
