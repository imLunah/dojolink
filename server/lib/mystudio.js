// The only place in DojoLink that talks to the studio management system.
//
// That system has no public API, no OAuth, and no service credential. Its web
// client authenticates with session cookies plus one custom header, so the only
// way in is to hold a session the way a signed-in browser holds one. Everything
// here is a GET against endpoints the vendor's own front end calls, with one
// exception noted at verifySession(). Nothing is written upstream except the
// kiosk's check-in of an already booked child (see "The check-in portal" at the
// bottom): it is the franchise system of record, attendance there counts
// against a family's membership limits, and its registration paths touch a
// payment processor.
//
// Two rules that are easy to get wrong and expensive to get wrong:
//
//   1. The participants endpoint returns `all`, `registered` and `waitlisted`.
//      `all` is every active member at the center, not a class. Only
//      `registered` answers "who is booked into this class today", and anything
//      feeding the check-in board must read that and nothing else, or it will
//      offer to check in all 73 people at the center. The single exception is
//      getCenterRoster below, where the whole center IS the question.
//
//   2. The upstream roster carries a child's check-in PIN, date of birth,
//      contact email, mobile number and parent names. None of that is needed to
//      match a ninja to a DojoLink record, so it is dropped here at the
//      boundary and never reaches a route, a response, the database or a log.

const crypto = require('crypto');

const BASE = 'https://codeninjas.mystudio.io';

// The stored cookie is a live credential for a third-party system holding
// student records, so it is encrypted at rest rather than sitting in a column
// in plaintext. 32 bytes, hex encoded.
const ENC_KEY_HEX = (process.env.MYSTUDIO_ENC_KEY || '').trim();

// The vendor's client echoes navigator.userAgent into a custom header. Sending
// a plausible desktop value keeps our requests shaped like the ones the app
// itself makes; a missing or obviously synthetic agent is the kind of thing a
// bot filter looks at.
//
// It is also part of the remembered device (see renewSignIn): MyStudio only
// honours the 30 day "remember" cookies from the same user agent that entered
// the code. Changing this string forgets every center's device, and each one
// needs a code again the next time its sign-in runs out.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Class titles map to DojoLink programs only when the match is unambiguous.
// "Academies" is one class covering both Robotics Academy and AI Academy, and
// the membership category on the participant describes what the family bought
// rather than which class they are sitting in, so it cannot break the tie.
// Anything unresolved becomes a generic check-in (program NULL), which the
// daily route already supports and where the sensei picks the class at log
// time. Guessing here would either fail the program CHECK constraint or, worse,
// file a session under the wrong program.
const PROGRAMS = [
  'CREATE',
  'Robotics Academy',
  'AI Academy',
  'JR',
  'VR Coding',
];

// Raised when the upstream session is no longer good. Callers turn this into a
// "reconnect" state rather than an error, because an expired cookie is the
// expected end of every connection's life, not a fault.
class MyStudioAuthError extends Error {
  constructor(message = 'MyStudio session is no longer valid') {
    super(message);
    this.name = 'MyStudioAuthError';
    this.expired = true;
  }
}

// Anything else: upstream 500s, a shape we did not expect, a network failure.
class MyStudioError extends Error {
  constructor(message = 'MyStudio request failed') {
    super(message);
    this.name = 'MyStudioError';
  }
}

// The sign-in form no longer works the way it did when it was read.
//
// Its own category because it has its own answer. The credential itself may be
// perfectly fine; what broke is our copy of an undocumented login flow, so the
// honest thing to tell someone is to fall back to pasting a cookie rather than
// to imply their password is wrong.
class MyStudioSignInUnavailable extends MyStudioError {
  constructor(
    message = 'MyStudio changed their sign-in page, so signing in from here is ' +
      'not working. Paste a cookie instead, and this will need updating.'
  ) {
    super(message);
    this.name = 'MyStudioSignInUnavailable';
  }
}

function isConfigured() {
  return /^[0-9a-f]{64}$/i.test(ENC_KEY_HEX);
}

function encryptionKey() {
  if (!isConfigured()) {
    throw new MyStudioError('MYSTUDIO_ENC_KEY is missing or not 64 hex characters');
  }
  return Buffer.from(ENC_KEY_HEX, 'hex');
}

// AES-256-GCM so the stored value is authenticated as well as hidden: a cookie
// that has been tampered with fails to decrypt instead of being sent upstream.
function encryptCookie(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    body.toString('base64'),
  ].join(':');
}

function decryptCookie(blob) {
  const parts = String(blob || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new MyStudioError('Stored MyStudio credential is unreadable');
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(parts[1], 'base64')
    );
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Wrong key, or the row was edited. Either way it cannot be used, and the
    // underlying error is not worth surfacing.
    throw new MyStudioError('Stored MyStudio credential is unreadable');
  }
}

// The pasted value is a document.cookie style string: "a=b; c=d".
//
// Carriage returns and newlines are stripped rather than escaped. This string is
// interpolated into an outbound HTTP header, and a newline in a header value is
// request splitting.
function sanitizeCookie(raw) {
  return String(raw || '').replace(/[\r\n]+/g, ' ').trim();
}

// Pulls the cookie out of whatever the person actually pasted.
//
// The credential lives in two httpOnly cookies, which means there is no way to
// read it from the console and no bookmarklet that can fetch it. Someone has to
// go into devtools. Asking a center director to find one header row inside a
// request is a bad instruction, and the first person to try it said so, so the
// screen now says "right click the request, Copy, Copy as cURL" instead: one
// menu everybody can find, and the cookie is in what lands on the clipboard.
//
// So this accepts three shapes and stops caring which:
//   - a cURL command, from either the -b/--cookie flag or a cookie -H header
//   - a bare cookie header, with or without a leading "cookie:" label
//   - the raw "a=b; c=d" string
//
// Being generous here is a security decision as much as a usability one. The
// alternative to accepting a pasted cURL is a person retyping a credential by
// hand, and retyping goes wrong quietly.
function extractCookie(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';

  // cURL's -b/--cookie, quoted or not.
  const flag = /(?:^|\s)(?:-b|--cookie)\s+(?:'([^']*)'|"([^"]*)"|(\S+))/.exec(text);
  if (flag) return sanitizeCookie(flag[1] ?? flag[2] ?? flag[3]);

  // A cookie passed as a header, in a cURL command or pasted on its own. Chrome
  // writes -H 'cookie: ...'; Firefox and Safari capitalise it differently, hence
  // the case-insensitive match.
  const header =
    /(?:-H|--header)\s+(?:'\s*cookie\s*:\s*([^']*)'|"\s*cookie\s*:\s*([^"]*)")/i.exec(text) ||
    /(?:^|\n)\s*cookie\s*:\s*([^\n]+)/i.exec(text);
  if (header) return sanitizeCookie(header[1] ?? header[2] ?? header[3]);

  // It was a command or a set of headers, and none of them was the cookie. Give
  // back nothing rather than falling through, because the fallback below would
  // hand the whole command over to be stored and sent as a cookie header. An
  // empty answer becomes "paste the cookie to connect", which is the truth.
  const looksLikeCommand =
    /^\s*curl\b/i.test(text) || /(?:^|\s)(?:-H|--header|-b|--cookie)\s/.test(text);
  if (looksLikeCommand) return '';

  // Nothing wrapping it: treat the paste as the cookie itself.
  return sanitizeCookie(text);
}

