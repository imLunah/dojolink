const express = require('express');
const router = express.Router();
const { requireAuth, requireSensei, requireManager, requireOwnLocation } = require('../middleware/auth');
const storage = require('../lib/storage');
const { reactionsSubquery, toggleReaction } = require('../lib/reactions');

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const MAX_POST_BODY = 4000;
const MAX_POST_TITLE = 200;
const MAX_COMMENT = 2000;

const REACTION_TABLE = { table: 'club_resource_reactions', fk: 'resource_id' };
const postReactions = (userParam) =>
  `${reactionsSubquery({ ...REACTION_TABLE, subject: 'r.id', userParam })} AS reactions`;

// A sensei owns their own board posts; directors and admin can tidy any of them.
// Posts written before the board existed have no created_by, so only a manager
// can clear those out.
function canEditPost(req, createdBy) {
  if (['manager', 'admin'].includes(req.session.role)) return true;
  return createdBy != null && createdBy === req.session.userId;
}

async function getValidClubNames(pool, locationId) {
  const { rows } = await pool.query(
    'SELECT name FROM club_definitions WHERE location_id = $1 OR location_id IS NULL',
    [locationId]
  );
  return new Set(rows.map((r) => r.name));
}

// A function, not a constant, because the reaction aggregate needs to know which
// placeholder holds the viewer's id, and the two callers number theirs
// differently.
const sessionSelect = (userParam) => `
  SELECT
    cs.id, cs.club_name, cs.session_date, cs.notes, cs.created_at,
    cs.sensei_id,
    u.display_name AS sensei_name,
    cd.color_key, cd.cover_image_url,
    COALESCE(
      (SELECT json_agg(json_build_object('id', s.id, 'full_name', s.full_name) ORDER BY s.full_name)
       FROM club_attendees ca JOIN students s ON ca.student_id = s.id
       WHERE ca.club_session_id = cs.id),
      '[]'::json
    ) AS attendees,
    COALESCE(
      (SELECT json_agg(json_build_object('id', c.id, 'user_name', c.user_name, 'body', c.body, 'created_at', c.created_at) ORDER BY c.created_at ASC)
       FROM club_session_comments c WHERE c.session_id = cs.id),
      '[]'::json
    ) AS comments,
    ${reactionsSubquery({ table: 'club_session_reactions', fk: 'session_id', subject: 'cs.id', userParam })} AS reactions
  FROM club_sessions cs
  LEFT JOIN users u ON cs.sensei_id = u.id
  LEFT JOIN club_definitions cd
    ON cd.name = cs.club_name
   AND (cd.location_id = cs.location_id OR cd.location_id IS NULL)
`;

// ─── Club definitions ─────────────────────────────────────────────────────────

// GET /api/clubs/definitions — all clubs available at this location
router.get('/definitions', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      `SELECT cd.id, cd.name, cd.slug, cd.description, cd.color_key, cd.location_id, cd.created_at, cd.schedule, cd.cover_image_url,
              u.display_name AS creator_name
       FROM club_definitions cd
       LEFT JOIN users u ON cd.created_by = u.id
       WHERE cd.location_id = $1 OR cd.location_id IS NULL
       ORDER BY cd.location_id NULLS FIRST, cd.created_at ASC`,
      [req.session.activeLocationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Club definitions fetch error:', err);
    res.status(500).json({ error: 'Failed to load clubs' });
  }
});

