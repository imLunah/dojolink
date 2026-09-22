function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.session.activeLocationId) return res.status(403).json({ error: 'No active location. Please log in again.' });
  next();
}

function requireManager(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!['manager', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager only' });
  next();
}

function requireSensei(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!['manager', 'sensei', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Sensei required' });
  next();
}

// Blocks writes when a user is viewing a center they're not assigned to (admin bypasses).
// Membership = the set of centers a user belongs to (home + user_locations rows), loaded
// into the session at login / on /me. Also re-validates on every write that the location is
// still active, so deactivating a location mid-session immediately blocks new writes.
async function requireOwnLocation(req, res, next) {
  if (req.session.role === 'admin') return next();
  const memberIds = req.session.locationIds || [req.session.homeLocationId];
  if (!memberIds.includes(req.session.activeLocationId)) {
    return res.status(403).json({ error: 'You can only make changes at your assigned centers.' });
  }
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      'SELECT 1 FROM locations WHERE id = $1 AND active = true',
      [req.session.activeLocationId]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Your center is no longer active.' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// A parent session must name the center it was made for.
//
// Sessions created before center codes existed carry an email and nothing else,
// and every query below scopes on the location. Without this they would fall
// through with location_id = undefined and match nothing, or worse, be read as
// unscoped. Failing them here sends the parent back to sign in once.
function requireParent(req, res, next) {
  if (!req.session.parentEmail) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.session.parentLocationId) {
    return res.status(401).json({ error: 'Please sign in again with your center code.' });
  }
  next();
}

// A kiosk session carries a center and nothing else. See routes/kiosk.js.
function requireKiosk(req, res, next) {
  const kiosk = req.session && req.session.kiosk;
  if (!kiosk || !kiosk.locationId) return res.status(401).json({ error: 'This device is not a kiosk' });
  next();
}

module.exports = { requireKiosk, requireAuth, requireManager, requireSensei, requireOwnLocation, requireParent, requireAdmin };