// The host a pasted cURL was aimed at, when it can be told.
//
// This exists to answer one specific confusion. A MyStudio page also loads the
// support chat, a payment script and analytics, so "copy any request" hands back
// somebody else's cookies and a connection that cannot work. Knowing the host
// lets the error name the mistake instead of reporting a missing companyId,
// which reads like MyStudio's fault.
function extractRequestHost(raw) {
  const text = String(raw || '');
  const m =
    /(?:--url|--location)\s+(?:'([^']+)'|"([^"]+)"|(\S+))/.exec(text) ||
    /(?:^|\s)curl\s+(?:-\S+\s+)*?(?:'(https?:\/\/[^']+)'|"(https?:\/\/[^"]+)"|(https?:\/\/\S+))/i.exec(text) ||
    /(https?:\/\/[^\s'"]+)/.exec(text);
  const url = m && (m[1] ?? m[2] ?? m[3]);
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Only the signed-in origin counts, not the whole of mystudio.io.
//
// Uploaded images come from cn.mystudio.io, which is a different host and so
// never receives the sign-in cookies. A request copied from there looks exactly
// like a MyStudio request and carries none of the credential, so accepting any
// mystudio.io host would wave through the mis-copy most likely to happen: the
// studio logo sitting at the bottom of the network list.
function isMyStudioHost(host) {
  if (!host) return false;
  try {
    return host.toLowerCase() === new URL(BASE).host.toLowerCase();
  } catch {
    return false;
  }
}

// A mystudio.io host that is not the one that answers API calls. Worth telling
// apart, because "that request went to MyStudio, not MyStudio" is not an error
// message anybody can act on.
function isMyStudioAssetHost(host) {
  return Boolean(host) && /(^|\.)mystudio\.io$/i.test(String(host)) && !isMyStudioHost(host);
}

function parseCookie(raw) {
  const out = {};
  for (const pair of extractCookie(raw).split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    if (!name) continue;
    let value = pair.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // A value that is not valid percent-encoding is used as-is.
    }
    out[name] = value;
  }
  return out;
}

// The same split as parseCookie, but the values are left exactly as they arrived.
//
// parseCookie decodes, because it exists to read identity out of a paste. This
// one exists to hand the string back to MyStudio, so a value that round trips
// through decode and encode is a value that can change on the way: an address in
// ms_u_em is stored percent-encoded and would go back out re-encoded, and any
// name we did not think about carries the same risk. Keeping the wire form
// verbatim means a jar nothing rotated serializes back byte for byte.
function parseJar(cookieString) {
  const out = {};
  for (const pair of String(cookieString || '').split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    if (name) out[name] = pair.slice(eq + 1).trim();
  }
  return out;
}

function serializeJar(jar) {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// When this credential stops working, read off the credential itself.
//
// kc_refresh is a Keycloak refresh token, and a JWT, so it states its own
// expiry. Measured across both connected centers it is issued with a lifespan
// of exactly 1440 minutes: a hard twenty four hour fuse lit at sign in, which
// nothing on our side can extend. Their backend exchanges the refresh token for
// a fresh access token on every request but never hands the new pair back, no
// page load returns a Set-Cookie, and their own client carries no refresh call,
// so the fuse is the vendor's behaviour rather than a defect in how we connect.
// "Remember for 30 days" does not change it: the Fullerton connection was made
// through the sign-in with rememberMe on and still got 1440 minutes. What that
// box does remember is the device, for signing in again without a code, which
// is how renewSignIn relights the fuse every day.
//
// Knowing the moment in advance is the whole point. It turns a director finding
// an empty board into the app asking for ten seconds before the fuse runs out.
//
// Derived rather than stored. The cookie is the only thing that actually
// decides, and a column holding a second copy would be one more thing that can
// disagree with it. Unreadable returns null, meaning unknown, never "expired":
// a token shape we cannot parse is not a reason to refuse to try a pull.
function readCookieExpiry(rawCookie) {
  let refresh;
  try {
    refresh = parseJar(extractCookie(rawCookie)).kc_refresh;
  } catch {
    return null;
  }
  if (!refresh) return null;

  const parts = String(refresh).split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    const at = new Date(payload.exp * 1000);
    return Number.isNaN(at.getTime()) ? null : at;
  } catch {
    return null;
  }
}

// Folds a response's Set-Cookie headers into a jar. Returns whether anything
// actually moved, so a pull that changed nothing does not write to the database.
//
// Deletions are deliberately ignored. A Set-Cookie clearing kc_access with
// Max-Age=0 means the session is ending, and a browser would drop the value; we
// do not, because the next request will then fail with a proper auth error and
// flip the connection to expired. Honouring the deletion would instead empty a
// stored credential in place, turning a legible "reconnect" into a paste that
// looks corrupted.
function mergeSetCookie(jar, lines) {
  let changed = false;
  for (const line of lines || []) {
    const [pair, ...attrs] = String(line || '').split(';');
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;

    const expiring =
      attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a)) || value === '';
    if (expiring) continue;

    if (jar[name] !== value) {
      jar[name] = value;
      changed = true;
    }
  }
  return changed;
}

// A cookie jar that requests can update in place.
//
// MyStudio refreshes the Keycloak tokens for us: a jar carrying only kc_refresh
// works, which means their server exchanges it and hands back a fresh kc_access
// in Set-Cookie. Until this existed we read two things off each response and
// threw the rest away, so our stored copy stayed frozen at whatever the browser
// held the day it was pasted while the real session rolled forward without us.
// That is most of why a connection died within hours instead of lasting.
//
// Holding the jar in one mutable object is what makes rotation safe under the
// request pool in getExpectedForDate: four calls share this object, and each
// folds its own response in with no await between read and write, so the last
// answer wins rather than two of them interleaving.
function createSession(rawCookie) {
  return { cookie: extractCookie(rawCookie), rotated: false };
}

function toSession(cookieOrSession) {
  if (cookieOrSession && typeof cookieOrSession === 'object' && 'cookie' in cookieOrSession) {
    return cookieOrSession;
  }
  return createSession(cookieOrSession);
}

function getSetCookie(res) {
  return typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
}

function absorbCookies(session, res) {
  const lines = getSetCookie(res);
  if (!lines.length) return;

  const jar = parseJar(session.cookie);
  if (mergeSetCookie(jar, lines)) {
    session.cookie = serializeJar(jar);
    session.rotated = true;
  }
}

// What a usable paste has to contain.
//
// `companyId` says which center to ask about. `kc_access` and `kc_refresh` are
// the actual credential: httpOnly Keycloak tokens that authorize every API call.
// Because they are httpOnly, `document.cookie` cannot see them, so a cookie
// copied out of a console will look complete and fail with no_refresh_token. The
// connect screen therefore asks for the cookie request header from the network
// tab, and this is where a paste that missed the tokens gets rejected with an
// explanation rather than a shrug.
//
// PHPSESSID and ms_u_em are read too, but they are NOT required: they belong to
// a legacy session that expires on its own schedule while the Keycloak tokens
// stay good, so treating them as mandatory would reject working cookies.
function readCookieIdentity(raw) {
  const jar = parseCookie(raw);
  const companyId = jar.companyId;
  const access = jar.kc_access;
  const refresh = jar.kc_refresh;

  // Wrong request before missing value. A MyStudio page also loads the support
  // chat, Stripe and analytics, so the likeliest reason nothing is here is that
  // the copied row belonged to one of them, and saying "missing companyId" sends
  // someone looking for a fault that is not there.
  if (!companyId || (!access && !refresh)) {
    const host = extractRequestHost(raw);
    if (isMyStudioAssetHost(host)) {
      throw new MyStudioAuthError(
        `${host} only serves images, so it never sees your sign-in. Reload ` +
          "MyStudio's home page and copy the first row, named home, instead."
      );
    }
    if (host && !isMyStudioHost(host)) {
      throw new MyStudioAuthError(
        `That request went to ${host}, not MyStudio. Reload MyStudio's home ` +
          'page with devtools open and copy the first row, named home.'
      );
    }
  }

  if (!companyId) {
    throw new MyStudioAuthError(
      'That cookie has no companyId, so it did not come from a signed-in ' +
        'MyStudio page. Sign in, then copy a mystudio.io request.'
    );
  }
  if (!access && !refresh) {
    throw new MyStudioAuthError(
      'That cookie is missing the kc_access and kc_refresh values. Use Copy ' +
        'as cURL on the home row, not the cookie from the console.'
    );
  }

  return {
    companyId,
    sessionId: jar.PHPSESSID || null,
    email: jar.ms_u_em || null,
  };
}

function buildHeaders(cookie, companyId, extra = {}) {
  return {
    accept: 'application/json',
    // Already extracted when the session was created, and re-read from the
    // session on every call so a rotation lands on the next request rather than
    // the next pull.
    cookie,
    // Only companyId is actually required. The vendor's client also sends
    // stripeAcc, userId, userEmail and isStaffRequest, all of which the read
    // endpoints ignore, and two of which we deliberately do not store.
    'X-User-Info': JSON.stringify({ companyId: String(companyId) }),
    'User-Agent-Info': USER_AGENT,
    'user-agent': USER_AGENT,
    'x-origin-url': '/attendance/class-schedule',
    ...extra,
  };
}

async function request(cookieOrSession, companyId, method, path, { params, body } = {}) {
  const session = toSession(cookieOrSession);
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers = buildHeaders(session.cookie, companyId);
  if (body) headers['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // Do not follow a bounce to the sign-in page. Following it turns an
      // expired session into a 200 with an HTML body, which reads as a shape
      // problem instead of the auth problem it is.
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new MyStudioError(
      err && err.name === 'TimeoutError' ? 'MyStudio timed out' : 'Could not reach MyStudio'
    );
  }

  // Before the throws on purpose. A refreshed token can arrive on a response we
  // are about to reject, and keeping it costs nothing.
  absorbCookies(session, res);

  if (res.status >= 300 && res.status < 400) throw new MyStudioAuthError();
  if (res.status === 401 || res.status === 403) throw new MyStudioAuthError();

  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('json')) {
    // An HTML body here is the sign-in page rendered in place.
    if (/login|sign\s*in/i.test(text.slice(0, 2000))) throw new MyStudioAuthError();
    throw new MyStudioError('MyStudio returned an unexpected response');
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new MyStudioError('MyStudio returned an unexpected response');
  }

  // Upstream error bodies can quote request data back, so the status is logged
  // and the body is not.
  if (!res.ok) throw new MyStudioError(`MyStudio responded ${res.status}`);

  return json;
}