// POST /api/clubs/definitions — manager creates a new club
router.post('/definitions', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { name, description, color_key, schedule } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Club name is required' });
  if (name.trim().length > 80) return res.status(400).json({ error: 'Club name too long (max 80 chars)' });
  if (description && description.length > 500) return res.status(400).json({ error: 'Description too long (max 500 chars)' });

  const slug = toSlug(name.trim());
  try {
    const { rows } = await pool.query(
      `INSERT INTO club_definitions (name, slug, description, color_key, location_id, created_by, schedule)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name.trim(), slug, description?.trim() || null, color_key || 'blue', req.session.activeLocationId, req.session.userId, schedule?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A club with that name already exists' });
    console.error('Club definition create error:', err);
    res.status(500).json({ error: 'Failed to create club' });
  }
});

// PATCH /api/clubs/definitions/:id — manager edits a custom club
router.patch('/definitions/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { name, description, color_key } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Club name is required' });
  try {
    const { rows: existing } = await pool.query(
      'SELECT id, location_id FROM club_definitions WHERE id = $1',
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Club not found' });
    if (existing[0].location_id === null) return res.status(403).json({ error: 'Cannot edit a built-in club' });
    if (existing[0].location_id !== req.session.activeLocationId) return res.status(403).json({ error: 'Forbidden' });

    const { schedule } = req.body;
    const slug = toSlug(name.trim());
    const { rows } = await pool.query(
      `UPDATE club_definitions SET name = $1, slug = $2, description = $3, color_key = $4, schedule = $5
       WHERE id = $6 RETURNING *`,
      [name.trim(), slug, description?.trim() || null, color_key || 'blue', schedule?.trim() || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A club with that name already exists' });
    console.error('Club definition update error:', err);
    res.status(500).json({ error: 'Failed to update club' });
  }
});

// PATCH /api/clubs/definitions/:id/cover-image — set/clear cover photo.
// Body: { path } where path is the object path just uploaded via /api/storage/club-cover,
// or { path: null } to clear. The read URL is signed server-side; clients never sign.
router.patch('/definitions/:id/cover-image', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { path } = req.body;
  const clubId = req.params.id;

  if (path != null) {
    if (typeof path !== 'string' || !path.startsWith(`covers/${clubId}/`) || path.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
  }
  try {
    const { rows: existing } = await pool.query(
      'SELECT id, location_id, cover_image_url FROM club_definitions WHERE id = $1',
      [clubId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Club not found' });
    if (existing[0].location_id === null) return res.status(403).json({ error: 'Cannot edit a built-in club' });
    if (req.session.role !== 'admin' && existing[0].location_id !== req.session.activeLocationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const newUrl = path ? await storage.createSignedReadUrl('club-resources', path) : null;
    const { rows } = await pool.query(
      'UPDATE club_definitions SET cover_image_url = $1 WHERE id = $2 RETURNING cover_image_url',
      [newUrl, clubId]
    );
    // Old cover is now orphaned — best-effort delete.
    if (existing[0].cover_image_url) await storage.removeByUrl('club-resources', existing[0].cover_image_url);
    res.json(rows[0]);
  } catch (err) {
    console.error('Club cover image error:', err);
    res.status(500).json({ error: 'Failed to update cover image' });
  }
});

// DELETE /api/clubs/definitions/:id — manager deletes a custom club
router.delete('/definitions/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      'SELECT id, location_id, cover_image_url FROM club_definitions WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Club not found' });
    if (rows[0].location_id === null) return res.status(403).json({ error: 'Cannot delete a built-in club' });
    if (rows[0].location_id !== req.session.activeLocationId) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM club_definitions WHERE id = $1', [req.params.id]);
    if (rows[0].cover_image_url) await storage.removeByUrl('club-resources', rows[0].cover_image_url);
    res.json({ ok: true });
  } catch (err) {
    console.error('Club definition delete error:', err);
    res.status(500).json({ error: 'Failed to delete club' });
  }
});

// ─── Session list / create ────────────────────────────────────────────────────

// GET /api/clubs — all sessions for this location (optional ?club= filter)
router.get('/', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  try {
    // Params are collected before the SELECT is built: the viewer's id goes on
    // the end, so its placeholder number depends on whether ?club= took one.
    const params = [req.session.activeLocationId];
    let where = ' WHERE cs.location_id = $1';
    if (req.query.club) {
      params.push(req.query.club);
      where += ` AND cs.club_name = $${params.length}`;
    }
    params.push(req.session.userId);
    const query = sessionSelect(`$${params.length}`) + where
      + ' ORDER BY cs.session_date DESC, cs.created_at DESC LIMIT 50';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Club sessions fetch error:', err);
    res.status(500).json({ error: 'Failed to load club sessions' });
  }
});

// POST /api/clubs — check in a club session (manager only); attendees/notes filled in later by senseis
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { club_name, session_date, notes, student_ids } = req.body;

  if (!club_name) return res.status(400).json({ error: 'Club name is required' });

  const validClubs = await getValidClubNames(pool, req.session.activeLocationId);
  if (!validClubs.has(club_name)) return res.status(400).json({ error: 'Invalid club name' });

  const today = new Date().toISOString().split('T')[0];
  // session_date (when provided) must be a real calendar date, not future, not
  // absurdly old — it's stored on the session and feeds the student activity chart.
  if (session_date != null) {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(session_date) && !Number.isNaN(Date.parse(session_date));
    if (!validFormat || session_date > today || session_date < '2020-01-01') {
      return res.status(400).json({ error: 'Invalid session date' });
    }
  }

  const date = session_date || today;
  const ids = Array.isArray(student_ids) ? student_ids : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO club_sessions (club_name, session_date, location_id, sensei_id, notes)
       VALUES ($1, $2, $3, NULL, $4) RETURNING id`,
      [club_name, date, req.session.activeLocationId, notes?.trim() || null]
    );
    const sessionId = rows[0].id;
    for (const sid of ids) {
      await client.query(
        'INSERT INTO club_attendees (club_session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [sessionId, sid]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ id: sessionId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Club session create error:', err);
    res.status(500).json({ error: 'Failed to log club session' });
  } finally {
    client.release();
  }
});

