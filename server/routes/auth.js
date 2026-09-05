const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { deleteStaffUser, DELETION_REASONS, cleanDetails } = require('../lib/deleteStaffUser');
const router = express.Router();
const { requireAuth, requireManager, requireSensei } = require('../middleware/auth');

// Membership = the centers a user belongs to: their home (users.location_id) plus any
// user_locations rows. Backfill guarantees the home row exists, but we union home in
// defensively so a user is never locked out of their own center.
async function loadMembershipIds(pool, user) {
  const { rows } = await pool.query(
    'SELECT location_id FROM user_locations WHERE user_id = $1',
    [user.id]
  );
  return [...new Set([user.location_id, ...rows.map((r) => r.location_id)].filter(Boolean))];
}

// availableLocations drives the location switcher. Managers/admins can view every active
// center (read-only outside their membership); senseis only see centers they belong to.
async function getAvailableLocations(pool, role, locationIds) {
  if (['manager', 'admin'].includes(role)) {
    return (await pool.query('SELECT id, name, slug FROM locations WHERE active = true ORDER BY name')).rows;
  }
  return (await pool.query(
    'SELECT id, name, slug FROM locations WHERE active = true AND id = ANY($1) ORDER BY name',
    [locationIds]
  )).rows;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // integration tests log in many times from one IP
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// POST /api/auth/delete-account — a staff member deletes their own account.
//
// Username and password again, typed, because a signed-in session is not the
// same as the person being sure: a shared tablet left open must not be able
// to erase someone. Admin accounts are refused here; an admin deleting
// themselves could take the last key to the system with them. The deletion
// itself is the director's permanent delete (deleteStaffUser), so a ninja's
// logs survive with "Deleted user" as the author, and the session dies with
// the row.
const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});
router.post('/delete-account', requireAuth, deleteLimiter, async (req, res) => {
  const pool = req.app.get('db');
  const { username, password, reason, details } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Enter your username and password to confirm.' });
  if (!DELETION_REASONS.includes(reason)) return res.status(400).json({ error: 'Choose a reason.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, username, role, location_id, password_hash FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.role === 'admin') return res.status(403).json({ error: "Admin accounts can't be deleted from here." });
    const sameUser = String(username).trim().toLowerCase() === String(user.username).toLowerCase();
    const match = sameUser && await bcrypt.compare(String(password), user.password_hash);
    if (!match) return res.status(401).json({ error: "That username and password don't match this account." });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO account_deletions (role, location_id, reason, details) VALUES ($1, $2, $3, $4)',
        [user.role, user.location_id, reason, cleanDetails(details)]
      );
      await deleteStaffUser(client, user.id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    req.session.destroy(() => res.json({ ok: true }));
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete your account' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password, keep_signed_in } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      'SELECT id, username, display_name, role, location_id, profile_pic_url, password_hash, must_reset_password, theme_mode, theme_accent FROM users WHERE LOWER(username) = LOWER($1) AND active = true',
      // Trimmed: a stray space picked up from autofill or a keyboard shouldn't
      // read as a wrong username.
      [String(username).trim()]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify location is still active before issuing a session (admin exempt — can switch locations)
    const { rows: locationRows } = await pool.query(
      'SELECT id, name, slug FROM locations WHERE id = $1 AND active = true',
      [user.location_id]
    );
    const activeLocation = locationRows[0];
    if (!activeLocation && user.role !== 'admin') {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.displayName = user.display_name;
    const locationIds = await loadMembershipIds(pool, user);

    req.session.activeLocationId = user.location_id;
    req.session.homeLocationId = user.location_id;
    req.session.locationIds = locationIds;
    req.session.mustResetPassword = !!user.must_reset_password;
    req.session.cookie.maxAge = keep_signed_in
      ? 30 * 24 * 60 * 60 * 1000  // 30 days
      : null;                       // session cookie — expires when browser closes

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    const availableLocations = await getAvailableLocations(pool, user.role, locationIds);

    const { rows: annRows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'announcement'`);
    const announcement = annRows[0]?.value || null;

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      homeLocationId: user.location_id,
      locationIds,
      profilePicUrl: user.profile_pic_url || null,
      activeLocation: activeLocation ?? null,
      availableLocations,
      announcement,
      mustResetPassword: !!user.must_reset_password,
      theme: (user.theme_mode || user.theme_accent) ? { mode: user.theme_mode || null, accent: user.theme_accent || null } : null,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// POST /api/auth/switch-location
// Managers/admins can switch to any active center (read-only outside their membership).
// Senseis can only switch among the centers they belong to.
router.post('/switch-location', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId is required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, name, slug FROM locations WHERE id = $1 AND active = true',
      [locationId]
    );
    const location = rows[0];
    if (!location) return res.status(403).json({ error: 'Location not found or inactive' });
    if (!['manager', 'admin'].includes(req.session.role) &&
        !(req.session.locationIds || []).includes(location.id)) {
      return res.status(403).json({ error: 'You are not assigned to that center' });
    }
    req.session.activeLocationId = location.id;
    res.json({ activeLocation: location });
  } catch (err) {
    console.error('Switch location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(200).json(null);
  }

  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      'SELECT id, username, display_name, role, location_id, profile_pic_url, must_reset_password, onboarded_at, theme_mode, theme_accent FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];

    if (!user) {
      return res.status(200).json(null);
    }

    const { rows: [activeLocation] } = await pool.query(
      'SELECT id, name, slug FROM locations WHERE id = $1 AND active = true',
      [req.session.activeLocationId]
    );
    // Refresh membership in case the user's center assignments changed since login.
    const locationIds = await loadMembershipIds(pool, user);
    req.session.locationIds = locationIds;
    const availableLocations = await getAvailableLocations(pool, user.role, locationIds);

    const { rows: annRows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'announcement'`);
    const announcement = annRows[0]?.value || null;

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      homeLocationId: user.location_id,
      locationIds,
      profilePicUrl: user.profile_pic_url || null,
      activeLocation: activeLocation ?? null,
      availableLocations,
      announcement,
      mustResetPassword: req.session.mustResetPassword ?? false,
      onboarded: !!user.onboarded_at,
      theme: (user.theme_mode || user.theme_accent) ? { mode: user.theme_mode || null, accent: user.theme_accent || null } : null,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