// Best effort friendly name for the connected center.
//
// The vendor's client turns its cookies into a user record through this call, and
// the record carries the center's display name. It leans on the LEGACY session
// though, which expires independently of the Keycloak tokens: a perfectly usable
// cookie regularly gets "Expired" here while every read endpoint still answers.
// So the name is a nicety and never a verdict. Failure returns null.
async function fetchCompanyName(session, companyId, sessionId, email) {
  if (!sessionId || !email) return null;
  try {
    const data = await request(
      session,
      companyId,
      'POST',
      '/api/v1SessionLogin/v1SessionLogin',
      { body: { session_id: sessionId, email } }
    );
    if (!data || data.status !== 'Success') return null;
    const companies = Array.isArray(data.company_list) ? data.company_list : [];
    const match = companies.find((c) => String(c.company_id) === String(companyId));
    return (match && match.company_name) || null;
  } catch {
    return null;
  }
}

// Confirms a cookie can actually do the job.
//
// Deliberately verified against class-list, the endpoint the feature depends on,
// rather than against a session-exchange call that reports on a different and
// shorter-lived session. Verifying with the real capability is the only check
// that cannot pass while the feature is broken, or fail while it works.
async function verifySession(rawCookie, date) {
  const session = toSession(rawCookie);
  const { companyId, sessionId, email } = readCookieIdentity(session.cookie);
  const probeDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  const data = await request(session, companyId, 'GET', '/api/features/attendance/class-list', {
    params: { selected_date: probeDate },
  });

  // A body without a classList is not a schedule, whatever its status code.
  if (!data || !Array.isArray(data.classList)) throw new MyStudioAuthError();

  return {
    companyId: String(companyId),
    companyName: await fetchCompanyName(session, companyId, sessionId, email),
    classCount: data.classList.length,
  };
}

// ---------------------------------------------------------------------------
// Signing in
//
// Everything above holds a session somebody else established. This part
// establishes one, so that reconnecting is a form in DojoLink rather than a trip
// through devtools.
//
// Why it is worth the trouble: the pasted cookie turned out to last hours, not
// the month the feature was designed around, which makes "copy a request as
// cURL" a daily chore rather than a monthly one.
//
// Why it can never be unattended: MyStudio emails a six digit code at every
// sign-in. That is the whole point of the code, and working around it would mean
// reading the director's mailbox. So the best available shape is what this does
// — ask MyStudio to send the code, then exchange it — leaving the human with six
// digits to type instead of a network tab to navigate. After that the device is
// remembered for thirty days and renewSignIn keeps the session going without
// one, so the code is a monthly errand rather than a daily one.
//
// The sign-in is two Next.js Server Actions on the login page. They are not a
// documented API and their ids are build artifacts that change whenever MyStudio
// deploys, which is why the ids are read off the live page instead of pinned
// here, and why the cookie paste stays in the UI as the path that still works
// when this stops working.
// ---------------------------------------------------------------------------

const LOGIN_PATH = '/login?goTo=%2Fhome';

// Chrome sends this on an action POST and their edge stack expects a browser.
const ACTION_ACCEPT = 'text/x-component';

let actionIdCache = null;

// A React server action call is a POST to the page carrying the action id in a
// header, with the arguments encoded as multipart form data: field "0" is the
// argument list, in which "$K1" stands for a FormData, and that FormData's
// entries arrive as "1_<name>".
//
// Two details here are not guesses, they were measured against the live login
// page, and getting either wrong produces the same generic "Something went
// wrong" that a completely malformed request produces. That identical message is
// why this took three attempts to see: a wrong encoding and a wrong password are
// indistinguishable from the outside.
//
//   1. There are TWO arguments, not one. Both actions are wrapped in
//      useActionState, which calls them as (previousState, formData), so the
//      list is [null, "$K1"]. With one argument the request never reaches their
//      validation at all.
//
//   2. The entries must come BEFORE field 0. The body is read as a stream and
//      the reference is resolved as it is met, so a reference that arrives ahead
//      of its entries resolves to an empty FormData and every field comes back
//      "Required". Insertion order here is the wire order.
//
// With both right, the responses turn specific: "Incorrect email and / or
// password", "Incorrect 6-digit code".
function encodeActionForm(fields) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.set(`1_${name}`, String(value));
  }
  form.set('0', '[null,"$K1"]');
  return form;
}

// An action response is a flight stream: numbered lines of JSON, where line 0
// points at the line holding the return value.
//
//   0:{"a":"$@1", ...}
//   1:{"status":"error","message":"..."}
//
// The pointer is followed rather than assuming line 1, because the numbering is
// an implementation detail of how much the page streamed.
function parseFlightResult(text) {
  const lines = String(text || '').split('\n');
  const byId = new Map();
  for (const line of lines) {
    const at = line.indexOf(':');
    if (at < 1) continue;
    const id = line.slice(0, at);
    try {
      byId.set(id, JSON.parse(line.slice(at + 1)));
    } catch {
      // Rows that are not JSON are the stream's own scaffolding.
    }
  }

  const root = byId.get('0');
  const pointer = root && typeof root.a === 'string' && /^\$@(\w+)$/.exec(root.a);
  if (pointer && byId.has(pointer[1])) return byId.get(pointer[1]);

  // No pointer: the last JSON row is the best remaining guess.
  const values = [...byId.entries()].filter(([id]) => id !== '0');
  return values.length ? values[values.length - 1][1] : null;
}

// The two action ids, read out of the login page's own JavaScript.
//
// They sit in a chunk as createServerReference("<id>", …, "loginAction"), so the
// page is fetched, its scripts are collected, and they are scanned until both
// turn up. Cached for the life of the process and re-read on demand, because a
// MyStudio deploy invalidates them without warning.
async function resolveLoginActions({ force = false } = {}) {
  if (actionIdCache && !force) return actionIdCache;

  const pageUrl = new URL(LOGIN_PATH, BASE);
  let html;
  try {
    const res = await fetch(pageUrl, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
    });
    html = await res.text();
  } catch {
    throw new MyStudioError('Could not reach MyStudio');
  }

  const scripts = [...new Set(
    [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1])
  )];
  if (!scripts.length) throw new MyStudioSignInUnavailable();

  // Only otpAction is needed. loginAction is read when it happens to be in the
  // same chunk, purely so a future debugging session can see it, but nothing
  // calls it: see requestOtp for why the code request goes elsewhere.
  const found = {};
  const read = (source) => {
    for (const name of ['otpAction', 'loginAction']) {
      if (found[name]) continue;
      const hit = new RegExp(
        `createServerReference\\)?\\(\\s*"([0-9a-f]{20,})"[^)]*"${name}"\\s*\\)`
      ).exec(source);
      if (hit) found[name] = hit[1];
    }
  };

  await mapPooled(scripts, 6, async (src) => {
    if (found.otpAction) return;
    try {
      const res = await fetch(new URL(src, BASE), {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(20000),
      });
      read(await res.text());
    } catch {
      // One unreadable chunk is not fatal; the ids live in one of the others.
    }
  });

  if (!found.otpAction) throw new MyStudioSignInUnavailable();

  actionIdCache = found;
  return found;
}

// Calls one of the login actions and hands back both the payload and the
// response, because on the success path the credential is in the headers.
//
// `cookie` carries whatever the previous step was given. A browser would send it
// without being asked; these are two separate fetches, so it has to be threaded
// by hand, and the code exchange fails without it.
async function callLoginAction(actionId, fields, { cookie } = {}) {
  let res;
  try {
    res = await fetch(new URL(LOGIN_PATH, BASE), {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        accept: ACTION_ACCEPT,
        'user-agent': USER_AGENT,
        ...(cookie ? { cookie } : {}),
      },
      body: encodeActionForm(fields),
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new MyStudioError(
      err && err.name === 'TimeoutError' ? 'MyStudio timed out' : 'Could not reach MyStudio'
    );
  }

  const text = await res.text();
  // A stale action id gets the page back instead of a stream, which is the
  // signal that MyStudio has deployed since the ids were read.
  if (!/^\s*\d+:/.test(text)) throw new MyStudioSignInUnavailable();

  return { payload: parseFlightResult(text), res };
}

// The actions answer 200 for a rejected password as readily as an accepted one,
// so the verdict is inside the payload.
//
// This used to treat a payload without a `status` as a rejection, which was
// exactly backwards: a successful sign-in returns a plain message and no status
// at all. The cost of that guess was not a bad error message. Believing a
// working sign-in had failed sent the code back through the resend endpoint to
// ask what went wrong, and asking issues a NEW code, so the one already sitting
// in the person's inbox was cancelled by the act of misreading the success. Only
// call something a failure when it actually says so.
// A rejection always says so in `status`: a wrong password came back as
// {"status":"error","message":"Something went wrong. Please try again."} when
// this was tested against the live app. A success carries no status at all.
//
// Sniffing the message for failure words was tried and thrown away. It read
// "invalid" out of the address the code had just been sent to and called a
// working sign-in a failure, which is the same bug in a new place: the whole
// point here is that only an explicit failure counts as one.
//
// If a failure ever does arrive without a status, this treats it as sent and the
// code simply never turns up, which the person fixes with "Send a new code". The
// opposite mistake cancels a code they are already holding.
function actionRejected(payload) {
  if (!payload || typeof payload !== 'object') return true;
  const status = typeof payload.status === 'string' ? payload.status : '';
  return /error|fail/i.test(status);
}

// An address in a log is still an address, and these messages quote the one the
// code was sent to.
function redactEmails(text) {
  return String(text || '').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '<email>');
}

