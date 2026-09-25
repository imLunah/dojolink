const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireSensei, requireAdmin } = require('../middleware/auth');
const storage = require('../lib/storage');

// Feedback tickets: bug reports and feature ideas, from staff and parents.
//
// A ticket arrives 'new' and only admins and its sender can see it. An admin
// triages it by writing a title and picking a status; after that every staff
// member sees the title and status on Issues & roadmap. What the reporter
// wrote, who they are, their screenshot and their browser details stay in the
// admin view, whatever the status: a parent's report can name a child, and
// the title an admin writes will not.
//
// Mounted behind both sessions in index.js: a staff session if there is one,
// otherwise the parent session. `requireSensei`/`requireAdmin` therefore
// refuse parents on their own, since a parent session has no userId.

const BUCKET = 'club-resources';
const SHOT_PREFIX = 'tickets';
const SHOT_MAX_BYTES = 5 * 1024 * 1024;
const SHOT_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
// Screenshot links handed to an admin are never stored, so they can be short.
const SHOT_URL_TTL = 60 * 60;

const STATUSES = ['new', 'aware', 'planned', 'in_progress', 'resolved', 'wont_fix'];
const CLOSED = ['resolved', 'wont_fix'];

const clip = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

function requireAnySession(req, res, next) {
  if (!req.session.userId && !req.session.parentEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// The reporter's own tickets, whichever kind of account they are.
function mineClause(req, startAt = 1) {
  if (req.session.userId) {
    return { sql: `reporter_user_id = $${startAt}`, params: [req.session.userId] };
  }
  return {
    sql: `LOWER(reporter_parent_email) = LOWER($${startAt}) AND location_id = $${startAt + 1}`,
    params: [req.session.parentEmail, req.session.parentLocationId],
  };
}

async function saveScreenshot(dataUrl) {
  if (typeof dataUrl !== 'string' || !storage.isConfigured()) return null;
  const m = dataUrl.match(/^data:([a-z/+-]+);base64,(.+)$/i);
  if (!m) return null;
  const ext = SHOT_TYPES[m[1].toLowerCase()];
  if (!ext) return null;
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length || buffer.length > SHOT_MAX_BYTES) return null;
  const path = `${SHOT_PREFIX}/${crypto.randomUUID()}.${ext}`;
  try {
    return await storage.uploadObject(BUCKET, path, buffer, m[1].toLowerCase());
  } catch (err) {
    // A ticket without its screenshot is still a ticket.
    console.error('Ticket screenshot upload failed:', err.message);
    return null;
  }
}

// POST /api/bugs — file a ticket.
router.post('/', requireAnySession, async (req, res) => {
  const { type, category, description, screenshot, pageUrl, userAgent, screenSize, consoleErrors } = req.body || {};
  const text = String(description ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Description is required.' });
  if (text.length > 2000) return res.status(400).json({ error: 'Description is too long.' });
  const kind = type === 'feature' ? 'feature' : 'bug';

  const errors = kind === 'bug' && Array.isArray(consoleErrors)
    ? consoleErrors.slice(-20).map((e) => String(e).slice(0, 2000))
    : null;

  const pool = req.app.get('db');
  try {
    // Who sent it comes from the session, never from the request body.
    let reporter;
    if (req.session.userId) {
      const { rows: [u] } = await pool.query('SELECT display_name, username FROM users WHERE id = $1', [req.session.userId]);
      reporter = {
        userId: req.session.userId,
        parentEmail: null,
        name: u?.display_name || u?.username || null,
        role: req.session.role || null,
        locationId: req.session.activeLocationId || null,
      };
    } else {
      reporter = {
        userId: null,
        parentEmail: req.session.parentEmail,
        name: req.session.parentName || null,
        role: 'parent',
        locationId: req.session.parentLocationId || null,
      };
    }

    const shotPath = await saveScreenshot(screenshot);

    const { rows: [row] } = await pool.query(
      `INSERT INTO feedback_tickets
         (type, category, description, reporter_user_id, reporter_parent_email, reporter_name, reporter_role,
          location_id, page_url, user_agent, screen_size, console_errors, screenshot_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, type, category, description, status, title, created_at, updated_at, closed_at`,
      [
        kind, clip(category, 60) || 'Other', text,
        reporter.userId, reporter.parentEmail, clip(reporter.name, 120), reporter.role, reporter.locationId,
        clip(pageUrl, 500), clip(userAgent, 500), clip(screenSize, 40),
        errors && errors.length ? JSON.stringify(errors) : null, shotPath,
      ]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('Ticket create error:', err.message);
    res.status(500).json({ error: 'Failed to send. Please try again.' });
  }
});

// GET /api/bugs/mine — what I have sent, in my own words, with where it stands.
router.get('/mine', requireAnySession, async (req, res) => {
  const pool = req.app.get('db');
  const { sql, params } = mineClause(req);
  try {
    const { rows } = await pool.query(
      `SELECT id, type, category, description, status, title, created_at, updated_at, closed_at
         FROM feedback_tickets WHERE ${sql}
        ORDER BY created_at DESC LIMIT 100`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Ticket mine error:', err.message);
    res.status(500).json({ error: 'Failed to load your reports' });
  }
});

// GET /api/bugs/board — every triaged ticket, title and status only.
router.get('/board', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `SELECT id, type, category, status, title, created_at, updated_at, closed_at,
              (reporter_user_id = $1) AS mine
         FROM feedback_tickets
        WHERE status <> 'new'
        ORDER BY updated_at DESC
        LIMIT 500`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Ticket board error:', err.message);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

const ADMIN_COLUMNS = `
  t.id, t.type, t.category, t.description, t.status, t.title,
  t.reporter_name, t.reporter_role, t.reporter_parent_email, t.page_url, t.user_agent, t.screen_size,
  t.console_errors, (t.screenshot_path IS NOT NULL) AS has_screenshot,
  t.seen_at, t.created_at, t.updated_at, t.closed_at,
  l.name AS location_name`;

// GET /api/bugs/admin — every ticket, with everything the reporter sent.
router.get('/admin', requireAdmin, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `SELECT ${ADMIN_COLUMNS}
         FROM feedback_tickets t LEFT JOIN locations l ON l.id = t.location_id
        ORDER BY t.created_at DESC
        LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('Ticket admin list error:', err.message);
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

const ticketId = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/bugs/admin/:id — one ticket, opened. Opening it is what reading
// it means, so it also clears it from the admin's bell.
router.get('/admin/:id', requireAdmin, async (req, res) => {
  const id = ticketId(req);
  if (!id) return res.status(404).json({ error: 'Ticket not found' });
  const pool = req.app.get('db');
  try {
    await pool.query('UPDATE feedback_tickets SET seen_at = COALESCE(seen_at, now()) WHERE id = $1', [id]);
    const { rows: [row] } = await pool.query(
      `SELECT ${ADMIN_COLUMNS}, t.screenshot_path
         FROM feedback_tickets t LEFT JOIN locations l ON l.id = t.location_id
        WHERE t.id = $1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Ticket not found' });
    let screenshotUrl = null;
    if (row.screenshot_path) {
      try {
        screenshotUrl = await storage.createSignedReadUrl(BUCKET, row.screenshot_path, SHOT_URL_TTL);
      } catch (err) {
        console.error('Ticket screenshot sign failed:', err.message);
      }
    }
    delete row.screenshot_path;
    res.json({ ...row, screenshot_url: screenshotUrl });
  } catch (err) {
    console.error('Ticket admin get error:', err.message);
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

// PATCH /api/bugs/:id — triage: the title everyone sees, and the status.
router.patch('/:id', requireAdmin, async (req, res) => {
  const id = ticketId(req);
  if (!id) return res.status(404).json({ error: 'Ticket not found' });
  const { title, status } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown status' });
  }
  const cleanTitle = title === undefined ? undefined : clip(title, 120);
  const pool = req.app.get('db');
  try {
    const { rows: [current] } = await pool.query('SELECT status, title FROM feedback_tickets WHERE id = $1', [id]);
    if (!current) return res.status(404).json({ error: 'Ticket not found' });
    const nextStatus = status ?? current.status;
    const nextTitle = cleanTitle === undefined ? current.title : cleanTitle;
    if (nextStatus !== 'new' && !nextTitle) {
      return res.status(400).json({ error: 'Give it a title before it leaves the inbox.' });
    }
    // A move to a real status rings the reporter's bell (notifications.js).
    // Retitling alone does not, and nor does sending it back to the inbox.
    const notify = nextStatus !== current.status && nextStatus !== 'new';
    const { rows: [row] } = await pool.query(
      `UPDATE feedback_tickets
          SET title = $2, status = $3, updated_at = now(), seen_at = COALESCE(seen_at, now()),
              closed_at = CASE WHEN $3 = ANY($4::text[]) THEN COALESCE(closed_at, now()) ELSE NULL END,
              status_changed_at = CASE WHEN $5 THEN now() ELSE status_changed_at END,
              status_changed_by = CASE WHEN $5 THEN $6::int ELSE status_changed_by END,
              reporter_read_at  = CASE WHEN $5 THEN NULL ELSE reporter_read_at END
        WHERE id = $1
        RETURNING id`,
      [id, nextTitle, nextStatus, CLOSED, notify, req.session.userId]
    );
    const { rows: [full] } = await pool.query(
      `SELECT ${ADMIN_COLUMNS} FROM feedback_tickets t LEFT JOIN locations l ON l.id = t.location_id WHERE t.id = $1`,
      [row.id]
    );
    res.json(full);
  } catch (err) {
    console.error('Ticket update error:', err.message);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// DELETE /api/bugs/:id — for spam and duplicates. Takes the screenshot with it.
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = ticketId(req);
  if (!id) return res.status(404).json({ error: 'Ticket not found' });
  const pool = req.app.get('db');
  try {
    const { rows: [row] } = await pool.query(
      'DELETE FROM feedback_tickets WHERE id = $1 RETURNING screenshot_path', [id]
    );
    if (!row) return res.status(404).json({ error: 'Ticket not found' });
    if (row.screenshot_path) await storage.removeObject(BUCKET, row.screenshot_path);
    res.json({ ok: true });
  } catch (err) {
    console.error('Ticket delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

module.exports = router;