// ─── Club profile routes (must come before /:id routes) ──────────────────────

// GET /api/clubs/profile/:clubName
router.get('/profile/:clubName', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  const clubName = decodeURIComponent(req.params.clubName);

  const validClubs = await getValidClubNames(pool, req.session.activeLocationId);
  if (!validClubs.has(clubName)) return res.status(400).json({ error: 'Invalid club' });

  try {
    const [profileRes, resourceRes, memberRes] = await Promise.all([
      pool.query('SELECT * FROM club_profiles WHERE club_name = $1 AND location_id = $2', [clubName, req.session.activeLocationId]),
      pool.query(`
        SELECT r.*, u.display_name AS author_name,
               ${postReactions('$3')}
        FROM club_resources r
        LEFT JOIN users u ON u.id = r.created_by
        WHERE r.club_name = $1 AND r.location_id = $2
        ORDER BY r.created_at DESC
      `, [clubName, req.session.activeLocationId, req.session.userId]),
      pool.query('SELECT COUNT(*) AS count FROM club_members WHERE club_name = $1 AND location_id = $2', [clubName, req.session.activeLocationId]),
    ]);
    const profile = profileRes.rows[0] || null;
    const member_count = parseInt(memberRes.rows[0].count, 10);
    res.json({ profile, resources: resourceRes.rows, member_count });
  } catch (err) {
    console.error('Club profile fetch error:', err);
    res.status(500).json({ error: 'Failed to load club profile' });
  }
});