// What the upstream response looked like, in a form that is safe to keep.
//
// Only the field names, the status and a redacted message. Enough to tell a
// rejected password from a shape that changed, which is the thing that cannot be
// worked out from a 400 in a browser console.
function describePayload(payload) {
  if (!payload || typeof payload !== 'object') return `non-object (${typeof payload})`;
  const keys = Object.keys(payload).join(',');
  const status = typeof payload.status === 'string' ? payload.status : '(none)';
  const message = redactEmails(payload.message).slice(0, 200);
  return `keys=[${keys}] status=${status} message=${message}`;
}

// Asks MyStudio to email the six digit code, through the action their own form
// uses.
//
// This was briefly done through the plain resendOtp route instead, on the
// grounds that loginAction always failed. loginAction was in fact fine; the
// encoding was wrong. The distinction turned out to matter: a code from
// resendOtp arrives in the inbox and then cannot be exchanged, because the code
// exchange completes a sign-in that loginAction is what starts. Entering a
// perfectly good code returned a generic error, while a wrong one was correctly
// named, which is the tell — the code was being accepted and the step after it
// had nothing to finish.
//
// So the code request has to be this call, and whatever it is handed back has to
// travel with it. rememberMe is always on: it is the difference between a ten
// hour session and a thirty day one, and no director wants the short one.
async function startLogin({ email, password }) {
  const ids = await resolveLoginActions();
  const fields = { email, password, rememberMe: 'on' };

  let result;
  try {
    result = await callLoginAction(ids.loginAction, fields);
  } catch (err) {
    if (!(err instanceof MyStudioSignInUnavailable)) throw err;
    const fresh = await resolveLoginActions({ force: true });
    result = await callLoginAction(fresh.loginAction, fields);
  }

  if (actionRejected(result.payload)) {
    console.error('MyStudio sign-in rejected:', describePayload(result.payload));
    const message = String((result.payload && result.payload.message) || '').trim();
    throw new MyStudioAuthError(
      message || 'MyStudio did not accept that email and password.'
    );
  }

  const jar = {};
  mergeSetCookie(jar, getSetCookie(result.res));
  console.log(
    'MyStudio sign-in accepted:',
    describePayload(result.payload),
    `cookies=${Object.keys(jar).length}`
  );

  return { otpSent: true, cookie: serializeJar(jar) };
}

// Same call. A resend is a fresh start, which also renews the state the code
// exchange needs; asking the resendOtp route instead would email a code that
// cannot be completed.
async function resendOtp({ email, password }) {
  return startLogin({ email, password });
}

// Exchanges the six digit code for a session.
//
// The credential arrives as Set-Cookie on this response and nowhere else, which
// is why the response object is kept rather than just its payload.
async function completeLogin({
  email,
  password,
  otpCode,
  preferredCompanyId = null,
  cookie = '',
}) {
  const ids = await resolveLoginActions();
  const fields = { email, password, otpCode, rememberMe: 'on' };

  let result;
  try {
    result = await callLoginAction(ids.otpAction, fields, { cookie });
  } catch (err) {
    if (!(err instanceof MyStudioSignInUnavailable)) throw err;
    const fresh = await resolveLoginActions({ force: true });
    result = await callLoginAction(fresh.otpAction, fields, { cookie });
  }

  const { payload, res } = result;
  if (actionRejected(payload)) {
    console.error('MyStudio code exchange rejected:', describePayload(payload));
    throw new MyStudioAuthError(
      (payload && String(payload.message || '').trim()) ||
        'That code was not accepted. Ask for a new one and try again.'
    );
  }

  console.log(
    'MyStudio code accepted:',
    describePayload(payload),
    'setCookieCount=' +
      (typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie().length : -1)
  );

  // Everything the sign-in was given, plus whatever the exchange adds. The
  // session is assembled across both calls, not just the last one.
  const jar = parseJar(cookie);
  mergeSetCookie(jar, getSetCookie(res));

  if (!jar.kc_access && !jar.kc_refresh) {
    // The code was accepted but no session came back, which means the sign-in
    // works differently than it did when this was written.
    throw new MyStudioSignInUnavailable();
  }

  // MyStudio's own client picks the center after signing in and posts it back to
  // set the companyId cookie. We set it in our own jar instead: it is a cookie
  // the browser holds, every request re-sends it, and writing it here avoids
  // asking the vendor to change anything about the account.
  const companyId = await resolveCompanyId({ jar, payload, preferredCompanyId });
  jar.companyId = String(companyId);
  jar.keepCache = 'true';

  return {
    cookie: serializeJar(jar),
    companyId: String(companyId),
    rememberedUntil: readRememberedUntil(getSetCookie(res)),
  };
}

// The remembered device.
//
// Ticking "Remember for 30 days" on the code step makes the exchange set two
// more cookies, c_u_id_<userId> and c_u_id_<userId>_sessid, each with a
// Max-Age of exactly thirty days. Sent back with the next loginAction, they make
// it answer with a finished sign-in (`data`, the same shape the code exchange
// returns) instead of emailing a code. Measured on 25 Sep 2026: a pair stored
// from a sign-in made on Vercel still skipped the code when replayed from a
// different network, so the IP is not part of it, but the same pair sent under
// a different user agent got a code. Only the pair is needed; the rest of the
// jar made no difference.
//
// A code-free sign-in does NOT reissue the pair, so the thirty days run from
// the last time somebody typed a code, and no amount of renewing extends them.
function rememberedDevice(jar) {
  const out = {};
  for (const [name, value] of Object.entries(jar || {})) {
    if (/^c_u_id_\d+(_sessid)?$/.test(name)) out[name] = value;
  }
  return Object.keys(out).length ? out : null;
}

function forgetDevice(jar) {
  const out = {};
  for (const [name, value] of Object.entries(jar || {})) {
    if (!/^c_u_id_\d+(_sessid)?$/.test(name)) out[name] = value;
  }
  return out;
}

// When the remembered device stops working, read off the Set-Cookie attributes
// the jar itself throws away. The earliest of the pair wins.
function readRememberedUntil(lines) {
  let earliest = null;
  for (const line of lines || []) {
    const [pair, ...attrs] = String(line || '').split(';');
    const name = pair.slice(0, pair.indexOf('=')).trim();
    if (!/^c_u_id_\d+(_sessid)?$/.test(name)) continue;

    let at = null;
    for (const attr of attrs) {
      const [key, ...rest] = attr.split('=');
      const value = rest.join('=').trim();
      if (/^\s*max-age\s*$/i.test(key) && /^\d+$/.test(value)) {
        at = new Date(Date.now() + Number(value) * 1000);
        break;
      }
      if (/^\s*expires\s*$/i.test(key)) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) at = parsed;
      }
    }
    if (at && (!earliest || at < earliest)) earliest = at;
  }
  return earliest;
}

// Signs in again with no code, from the saved password and the remembered
// device, and returns a fresh day long session.
//
// Returns { needsCode: true } when MyStudio emailed a code instead, which means
// the device is no longer remembered. The caller must stop trying at that
// point: every further attempt emails the director another code.
async function renewSignIn({ email, password, cookie, preferredCompanyId = null }) {
  const jar = parseJar(cookie);
  const device = rememberedDevice(jar);
  if (!device) return { needsCode: true };

  const fields = { email, password, rememberMe: 'on' };
  const deviceCookie = serializeJar(device);

  let result;
  try {
    result = await callLoginAction((await resolveLoginActions()).loginAction, fields, {
      cookie: deviceCookie,
    });
  } catch (err) {
    if (!(err instanceof MyStudioSignInUnavailable)) throw err;
    const fresh = await resolveLoginActions({ force: true });
    result = await callLoginAction(fresh.loginAction, fields, { cookie: deviceCookie });
  }

  const { payload, res } = result;
  if (actionRejected(payload)) {
    console.error('MyStudio renewal rejected:', describePayload(payload));
    throw new MyStudioAuthError(
      String((payload && payload.message) || '').trim() ||
        'MyStudio did not accept the saved email and password.'
    );
  }
  if (!payload || !payload.data) return { needsCode: true };

  // The old jar, so the device pair and anything else it carried survive, with
  // the new session written over it.
  mergeSetCookie(jar, getSetCookie(res));
  if (!jar.kc_access && !jar.kc_refresh) throw new MyStudioSignInUnavailable();

  const companyId = await resolveCompanyId({ jar, payload, preferredCompanyId });
  jar.companyId = String(companyId);
  jar.keepCache = 'true';

  return { cookie: serializeJar(jar), companyId: String(companyId) };
}

