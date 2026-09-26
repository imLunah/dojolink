const express = require('express');
const router = express.Router();
const { requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');
const impact = require('../lib/impact');
const { accessTokenFor } = require('../lib/impactSession');
const { encryptCookie, isConfigured } = require('../lib/mystudio');

// Experimental: the Live Ninjas board, read out of IMPACT.
//
// IMPACT's own board only updates when a push message reaches it, and when
// that connection drops (a sleeping tablet, a wifi blip, its hourly token) it
// freezes until someone reloads it. Here the board asks every twenty seconds
// and counts down on its own between asks, so a missed answer costs twenty
// seconds rather than the rest of the afternoon.
//
// Read-only upstream. No route here removes a ninja or extends a session.
// The stored password and tokens never appear in a response from this file.

async function loadConnection(pool, locationId) {
  const { rows } = await pool.query(
    `SELECT c.*, u.display_name AS connected_by_name
       FROM impact_connections c
       LEFT JOIN users u ON u.id = c.connected_by
      WHERE c.location_id = $1`,
    [locationId]
  );
  return rows[0] || null;
}

// Built field by field so a column added later cannot leak by being forgotten.
function publicShape(conn, { manager }) {
  if (!conn) return { connected: false };
  const shape = {
    connected: true,
    status: conn.status,
    facilityName: conn.facility_name,
  };
  if (!manager) return shape;
  return {
    ...shape,
    loginEmail: conn.login_email,
    connectedByName: conn.connected_by_name || null,
    lastVerifiedAt: conn.last_verified_at,
    lastSyncedAt: conn.last_synced_at,
    lastError: conn.status === 'expired' ? conn.last_error : null,
  };
}

function isManagerSession(req) {
  return ['manager', 'admin'].includes(req.session.role);
}

// Senseis get whether there is a board to open; directors get the rest.
router.get('/status', requireSensei, async (req, res) => {
  try {
    const conn = await loadConnection(req.app.get('db'), req.session.activeLocationId);
    res.json(publicShape(conn, { manager: isManagerSession(req) }));
  } catch (err) {
    console.error('IMPACT status failed:', err.message);
    res.status(500).json({ error: 'Could not load the IMPACT connection.' });
  }
});

router.post('/connect', requireManager, requireOwnLocation, async (req, res) => {
  const pool = req.app.get('db');
  if (!isConfigured()) {
    return res.status(503).json({ error: 'IMPACT is not set up on the server yet. MYSTUDIO_ENC_KEY is missing.' });
  }

  const email = String((req.body && req.body.email) || '').trim();
  const password = String((req.body && req.body.password) || '');
  if (!email || !password || email.length > 200 || password.length > 200) {
    return res.status(400).json({ error: 'Enter the email and password you use for IMPACT.' });
  }

  try {
    const { rows: locRows } = await pool.query('SELECT name FROM locations WHERE id = $1', [
      req.session.activeLocationId,
    ]);
    const tokens = await impact.signIn({ email, password });
    const facilities = await impact.getFacilities(tokens.accessToken);
    const facility = impact.pickFacility(facilities, locRows[0] && locRows[0].name);
    if (!facility) {
      return res.status(400).json({
        error: facilities.length
          ? `That account covers ${facilities.map((f) => f.name).join(', ')}, and none of them is clearly this center.`
          : 'That IMPACT account is not attached to any center.',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO impact_connections
         (location_id, connected_by, facility_guid, facility_name, login_email, login_secret,
          access_token, access_expires_at, refresh_token, refresh_expires_at,
          status, last_error, last_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'connected', NULL, now())
       ON CONFLICT (location_id) DO UPDATE SET
         connected_by = EXCLUDED.connected_by,
         facility_guid = EXCLUDED.facility_guid,
         facility_name = EXCLUDED.facility_name,
         login_email = EXCLUDED.login_email,
         login_secret = EXCLUDED.login_secret,
         access_token = EXCLUDED.access_token,
         access_expires_at = EXCLUDED.access_expires_at,
         refresh_token = EXCLUDED.refresh_token,
         refresh_expires_at = EXCLUDED.refresh_expires_at,
         status = 'connected', last_error = NULL, last_verified_at = now()
       RETURNING id`,
      [
        req.session.activeLocationId,
        req.session.userId,
        facility.guid,
        facility.name || null,
        email,
        encryptCookie(password),
        encryptCookie(tokens.accessToken),
        tokens.accessExpiresAt,
        tokens.refreshToken ? encryptCookie(tokens.refreshToken) : null,
        tokens.refreshExpiresAt,
      ]
    );
    liveCache.delete(req.session.activeLocationId);
    const conn = await loadConnection(pool, req.session.activeLocationId);
    res.json(publicShape(conn || { id: rows[0].id }, { manager: true }));
  } catch (err) {
    if (err instanceof impact.ImpactAuthError) {
      return res.status(400).json({ error: err.message });
    }
    // Never the body: the request carried a password.
    console.error('IMPACT connect failed:', err.message);
    res.status(502).json({ error: 'Could not reach IMPACT. Try again shortly.' });
  }
});

router.delete('/connect', requireManager, requireOwnLocation, async (req, res) => {
  try {
    await req.app.get('db').query('DELETE FROM impact_connections WHERE location_id = $1', [
      req.session.activeLocationId,
    ]);
    liveCache.delete(req.session.activeLocationId);
    res.json({ connected: false });
  } catch (err) {
    console.error('IMPACT disconnect failed:', err.message);
    res.status(500).json({ error: 'Could not disconnect IMPACT.' });
  }
});

// The upstream answer, briefly remembered per center, so a board on the wall,
// one on a sensei's laptop and a director's tab cost IMPACT one request between
// them rather than three. Per lambda instance, which is enough.
const LIVE_TTL_MS = 10 * 1000;
const liveCache = new Map();

router.get('/live', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = req.session.activeLocationId;

  const cached = liveCache.get(locationId);
  if (cached && Date.now() - cached.at < LIVE_TTL_MS) return res.json(cached.body);

  let conn;
  try {
    conn = await loadConnection(pool, locationId);
  } catch (err) {
    console.error('IMPACT live load failed:', err.message);
    return res.status(500).json({ error: 'Could not load the IMPACT connection.' });
  }
  if (!conn) return res.json({ connected: false, ninjas: [] });

  try {
    const token = await accessTokenFor(pool, conn);
    let ninjas;
    try {
      ninjas = await impact.getNinjasInDojo(token, conn.facility_guid);
    } catch (err) {
      // A token IMPACT turned away before its stated expiry: renew once and
      // ask again before calling the connection dead. Only the board read
      // gets this second go; a refused password never does.
      if (!(err instanceof impact.ImpactAuthError)) throw err;
      ninjas = await impact.getNinjasInDojo(
        await accessTokenFor(pool, conn, { force: true }),
        conn.facility_guid
      );
    }
    pool
      .query('UPDATE impact_connections SET last_synced_at = now() WHERE id = $1', [conn.id])
      .catch(() => {});
    const body = {
      connected: true,
      status: 'connected',
      facilityName: conn.facility_name,
      fetchedAt: new Date().toISOString(),
      ninjas,
    };
    liveCache.set(locationId, { at: Date.now(), body });
    res.json(body);
  } catch (err) {
    if (err instanceof impact.ImpactAuthError) {
      return res.json({ connected: true, status: 'expired', facilityName: conn.facility_name, ninjas: [] });
    }
    console.error('IMPACT live failed:', err.message);
    res.status(502).json({ error: 'Could not reach IMPACT.' });
  }
});

module.exports = router;
