const impact = require('./impact');
const { encryptCookie, decryptCookie, isConfigured } = require('./mystudio');

// Keeps a center's IMPACT sign-in alive with nobody present.
//
// Three layers, each used only when the one above it has run out:
//   1. The access token, good for an hour.
//   2. The refresh token, good for 24 hours and replaced by a new 24 hours on
//      every use. A board open through the week never gets past this layer.
//   3. The saved password, for the morning after nobody looked (a Sunday).
//
// A password IMPACT rejects is tried once and never again until a director
// signs in afresh: retrying it on every poll would walk the account toward a
// lockout. The connection is marked expired and the board says so.
//
// Encryption reuses the MyStudio helpers and key, so there is one key to keep
// identical between local and Vercel, not two.

const ACCESS_MARGIN_MS = 2 * 60 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;

const inflight = new Map();

function future(value, marginMs) {
  return Boolean(value && new Date(value).getTime() - Date.now() > marginMs);
}

async function saveTokens(pool, conn, tokens) {
  const { rows } = await pool.query(
    `UPDATE impact_connections
        SET access_token = $2, access_expires_at = $3,
            refresh_token = COALESCE($4, refresh_token),
            refresh_expires_at = COALESCE($5, refresh_expires_at),
            status = 'connected', last_error = NULL, last_verified_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      conn.id,
      encryptCookie(tokens.accessToken),
      tokens.accessExpiresAt,
      tokens.refreshToken ? encryptCookie(tokens.refreshToken) : null,
      tokens.refreshExpiresAt,
    ]
  );
  return rows[0] || conn;
}

async function markExpired(pool, conn, message) {
  await pool.query(
    `UPDATE impact_connections
        SET status = 'expired', last_error = $2, access_token = NULL, refresh_token = NULL
      WHERE id = $1`,
    [conn.id, String(message || '').slice(0, 300)]
  );
}

async function renew(pool, conn) {
  if (conn.refresh_token && future(conn.refresh_expires_at, REFRESH_MARGIN_MS)) {
    try {
      return await saveTokens(pool, conn, await impact.refresh(decryptCookie(conn.refresh_token)));
    } catch (err) {
      // A refused refresh token falls through to the password. Anything else
      // (IMPACT down) is not a reason to spend a password attempt.
      if (!(err instanceof impact.ImpactAuthError)) throw err;
    }
  }

  try {
    const tokens = await impact.signIn({
      email: conn.login_email,
      password: decryptCookie(conn.login_secret),
    });
    console.log(`IMPACT signed in again for location ${conn.location_id}`);
    return await saveTokens(pool, conn, tokens);
  } catch (err) {
    if (err instanceof impact.ImpactAuthError) {
      console.error(`IMPACT saved sign-in rejected for location ${conn.location_id}`);
      await markExpired(pool, conn, err.message);
    }
    throw err;
  }
}

// A usable access token for this connection, renewing it if it needs to be.
// Throws ImpactAuthError when a director has to sign in again.
async function accessTokenFor(pool, conn, { force = false } = {}) {
  if (!isConfigured()) throw new impact.ImpactError('MYSTUDIO_ENC_KEY is not set');
  if (conn.status === 'expired') {
    throw new impact.ImpactAuthError(conn.last_error || 'The IMPACT sign-in ran out');
  }
  if (!force && conn.access_token && future(conn.access_expires_at, ACCESS_MARGIN_MS)) {
    return decryptCookie(conn.access_token);
  }

  // Several boards polling at once share one renewal.
  const key = conn.location_id;
  if (!inflight.has(key)) {
    inflight.set(key, renew(pool, conn).finally(() => inflight.delete(key)));
  }
  const renewed = await inflight.get(key);
  return decryptCookie(renewed.access_token);
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

module.exports = { accessTokenFor, readScanIns };