// Which center this session is for.
//
// One MyStudio account covers one center, so this is normally a list of one.
// Preferring an already-known id matters when reconnecting: whatever the center
// was before is what the roster is matched against.
async function resolveCompanyId({ jar, payload, preferredCompanyId }) {
  const listFrom = (value) => {
    const list = value && Array.isArray(value.company_list) ? value.company_list : null;
    return list && list.length ? list : null;
  };

  let companies = listFrom(payload) || listFrom(payload && payload.data);

  if (!companies && jar.PHPSESSID && jar.ms_u_em) {
    // Right after a sign-in the legacy session is brand new, so this is the one
    // moment it can be relied on. Everywhere else in this file it cannot.
    try {
      const session = createSession(serializeJar(jar));
      const data = await request(session, '', 'POST', '/api/v1SessionLogin/v1SessionLogin', {
        body: {
          session_id: jar.PHPSESSID,
          email: decodeURIComponent(jar.ms_u_em),
        },
      });
      companies = listFrom(data);
    } catch {
      // Falls through to the preferred id.
    }
  }

  if (companies) {
    if (preferredCompanyId) {
      const match = companies.find((c) => String(c.company_id) === String(preferredCompanyId));
      if (match) return match.company_id;
    }
    return companies[0].company_id;
  }

  if (preferredCompanyId) return preferredCompanyId;

  throw new MyStudioError(
    'Signed in, but MyStudio did not say which center this account belongs to.'
  );
}

function toMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(time || '').trim());
  if (!m) return Number.MAX_SAFE_INTEGER;
  let hour = Number(m[1]) % 12;
  if (/PM/i.test(m[3])) hour += 12;
  return hour * 60 + Number(m[2]);
}

// A club is not a curriculum session.
//
// DojoLink tracks clubs as their own thing, with their own sessions and their
// own notes, so filing one as a daily check-in would put the wrong kind of
// attendance against a ninja and quietly inflate the check-in numbers. The
// booking is still worth showing — a sensei needs to know who is coming to the
// Roblox Club at five — it just is not something to accept from here.
//
// Matched on the title because that is all upstream gives us. Their classes are
// named "Roblox Club", "Minecraft Club" and so on, and a title with "club" in it
// has never meant anything else.
function isClubClass(title) {
  return /\bclubs?\b/i.test(String(title || ''));
}

function programForClass(title) {
  const raw = String(title || '').trim();
  if (!raw) return null;
  const hit = PROGRAMS.find((p) => p.toLowerCase() === raw.toLowerCase());
  return hit || null;
}

// Everything the feature needs, and nothing else. See the PII note at the top:
// the fields not copied here are the reason this function exists.
function normalizeParticipant(p, cls) {
  const first = String(p.participant_first_name || '').trim();
  const last = String(p.participant_last_name || '').trim();
  return {
    participantId: String(p.participant_id || ''),
    firstName: first,
    lastName: last,
    // Built from the parts rather than taken from participant_full_name, which
    // arrives as "First, Last" and would not match a DojoLink full_name.
    fullName: [first, last].filter(Boolean).join(' '),
    rankName: String(p.rank_name || '').trim() || null,
    // Already marked present upstream. Shown as context so staff are not asked
    // to check in a kid the vendor's own portal already has.
    checkedInUpstream: Boolean(
      String(p.checkin_status || '').trim() || p.att_checkin_datetime
    ),
    className: String(cls.class_appointment_title || '').trim(),
    startTime: String(cls.start_time || '').trim(),
    program: programForClass(cls.class_appointment_title),
    // Shown, but never offered as a check-in. See isClubClass.
    isClub: isClubClass(cls.class_appointment_title),
  };
}

async function getClassList(session, companyId, date) {
  const data = await request(session, companyId, 'GET', '/api/features/attendance/class-list', {
    params: { selected_date: date },
  });
  return Array.isArray(data && data.classList) ? data.classList : [];
}

// `registered` only. See rule 1 at the top of this file.
async function getRegisteredForClass(session, companyId, date, cls) {
  const data = await request(
    session,
    companyId,
    'GET',
    '/api/features/attendance/class-participants',
    {
      params: {
        selected_date: date,
        class_appointment_id: cls.class_appointment_id,
        class_appointment_times_id: cls.class_appointment_times_id,
        class_appointment_occurrence_id: cls.class_appointment_occurrence_id,
        drop_in_flag: 'N',
        include_active_only: '1',
      },
    }
  );
  const registered = Array.isArray(data && data.registered) ? data.registered : [];
  return registered.map((p) => normalizeParticipant(p, cls));
}

function cleanText(value) {
  return String(value ?? '').trim() || null;
}

