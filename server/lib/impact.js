const crypto = require('crypto');

// IMPACT is Code Ninjas' own platform: the sensei app at sensei.codeninjas.com
// and the dojo computers the ninjas log into. When a ninja logs in there it is
// recorded as a "scan-in" with a session length, and the sensei app's Live
// Ninjas board is a countdown drawn from those scan-ins.
//
// This is the only file that talks to IMPACT. It is READ-ONLY: the sensei app
// can also remove a ninja from the board (addorremoveninja) and extend a
// session (extendCheckinTime), and neither is called from here.
//
// There is no public API. What follows was read off the live sensei app on
// 25 Sep 2026 and can change without notice:
//
//   Sign-in is Azure AD B2C, policy B2C_1_SignIn, as the sensei app's own
//   public client. Email and password, no emailed code. The steps are the ones
//   the hosted login page performs itself: load the authorize page for its csrf
//   token and transaction id, POST the credentials to SelfAsserted, then GET
//   `confirmed`, which redirects to the app with an authorization code in the
//   fragment. The code is redeemed with PKCE for tokens.
//
//   The access token lasts an hour. Every refresh returns a new refresh token
//   good for another 24 hours, and the old one keeps working until its own
//   expiry. So a center that is looked at at least once a day never signs in
//   again, and one that is not (a weekend) signs in with the saved password.
//
//   GET api/personnel lists the account's centers ("facilities"), and
//   GET cncommon/api/v1/center/ninjasindojo/{facilityGuid}/{utcOffsetMinutes}
//   is the board. The offset is JavaScript's getTimezoneOffset(), positive
//   west of UTC (420 in Pacific daylight time).

const TENANT = 'codeninjasusb2c.onmicrosoft.com';
const POLICY = 'B2C_1_SignIn';
const B2C = `https://codeninjasusb2c.b2clogin.com/${TENANT}`;
const CLIENT_ID = '46e8cec8-a25b-4b50-9053-469e906a364e';
const REDIRECT_URI = 'https://sensei.codeninjas.com';
const SCOPE = `https://${TENANT}/82346e2e-022a-43b5-9205-f8808023cf40/Api.Access.Full openid profile offline_access`;
const API = 'https://api.impact.codeninjas.com';
const TIMEOUT_MS = 15000;

// The credential was refused: wrong email or password, or a refresh token the
// server no longer honours. The person has to act.
class ImpactAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImpactAuthError';
  }
}

// Anything else: IMPACT unreachable, or its login page no longer shaped the way
// this file expects. Not the person's fault and not fixed by retyping.
class ImpactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImpactError';
  }
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Cookies for the B2C host only, carried between the three steps of one
// sign-in the way a browser would.
function absorb(jar, res) {
  const lines = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of lines) {
    const pair = line.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function timedFetch(url, init = {}) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ImpactError(`Could not reach IMPACT (${err.name === 'TimeoutError' ? 'timed out' : err.message})`);
  }
}

// The token endpoint answers both grants the same way.
async function tokenRequest(fields) {
  const res = await timedFetch(`${B2C}/${POLICY.toLowerCase()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // The client is registered as a single page app. Refresh measured fine
      // without this; code redemption for an SPA client is the case Azure is
      // strict about, and a browser always sends it.
      Origin: REDIRECT_URI,
    },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE, ...fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const desc = String(data.error_description || '').split('\n')[0].slice(0, 200);
    // invalid_grant is B2C's answer to a refresh token that has expired or
    // been revoked. Signing in again is the remedy, so it is an auth error.
    if (data.error === 'invalid_grant') throw new ImpactAuthError(desc || 'IMPACT sign-in expired');
    throw new ImpactError(`IMPACT token request failed (${res.status}${data.error ? ` ${data.error}` : ''})`);
  }
  return shapeTokens(data);
}

function shapeTokens(data) {
  const now = Date.now();
  const accessSeconds = Number(data.expires_in) || 3600;
  const refreshSeconds = Number(data.refresh_token_expires_in) || 24 * 60 * 60;
  return {
    accessToken: data.access_token,
    accessExpiresAt: new Date(now + accessSeconds * 1000),
    refreshToken: data.refresh_token || null,
    refreshExpiresAt: data.refresh_token ? new Date(now + refreshSeconds * 1000) : null,
  };
}

// The hosted page puts everything its script needs in `var SETTINGS = {...}`.
function readSettings(html) {
  const csrf = /"csrf":"([^"]+)"/.exec(html);
  const transId = /"transId":"([^"]+)"/.exec(html);
  if (!csrf || !transId) return null;
  return { csrf: csrf[1], transId: transId[1] };
}

// B2C error codes that mean the request itself was not understood. Anything
// else from SelfAsserted is a verdict on the email or password.
const MALFORMED = new Set(['AADB2C90278']);

async function signIn({ email, password }) {
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail || !password) throw new ImpactAuthError('Enter the email and password you use for IMPACT.');

  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const jar = {};

  const authorize = new URL(`${B2C}/${POLICY.toLowerCase()}/oauth2/v2.0/authorize`);
  authorize.search = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    response_mode: 'fragment',
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    nonce: crypto.randomUUID(),
    state: crypto.randomUUID(),
    prompt: 'login',
  }).toString();

  const page = await timedFetch(authorize, { redirect: 'manual' });
  absorb(jar, page);
  const settings = readSettings(await page.text());
  if (!settings) throw new ImpactError('The IMPACT sign-in page has changed');

  const qs = `tx=${encodeURIComponent(settings.transId)}&p=${POLICY}`;
  const posted = await timedFetch(`${B2C}/${POLICY}/SelfAsserted?${qs}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-CSRF-TOKEN': settings.csrf,
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({ request_type: 'RESPONSE', email: cleanEmail, password }),
  });
  absorb(jar, posted);
  const verdict = await posted.json().catch(() => null);
  if (!verdict) throw new ImpactError('The IMPACT sign-in page has changed');
  if (String(verdict.status) !== '200') {
    if (MALFORMED.has(verdict.errorCode)) throw new ImpactError('The IMPACT sign-in page has changed');
    // B2C's own wording ("Your password is incorrect", "We can't seem to find
    // your account") is written for the person at the keyboard.
    throw new ImpactAuthError(String(verdict.message || 'IMPACT did not accept that email and password.'));
  }

  const confirmed = await timedFetch(
    `${B2C}/${POLICY}/api/CombinedSigninAndSignup/confirmed?rememberMe=false&csrf_token=${encodeURIComponent(
      settings.csrf
    )}&${qs}`,
    { redirect: 'manual', headers: { Cookie: cookieHeader(jar) } }
  );
  const location = confirmed.headers.get('location') || '';
  const params = new URLSearchParams(location.split('#')[1] || location.split('?')[1] || '');
  const code = params.get('code');
  if (!code) {
    // A page instead of a redirect: a forced password change, terms to accept.
    // Something the person has to do on IMPACT itself.
    if (params.get('error')) {
      throw new ImpactAuthError(String(params.get('error_description') || 'IMPACT refused the sign-in').split('\n')[0]);
    }
    throw new ImpactAuthError('IMPACT wants something done before it signs in. Sign in at sensei.codeninjas.com once, then try again.');
  }

  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
  });
}

