const express = require('express');
const { deleteStaffUser } = require('../lib/deleteStaffUser');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { validateUsername } = require('../lib/username');
const { requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');
const { generateTempPassword } = require('../lib/tempPassword');

const SALT_ROUNDS = 10;

// Host of our own Supabase storage, the only remote origin an avatar may come from.
// Resolved once at load; null when SUPABASE_URL is unset (local dev without storage).
const STORAGE_HOST = (() => {
  try { return new URL(process.env.SUPABASE_URL).host; } catch { return null; }
})();

function validatePassword(pw) {
  return pw.length >= 6 && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

// GET /api/users
router.get('/', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { role } = req.query;
  const showInactive = req.query.inactive === 'true' && ['manager', 'admin'].includes(req.session.role);

  try {
    if (role === 'sensei' || role === 'staff') {
      const roleFilter = role === 'staff' ? `u.role IN ('sensei', 'manager')` : `u.role = 'sensei'`;
      // Scope by membership (user_locations) so staff assigned to this center show up
      // even when it isn't their home center. location_ids carries every center the
      // member belongs to so the client can render assigned-center badges.
      const { rows } = await pool.query(`
        SELECT u.id, u.username, u.display_name, u.role, u.location_id, u.created_at,
               u.profile_pic_url, u.active, COUNT(DISTINCT pl.id)::int AS progress_log_count,
               COALESCE(array_agg(DISTINCT ul.location_id) FILTER (WHERE ul.location_id IS NOT NULL), '{}') AS location_ids
        FROM users u
        LEFT JOIN progress_logs pl ON pl.sensei_id = u.id
          AND pl.student_id IN (SELECT id FROM students WHERE location_id = $1)
        LEFT JOIN user_locations ul ON ul.user_id = u.id
        WHERE ${roleFilter} AND u.active = $2
          AND u.id IN (SELECT user_id FROM user_locations WHERE location_id = $1)
        GROUP BY u.id
        ORDER BY u.role ASC, u.display_name ASC
      `, [req.session.activeLocationId, !showInactive]);
      return res.json(rows);
    }

    // Scope by membership — never expose users who aren't assigned to this center
    const { rows } = await pool.query(
      `SELECT id, username, display_name, role, location_id, created_at FROM users
       WHERE id IN (SELECT user_id FROM user_locations WHERE location_id = $1)
         AND active = true ORDER BY role, display_name ASC`,
      [req.session.activeLocationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id — sensei profile with their progress logs
router.get('/:id', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const { rows: userRows } = await pool.query(
      `SELECT id, username, display_name, role, location_id, created_at, profile_pic_url FROM users
       WHERE id = $1 AND active = true
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = $2)`,
      [id, req.session.activeLocationId]
    );
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { rows: logs } = await pool.query(`
      SELECT pl.id, pl.session_date, pl.notes, pl.belt_level_at, pl.belt_sublevel_at, pl.project_at, pl.status_at,
             s.full_name AS student_name
      FROM progress_logs pl
      JOIN students s ON pl.student_id = s.id
      WHERE pl.sensei_id = $1 AND s.location_id = $2
      ORDER BY pl.session_date DESC, pl.created_at DESC
    `, [id, req.session.activeLocationId]);

    res.json({ ...user, progress_logs: logs });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users
router.post('/', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { username, display_name, role, location_ids } = req.body;

  if (!username || !display_name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const checked = validateUsername(username);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const cleanUsername = checked.value;
  if (display_name.length > 80) return res.status(400).json({ error: 'Display name too long (max 80 chars)' });

  if (!['manager', 'sensei'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // CDs may assign new staff to any active center; default to the CD's current center.
  const requestedIds = Array.isArray(location_ids) && location_ids.length
    ? [...new Set(location_ids.map(Number).filter(Boolean))]
    : [req.session.activeLocationId];

  try {
    // Case-insensitive: login matches on LOWER(username), so `Alex` and `alex`
    // must never both exist or the lookup picks one of them arbitrarily.
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [cleanUsername]
    );
    if (existing[0]) return res.status(409).json({ error: 'Username already taken' });

    const { rows: validLocs } = await pool.query(
      'SELECT id FROM locations WHERE id = ANY($1) AND active = true',
      [requestedIds]
    );
    let validIds = validLocs.map((r) => r.id);

    // A manager may only place staff at centers they belong to themselves.
    // location_ids arrives from the client and was taken at face value, so a
    // director could reach a center they have no connection to by sending an id
    // the form never offered them.
    if (req.session.role !== 'admin') {
      const mine = req.session.locationIds?.length
        ? req.session.locationIds
        : [req.session.homeLocationId];
      const outside = validIds.filter((id) => !mine.includes(id));
      if (outside.length) {
        return res.status(403).json({ error: 'You can only add staff to your own centers.' });
      }
      validIds = validIds.filter((id) => mine.includes(id));
    }

    if (!validIds.length) return res.status(400).json({ error: 'No valid centers selected' });
    // Home = the CD's active center if included, else the first valid center.
    const homeId = validIds.includes(req.session.activeLocationId) ? req.session.activeLocationId : validIds[0];

    // Match the admin flow: generate a temp password, force reset → onboarding on first login.
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO users (username, password_hash, display_name, role, location_id, must_reset_password) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, username, display_name, role, location_id, created_at',
        [cleanUsername, hash, display_name, role, homeId]
      );
      const newUser = rows[0];
      for (const locId of validIds) {
        await client.query(
          'INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newUser.id, locId]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ ...newUser, location_ids: validIds, temp_password: tempPassword });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id/locations — update a staff member's assigned centers
router.patch('/:id/locations', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const targetId = parseInt(req.params.id, 10);
  const { location_ids } = req.body;
  const requestedIds = [...new Set((location_ids || []).map(Number).filter(Boolean))];
  if (!requestedIds.length) return res.status(400).json({ error: 'Select at least one center' });

  try {
    // Target must be a non-admin staff member assigned to the CD's current center.
    const { rows } = await pool.query(
      `SELECT u.id FROM users u
       WHERE u.id = $1 AND u.role != 'admin'
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = $2)`,
      [targetId, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Staff member not found' });

    const { rows: validLocs } = await pool.query(
      'SELECT id FROM locations WHERE id = ANY($1) AND active = true',
      [requestedIds]
    );
    let validIds = validLocs.map((r) => r.id);

    // A manager may only place staff at centers they belong to themselves.
    // location_ids arrives from the client and was taken at face value, so a
    // director could reach a center they have no connection to by sending an id
    // the form never offered them.
    if (req.session.role !== 'admin') {
      const mine = req.session.locationIds?.length
        ? req.session.locationIds
        : [req.session.homeLocationId];
      const outside = validIds.filter((id) => !mine.includes(id));
      if (outside.length) {
        return res.status(403).json({ error: 'You can only add staff to your own centers.' });
      }
      validIds = validIds.filter((id) => mine.includes(id));
    }

    if (!validIds.length) return res.status(400).json({ error: 'No valid centers selected' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_locations WHERE user_id = $1', [targetId]);
      for (const locId of validIds) {
        await client.query('INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2)', [targetId, locId]);
      }
      // Keep the current home if it's still assigned, otherwise fall back to the first center.
      const { rows: cur } = await client.query('SELECT location_id FROM users WHERE id = $1', [targetId]);
      const homeId = validIds.includes(cur[0]?.location_id) ? cur[0].location_id : validIds[0];
      await client.query('UPDATE users SET location_id = $1 WHERE id = $2', [homeId, targetId]);
      await client.query('COMMIT');
      res.json({ ok: true, location_ids: validIds });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating user locations:', err);
    res.status(500).json({ error: 'Failed to update centers' });
  }
});

// PATCH /api/users/me/avatar — save profile picture URL
router.patch('/me/avatar', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { profile_pic_url } = req.body;
  if (profile_pic_url) {
    if (typeof profile_pic_url !== 'string') return res.status(400).json({ error: 'Invalid URL' });
    const isPreset = /^\/profile\/[\w\-]+\.png$/.test(profile_pic_url);
    if (!isPreset) {
      // Only our own storage host. Accepting any http(s) URL let a staff member
      // point their avatar at a server they control — it renders in every other
      // staff member's browser (StaffPage, SenseiProfileModal), which leaks each
      // viewer's IP and the time they were reading staff records. CSP's img-src
      // does not save us: it allows https://*.supabase.co, a wildcard over every
      // Supabase project, so a self-hosted pixel passes. Same exfiltration channel
      // session 32 closed for note markdown with img: () => null.
      if (!STORAGE_HOST) return res.status(503).json({ error: 'File storage is not configured on the server.' });
      try {
        const parsed = new URL(profile_pic_url);
        if (parsed.protocol !== 'https:' || parsed.host !== STORAGE_HOST) {
          return res.status(400).json({ error: 'Invalid URL' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }
    }
  }
  try {
    await pool.query('UPDATE users SET profile_pic_url = $1 WHERE id = $2', [profile_pic_url || null, req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Avatar update error:', err);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// PATCH /api/users/me/theme — persist the user's theme so it follows them across devices
router.patch('/me/theme', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { mode, accent } = req.body;
  if (mode && !['light', 'dark'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  if (accent && (typeof accent !== 'string' || accent.length > 20)) {
    return res.status(400).json({ error: 'Invalid accent' });
  }
  try {
    await pool.query(
      'UPDATE users SET theme_mode = $1, theme_accent = $2 WHERE id = $3',
      [mode || null, accent || null, req.session.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Theme save error:', err);
    res.status(500).json({ error: 'Failed to save theme' });
  }
});

// PATCH /api/users/me — any staff can update their own username/password
router.patch('/me', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { username, new_password, current_password, display_name } = req.body;
  if (!username?.trim() && !new_password?.trim() && !display_name?.trim()) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  if (display_name && display_name.trim().length > 80) {
    return res.status(400).json({ error: 'Display name too long (max 80 chars)' });
  }
  if (new_password?.trim() && !req.session.mustResetPassword) {
    if (!current_password?.trim()) return res.status(400).json({ error: 'Current password is required to set a new password' });
    const { rows: self } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    if (!self[0] || !(await bcrypt.compare(current_password.trim(), self[0].password_hash))) {
      return res.status(403).json({ error: 'Current password is incorrect' });
    }
  }
  try {
    if (username?.trim()) {
      // Only validated when it actually changes: an account created before the
      // format rule existed must still be able to edit its other fields.
      const { rows: cur } = await pool.query('SELECT username FROM users WHERE id = $1', [req.session.userId]);
      if (cur[0]?.username !== username.trim()) {
        const checked = validateUsername(username);
        if (checked.error) return res.status(400).json({ error: checked.error });
        const { rows } = await pool.query(
          'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
          [checked.value, req.session.userId]
        );
        if (rows[0]) return res.status(409).json({ error: 'Username already taken' });
        await pool.query('UPDATE users SET username = $1 WHERE id = $2', [checked.value, req.session.userId]);
      }
    }
    if (display_name?.trim()) {
      await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [display_name.trim(), req.session.userId]);
      req.session.displayName = display_name.trim();
    }
    if (new_password?.trim()) {
      if (!validatePassword(new_password.trim())) return res.status(400).json({ error: 'Password must be at least 6 characters and include an uppercase letter and a special character' });
      const hash = await bcrypt.hash(new_password.trim(), SALT_ROUNDS);
      await pool.query('UPDATE users SET password_hash = $1, must_reset_password = false WHERE id = $2', [hash, req.session.userId]);
      req.session.mustResetPassword = false;
    }
    res.json({ ok: true, username: username?.trim() || undefined, display_name: display_name?.trim() || undefined });
  } catch (err) {
    console.error('Self credential update error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// PATCH /api/users/:id/credentials — manager resets another user's credentials (same location)
router.patch('/:id/credentials', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const targetId = parseInt(req.params.id, 10);
  const { username, new_password } = req.body;
  if (!username?.trim() && !new_password?.trim()) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 AND active = true
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = $2)`,
      [targetId, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    if (rows[0].role !== 'sensei') return res.status(403).json({ error: 'Can only edit credentials of senseis' });
    if (username?.trim()) {
      const checked = validateUsername(username);
      if (checked.error) return res.status(400).json({ error: checked.error });
      const { rows: existing } = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
        [checked.value, targetId]
      );
      if (existing[0]) return res.status(409).json({ error: 'Username already taken' });
      await pool.query('UPDATE users SET username = $1 WHERE id = $2', [checked.value, targetId]);
    }
    if (new_password?.trim()) {
      if (!validatePassword(new_password.trim())) return res.status(400).json({ error: 'Password must be at least 6 characters and include an uppercase letter and a special character' });
      const hash = await bcrypt.hash(new_password.trim(), SALT_ROUNDS);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, targetId]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Credential reset error:', err);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

// POST /api/users/:id/reset-login — regenerate a temp password and force onboarding.
// Used for CD/admin staff (who set their own password via the welcome flow rather than
// having a manager type one). Works for any non-admin staff member at the CD's center.
router.post('/:id/reset-login', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const targetId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      `SELECT id, username, role FROM users WHERE id = $1 AND active = true AND role != 'admin'
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = $2)`,
      [targetId, req.session.activeLocationId]
    );
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'Staff member not found' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_reset_password = true WHERE id = $2',
      [hash, targetId]
    );
    res.json({ username: target.username, temp_password: tempPassword });
  } catch (err) {
    console.error('Error resetting login:', err);
    res.status(500).json({ error: 'Failed to reset login' });
  }
});

// DELETE /api/users/:id (soft delete — manager only, own location, senseis only)
router.delete('/:id', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 AND active = true
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = $2)`,
      [id, req.session.activeLocationId]
    );
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.session.userId) return res.status(403).json({ error: 'Cannot remove your own account' });
    // Directors manage directors now. Admin is still untouchable: it bypasses
    // every location gate, so it cannot be archived by somebody it outranks.
    if (target.role === 'admin') return res.status(403).json({ error: 'Cannot remove an admin account' });

    await pool.query('UPDATE users SET active = false WHERE id = $1', [id]);
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    console.error('Error removing user:', err);
    res.status(500).json({ error: 'Failed to remove sensei' });
  }
});

// PATCH /api/users/:id/restore
router.patch('/:id/restore', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND active = false
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = $2)`,
      [id, req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Archived user not found' });
    await pool.query('UPDATE users SET active = true WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error restoring user:', err);
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

// DELETE /api/users/:id/permanent — hard-delete a sensei at the manager's own center
router.delete('/:id/permanent', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, role FROM users WHERE id = $1
         AND EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = $2)`,
      [id, req.session.activeLocationId]
    );
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.session.userId) return res.status(403).json({ error: 'Cannot delete your own account' });
    if (target.role !== 'sensei') return res.status(403).json({ error: 'Can only delete senseis' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await deleteStaffUser(client, id);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error permanently deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
