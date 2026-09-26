// Writes IMPACT scan-ins into impact_scan_ins, so Reports can place ninjas in
// the room by the minute they sat down rather than by an assumed hour.
//
// Names are used here to find the ninja and then dropped: what is stored is
// IMPACT's opaque account id and, when the name matched exactly one ninja on
// the center's active roster, that ninja's id. A match made once is reused on
// later days for the same IMPACT account, so a ninja renamed in DojoLink or a
// sibling added later does not undo it.
//
// Upserts on IMPACT's own scan-in id, so recording the same day twice (every
// poll and again at night) only moves removed_at and the session length along.

const CENTER_TZ = 'America/Los_Angeles';

function nameKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function programOf(value) {
  const p = String(value || '').trim();
  if (/^jr$/i.test(p)) return 'JR';
  if (/^create$/i.test(p)) return 'CREATE';
  return null;
}

function minutesOf(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 600 ? n : 60;
}

// IMPACT account -> DojoLink ninja, for a list of { user, name }. A match
// already recorded for that account wins; otherwise the full name has to match
// exactly one active ninja at the center. Unmatched accounts are left out.
async function matchStudents(pool, locationId, people) {
  if (!people.length) return new Map();
  const userIds = [...new Set(people.map((p) => p.user))];
  const [roster, known] = await Promise.all([
    pool.query(
      `SELECT s.id, s.full_name
         FROM students s
         JOIN student_locations sl ON sl.student_id = s.id
        WHERE sl.location_id = $1 AND s.active = true`,
      [locationId]
    ),
    pool.query(
      `SELECT DISTINCT ON (impact_user_id) impact_user_id, student_id
         FROM impact_scan_ins
        WHERE location_id = $1 AND impact_user_id = ANY($2::text[]) AND student_id IS NOT NULL
        ORDER BY impact_user_id, captured_at DESC`,
      [locationId, userIds]
    ),
  ]);

  const byName = new Map();
  for (const s of roster.rows) {
    const key = nameKey(s.full_name);
    byName.set(key, byName.has(key) ? null : s.id); // null marks a shared name
  }
  const byUser = new Map(known.rows.map((r) => [r.impact_user_id, r.student_id]));

  const out = new Map();
  for (const p of people) {
    const id = byUser.get(p.user) ?? byName.get(nameKey(p.name)) ?? null;
    if (id != null) out.set(p.user, id);
  }
  return out;
}

// IMPACT account -> the ninja's CREATE belt as DojoLink has it. IMPACT's own
// beltName is not kept up (it reads White for every ninja at Yorba Linda), so
// the board draws the belt senseis actually log against. An account with no
// match, or a ninja not in CREATE, gets no belt rather than IMPACT's guess.
async function dojoBelts(pool, locationId, people) {
  const match = await matchStudents(pool, locationId, people);
  if (!match.size) return new Map();
  const { rows } = await pool.query(
    `SELECT student_id, belt_level FROM student_programs
      WHERE program = 'CREATE' AND belt_level IS NOT NULL AND student_id = ANY($1::int[])`,
    [[...new Set(match.values())]]
  );
  const belt = new Map(rows.map((r) => [r.student_id, r.belt_level]));
  const out = new Map();
  for (const [user, id] of match) if (belt.has(id)) out.set(user, belt.get(id));
  return out;
}

async function recordScanIns(pool, locationId, rows) {
  // Hidden accounts are not ninjas at a desk (IMPACT's own meaning of hidden).
  const usable = rows.filter((r) => r.userGuid && !r.hideFromDashboard && !Number.isNaN(new Date(r.dateCreated).getTime()));
  if (!usable.length) return 0;

  const match = await matchStudents(
    pool,
    locationId,
    usable.map((r) => ({ user: String(r.userGuid), name: `${r.firstName || ''} ${r.lastName || ''}` }))
  );

  const cols = { id: [], user: [], student: [], program: [], started: [], minutes: [], removed: [] };
  for (const r of usable) {
    const user = String(r.userGuid);
    const matched = match.get(user) ?? null;
    cols.id.push(String(r.key));
    cols.user.push(user);
    cols.student.push(matched);
    cols.program.push(programOf(r.programTypeName));
    cols.started.push(new Date(r.dateCreated).toISOString());
    cols.minutes.push(minutesOf(r.scanInSessionLength));
    cols.removed.push(r.dateTimeRemoved ? new Date(r.dateTimeRemoved).toISOString() : null);
  }

  await pool.query(
    `INSERT INTO impact_scan_ins
       (id, location_id, impact_user_id, student_id, program, session_date,
        started_at, session_minutes, removed_at)
     SELECT u.id::bigint, $1, u.user_id, u.student_id, u.program,
            (u.started_at AT TIME ZONE '${CENTER_TZ}')::date,
            u.started_at, u.minutes, u.removed_at
       FROM unnest($2::text[], $3::text[], $4::int[], $5::text[], $6::timestamptz[], $7::int[], $8::timestamptz[])
            AS u(id, user_id, student_id, program, started_at, minutes, removed_at)
     ON CONFLICT (id) DO UPDATE SET
       student_id = COALESCE(impact_scan_ins.student_id, EXCLUDED.student_id),
       program = EXCLUDED.program,
       session_minutes = EXCLUDED.session_minutes,
       removed_at = EXCLUDED.removed_at,
       captured_at = now()`,
    [locationId, cols.id, cols.user, cols.student, cols.program, cols.started, cols.minutes, cols.removed]
  );
  return usable.length;
}

module.exports = { recordScanIns, dojoBelts };