// PATCH /api/clubs/profile/:clubName/pinned-note
router.patch('/profile/:clubName/pinned-note', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const clubName = decodeURIComponent(req.params.clubName);
  const { note } = req.body;

  const validClubs = await getValidClubNames(pool, req.session.activeLocationId);
  if (!validClubs.has(clubName)) return res.status(400).json({ error: 'Invalid club' });

  try {
    await pool.query(
      `INSERT INTO club_profiles (club_name, location_id, pinned_note, pinned_note_author, pinned_note_updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (club_name, location_id) DO UPDATE
       SET pinned_note = $3, pinned_note_author = $4, pinned_note_updated_at = NOW()`,
      [clubName, req.session.activeLocationId, note?.trim() || null, req.session.displayName]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Club pinned note error:', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// POST /api/clubs/profile/:clubName/resources — write a board post.
// A post carries written text, one attachment, or both. The attachment is
// either an uploaded file (path, signed server-side) or an external link.
router.post('/profile/:clubName/resources', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const clubName = decodeURIComponent(req.params.clubName);
  const { title, body, url, path, resource_type, file_name } = req.body;

  const validClubs = await getValidClubNames(pool, req.session.activeLocationId);
  if (!validClubs.has(clubName)) return res.status(400).json({ error: 'Invalid club' });

  if (body != null && typeof body !== 'string') return res.status(400).json({ error: 'Invalid text' });
  if (body && body.length > MAX_POST_BODY) {
    return res.status(400).json({ error: `Text is too long (max ${MAX_POST_BODY} characters)` });
  }
  const cleanBody = body?.trim() || null;
  const hasAttachment = resource_type === 'file' || resource_type === 'url';
  if (!cleanBody && !hasAttachment) return res.status(400).json({ error: 'Write something or attach a file' });
  if (title != null && typeof title !== 'string') return res.status(400).json({ error: 'Invalid title' });
  if (title && title.length > MAX_POST_TITLE) {
    return res.status(400).json({ error: `Title is too long (max ${MAX_POST_TITLE} characters)` });
  }

  let finalUrl = null;
  if (resource_type === 'file') {
    const prefix = `resources/${req.session.activeLocationId}/`;
    if (typeof path !== 'string' || !path.startsWith(prefix) || path.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    try {
      finalUrl = await storage.createSignedReadUrl('club-resources', path);
    } catch {
      return res.status(500).json({ error: 'Failed to sign uploaded file' });
    }
    if (!title?.trim() && !file_name?.trim()) return res.status(400).json({ error: 'File is missing a name' });
  } else if (resource_type === 'url') {
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required' });
    try {
      const parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }
    finalUrl = url.trim();
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO club_resources
         (club_name, location_id, title, body, url, added_by, created_by, resource_type, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [clubName, req.session.activeLocationId, title?.trim() || null, cleanBody, finalUrl,
       req.session.displayName, req.session.userId,
       hasAttachment ? resource_type : 'text', file_name?.trim() || null]
    );
    res.status(201).json({ ...rows[0], author_name: req.session.displayName, reactions: [] });
  } catch (err) {
    console.error('Club post add error:', err);
    res.status(500).json({ error: 'Failed to add post' });
  }
});

// PATCH /api/clubs/resources/:id — edit the written part of a post.
// The attachment is immutable: swapping it would orphan the stored object.
router.patch('/resources/:id', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { title, body } = req.body;

  if (body != null && typeof body !== 'string') return res.status(400).json({ error: 'Invalid text' });
  if (body && body.length > MAX_POST_BODY) {
    return res.status(400).json({ error: `Text is too long (max ${MAX_POST_BODY} characters)` });
  }
  if (title != null && typeof title !== 'string') return res.status(400).json({ error: 'Invalid title' });
  if (title && title.length > MAX_POST_TITLE) {
    return res.status(400).json({ error: `Title is too long (max ${MAX_POST_TITLE} characters)` });
  }

  try {
    const { rows } = await pool.query(
      'SELECT created_by, url FROM club_resources WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    if (!canEditPost(req, rows[0].created_by)) return res.status(403).json({ error: 'Not your post' });
    // The CHECK guarantees a post says something; clearing the text of a
    // text-only post would leave an empty row.
    const cleanBody = body?.trim() || null;
    if (!cleanBody && !rows[0].url) return res.status(400).json({ error: 'A post needs text' });

    const { rows: updated } = await pool.query(
      `UPDATE club_resources SET title = $3, body = $4, updated_at = NOW()
       WHERE id = $1 AND location_id = $2 RETURNING *`,
      [req.params.id, req.session.activeLocationId, title?.trim() || null, cleanBody]
    );
    const { rows: named } = await pool.query('SELECT display_name FROM users WHERE id = $1', [updated[0].created_by]);
    // The client swaps the whole post for this row, so an edit that answered
    // without the reactions would silently clear them off the card.
    const { rows: withReactions } = await pool.query(
      `SELECT ${postReactions('$2')} FROM club_resources r WHERE r.id = $1`,
      [updated[0].id, req.session.userId]
    );
    res.json({
      ...updated[0],
      author_name: named[0]?.display_name ?? updated[0].added_by,
      reactions: withReactions[0]?.reactions ?? [],
    });
  } catch (err) {
    console.error('Club post edit error:', err);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// DELETE /api/clubs/resources/:id
router.delete('/resources/:id', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows: existing } = await pool.query(
      'SELECT created_by FROM club_resources WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Post not found' });
    if (!canEditPost(req, existing[0].created_by)) return res.status(403).json({ error: 'Not your post' });

    const { rows } = await pool.query(
      'DELETE FROM club_resources WHERE id = $1 AND location_id = $2 RETURNING url, resource_type',
      [req.params.id, req.session.activeLocationId]
    );
    // Clean up the stored file (links and text posts have no object to remove).
    if (rows[0] && rows[0].resource_type === 'file') await storage.removeByUrl('club-resources', rows[0].url);
    res.json({ ok: true, deleted: rows[0] || null });
  } catch (err) {
    console.error('Club post delete error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// POST /api/clubs/resources/:id/reactions — toggle one emoji on a post.
// Anyone at the center can react to any post, their own included; this is not
// gated on canEditPost. requireOwnLocation still applies, so a director reading
// another center's board can see the reactions but cannot add to them.
router.post('/resources/:id/reactions', requireSensei, requireOwnLocation, async (req, res) => {
  try {
    const result = await toggleReaction(req.app.get('db'), {
      ...REACTION_TABLE,
      emoji: req.body.emoji,
      userId: req.session.userId,
      // Scoped to the active center, so an id from another board is a 404
      // rather than a reaction written across the wall.
      verify: async (client) => {
        const { rows } = await client.query(
          'SELECT id FROM club_resources WHERE id = $1 AND location_id = $2',
          [req.params.id, req.session.activeLocationId]
        );
        return rows[0]?.id ?? null;
      },
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ reactions: result.reactions });
  } catch (err) {
    console.error('Club post reaction error:', err);
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

// GET /api/clubs/sessions/:id
router.get('/sessions/:id', requireAuth, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query(
      sessionSelect('$3') + ' WHERE cs.id = $1 AND cs.location_id = $2',
      [req.params.id, req.session.activeLocationId, req.session.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Club session detail error:', err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// ─── Session-scoped routes ────────────────────────────────────────────────────

// PATCH /api/clubs/:id/attendees — any staff can update the attendee list
router.patch('/:id/attendees', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { student_ids } = req.body;
  if (!Array.isArray(student_ids)) {
    return res.status(400).json({ error: 'student_ids must be an array' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id FROM club_sessions WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Session not found' }); }
    const { rows: sessionInfo } = await client.query(
      'SELECT club_name, location_id FROM club_sessions WHERE id = $1', [req.params.id]
    );
    // Validate all student_ids belong to this location before inserting
    const { rows: validStudents } = await client.query(
      'SELECT id FROM students WHERE id = ANY($1::int[]) AND EXISTS (SELECT 1 FROM student_locations sl_m WHERE sl_m.student_id = students.id AND sl_m.location_id = $2) AND active = true',
      [student_ids, req.session.activeLocationId]
    );
    const validIds = new Set(validStudents.map((s) => s.id));

    await client.query('DELETE FROM club_attendees WHERE club_session_id = $1', [req.params.id]);
    for (const sid of student_ids) {
      if (!validIds.has(sid)) continue;
      await client.query(
        'INSERT INTO club_attendees (club_session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, sid]
      );
      if (sessionInfo[0]) {
        await client.query(
          'INSERT INTO club_members (club_name, location_id, student_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [sessionInfo[0].club_name, sessionInfo[0].location_id, sid]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update attendees' });
  } finally {
    client.release();
  }
});

// PATCH /api/clubs/:id/notes — managers edit any session; senseis edit only unclaimed or their own
router.patch('/:id/notes', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { notes } = req.body;
  const isManager = ['manager', 'admin'].includes(req.session.role);
  try {
    const ownershipClause = isManager ? '' : 'AND (sensei_id IS NULL OR sensei_id = $3)';
    const params = isManager
      ? [notes?.trim() || null, req.session.userId, req.params.id, req.session.activeLocationId]
      : [notes?.trim() || null, req.session.userId, req.session.userId, req.params.id, req.session.activeLocationId];

    const { rows } = await pool.query(
      `UPDATE club_sessions SET notes = $1, sensei_id = $2
       WHERE id = $${isManager ? 3 : 4} AND location_id = $${isManager ? 4 : 5}
       ${ownershipClause}
       RETURNING id`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found or not yours' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// POST /api/clubs/:id/comments — any staff can comment
router.post('/:id/comments', requireSensei, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { body } = req.body;
  if (body != null && typeof body !== 'string') return res.status(400).json({ error: 'Invalid comment' });
  if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (body.length > MAX_COMMENT) {
    return res.status(400).json({ error: `Comment too long (max ${MAX_COMMENT} characters)` });
  }
  try {
    const { rows: sessionRows } = await pool.query(
      'SELECT id FROM club_sessions WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (!sessionRows[0]) return res.status(404).json({ error: 'Session not found' });
    const { rows } = await pool.query(
      `INSERT INTO club_session_comments (session_id, user_id, user_name, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.session.userId, req.session.displayName, body.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

// POST /api/clubs/:id/reactions — toggle one emoji on a club session.
// Same shape as the board's: reacting is not editing, so any staff member at
// the center can react to any session there, and requireOwnLocation is what
// decides whether they may write at all.
router.post('/:id/reactions', requireSensei, requireOwnLocation, async (req, res) => {
  try {
    const result = await toggleReaction(req.app.get('db'), {
      table: 'club_session_reactions',
      fk: 'session_id',
      emoji: req.body.emoji,
      userId: req.session.userId,
      verify: async (client) => {
        const { rows } = await client.query(
          'SELECT id FROM club_sessions WHERE id = $1 AND location_id = $2',
          [req.params.id, req.session.activeLocationId]
        );
        return rows[0]?.id ?? null;
      },
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ reactions: result.reactions });
  } catch (err) {
    console.error('Club session reaction error:', err);
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

// DELETE /api/clubs/:id — manager only
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      'DELETE FROM club_sessions WHERE id = $1 AND location_id = $2',
      [req.params.id, req.session.activeLocationId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Club session not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete club session' });
  }
});

module.exports = router;
