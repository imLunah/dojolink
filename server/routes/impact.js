const express = require('express');
const router = express.Router();
const { requireManager, requireSensei, requireOwnLocation } = require('../middleware/auth');
const impact = require('../lib/impact');
const { accessTokenFor } = require('../lib/impactSession');
const { recordScanIns, dojoBelts } = require('../lib/impactRecord');
const { encryptCookie, isConfigured } = require('../lib/mystudio');

// Experimental: the Live Ninjas board, read out of IMPACT.
//
// IMPACT's own board only updates when a push message reaches it, and when
// that connection drops (a sleeping tablet, a wifi blip, its hourly token) it
// freezes until someone reloads it. Here the board asks every twenty seconds
// and counts down on its own between asks, so a missed answer costs twenty
// seconds rather than the rest of the afternoon.
//
// Upstream it does what IMPACT's own board does and nothing more: remove a
// ninja whose time is up, add one back, and change how long a session runs.
// The browser names a scan-in by its id; the IMPACT username those requests
// need is looked up here from the center's own list, so it never reaches the
// browser, and a scan-in from another center is simply not found.
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
const RECORD_EVERY_MS = 60 * 1000;
const recordedAt = new Map();

// Belts for a set of IMPACT accounts, from DojoLink. A failed lookup costs the
// belt art, never the board.
function beltsFor(pool, locationId, people) {
  return dojoBelts(pool, locationId, people).catch((err) => {
    console.error('IMPACT belt lookup failed:', err.message);
    return new Map();
  });
}

async function liveBody(pool, conn, rows) {
  const belts = await beltsFor(
    pool,
    conn.location_id,
    rows.map((r) => ({ user: String(r.userGuid), name: `${r.firstName || ''} ${r.lastName || ''}` }))
  );
  return {
    connected: true,
    status: 'connected',
    facilityName: conn.facility_name,
    fetchedAt: new Date().toISOString(),
    ...impact.boardLists(rows, belts),
  };
}

// Today's scan-ins for a connection, renewing the sign-in if it has to.
async function readScanIns(pool, conn) {
  const token = await accessTokenFor(pool, conn);
  try {
    return await impact.getScanIns(token, conn.facility_guid);
  } catch (err) {
    // A token IMPACT turned away before its stated expiry: renew once and
    // ask again before calling the connection dead. Only the read gets this
    // second go; a refused password never does.
    if (!(err instanceof impact.ImpactAuthError)) throw err;
    return impact.getScanIns(await accessTokenFor(pool, conn, { force: true }), conn.facility_guid);
  }
}

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
    const rows = await readScanIns(pool, conn);
    // Every poll is also a chance to keep today's scan-ins for Reports. Once a
    // minute per center is plenty: the nightly capture writes the whole day
    // anyway, this only makes today's numbers right before then.
    if (Date.now() - (recordedAt.get(locationId) || 0) > RECORD_EVERY_MS) {
      recordedAt.set(locationId, Date.now());
      await recordScanIns(pool, locationId, rows).catch((err) => {
        console.error('IMPACT record failed:', err.message);
      });
    }
    pool
      .query('UPDATE impact_connections SET last_synced_at = now() WHERE id = $1', [conn.id])
      .catch(() => {});
    const body = await liveBody(pool, conn, rows);
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