// MyStudio sends dates in more than one shape, and a date column will take
// whatever it is given and be wrong later.
function toDateOnly(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

// Everything the roster import needs, and nothing else.
//
// This carries more than normalizeParticipant does, on purpose, and the
// difference between the two is the whole point of having two.
//
// The board matches a booking to a ninja who already exists, so it needs a name
// and nothing else, and it strips date of birth and contact details at the
// boundary. The roster import CREATES that ninja, and a DojoLink student record
// has a birthday and a parent to fill in — the same fields the CSV import has
// always carried, from the same families, for the same reason.
//
// What still never comes across: `real_pin`, which is a child's check-in code
// for somebody else's system and has no field here to land in, and the postal
// code, which has no field either. And none of this is ever returned to a
// client: it goes from the pull straight into the insert, and the preview
// describes which fields would be filled without quoting any of them.
function normalizeMember(p) {
  const first = String(p.participant_first_name || '').trim();
  const last = String(p.participant_last_name || '').trim();
  const parentName = [cleanText(p.buyer_first_name), cleanText(p.buyer_last_name)]
    .filter(Boolean)
    .join(' ');

  return {
    participantId: String(p.participant_id || ''),
    firstName: first,
    lastName: last,
    fullName: [first, last].filter(Boolean).join(' '),
    rankName: cleanText(p.rank_name),
    membershipTitle: cleanText(p.membership_title),
    categoryTitle: cleanText(p.category_title),
    birthday: toDateOnly(p.date_of_birth),
    parentName: parentName || null,
    // Named defensively: the buyer fields are the parent's where they exist, and
    // the student ones are what a child's record actually carries.
    parentEmail: cleanText(p.buyer_email) || cleanText(p.student_email),
    parentPhone: cleanText(p.buyer_mobile) || cleanText(p.student_mobile),
  };
}

// Which program a membership describes, when it describes one at all.
//
// A title naming exactly one program resolves to it; a title naming two resolves
// to neither. That is the same rule the class titles follow and it exists for the
// same reason: a membership says what a family bought, not what a child sits in,
// so guessing files a session under a program nobody is enrolled in. Anything
// unresolved becomes a ninja with no program, which a director can enrol in ten
// seconds and which cannot be wrong.
function programForMembership(...titles) {
  for (const raw of titles) {
    const text = String(raw || '').toLowerCase();
    if (!text) continue;
    const hits = PROGRAMS.filter((program) => text.includes(program.toLowerCase()));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;
  }
  return null;
}

// Every active member at this center.
//
// This is the one place allowed to read `all[]`. The standing rule against it is
// about check-in: `all` is the whole center rather than a class, so offering it
// as "who is booked in today" would propose checking in all 73 of them. For
// building a roster it is exactly the right list, and the only one there is.
// Nothing here feeds the board.
//
// `all` is center-wide rather than class-scoped, so any class on the day serves
// as the way in; the participants endpoint just needs one to be addressed to.
async function getCenterRoster(cookieOrSession, companyId, date) {
  const session = toSession(cookieOrSession);
  const classes = await getClassList(session, companyId, date);
  if (!classes.length) {
    throw new MyStudioError(
      'MyStudio has no classes scheduled on that date, so there is nothing to read the roster from.'
    );
  }

  const cls = classes[0];
  const data = await request(
    session,
    companyId,
    'GET',
    '/api/features/attendance/class-participants',
    {
      params: {
        selected_date: date,
        class_appointment_id: cls.class_appointment_id,
        class_appointment_times_id: cls.class_appointment_times_id,
        class_appointment_occurrence_id: cls.class_appointment_occurrence_id,
        drop_in_flag: 'N',
        include_active_only: '1',
      },
    }
  );

  const all = Array.isArray(data && data.all) ? data.all : [];

  // Field NAMES only, never a value. Their contact fields are named by
  // guesswork here, and this is what lets the next person tighten the mapping
  // without reading a live row full of children's details to do it.
  if (all.length) console.log('MyStudio roster fields:', Object.keys(all[0]).sort().join(','));

  const members = all.map(normalizeMember).filter((m) => m.participantId && m.fullName);

  // One row per person. The same member can appear more than once when they hold
  // more than one membership.
  const byId = new Map();
  for (const member of members) {
    if (!byId.has(member.participantId)) byId.set(member.participantId, member);
  }

  return [...byId.values()].sort(
    (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );
}

// Small pool rather than Promise.all over every class. A center runs about 17
// classes a day and we only ask about the ones with bookings, but firing all of
// them at a vendor API at once is rude and gains nothing.
async function mapPooled(items, limit, fn) {
  const out = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

// Who is booked into a class at this center on `date`.
async function getExpectedForDate(cookieOrSession, companyId, date) {
  // One session for the whole pull, so a token refreshed on the class list is
  // already in hand for the participant calls that follow it.
  const session = toSession(cookieOrSession);
  const classes = await getClassList(session, companyId, date);
  const booked = classes.filter((c) => Number(c.registration_count) > 0);

  const perClass = await mapPooled(booked, 4, (cls) =>
    getRegisteredForClass(session, companyId, date, cls)
  );

  // Every booking, including the same ninja twice.
  //
  // This used to collapse on participant id and keep the earliest class, on the
  // reasoning that one person is one check-in. True for checking in, wrong for
  // showing a day: a ninja in the four o'clock CREATE and a club afterwards had
  // the club silently deleted, and the class it belonged to vanished from the
  // list while still being counted. A director asked why a club on the schedule
  // was missing from DojoLink, and this was why.
  //
  // De-duplicating for the purpose that needs it — not posting the same
  // check-in twice — belongs where that happens, not here.
  const expected = perClass.flat().filter((row) => row.participantId).sort(
    (a, b) =>
      toMinutes(a.startTime) - toMinutes(b.startTime) ||
      // Class before name, so two classes at the same time stay in one block
      // each. The client groups by encounter order and would otherwise split a
      // class in half.
      a.className.localeCompare(b.className) ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName)
  );

  return {
    date,
    classCount: classes.length,
    bookedClassCount: booked.length,
    expected,
  };
}

// ---------------------------------------------------------------------------
// The check-in portal (the kiosk)
//
// This is the one place DojoLink writes to MyStudio. The owner chose on 22 Sep
// 2026 to let families check in at a DojoLink kiosk the way they do at
// MyStudio's own: search for their child, pick one of today's classes, and be
// checked in, booked into the class first if they had no place in it. Three
// portal actions are called, and only these three:
//
//   - checkInParticipant, for a child already booked into the class.
//   - registerParticipantAttendance, for a child who is not. This books them
//     in and counts against their membership, exactly as MyStudio's own kiosk
//     does for a walk-in. It is only offered for a class the child's membership
//     covers (see classFitsMembership), never for a club, and never for a child
//     holding more than one membership, because the portal would then have to
//     ask which one to charge.
//   - participantCancelCurrentAppointment, to take back a kiosk check-in made
//     by mistake (added 22 Sep 2026 at the owner's request). With
//     cancelRegistration it also removes the booking, and is used that way
//     ONLY when the kiosk made the booking itself; a child who was booked
//     beforehand is only checked back out, so a mis-tap never costs a family
//     a place they reserved. The route allows it only for check-ins this
//     kiosk made, and only for a short while after (routes/kiosk.js).
//
// Still never called: waivecheckformemortrial (drop-ins and trials, which
// carry a price) and registerParticipantAttendanceWithCCNumber (asks for a
// card). When
// MyStudio answers a check-in by asking for a card, the family is sent to the
// front desk.
//
// The portal is its own app at /attendance-portal with its own sign-in. That
// sign-in has no emailed code and hands back a per-center token the portal
// keeps for a hundred years, so a kiosk does not lapse the way the director
// connection does. The token rides in one cookie, ATTENDANCE_TOKEN, and needs
// nothing else: measured, the class list answers with that cookie alone and
// bounces to the portal's login page without it.
//
// The portal's member rows carry the PII listed in rule 2 at the top of this
// file, plus the child's check-in PIN, which MyStudio's own kiosk compares in
// the browser. A raw row is held only for the length of one call, because the
// portal's actions are sent the whole row back. Nothing of it leaves this file
// except what normalizeKioskMember copies.
// ---------------------------------------------------------------------------

const PORTAL_LOGIN_PATH = '/attendance-portal/login';
const PORTAL_CHECKIN_PATH = '/attendance-portal/classes/check-in';
const KIOSK_ACTIONS = ['checkInParticipant', 'registerParticipantAttendance', 'participantCancelCurrentAppointment'];

// Said to a family at the kiosk. The message is safe to put on screen.
class MyStudioCheckInRefused extends MyStudioError {
  constructor(message) {
    super(message);
    this.name = 'MyStudioCheckInRefused';
    this.refused = true;
  }
}

// The token goes into a cookie header, so it is held to the characters a token
// is made of rather than trusted to be one.
function cleanPortalToken(token) {
  const value = String(token || '').trim();
  // Base64 as it arrives: slashes, pluses and padding are all in real ones.
  if (!/^[A-Za-z0-9+/=._~-]{16,512}$/.test(value)) throw new MyStudioAuthError();
  return value;
}

function portalCookie(token) {
  return `ATTENDANCE_TOKEN=${cleanPortalToken(token)}`;
}

async function portalGet(token, path, params = {}) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const cookie = portalCookie(token);
  let res;
  try {
    res = await fetch(url, {
      headers: {
        accept: 'application/json',
        cookie,
        'user-agent': USER_AGENT,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new MyStudioError(
      err && err.name === 'TimeoutError' ? 'MyStudio timed out' : 'Could not reach MyStudio'
    );
  }

  // The portal answers a bad token with a redirect to its own login page.
  if (res.status >= 300 && res.status < 400) throw new MyStudioAuthError();
  if (res.status === 401 || res.status === 403) throw new MyStudioAuthError();
  if (!res.ok) throw new MyStudioError(`MyStudio responded ${res.status}`);

  try {
    return await res.json();
  } catch {
    throw new MyStudioError('MyStudio returned an unexpected response');
  }
}

// Action ids on the portal's pages, read the same way resolveLoginActions reads
// the main login page's, and for the same reason: they are build artifacts.
const portalActionCache = new Map();

async function portalActionIds(pagePath, names, { token = null, force = false } = {}) {
  const cacheKey = `${pagePath}|${names.join(',')}`;
  if (!force && portalActionCache.has(cacheKey)) return portalActionCache.get(cacheKey);

  let html;
  try {
    const res = await fetch(new URL(pagePath, BASE), {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html',
        ...(token ? { cookie: portalCookie(token) } : {}),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    html = await res.text();
  } catch {
    throw new MyStudioError('Could not reach MyStudio');
  }

  const scripts = [...new Set(
    [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1])
  )];
  if (!scripts.length) throw new MyStudioSignInUnavailable();

  const found = {};
  await mapPooled(scripts, 6, async (src) => {
    if (names.every((n) => found[n])) return;
    try {
      const res = await fetch(new URL(src, BASE), {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(20000),
      });
      const source = await res.text();
      for (const name of names) {
        if (found[name]) continue;
        const hit = new RegExp(
          `createServerReference\\)?\\(\\s*"([0-9a-f]{20,})"[^)]*"${name}"\\s*\\)`
        ).exec(source);
        if (hit) found[name] = hit[1];
      }
    } catch {
      // One unreadable chunk is not fatal.
    }
  });

  if (!names.every((n) => found[n])) throw new MyStudioSignInUnavailable();
  portalActionCache.set(cacheKey, found);
  return found;
}

// A Server Action called directly rather than through a form: React sends the
// argument list as JSON text, with any string that starts with "$" escaped to
// "$$" so it is not read as one of its own references.
function encodeActionArgs(args) {
  return JSON.stringify(args, (key, value) =>
    typeof value === 'string' && value.startsWith('$') ? `$${value}` : value
  );
}

// Posts one action. Returns null when the page answered with something other
// than a flight stream, which is what a stale action id gets back, and which
// also means the action did not run.
async function callPortalAction(pagePath, actionId, body, { token = null, contentType = null } = {}) {
  let res;
  try {
    res = await fetch(new URL(pagePath, BASE), {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        accept: ACTION_ACCEPT,
        'user-agent': USER_AGENT,
        ...(contentType ? { 'content-type': contentType } : {}),
        ...(token ? { cookie: portalCookie(token) } : {}),
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const timedOut = err && err.name === 'TimeoutError';
    const error = new MyStudioError(timedOut ? 'MyStudio timed out' : 'Could not reach MyStudio');
    // A timeout on a write is not a failure we can report as one: the request
    // may have landed. The caller says so instead of offering a retry.
    error.uncertain = timedOut;
    throw error;
  }

  if (res.status >= 300 && res.status < 400) throw new MyStudioAuthError();
  const text = await res.text();
  if (!/^\s*\d+:/.test(text)) return null;
  return parseFlightResult(text);
}

// Signs the portal in and returns one token per center the account can run a
// kiosk for. There is no code step: the portal hands the tokens straight back.
async function portalLogin({ email, password }) {
  const run = async (force) => {
    const ids = await portalActionIds(PORTAL_LOGIN_PATH, ['loginV2Action'], { force });
    return callPortalAction(PORTAL_LOGIN_PATH, ids.loginV2Action, encodeActionForm({ email, password }));
  };

  let payload = await run(false);
  if (payload === null) payload = await run(true);
  if (payload === null) throw new MyStudioSignInUnavailable();

  const branches = payload && payload.data && Array.isArray(payload.data.branches)
    ? payload.data.branches
    : null;

  if (!branches) {
    console.error('MyStudio portal sign-in rejected:', describePayload(payload));
    const message = String((payload && payload.message) || '').trim();
    throw new MyStudioAuthError(message || 'MyStudio did not accept that email and password.');
  }

  const out = branches
    .filter((b) => b && b.token)
    .map((b) => ({
      token: String(b.token),
      companyId: b.company_id != null ? String(b.company_id) : null,
      companyName: String(b.company_name || b.name || '').trim() || null,
    }));
  if (!out.length) throw new MyStudioAuthError('That account cannot open a check-in portal.');
  return out;
}

async function portalClassList(token, date) {
  const data = await portalGet(token, '/api/attendance/getAllClassList', { date });
  if (!data || !Array.isArray(data.class_details)) {
    throw new MyStudioError('MyStudio returned an unexpected response');
  }
  return data.class_details;
}

function portalClassKey(cls) {
  return [
    cls.class_appointment_id,
    cls.class_appointment_times_id,
    cls.class_appointment_occurrence_id,
  ].map((v) => String(v ?? '')).join(':');
}

// Drop-ins have no occurrence and are never offered: see the header above.
function isDropInClass(cls) {
  return !String(cls.class_appointment_occurrence_id || '');
}

// The rows the portal returns for one class, raw, narrowed to one child when
// `participantId` is given. Each row's class_reg_id is that child's booking in
// THIS class, which is why a check-in always reads the row through here rather
// than from the center-wide list. Stays inside this file.
async function portalParticipants(token, cls, participantId) {
  const data = await portalGet(token, '/api/attendance/getAllParticipantsBasedOnSelectedClass', {
    program_date: cls.class_appointment_date,
    class_appointment_id: cls.class_appointment_id,
    class_appointment_times_id: cls.class_appointment_times_id,
    class_appointment_occurrence_id: cls.class_appointment_occurrence_id,
    drop_in_flag: 'N',
    participant_id: participantId || undefined,
  });
  const groups = data && data.student_detail;
  if (!groups || typeof groups !== 'object') return [];
  return Object.values(groups).flat().filter(Boolean);
}

// `checkin_status` on the portal is the label of the button MyStudio would
// show: "Check in" means NOT checked in yet, "Cancel check in" means checked
// in. The label is the state wherever it is set. The timestamp is not: on a
// child's own class list (getAvailableClassDetails) every booked class carries
// one, including a class booked ahead that nobody has checked in to (measured
// 23 Sep 2026, "Check in" with a timestamp), so trusting it showed booked kids
// as checked in with nothing to tap. The timestamp only decides a row that has
// no label.
function isCheckedInRow(row) {
  const label = String(row.checkin_status || '').trim().toLowerCase();
  if (label) return label === 'cancel check in';
  return Boolean(row.att_checkin_datetime);
}

// Which classes a membership may be registered into from the kiosk.
//
// The center's memberships are "CODE NINJAS: CREATE" and "CODE NINJAS: JR".
// A CREATE membership is what Academies and Robotics Academy kids hold
// (measured: a booked Robotics Academy child is on a CREATE membership), so it
// covers every class except JR. A JR membership covers every class except
// CREATE, and clubs are open to both (the owner's rules, 22 Sep 2026).
// Anything else is a front desk conversation. The portal
// itself would register any child into any class, and this center's settings
// let it past limits and full capacity, so this is the only check between a
// mistaken tap and a wrong attendance on a family's membership.
function membershipProgram(member) {
  return programForMembership(member.categoryTitle, member.membershipTitle);
}

// A JR ninja never checks into CREATE at the kiosk, booked or not (the
// owner's rule, 22 Sep 2026). Stricter than classFitsMembership, which only
// governs booking someone in: this one also stops a booked check-in.
function classClosedToMembership(className, program) {
  return program === 'JR' && /\bcreate\b/i.test(className);
}

function classFitsMembership(className, program) {
  // "IN SCHOOL ONLY" (Fullerton) is a school's own session, not a center
  // class anyone can join: booked kids check in, nobody books in here.
  if (!program || /\bin[\s-]*school\b/i.test(className)) return false;
  if (program === 'JR') return !/\bcreate\b/i.test(className);
  if (program === 'CREATE') return !/\bjr\b/i.test(className);
  return false;
}

// What the kiosk keeps about a member: enough to search by and to ask
// MyStudio for their classes. Nothing personal beyond the name.
function normalizeKioskMember(row) {
  const first = String(row.participant_first_name || '').trim();
  const last = String(row.participant_last_name || '').trim();
  return {
    participantId: String(row.participant_id || ''),
    firstName: first,
    lastName: last,
    fullName: [first, last].filter(Boolean).join(' '),
    membershipRegistrationId: String(row.membership_registration_id || ''),
    type: String(row.type || ''),
    categoryTitle: String(row.category_title || ''),
    membershipTitle: String(row.membership_title || ''),
    moreReg: row.more_reg === 'Y',
  };
}

// Every active member at the center today. The whole center is the question
// here: a family at the kiosk may not have booked.
async function getKioskMembers(token, date) {
  const data = await portalGet(token, '/api/attendance/allParticipants', { program_date: date });
  const groups = data && data.student_detail;
  if (!groups || typeof groups !== 'object') {
    throw new MyStudioError('MyStudio returned an unexpected response');
  }
  let rows = Object.values(groups).flat();

  // A center can switch on "hide all participants list" in its portal
  // settings (Fullerton has): the whole-center list then comes back empty,
  // "Student details are not available", while each class still lists its own
  // eligible members. Build the list from today's classes instead.
  if (!rows.length && data.attendance_settings && data.attendance_settings.hide_all_participants_list) {
    const classes = (await portalClassList(token, date)).filter((c) => !isDropInClass(c));
    const perClass = await mapPooled(classes, 4, (cls) => portalParticipants(token, cls));
    rows = perClass.flat();
  }

  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || row.inactive_status === 'Y') continue;
    const m = normalizeKioskMember(row);
    if (!m.participantId || seen.has(m.participantId)) continue;
    seen.add(m.participantId);
    out.push(m);
  }
  return out;
}

// A class is on offer until it ends, and by default all day: the family picks
// the time. A center can narrow that to a window around now (Kiosk page).
function classOpen(cls, nowMinutes, windowMinutes = null) {
  if (isDropInClass(cls)) return false;
  const start = toMinutes(cls.start_time);
  const end = toMinutes(cls.end_time);
  if (start === Number.MAX_SAFE_INTEGER) return false;
  const close = end === Number.MAX_SAFE_INTEGER ? start + 60 : end;
  if (nowMinutes > close) return false;
  // A center can narrow the kiosk to classes starting near now, either side
  // (70 at 4:00 PM shows 2:50 to 5:10). Null is the whole day.
  if (windowMinutes && Math.abs(start - nowMinutes) > windowMinutes) return false;
  return true;
}

// Today's classes for one member, in the shape the kiosk shows. `booked` means
// they already have a place; `canRegister` means the kiosk may book them in.
async function getKioskClassesFor(token, member, date, nowMinutes, windowMinutes = null) {
  const regType = member.type === 'membership' ? 'M' : member.type === 'trial' ? 'T' : '';
  const data = await portalGet(token, '/api/attendance/getAvailableClassDetails', {
    participant_id: member.participantId,
    reg_id: member.membershipRegistrationId,
    reg_id_type: regType,
    selected_date: date,
  });
  const list = data && Array.isArray(data.class_details) ? data.class_details : [];
  const program = membershipProgram(member);

  return list
    .filter((cls) => classOpen(cls, nowMinutes, windowMinutes))
    .filter((cls) => !classClosedToMembership(String(cls.class_appointment_title || ''), program))
    .map((cls) => {
      const className = String(cls.class_appointment_title || '').trim();
      const booked = Boolean(cls.class_reg_id);
      return {
        classKey: portalClassKey(cls),
        className,
        startTime: String(cls.start_time || '').trim(),
        endTime: String(cls.end_time || '').trim(),
        booked,
        checkedIn: isCheckedInRow(cls),
        canRegister: !booked && !member.moreReg && classFitsMembership(className, program),
      };
    })
    .filter((c) => c.booked || c.canRegister)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.className.localeCompare(b.className));
}

// Today's classes a family can still pick, for a kiosk that starts from the
// class. Drop-ins and classes that have ended are left out.
async function getKioskSchedule(token, date, nowMinutes, windowMinutes = null) {
  const classes = await portalClassList(token, date);
  return classes
    .filter((cls) => classOpen(cls, nowMinutes, windowMinutes))
    .map((cls) => ({
      classKey: portalClassKey(cls),
      className: String(cls.class_appointment_title || '').trim(),
      startTime: String(cls.start_time || '').trim(),
      endTime: String(cls.end_time || '').trim(),
    }))
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.className.localeCompare(b.className));
}

// Who can be checked into one class: everyone booked into it, and everyone
// whose membership covers it (classFitsMembership). Booked first, then by
// name. Nothing personal beyond the name leaves this function.
async function getKioskRosterFor(token, { date, classKey, nowMinutes, windowMinutes = null }) {
  const classes = await portalClassList(token, date);
  const cls = classes.find((c) => portalClassKey(c) === classKey);
  if (!cls || !classOpen(cls, nowMinutes, windowMinutes)) return null;

  const className = String(cls.class_appointment_title || '').trim();
  const seen = new Set();
  const out = [];
  for (const row of await portalParticipants(token, cls)) {
    if (!row || row.inactive_status === 'Y') continue;
    const member = normalizeKioskMember(row);
    if (!member.participantId || seen.has(member.participantId)) continue;
    seen.add(member.participantId);
    const program = membershipProgram(member);
    if (classClosedToMembership(className, program)) continue;
    const booked = Boolean(row.class_reg_id);
    const canRegister = !booked && !member.moreReg && classFitsMembership(className, program);
    if (!booked && !canRegister) continue;
    out.push({
      participantId: member.participantId,
      firstName: member.firstName,
      lastName: member.lastName,
      booked,
      checkedIn: booked && isCheckedInRow(row),
    });
  }
  out.sort((a, b) => Number(b.booked) - Number(a.booked) || a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));
  return {
    class: {
      classKey,
      className,
      startTime: String(cls.start_time || '').trim(),
      endTime: String(cls.end_time || '').trim(),
    },
    roster: out,
  };
}

// Checks one child in, booking them into the class first when they have no
// place in it, the way MyStudio's own kiosk does. Everything is re-read from
// MyStudio rather than trusted from what the kiosk showed a moment ago.
async function kioskCheckIn(token, { date, classKey, member, nowMinutes, windowMinutes = null }) {
  const classes = await portalClassList(token, date);
  const cls = classes.find((c) => portalClassKey(c) === classKey);
  if (!cls) throw new MyStudioCheckInRefused("That class isn't on today's schedule. Please see the front desk.");
  if (!classOpen(cls, nowMinutes, windowMinutes)) {
    throw new MyStudioCheckInRefused("That class isn't open for check-in right now. Please see the front desk.");
  }

  const rows = await portalParticipants(token, cls, member.participantId);
  const row = rows.find((r) => String(r.participant_id) === String(member.participantId));
  if (!row) throw new MyStudioCheckInRefused("This ninja isn't on that class's list. Please see the front desk.");

  const className = String(cls.class_appointment_title || '').trim();
  const booked = Boolean(row.class_reg_id);
  const outcome = {
    participantId: member.participantId,
    firstName: member.firstName,
    lastName: member.lastName,
    fullName: member.fullName,
    classKey,
    className,
    startTime: String(cls.start_time || '').trim(),
    program: programForClass(className),
    isClub: isClubClass(className),
  };

  if (classClosedToMembership(className, membershipProgram(normalizeKioskMember(row)))) {
    throw new MyStudioCheckInRefused("JR ninjas can't check in to CREATE classes. Please see the front desk.");
  }

  if (booked && isCheckedInRow(row)) return { ...outcome, already: true, registered: false };

  if (!booked) {
    if (row.more_reg === 'Y') {
      throw new MyStudioCheckInRefused('This ninja has more than one membership. Please see the front desk to check in.');
    }
    if (!classFitsMembership(className, membershipProgram(normalizeKioskMember(row)))) {
      throw new MyStudioCheckInRefused("This class isn't part of this ninja's membership. Please see the front desk.");
    }
  }

  // Exactly what the portal sends: the class row with this child's booking ids
  // laid over it, and the member row as MyStudio gave it.
  const classDetails = {
    ...cls,
    class_reg_id: row.class_reg_id,
    class_registration_detail_id: row.class_registration_detail_id,
    att_attendance_status: '',
  };
  const body = encodeActionArgs([{ classDetails, membership: row }]);
  const actionName = booked ? 'checkInParticipant' : 'registerParticipantAttendance';

  const run = async (force) => {
    const ids = await portalActionIds(
      PORTAL_CHECKIN_PATH,
      KIOSK_ACTIONS,
      { token, force }
    );
    return callPortalAction(PORTAL_CHECKIN_PATH, ids[actionName], body, {
      token,
      contentType: 'text/plain;charset=UTF-8',
    });
  };

  // A null result means the action id was stale and nothing ran, so one retry
  // with fresh ids cannot act twice.
  let result = await run(false);
  if (result === null) result = await run(true);
  if (result === null) throw new MyStudioSignInUnavailable('MyStudio changed their check-in page.');

  // Field names only. The error text can name the child.
  const shape = result && typeof result === 'object' ? Object.keys(result).join(',') : typeof result;

  if (result && result.success === true) return { ...outcome, already: false, registered: !booked };

  if (result && result.action && result.action.type === 'check_cc_number') {
    // MyStudio wants the card on file confirmed. That is not a tablet question.
    console.error(`MyStudio kiosk ${actionName} wants a card: keys=[${shape}]`);
    throw new MyStudioCheckInRefused('Please see the front desk to finish checking in.');
  }

  if (result && result.error) {
    console.error(`MyStudio kiosk ${actionName} refused: keys=[${shape}]`);
    const message = typeof result.error === 'string' ? result.error : (result.error.message || '');
    throw new MyStudioCheckInRefused(
      (message && `${String(message).trim()} Please see the front desk.`) ||
        "MyStudio didn't accept this check-in. Please see the front desk."
    );
  }

  console.error(`MyStudio kiosk ${actionName} unexpected result: keys=[${shape}]`);
  throw new MyStudioCheckInRefused('Please see the front desk to finish checking in.');
}

// Takes back one kiosk check-in. `cancelRegistration` removes the booking as
// well, and the caller passes it only when the kiosk made that booking.
async function kioskUndo(token, { date, classKey, participantId, cancelRegistration }) {
  const classes = await portalClassList(token, date);
  const cls = classes.find((c) => portalClassKey(c) === classKey);
  if (!cls) throw new MyStudioCheckInRefused("That class isn't on today's schedule. Please see the front desk.");

  const rows = await portalParticipants(token, cls, participantId);
  const row = rows.find((r) => String(r.participant_id) === String(participantId));
  if (!row || !row.class_reg_id) {
    throw new MyStudioCheckInRefused("There's nothing to undo for this class. Please see the front desk.");
  }

  // What the portal's own cancel sends: the class row with this booking's ids
  // over it, the member row, and whether the booking goes too.
  const classDetails = {
    ...cls,
    class_reg_id: row.class_reg_id,
    class_registration_detail_id: row.class_registration_detail_id,
    att_attendance_status: '',
  };
  const body = encodeActionArgs([{
    classDetails,
    membership: row,
    cancelRegistration: Boolean(cancelRegistration),
    isDropIn: false,
  }]);

  const run = async (force) => {
    const ids = await portalActionIds(PORTAL_CHECKIN_PATH, KIOSK_ACTIONS, { token, force });
    return callPortalAction(PORTAL_CHECKIN_PATH, ids.participantCancelCurrentAppointment, body, {
      token,
      contentType: 'text/plain;charset=UTF-8',
    });
  };

  let result = await run(false);
  if (result === null) result = await run(true);
  if (result === null) throw new MyStudioSignInUnavailable('MyStudio changed their check-in page.');

  const shape = result && typeof result === 'object' ? Object.keys(result).join(',') : typeof result;
  if (result && result.success === true) {
    return {
      className: String(cls.class_appointment_title || '').trim(),
      startTime: String(cls.start_time || '').trim(),
    };
  }

  console.error(`MyStudio kiosk undo refused: keys=[${shape}]`);
  const message = result && result.error
    ? (typeof result.error === 'string' ? result.error : (result.error.message || ''))
    : '';
  throw new MyStudioCheckInRefused(
    (message && `${String(message).trim()} Please see the front desk.`) ||
      "MyStudio didn't accept the undo. Please see the front desk."
  );
}

module.exports = {
  MyStudioAuthError,
  MyStudioCheckInRefused,
  portalLogin,
  portalClassList,
  getKioskMembers,
  getKioskClassesFor,
  kioskCheckIn,
  kioskUndo,
  getKioskSchedule,
  getKioskRosterFor,
  kioskClassState: (row) => ({ checkedIn: isCheckedInRow(row) }),
  encodeActionArgs,
  classOpen,
  classFitsMembership,
  classClosedToMembership,
  normalizeKioskMember,
  cleanPortalToken,
  MyStudioError,
  MyStudioSignInUnavailable,
  parseFlightResult,
  encodeActionForm,
  actionRejected,
  resolveLoginActions,
  startLogin,
  completeLogin,
  renewSignIn,
  rememberedDevice,
  forgetDevice,
  readRememberedUntil,
  resendOtp,
  isConfigured,
  encryptCookie,
  decryptCookie,
  sanitizeCookie,
  extractCookie,
  extractRequestHost,
  isMyStudioHost,
  isMyStudioAssetHost,
  parseCookie,
  parseJar,
  serializeJar,
  readCookieExpiry,
  mergeSetCookie,
  createSession,
  readCookieIdentity,
  verifySession,
  fetchCompanyName,
  getClassList,
  getRegisteredForClass,
  getExpectedForDate,
  normalizeParticipant,
  normalizeMember,
  getCenterRoster,
  programForMembership,
  programForClass,
  isClubClass,
  toMinutes,
  PROGRAMS,
};
