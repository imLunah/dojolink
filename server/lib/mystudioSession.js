const ms = require('./mystudio');

// Keeps a center's MyStudio sign-in alive without a code.
//
// The session MyStudio hands out dies twenty four hours after it is made, and
// nothing extends it. What does last is the remembered device: for thirty days
// after a director types a code, the saved password alone signs in again. So
// every caller that is about to use a connection passes it through here first,
// and a session that is dead or into its last hours is replaced by a fresh one.
//
// Three rules keep this from emailing directors codes nobody asked for:
//   - It only tries while `remembered_until` is in the future.
//   - A renewal MyStudio answers with a code, or a saved password it rejects,
//     forgets the device (drops the pair from the jar, clears remembered_until),
//     so the next request does not try again. Only a sign-in with a code puts
//     it back.
//   - A failure that says nothing about the credential (network, a changed
//     login page) waits ten minutes on this instance before trying again.

// The same six hours the board warns at, so a remembered center never shows
// the warning at all.
const RENEW_AHEAD_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

const failedAt = new Map();
const inflight = new Map();

// Whether this connection can renew itself without anybody present.
function canRenew(conn) {
  return Boolean(
    conn &&
      conn.session_cookie &&
      conn.login_email &&
      conn.login_secret &&
      conn.remembered_until &&
      new Date(conn.remembered_until) > new Date()
  );
}

function sessionExpiry(conn) {
  try {
    return ms.readCookieExpiry(ms.decryptCookie(conn.session_cookie));
  } catch {
    return null;
  }
}

function needsRenewal(conn) {
  if (conn.status === 'expired') return true;
  const expiresAt = sessionExpiry(conn);
  // An unreadable expiry is not evidence of one.
  return Boolean(expiresAt && expiresAt - Date.now() <= RENEW_AHEAD_MS);
}

async function forget(pool, conn) {
  let jar = {};
  try {
    jar = ms.forgetDevice(ms.parseJar(ms.decryptCookie(conn.session_cookie)));
  } catch {
    // Nothing readable to strip; clearing the date is enough to stop retries.
  }
  const cookie = ms.encryptCookie(ms.serializeJar(jar));
  await pool.query(
    `UPDATE mystudio_connections SET session_cookie = $2, remembered_until = NULL WHERE id = $1`,
    [conn.id, cookie]
  );
  return { ...conn, session_cookie: cookie, remembered_until: null };
}

async function renew(pool, conn) {
  let renewed;
  try {
    renewed = await ms.renewSignIn({
      email: conn.login_email,
      password: ms.decryptCookie(conn.login_secret),
      cookie: ms.decryptCookie(conn.session_cookie),
      preferredCompanyId: conn.company_id,
    });
  } catch (err) {
    if (err instanceof ms.MyStudioAuthError) {
      // The saved password no longer works. Trying it again every request would
      // walk the account toward a lockout.
      console.error('MyStudio renewal: saved sign-in rejected, device forgotten');
      return forget(pool, conn);
    }
    // Never the body: the request carried a password.
    console.error('MyStudio renewal failed:', err.message);
    failedAt.set(conn.location_id, Date.now());
    return conn;
  }

  if (renewed.needsCode) {
    console.log(`MyStudio renewal for location ${conn.location_id} needs a code; device forgotten`);
    return forget(pool, conn);
  }

  const cookie = ms.encryptCookie(renewed.cookie);
  await pool.query(
    `UPDATE mystudio_connections
        SET session_cookie = $2, status = 'connected', last_verified_at = now()
      WHERE id = $1`,
    [conn.id, cookie]
  );
  failedAt.delete(conn.location_id);
  console.log(`MyStudio renewed for location ${conn.location_id} without a code`);
  return { ...conn, session_cookie: cookie, status: 'connected' };
}

// Returns the connection, renewed if it needed to be and could be. Never
// throws: a connection that cannot renew is returned as it was, and whatever
// the caller already does with an expired one still happens.
async function keepSignedIn(pool, conn) {
  if (!conn || !ms.isConfigured() || !canRenew(conn) || !needsRenewal(conn)) return conn;
  if (Date.now() - (failedAt.get(conn.location_id) || 0) < RETRY_MS) return conn;

  // Two requests arriving together share one sign-in instead of making two.
  const key = conn.location_id;
  if (!inflight.has(key)) {
    inflight.set(
      key,
      renew(pool, conn)
        .catch((err) => {
          console.error('MyStudio renewal error:', err.message);
          return conn;
        })
        .finally(() => inflight.delete(key))
    );
  }
  const result = await inflight.get(key);
  // A shared result carries the other caller's row; keep this caller's fields.
  return { ...conn, ...pick(result) };
}

function pick(row) {
  return {
    session_cookie: row.session_cookie,
    status: row.status,
    remembered_until: row.remembered_until,
  };
}

module.exports = { keepSignedIn, canRenew };
