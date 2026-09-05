# DojoLink

DojoLink is the day-to-day operations tool for three Code Ninjas centers (Yorba Linda, Fullerton, and Cerritos). It is where staff check ninjas in, log what they worked on, run clubs, and pull the numbers a Center Director needs at the end of the week. Parents get a stripped-down portal to follow their own kid's progress.

It replaced a pile of Discord threads and spreadsheets. Each center's data stays in its own lane: staff at Fullerton never see Yorba Linda's roster unless they are an admin.

**Live:** [dojolink.app](https://www.dojolink.app)

> Independently built and maintained by a franchise staff member. Not an official Code Ninjas product and not affiliated with Code Ninjas Inc.

---

## Table of contents

- [Who uses it](#who-uses-it)
- [Feature tour](#feature-tour)
- [How a request flows](#how-a-request-flows)
- [Design system](#design-system)
- [Tech stack](#tech-stack)
- [API surface](#api-surface)
- [Data model](#data-model)
- [Security](#security)
- [Performance](#performance)
- [Programs and belts](#programs-and-belts)
- [Running it locally](#running-it-locally)
- [Tests](#tests)
- [Deployment](#deployment)
- [Project layout](#project-layout)

---

## Who uses it

Three staff roles plus a separate parent login. They stack: an admin can do everything a manager can, a manager everything a sensei can.

| Role | Scope |
|------|-------|
| **Sensei** | Front-line. Today's board, logging progress for any ninja on it, advancing belts and projects for CREATE kids, the roster, ninja profiles, clubs, the curriculum reference, and the center calendar (read-only). |
| **Center Director (manager)** | Everything a sensei does, plus the director dashboard, building the daily board, editing profiles and enrollments, CSV roster import, archiving and deleting ninjas, creating clubs, staff management, reports, announcements, sticky notes, and calendar editing. Can switch to another center for a read-only look. |
| **Admin** | Master key. Bypasses every role gate and every location gate, server and client side. Owns the Locations / Users / Curriculum / Settings panels, and can drop into a sensei's view of the app to see what they see. |
| **Parent** | Separate session and separate cookie. Email-only sign in, read-only progress for their own children, plus one editable note addressed to the instructors. |

Location scoping is a session value (`activeLocationId`). Reads are scoped to it, writes go through `requireOwnLocation`, and `admin` short-circuits both.

---

## Feature tour

### Today's board
Every center has a board of who is in today and what program they are checked into. Cards are color coded: green when everything is logged, yellow when something is pending, red when it rolled over from an earlier day. A ninja enrolled in two programs is checked in once per program, and the card shows which half is done. Incomplete assignments carry forward instead of disappearing, and a repeat check-in on the same day cannot silently re-stamp an old row. Filters and a live stat strip sit above it, with the day's club sessions in a side panel.

### Progress logging
Senseis log against a specific program, not the kid in general. CREATE ninjas carry a belt, level, project, and status; the other programs track lesson completion against the curriculum, and percent-complete is computed from completed lessons in the current module so it moves on its own. Every log snapshots the belt and project state at the time, so history stays truthful after a belt-up. Logs support a rich text note, emoji reactions, and a staff comment thread. Authors (and admins) can edit or delete their own entries.

### Ninja profiles
Enrollments, belt and project for CREATE, a pinned staff note, the note the parent wrote for instructors, full progress history filterable by program, a birthday confetti burst on the day, and a Code.org sticker picker for JR ninjas so kids recognize their own login picture. A roadmap view shows the CREATE ladder with completed levels marked, and levels can be completed or un-completed from there.

### Roster and CSV import
The roster is paginated and searchable, with program and archive filters, plus multi-select for bulk actions. Select-all covers every ninja matching the current filters, not just the loaded page.

Import takes a MyStudio CSV export and runs as **preview then confirm**: the first pass classifies everything inside a transaction and rolls back, so nothing changes until you accept it. It reports ninjas added, ninjas already enrolled, ninjas in the system but missing from the CSV (offered for archive, never a hard delete), and belt conflicts where the CSV rank differs from what is on file. Belt overrides are opt-in per row and only touch that one program.

### Clubs
Clubs are per center. Each has a profile page with a colored header band or cover photo, a markdown pinned note, a resource list (links or uploaded files) with reactions, a member count, and session threads. Logging a session records who attended, what happened, and adds attendees to the club roster. Session cards reuse the board's green / yellow / red logic, and club attendance counts as an activity session in a ninja's stats.

### Director dashboard
The landing page for directors. A greeting banner, a check-ins trend chart with Week / Month / 6 months / All time ranges, peak day and ninjas-per-week stats, a busiest-days breakdown, quick links, the center calendar, staff announcements, and a sticky notes board.

### Sticky notes
A slot-based board of draggable notes in five paper colors, with a rich text editor on the paper itself. Notes always occupy a grid slot rather than free coordinates, so they cannot overlap and the board never grows taller than its rows. Drag position lives in motion values rather than React state, and the drop target comes from grid math rather than hit-testing siblings. Order is shared for the whole center; editing and deleting are limited to the author or an admin.

### Center calendar and birthdays
A month calendar of center events (title, date, time, type, description) that every staff member can read and directors can edit. Ninja birthdays appear as chips on their day and repeat every year. Days with more than three items open a detail dialog.

### Announcements
Two separate systems. Directors post per-location staff announcements that render at the top of the app shell for their center. Admins set one global banner from Settings that everyone sees.

### Curriculum
CREATE runs on belts, levels, and named projects; the other programs run on modules and lessons. Admins edit both from the Curriculum panel. The reference page presents programs as tabs, modules as openable rows, and numbered lessons, with a per-program Resources tab. Curriculum is cached client-side because it barely changes, with an explicit invalidation hook for admin edits.

### Reports
Manager only. Total active ninjas (counted distinctly, not summed per program), enrollment per program, belt distribution across CREATE, who has gone inactive in the last 30 days (a progress log or a club attendance both count as activity), recent belt advancements, and a per-day attendance series the charts slice client-side.

### Staff management
Directors add senseis without typing a password: the server generates a 16-character CSPRNG temp password, flags the account for reset, and the modal shows the credentials once with a copy button. Staff can be archived, restored, or permanently deleted, have their login reset, and be assigned to more than one location. New accounts land on a three-step `/welcome` onboarding before they can use the app.

### Accounts and appearance
Avatar upload with a crop step, display name editing, location switching for multi-center staff, an experimental-features toggle, and a theme customizer (dark or light plus an accent color) that follows the account across devices.

### Release notes
Published releases pop once as a "What's New" card on the next sign in, with a full changelog page behind it. Release bodies are markdown and can carry images from storage.

### Feedback
One modal covers Report a Bug and Suggest a Feature, with the type as a segmented toggle. Submissions email in, rate limited to five per hour per account.

### Parent portal
Email-only sign in on its own cookie, all of a parent's children, each child's enrollments, a visual belt path drawn with belt art rather than "Green 3" text, recent session history with instructor notes stripped out, and one markdown note the parent can leave for the instructors. Parent-authored markdown never renders images, which closes an obvious pixel-tracking channel into staff screens.

---

## How a request flows

1. A visitor hits `www.dojolink.app` and gets the landing page, then the login page.
2. Staff sign in against `POST /api/auth/login`. bcrypt verifies, the session is regenerated, and `userId`, `role`, and `activeLocationId` are written to a Postgres-backed session.
3. If `must_reset_password` is set, the client routes to `/welcome` instead of a dashboard.
4. Directors land on `/manager/overview`, everyone else on `/sensei/dashboard`.
5. Every API call from the browser goes through one fetch wrapper that sends credentials and the `X-Requested-With` header the server requires on writes.
6. Express resolves the route, the middleware chain checks the role and the location, and the handler talks to Postgres through a shared `pg` pool with parameterized queries.
7. File uploads never touch storage from the browser: the client asks the server for a one-time signed upload URL, PUTs the file to it, then hands the resulting path back to the resource endpoint, which signs a read URL, saves it, and deletes the object it replaced.
8. Parents run on a completely separate session cookie and their own route tree.

---

## Design system

The UI is built on a small set of CSS custom properties, so light and dark mode and the accent color are a variable swap rather than a rewrite.

### Tokens

Colors are stored as raw RGB channels (`--ninja-blue: 0 106 221`) so Tailwind opacity modifiers (`bg-ninja-blue/10`) work. They surface as `ninja-*` classes:

| Token | Light | Dark | Used for |
|-------|-------|------|----------|
| `ninja-bg` | `#f5f7fa` | `#1c2132` | Page background |
| `ninja-border` | `#e2e8f0` | `#2c3752` | Borders, dividers |
| `ninja-blue` | `#006add` | `#38a1ff` | Brand accent, links, primary buttons |
| `ninja-navy` | `#1a2e4a` | `#d0daed` | Primary text (flips near-white in dark) |
| `ninja-muted` | `#506690` | `#8a9bb8` | Secondary text (both pass WCAG AA) |
| `ninja-red` | `#e51520` | same | Destructive and overdue |

Type is **Nunito** throughout, self-hosted as woff2 and mapped to `font-ninja`. No font CDN.

### Shared primitives

Card and panel surfaces come from one module rather than a pasted class string. Loading states are skeletons, never the word "Loading". There is exactly one `:focus-visible` rule for the whole app instead of per-component focus classes. The dialog primitive traps focus, closes on Escape, and restores focus to whatever opened it. UI glyphs are inline SVG or `lucide-react` components so `currentColor` theming keeps working; image files are reserved for art, logos, and belts.

### Dark mode

Class based (`.dark` on `<html>`), applied by an inline script before first paint so there is no flash. It is not an inversion: dark mode is a deep blue-slate palette (`#1c2132` base, `#252c3e` cards) closer to a code editor than pure black. Tailwind's stock colored badges get muted dark overrides so status pills do not glow. A transition class fires only during the toggle, so the app does not animate on every render.

One sharp edge worth knowing: the dark overrides match the exact utility class, so a nested `bg-white` goes dark no matter what it sits on, and an opacity variant like `bg-white/80` escapes the override entirely. Anything drawn on a colored surface uses inline hex or `currentColor` instead.

### Accent customizer

Eight presets plus a custom HSV picker (a saturation and brightness square with a hue slider). An accent only swaps the brand color and its hover state; it never retints backgrounds or text, which is what kept an earlier "tint everything" version from looking muddy. The choice is stored per account so it follows the user across devices, with localStorage driving the first paint. Public pages carry a `.theme-locked` class that pins the stock blue so a custom accent cannot leak onto pre-login screens.

Program identity colors do not follow the accent: JR is purple, CREATE / Robotics / AI are blue. Belt colors are semantic too. Those are product identity, not theme.

### Mobile

Mobile is its own layout, not a squished desktop. The shell is fixed to the viewport so the iOS URL bar cannot shift things mid-gesture, and the body never scrolls; only the content pane does. You swipe horizontally between tabs, with the adjacent tabs pre-mounted off-screen so they slide in together. The bottom nav is a floating frosted-glass capsule with a sliding active pill, and reference destinations sit in the top corners. The breakpoint is `lg` (1024px), which keeps iPhone landscape on the mobile layout.

Active and selected states are marked with a background tint and text color, never a colored edge bar. Animation is framer-motion, and everything respects the OS reduced-motion setting.

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite 6, React Router v6, Tailwind CSS v3, framer-motion v12 |
| Charts | Recharts |
| Icons | lucide-react, plus hand-rolled inline SVG for older shared glyphs |
| Rich text | Tiptap with a markdown serializer, loaded lazily |
| Markdown render | react-markdown with remark-gfm |
| Backend | Node.js, Express, express-session with a `connect-pg-simple` store, express-rate-limit |
| Auth | bcryptjs, server sessions in Postgres (no JWTs) |
| Database | PostgreSQL on Supabase, accessed through a direct `pg` pool (not PostgREST) |
| Storage | Supabase Storage, private buckets, server-mediated signed URLs |
| Email | nodemailer over Gmail, for bug and feature reports |
| Hosting | Vercel, SPA plus a serverless Express entry under `/api` |
| Tests | vitest and supertest against a local Postgres in Docker |

Supabase provides the database and file storage only. Auth, sessions, and every query are Express and `pg`.

---

## API surface

Everything lives under `/api`. Gates are `requireAuth`, `requireSensei`, `requireManager`, `requireAdmin`, `requireParent`, `requireAnySession`, and `requireOwnLocation`; `admin` bypasses all of them.

| Router | Covers | Typical gate |
|--------|--------|--------------|
| `auth` | Login, logout, session probe, location switching | Public login, then `requireSensei` |
| `students` | Roster, profiles, enrollments, notes, stickers, roadmap, archive and restore, CSV import, bulk archive | `requireAuth` to read, `requireManager` plus `requireOwnLocation` to write |
| `daily` | Today's board, assignment creation, reassignment, removal | Read `requireAuth`, write `requireManager` |
| `progress` | Progress logs, edits, deletes, comments, reactions | `requireSensei` plus `requireOwnLocation` |
| `clubs` | Club definitions, sessions, attendees, notes, resources, comments, reactions | Mixed sensei and manager |
| `curriculum` | Modules, lessons, belt projects, roadmap, program resources | Read `requireSensei`, edit `requireAdmin` |
| `reports` | Overview stats and the attendance series | `requireManager` |
| `users` | Staff list, creation, credentials, avatar, theme, locations, archive and delete | `requireSensei` to read, `requireManager` to write |
| `admin` | Locations, user administration, global settings | `requireAdmin` |
| `announcements` | Per-location staff announcements | Read `requireSensei`, write `requireManager` |
| `directorNotes` | Sticky notes and their shared ordering | `requireManager` |
| `events` | Center calendar events | Read `requireSensei`, write `requireManager` |
| `releases` | Published release notes and seen-state | `requireSensei` |
| `storage` | Signed upload URLs for club covers and resources | `requireSensei` or `requireManager` |
| `onboarding` | Marks the welcome flow complete | `requireSensei` |
| `parent` | Parent login, children, child detail, instructor note | `requireParent` |
| `bugs` | Bug and feature report email | `requireAnySession`, rate limited |

One Express detail that has bitten this codebase: any route declared after `router.get('/:id')` is unreachable, because Express matches the literal segment as an id. Collection-level routes such as `/students/birthdays` and `PATCH /director-notes/reorder` are declared above it on purpose.

---

## Data model

| Table | Purpose |
|-------|---------|
| `locations` | The centers, with an `active` flag for soft disable |
| `users` | Staff accounts: role, home location, theme, `must_reset_password`, `active` |
| `user_locations` | Extra locations a staff member may switch into |
| `students` | Ninja profiles with parent contact fields, pinned note, parent note, birthday, sticker, `active` for archive |
| `student_programs` | One row per enrollment: belt, level, project, status, lesson pointers, percent complete |
| `daily_assignments` | The check-in board; incomplete rows carry over to the next day |
| `progress_logs` | Session records per program with a belt and project snapshot |
| `progress_log_comments` / `progress_log_reactions` | Threads and emoji on individual logs |
| `club_definitions` | Club types per location, with color and cover image |
| `club_profiles` | Per-club pinned note and metadata |
| `club_sessions` | Logged sessions with date, notes, and status |
| `club_attendees` | Who attended each session |
| `club_members` | Standing club roster, grown from attendance |
| `club_session_comments` / `club_session_reactions` | Threads and emoji on sessions |
| `club_resources` / `club_resource_reactions` | Links and uploaded files attached to a club |
| `curriculum_modules` / `curriculum_lessons` | Module and lesson curriculum for the non-CREATE programs |
| `belt_level_projects` | Named projects per belt and level for CREATE |
| `events` | Center calendar entries |
| `announcements` | Per-location staff announcements |
| `director_notes` | Sticky notes with color and shared ordering |
| `releases` | Published release notes for the What's New feed |
| `onboarding_steps` | Welcome flow state |
| `app_settings` | Global key-value config, including the announcement banner |
| `session` | express-session store, pre-created because the pooler cannot run DDL |

`program` is a controlled value, not free text. `student_programs`, `daily_assignments`, and `progress_logs` each carry a CHECK constraint listing the valid programs, and every write path verifies the ninja is actually enrolled before storing one.

---

## Security

- **Sessions, not tokens.** `httpOnly`, `secure` in production, `sameSite: Strict`, seven day expiry, stored in Postgres. The session is regenerated on login. Parents run on a separate cookie (`parent.sid`) with a separate session and route tree.
- **CSRF.** Every state-changing request must carry `X-Requested-With: XMLHttpRequest`, which a cross-site form post cannot set.
- **Rate limiting.** Login is 10 attempts per 15 minutes per IP, all writes are 200 per 15 minutes, and bug reports are 5 per hour (that endpoint sends mail).
- **Row Level Security.** Every public table has a restrictive deny-all policy. The anon key ships in the browser bundle, so RLS is the only thing standing between it and the data; all real access goes through the Express server and its pooled connection.
- **Storage.** Both buckets are private. Nothing touches storage from the browser. Uploads use one-time signed URLs minted by the server, and the service-role key is server-side only and used for storage exclusively, never for SQL.
- **Input validation.** Parameterized queries everywhere, program values constrained at the database level, belt and level values checked against the real curriculum, and length caps on every free-text field. Usernames have a format validator and are compared case-insensitively on every path, so two accounts cannot differ only by case.
- **Passwords.** bcrypt hashes. Generated temp passwords are 16 characters of CSPRNG output over a 56-character unambiguous alphabet, and force a reset on first sign in.
- **Headers.** `vercel.json` enforces a Content Security Policy (`default-src 'self'` plus scoped exceptions and a hash for the one inline theme script), HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy, and Permissions-Policy. New external origins have to be added to the matching directive or the browser blocks them, and the inline script's hash has to be recomputed if that script changes.
- **Markdown.** Note markdown renders no images anywhere it can carry text written by a parent, and link URLs go through an allowlist.

This repository is public. Nothing restricted belongs in it: secrets live in environment variables, and anything a role gate implies is private belongs in the database behind an authenticated route.

---

## Performance

- Every authenticated route is code-split behind `React.lazy` under a single Suspense boundary. Only the landing and login pages are eager, which keeps the first paint small.
- Heavy libraries stay out of the eager graph: the rich text editor, the emoji picker, the markdown renderer, and the Supabase client all live in their own chunks.
- Nunito is self-hosted and preloaded, so first text does not swap a second late.
- Image assets are committed at display size (avatars 512px, belts 256px, program logos 384px, backgrounds 1600px) rather than shipped at source resolution.
- Curriculum is cached in a module-level store because it changes rarely, with an explicit invalidation path for admin edits.
- The roster paginates at 50 with an intersection-observer sentinel for the next page.

---

## Programs and belts

Five programs: **CREATE**, **JR**, **Robotics Academy**, **AI Academy**, and **VR Coding**. Only CREATE carries belts and projects; the rest track modules and lessons.

Silver, Gold Unity and Gold Godot were programs until session 49. They duplicated the top of the CREATE ladder, which carries Bronze, Silver, Platinum and Gold as belts with their own projects, and nobody was enrolled in any of them. The **belts** of those names are unchanged and are in the table below.

The CREATE ladder runs White to Black, then three bonus tracks:

| Belt | Levels |
|------|--------|
| White | 1 to 4 |
| Yellow | 1 to 4 |
| Orange | 1 to 5 |
| Green | 1 to 5 |
| Blue | 1 to 6 |
| Purple | 1 to 6 |
| Brown | 1 to 10 |
| Red | 1 to 2 |
| Black | 1 |
| Bronze (bonus) | 1 to 11 |
| Silver (bonus) | 1 to 17 |
| Platinum (bonus) | 1 to 4 |
| Gold (bonus) | 1 to 6 |

Each level has its own named project list drawn from the printed curriculum, prefixed Build, Solve, or Adventure. A project's status is one of Started, Working On, or Completed.

---

## Running it locally

You need Node 18 or newer, npm, and a Supabase project with the schema applied.

```bash
npm install                                # root (server deps)
npm install --prefix server                # server
npm install --include=dev --prefix client  # client; --include=dev is required, Vite is a devDep
```

Root `.env`:

```
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-west-1.pooler.supabase.com:6543/postgres
SESSION_SECRET=your-secret-here
PORT=3001
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # storage only, server-side only
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

Use the **Transaction pooler** URL (port 6543), and note the username has to include the project ref: `postgres.PROJECT_REF`. Plain `postgres` returns "Tenant or user not found".

`client/.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Apply `supabase/schema.sql`, then the migrations in `supabase/migrations/` in order through the Supabase SQL editor. Seed sample data with `npm run seed`, then:

```bash
npm run dev     # client on :5173, server on :3001
```

Useful scripts: `npm run seed` (sample data), `npm run import` (bulk roster import), `node server/db/seed_belt_projects.js` (rebuild the CREATE project table), `node server/db/seed_curriculum.js`.

---

## Tests

API tests run with vitest and supertest against a real Postgres in Docker, not a mock.

```bash
npm --prefix server run test:db:up   # postgres:17 on :55432
bash test/db/init.sh                 # load the schema into it
npm test                             # vitest run
```

Current coverage is the routes where a mistake is expensive: auth and session handling, progress log writes and their validation, the daily board's carry-over and reuse rules, and the CREATE roadmap's complete and un-complete paths. Everything else is manual for now.

---

## Deployment

Vercel plus Supabase. GitHub `main` deploys to production, `sandbox` to a preview. A push does not always trigger a fresh build right away; an empty commit forces one.

Things Vercel needs that are not obvious:

- `trust proxy 1` in Express, or the session cookie is never set behind Vercel's proxy.
- The Postgres session table has to be pre-created, because the Transaction pooler cannot run the DDL to auto-create it.
- The client install needs `--include=dev`, since Vite is a devDependency and `NODE_ENV=production` would skip it.
- File uploads return 503 until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present in the Vercel environment.
- `www` is canonical. The apex 308-redirects to it, and social scrapers often do not follow redirects, so the Open Graph tags point at `www`.

Required environment variables: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and the `VITE_SUPABASE_*` pair, which is baked into the client bundle at build time.

---

## Project layout

```
├── api/index.js                    # Vercel serverless entry (wraps server/index.js)
├── client/                         # React + Vite SPA
│   └── src/
│       ├── api/client.js           # fetch wrapper (credentials + CSRF header)
│       ├── components/
│       │   ├── layout/             # Layout, Sidebar, MobileNav, ParentLayout, route guards
│       │   ├── manager/            # TodayBoard, sticky notes, announcements, calendar, modals
│       │   ├── sensei/             # log entry form, belt progress fields
│       │   ├── parent/             # parent progress visuals
│       │   ├── shared/             # markdown editor and view, pinned note, progress history,
│       │   │                       #   club board and panels, release content, what's new
│       │   ├── theme/              # accent customizer (color map, palette, mode toggle)
│       │   └── ui/                 # Button, Card, Modal, Skeleton, badges, chart, icons
│       ├── context/                # Auth, ParentAuth, Curriculum, Theme
│       ├── lib/                    # supabase storage client, navTabs, accents, surfaces, features
│       ├── utils/                  # beltConfig, stickers, date helpers
│       └── pages/                  # admin/, manager/, sensei/, parent/, clubs, legal, account
├── server/
│   ├── db/                         # pool, schema, seeds, bulk import
│   ├── lib/                        # storage (service role), belts, reactions, temp password, username
│   ├── middleware/auth.js          # requireAuth / Sensei / Manager / Admin / Parent / OwnLocation
│   ├── resources/                  # static curriculum reference data served behind a staff gate
│   ├── routes/                     # one router per resource (see API surface)
│   ├── tests/                      # vitest + supertest suites
│   └── index.js                    # Express entry, CSRF gate, rate limits, sessions, error handler
├── supabase/
│   ├── schema.sql
│   └── migrations/                 # 001 to 013, applied in order
├── test/db/                        # docker Postgres bootstrap for the test suite
└── vercel.json                     # rewrites + security headers
```