function refresh(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

async function apiGet(accessToken, path) {
  const res = await timedFetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) throw new ImpactAuthError('IMPACT refused the stored sign-in');
  if (!res.ok) throw new ImpactError(`IMPACT answered ${res.status}`);
  return res.json();
}

// The account's centers. Personal details on the same record are not kept.
async function getFacilities(accessToken) {
  const me = await apiGet(accessToken, 'api/personnel');
  return (Array.isArray(me && me.facilities) ? me.facilities : [])
    .filter((f) => f && f.facilityId)
    .map((f) => ({
      guid: String(f.facilityId),
      name: String(f.facilityName || '').trim(),
      slug: String(f.slug || '').trim(),
    }));
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/^code ninjas\s*/, '').replace(/[^a-z0-9]/g, '');
}

// Which of the account's centers is this DojoLink location, matched on name
// then on the slug ("cn-ca-yorba-linda"). Even an account with one center has
// to match: a Fullerton director signing in with a Yorba Linda account would
// otherwise put Yorba Linda's ninjas on Fullerton's board.
function pickFacility(facilities, locationName) {
  const want = normalizeName(locationName);
  if (!want) return null;
  const hits = facilities.filter(
    (f) => normalizeName(f.name).includes(want) || normalizeName(f.slug).endsWith(want)
  );
  return hits.length === 1 ? hits[0] : null;
}

// Minutes west of UTC for the centers' own clock, the value a browser in
// California would put in the URL. Worked out rather than fixed so the path is
// right across daylight saving.
function pacificOffsetMinutes(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((Math.floor(at.getTime() / 1000) * 1000 - asUtc) / 60000);
}

function toMinutes(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

// One scan-in, cut down at the boundary. The upstream row carries the ninja's
// IMPACT username, account guid and full surname; none of it is needed to draw
// the board and none of it leaves this file. The board shows a first name and
// an initial, as IMPACT's own does.
function normalizeScanIn(row) {
  const first = String(row.firstName || '').trim();
  const last = String(row.lastName || '').trim();
  const program = String(row.programTypeName || '').trim();
  return {
    id: String(row.key),
    firstName: first,
    lastInitial: last ? last[0].toUpperCase() : '',
    program: /^jr$/i.test(program) ? 'JR' : /^create$/i.test(program) ? 'CREATE' : program || null,
    belt: String(row.beltName || '').trim() || null,
    startedAt: row.dateCreated || null,
    sessionMinutes: toMinutes(row.scanInSessionLength, 60),
    weekMinutes: toMinutes(row.totalMinutes, 0),
  };
}

// Today's scan-ins at a center, as IMPACT has them: everyone who logged in
// today, removed or not. Rows a sensei hid from IMPACT's dashboard are left
// out everywhere, since hiding is how IMPACT marks a scan-in as not a ninja.
// Raw rows: they carry names and must not leave the server as they are.
async function getScanIns(accessToken, facilityGuid) {
  const data = await apiGet(
    accessToken,
    `cncommon/api/v1/center/ninjasindojo/${encodeURIComponent(facilityGuid)}/${pacificOffsetMinutes()}`
  );
  const rows = Array.isArray(data && data.scanIns) ? data.scanIns : [];
  return rows.filter((r) => r && r.key != null && r.dateCreated && !r.hideFromDashboard);
}

// Who is in the dojo now: nobody has removed them yet. Oldest first.
function liveNinjas(rows) {
  return rows
    .filter((r) => !r.dateTimeRemoved)
    .map(normalizeScanIn)
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

async function getNinjasInDojo(accessToken, facilityGuid) {
  return liveNinjas(await getScanIns(accessToken, facilityGuid));
}

module.exports = {
  ImpactAuthError,
  ImpactError,
  signIn,
  refresh,
  getFacilities,
  pickFacility,
  getNinjasInDojo,
  getScanIns,
  liveNinjas,
  normalizeScanIn,
  pacificOffsetMinutes,
  readSettings,
};
