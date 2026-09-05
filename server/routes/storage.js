const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireSensei, requireManager, requireOwnLocation } = require('../middleware/auth');
const storage = require('../lib/storage');

const BUCKET = 'club-resources';

// Image types allowed for club covers.
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// CSPRNG, not Math.random(): object paths shouldn't be predictable even though
// the bucket is private and reads go through signed URLs.
function rand() {
  return crypto.randomBytes(6).toString('hex');
}

// Derive a safe extension from a filename, falling back to a default.
function safeExt(filename, fallback) {
  const m = typeof filename === 'string' ? filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/) : null;
  return m ? m[1] : fallback;
}

function guard(req, res) {
  if (!storage.isConfigured()) {
    res.status(503).json({ error: 'File storage is not configured on the server.' });
    return false;
  }
  return true;
}

// POST /api/storage/club-cover/:clubId — authorize a cover upload for a club.
router.post('/club-cover/:clubId', requireManager, requireOwnLocation, async (req, res) => {
  if (!guard(req, res)) return;
  const pool = req.app.get('db');
  const ext = IMAGE_EXT[req.body?.contentType];
  if (!ext) return res.status(400).json({ error: 'Only image files are allowed.' });
  try {
    const { rows } = await pool.query('SELECT id, location_id FROM club_definitions WHERE id = $1', [req.params.clubId]);
    if (!rows[0]) return res.status(404).json({ error: 'Club not found' });
    if (rows[0].location_id === null) return res.status(403).json({ error: 'Cannot edit a built-in club' });
    if (req.session.role !== 'admin' && rows[0].location_id !== req.session.activeLocationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const path = `covers/${req.params.clubId}/${Date.now()}-${rand()}.${ext}`;
    res.json({ bucket: BUCKET, ...(await storage.createSignedUploadUrl(BUCKET, path)) });
  } catch (err) {
    console.error('Cover upload-url error:', err);
    res.status(500).json({ error: 'Failed to prepare upload' });
  }
});

// POST /api/storage/event-image — authorize a banner image upload for an
// event listing. Pathed by location, not listing id, so the image can be
// uploaded before the listing exists; the attach happens on
// PATCH /api/event-listings/:id/image, which enforces the same prefix.
router.post('/event-image', requireManager, requireOwnLocation, async (req, res) => {
  if (!guard(req, res)) return;
  const ext = IMAGE_EXT[req.body?.contentType];
  if (!ext) return res.status(400).json({ error: 'Only image files are allowed.' });
  try {
    const path = `event-listings/${req.session.activeLocationId}/${Date.now()}-${rand()}.${ext}`;
    res.json({ bucket: BUCKET, ...(await storage.createSignedUploadUrl(BUCKET, path)) });
  } catch (err) {
    console.error('Event image upload-url error:', err);
    res.status(500).json({ error: 'Failed to prepare upload' });
  }
});

// POST /api/storage/club-resource — authorize a club resource file upload.
router.post('/club-resource', requireSensei, requireOwnLocation, async (req, res) => {
  if (!guard(req, res)) return;
  const ext = safeExt(req.body?.filename, 'bin');
  try {
    const path = `resources/${req.session.activeLocationId}/${Date.now()}-${rand()}.${ext}`;
    res.json({ bucket: BUCKET, ...(await storage.createSignedUploadUrl(BUCKET, path)) });
  } catch (err) {
    console.error('Resource upload-url error:', err);
    res.status(500).json({ error: 'Failed to prepare upload' });
  }
});

module.exports = router;
