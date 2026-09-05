const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db/pool');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable must be set in production');
}
// No committed secret literal. Production already fails closed above; in dev,
// mint an ephemeral per-process secret so there is nothing hardcoded to leak.
const SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');

app.set('db', pool);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CSRF mitigation: require custom header on all state-changing requests
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use((req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return next();
  return res.status(403).json({ error: 'Forbidden' });
});

// Rate limiting on login endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Flood protection on all state-changing requests (POST/PATCH/PUT/DELETE).
// Reads (dashboards poll) are never throttled. 200/15min per IP is generous
// for a real staff burst (CSV import + belt-apply fire several writes) while
// capping an abusive replay loop like the session-26 ZAP scan.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || SAFE_METHODS.has(req.method),
  message: { error: 'Too many requests. Slow down and try again shortly.' },
});
app.use('/api', writeLimiter);

// Strict cap on bug/feature reports — the POST sends a Gmail message, so an
// authenticated user could otherwise flood the inbox / burn the Gmail quota.
const bugLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many reports submitted. Please wait a bit before sending another.' },
});

// The MyStudio routes are the only GETs in the app worth throttling: a single
// /today fans out to one third-party request per booked class, so a polling
// client or a stuck retry loop would hammer a vendor API rather than our own
// database. writeLimiter deliberately skips reads, hence a separate cap here.
const mystudioLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many MyStudio requests. Wait a moment and try again.' },
});

// Signing into MyStudio is throttled harder than reading from it, but the two
// halves of it are not the same risk and were wrong to share one cap.
//
// Asking for a code is the expensive half: it carries a password to a third
// party's auth system and it emails a real person. That stays tight.
//
// Entering a code is cheap, and a single sign-in legitimately takes several
// goes: a mistyped digit, a code that timed out while its owner walked to their
// inbox, a fresh code after that. One shared cap of eight locked out the first
// real sign-in this app ever attempted, which is a worse outcome than the one
// the cap exists to prevent. MyStudio validates the code itself and expires it,
// so this is not the only thing standing between a guesser and an account.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many code requests. Try again in 15 minutes.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many code attempts. Try again in 15 minutes.' },
});

// req.path is relative to the mount point.
const mystudioLoginLimiter = (req, res, next) => {
  const asksForACode = req.path === '/start' || req.path === '/resend';
  return asksForACode ? otpRequestLimiter(req, res, next) : otpVerifyLimiter(req, res, next);
};

const sessionConfig = {
  store: new pgSession({ pool, tableName: 'session' }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

// Staff session (connect.sid) — skipped for /api/parent and /api/bugs (both get special session handling)
const staffSession = session(sessionConfig);
app.use((req, res, next) => {
  if (req.path.startsWith('/api/parent') || req.path.startsWith('/api/bugs')) return next();
  staffSession(req, res, next);
});

// Parent portal uses its own cookie (parent.sid) — completely isolated from staff
const parentSession = session({ ...sessionConfig, name: 'parent.sid' });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/parent', parentSession, require('./routes/parent'));
app.use('/api/students', require('./routes/students'));
app.use('/api/daily', require('./routes/daily'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/director-tasks', require('./routes/directorTasks'));
app.use('/api/events', require('./routes/events'));
app.use('/api/event-listings', require('./routes/eventListings'));
app.use('/api/releases', require('./routes/releases'));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/mystudio/login', mystudioLoginLimiter);
app.use('/api/mystudio', mystudioLimiter, require('./routes/mystudio'));
// Bug reports — staff or parent session accepted; try staff first, fall back to parent
app.use('/api/bugs',
  (req, res, next) => staffSession(req, res, () => {
    if (req.session?.userId) return next();
    parentSession(req, res, next);
  }),
  bugLimiter,
  require('./routes/bugs')
);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Global error handler — catches next(err) and unhandled throws in sync middleware
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Code Ninjas server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