// GET /api/impact/ninjas?search=&page= — "View All Ninjas". Read-only: no
// check-in and no account edits (IMPACT's own version does both). Each ninja
// is marked with where they are today, from the same scan-in list the board
// reads.
router.get('/ninjas', requireSensei, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const conn = await loadConnection(pool, req.session.activeLocationId);
    if (!conn) return res.status(404).json({ error: 'IMPACT is not connected for this center.' });
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 50);
    const [found, rows] = await Promise.all([
      accessTokenFor(pool, conn).then((token) =>
        impact.searchNinjas(token, conn.facility_guid, { search: req.query.search || '', page })
      ),
      readScanIns(pool, conn),
    ]);
    const today = new Map();
    for (const r of rows) {
      const n = impact.normalizeScanIn(r);
      const prev = today.get(String(r.userGuid));
      if (!prev || new Date(n.startedAt) > new Date(prev.startedAt)) today.set(String(r.userGuid), n);
    }
    const belts = await beltsFor(
      pool,
      conn.location_id,
      found.ninjas.map((n) => ({ user: n.guid, name: n.fullName }))
    );
    res.json({
      hasMore: found.hasMore,
      ninjas: found.ninjas.map(({ guid, fullName, ...n }) => {
        const scan = today.get(guid);
        return {
          ...n,
          id: guid,
          belt: belts.get(guid) || null,
          program: scan ? scan.program : null,
          today: scan
            ? {
                startedAt: scan.startedAt,
                sessionMinutes: scan.sessionMinutes,
                removedAt: scan.removedAt,
                weekMinutes: scan.weekMinutes,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    if (err instanceof impact.ImpactAuthError) {
      return res.status(409).json({ error: 'The IMPACT sign-in stopped working. A director needs to sign in again.' });
    }
    console.error('IMPACT search failed:', err.message);
    res.status(502).json({ error: 'Could not reach IMPACT.' });
  }
});

// The board's three actions. Each reads the center's list first, so the
// scan-in must belong to this center, then acts, then answers with the board
// as IMPACT now has it.
function boardAction(act) {
  return async (req, res) => {
    const pool = req.app.get('db');
    const locationId = req.session.activeLocationId;
    try {
      const conn = await loadConnection(pool, locationId);
      if (!conn) return res.status(404).json({ error: 'IMPACT is not connected for this center.' });
      const rows = await readScanIns(pool, conn);
      const row = rows.find((r) => String(r.key) === String(req.params.id));
      if (!row) return res.status(404).json({ error: 'That ninja is not on today\'s board.' });
      await act(await accessTokenFor(pool, conn), row, req.body || {});
      liveCache.delete(locationId);
      const fresh = await readScanIns(pool, conn);
      await recordScanIns(pool, locationId, fresh).catch(() => {});
      res.json(await liveBody(pool, conn, fresh));
    } catch (err) {
      if (err instanceof impact.ImpactRefused) return res.status(400).json({ error: err.message });
      if (err instanceof impact.ImpactAuthError) {
        return res.status(409).json({ error: 'The IMPACT sign-in stopped working. A director needs to sign in again.' });
      }
      console.error('IMPACT board action failed:', err.message);
      res.status(502).json({ error: 'IMPACT did not take that. Try again.' });
    }
  };
}

router.post('/scan-ins/:id/remove', requireSensei, requireOwnLocation,
  boardAction((token, row) => impact.setRemoved(token, row, true)));
router.post('/scan-ins/:id/add-back', requireSensei, requireOwnLocation,
  boardAction((token, row) => impact.setRemoved(token, row, false)));
router.post('/scan-ins/:id/time', requireSensei, requireOwnLocation,
  boardAction((token, row, body) => impact.setExtraTime(token, row, body.extraMinutes)));

// GET /api/impact/capture — the nightly job. Vercel Cron calls it after the
// centers close and it writes each connected center's whole day, so Reports
// has the day even where nobody opened the board. Not a session route: it is
// authorized by CRON_SECRET, which Vercel sends as a bearer token, and it does
// nothing at all when that variable is unset.
router.get('/capture', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const pool = req.app.get('db');
  const { rows: conns } = await pool.query(
    `SELECT * FROM impact_connections WHERE status = 'connected'`
  );
  const results = [];
  for (const conn of conns) {
    try {
      const count = await recordScanIns(pool, conn.location_id, await readScanIns(pool, conn));
      results.push({ location: conn.location_id, recorded: count });
    } catch (err) {
      console.error(`IMPACT capture failed for location ${conn.location_id}:`, err.message);
      results.push({ location: conn.location_id, error: err.name });
    }
  }
  res.json({ results });
});

module.exports = router;
