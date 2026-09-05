const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { requireAdmin, requireManager } = require('../middleware/auth');
const { generateTempPassword } = require('../lib/tempPassword');
const { validateUsername } = require('../lib/username');

const SALT_ROUNDS = 10;

// Directors reach this file now, scoped to their own centers.
//
// Everything here used to be requireAdmin, which meant a director could not add
// a sensei or fix their own center's name without one. What opens up is bounded
// three ways, and every route below states which of them it relies on:
//
//   1. A director only ever sees or touches centers they belong to. Creating and
//      deleting a center stay with an admin: creating one makes a place nobody
//      is responsible for, and deleting one cascades through students, staff,
//      clubs and logs.
//   2. Admin accounts are invisible and untouchable. The role that bypasses
//      every location gate cannot be edited, reset, archived or created by
//      somebody it outranks, and no director can mint one.
//   3. A director cannot demote or remove themselves, so a center cannot end up
//      with nobody who can administer it by one wrong press.
//
// Curriculum and app settings are GLOBAL and deliberately still reachable. A
// director editing either changes it for every center, which the screens say
// out loud, because the alternative was that only an admin could fix a typo in
// a lesson name.
function isAdmin(req) {
  return req.session.role === 'admin';
}

// The centers this person may act on. Admins are unrestricted.
function allowedLocationIds(req) {
  if (isAdmin(req)) return null;
  const ids = req.session.locationIds && req.session.locationIds.length
    ? req.session.locationIds
    : [req.session.homeLocationId];
  return ids.filter((id) => Number.isInteger(id));
}

function mayTouchLocation(req, locationId) {
  const allowed = allowedLocationIds(req);
  return allowed === null || allowed.includes(Number(locationId));
}

// A director may only act on staff who share one of their centers, and never on
// an admin. Returns the target row, or null if they may not see it at all.
async function loadStaffTarget(req, pool, id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.role, u.active, u.location_id,
            COALESCE(ARRAY_AGG(ul.location_id) FILTER (WHERE ul.location_id IS NOT NULL), '{}') AS location_ids
       FROM users u
       LEFT JOIN user_locations ul ON ul.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id`,
    [id]
  );
  const target = rows[0];
  if (!target) return null;
  if (target.role === 'admin') return null;
  if (isAdmin(req)) return target;

  const allowed = allowedLocationIds(req);
  const shares = [target.location_id, ...(target.location_ids || [])]
    .filter((v) => v != null)
    .some((locId) => allowed.includes(Number(locId)));
  return shares ? target : null;
}

// GET /api/admin/locations
router.get('/locations', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const allowed = allowedLocationIds(req);
  try {
    const { rows } = await pool.query(`
      SELECT l.id, l.name, l.slug, l.active, l.created_at, l.center_code, l.address,
             COUNT(DISTINCT s.id) FILTER (WHERE s.active = true)::int AS student_count,
             COUNT(DISTINCT u.id) FILTER (WHERE u.active = true AND u.role IN ('manager','sensei'))::int AS staff_count
      FROM locations l
      LEFT JOIN student_locations sl ON sl.location_id = l.id
      LEFT JOIN students s ON s.id = sl.student_id
      LEFT JOIN user_locations ul ON ul.location_id = l.id
      LEFT JOIN users u ON u.id = ul.user_id
      ${allowed ? 'WHERE l.id = ANY($1)' : ''}
      GROUP BY l.id
      ORDER BY l.created_at ASC
    `, allowed ? [allowed] : []);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// ── Shared ninjas ─────────────────────────────────────────────────────────────
//
// A ninja can belong to more than one center (migration 027). These three
// routes let a director bring a ninja from another center onto their own
// roster and take them off again. Rule 1 above applies throughout: the target
// center must be one the director belongs to. The ninja's HOME center is never
// changed here; sharing is additive, and only the home center can archive them.
//
// The search deliberately shows only a name, an age and the home center. It is
// enough to pick the right child, and a director looking across centers does
// not need a parent's email or phone to do it.

const SHARED_SELECT = `
  SELECT s.id, s.full_name, s.birthday, s.location_id AS home_location_id,
         hl.name AS home_location_name,
         COALESCE(
           (SELECT json_agg(sp.program ORDER BY sp.program) FROM student_programs sp WHERE sp.student_id = s.id),
           '[]'::json
         ) AS programs
    FROM students s
    JOIN locations hl ON hl.id = s.location_id`;

// GET /api/admin/locations/:id/students/search?q=  — ninjas at OTHER centers
router.get('/locations/:id/students/search', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = Number(req.params.id);
  if (!mayTouchLocation(req, locationId)) return res.status(403).json({ error: 'Not your center' });

  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  try {
    const { rows } = await pool.query(
      `${SHARED_SELECT}
        WHERE s.active = true
          AND s.full_name ILIKE $1
          AND NOT EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = $2)
        ORDER BY s.full_name
        LIMIT 20`,
      [`%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`, locationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error searching students to share:', err);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /api/admin/locations/:id/students/shared — members whose home is elsewhere
router.get('/locations/:id/students/shared', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = Number(req.params.id);
  if (!mayTouchLocation(req, locationId)) return res.status(403).json({ error: 'Not your center' });

  try {
    const { rows } = await pool.query(
      `${SHARED_SELECT.replace('FROM students s', 'FROM student_locations sl JOIN students s ON s.id = sl.student_id')}
        WHERE sl.location_id = $1 AND s.location_id <> $1 AND s.active = true
        ORDER BY s.full_name`,
      [locationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error listing shared students:', err);
    res.status(500).json({ error: 'Failed to load shared ninjas' });
  }
});

// POST /api/admin/locations/:id/students  { studentId } — share a ninja into this center
router.post('/locations/:id/students', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = Number(req.params.id);
  const studentId = Number(req.body?.studentId);
  if (!mayTouchLocation(req, locationId)) return res.status(403).json({ error: 'Not your center' });
  if (!Number.isInteger(studentId)) return res.status(400).json({ error: 'studentId is required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, location_id FROM students WHERE id = $1 AND active = true',
      [studentId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ninja not found' });
    if (Number(rows[0].location_id) === locationId) {
      return res.status(400).json({ error: 'That ninja already calls this center home' });
    }
    await pool.query(
      `INSERT INTO student_locations (student_id, location_id, added_by)
       VALUES ($1, $2, $3) ON CONFLICT (student_id, location_id) DO NOTHING`,
      [studentId, locationId, req.session.userId]
    );
    const { rows: out } = await pool.query(`${SHARED_SELECT} WHERE s.id = $1`, [studentId]);
    res.status(201).json(out[0]);
  } catch (err) {
    console.error('Error sharing student:', err);
    res.status(500).json({ error: 'Failed to add ninja' });
  }
});

// DELETE /api/admin/locations/:id/students/:studentId — stop sharing
router.delete('/locations/:id/students/:studentId', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const locationId = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  if (!mayTouchLocation(req, locationId)) return res.status(403).json({ error: 'Not your center' });

  try {
    const { rows } = await pool.query('SELECT location_id FROM students WHERE id = $1', [studentId]);
    if (!rows[0]) return res.status(404).json({ error: 'Ninja not found' });
    // The home row is not a share. Taking a ninja off their own home center is
    // archiving, which lives on the roster page with its own confirm.
    if (Number(rows[0].location_id) === locationId) {
      return res.status(400).json({ error: 'This is the ninja\'s home center. Archive them from the roster instead.' });
    }
    const { rowCount } = await pool.query(
      'DELETE FROM student_locations WHERE student_id = $1 AND location_id = $2',
      [studentId, locationId]
    );
    if (!rowCount) return res.status(404).json({ error: 'That ninja is not shared with this center' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error unsharing student:', err);
    res.status(500).json({ error: 'Failed to remove ninja' });
  }
});

// POST /api/admin/locations — create location + initial manager account
router.post('/locations', requireAdmin, async (req, res) => {
  const pool = req.app.get('db');
  const { name, slug, manager_username, manager_display_name } = req.body;

  if (!name || !slug || !manager_username || !manager_display_name) {
    return res.status(400).json({ error: 'name, slug, manager_username, and manager_display_name are required' });
  }

  const cleanSlug = slug.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!cleanSlug) return res.status(400).json({ error: 'Invalid slug' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existingLoc } = await client.query('SELECT id FROM locations WHERE slug = $1 OR name = $2', [cleanSlug, name.trim()]);
    if (existingLoc.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A location with that name or slug already exists' });
    }

    const checkedManager = validateUsername(manager_username);
    if (checkedManager.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: checkedManager.error });
    }
    const { rows: existingUser } = await client.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [checkedManager.value]);
    if (existingUser.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username already taken' });
    }

    const { rows: locRows } = await client.query(
      'INSERT INTO locations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
      [name.trim(), cleanSlug]
    );
    const location = locRows[0];

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const { rows: userRows } = await client.query(
      'INSERT INTO users (username, password_hash, display_name, role, location_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name, role',
      [checkedManager.value, hash, manager_display_name.trim(), 'manager', location.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ location, manager: userRows[0], temp_password: tempPassword });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating location:', err);
    res.status(500).json({ error: 'Failed to create location' });
  } finally {
    client.release();
  }
});

// PATCH /api/admin/locations/:id — rename or toggle active
router.patch('/locations/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { name, active, center_code, address } = req.body;

  if (!mayTouchLocation(req, id)) {
    return res.status(403).json({ error: 'You can only change your own center.' });
  }

  // Deactivating a center locks its staff out of their own writes and its
  // parents out entirely. A director switching their own center off is a
  // mistake nobody at that center could undo, so it stays with an admin.
  if (active !== undefined && !isAdmin(req)) {
    return res.status(403).json({ error: 'Only an admin can activate or deactivate a center.' });
  }

  try {
    const { rows: existing } = await pool.query('SELECT * FROM locations WHERE id = $1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'Location not found' });

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ error: 'Name cannot be empty' });
      const { rows: conflict } = await pool.query('SELECT id FROM locations WHERE name = $1 AND id != $2', [trimmed, id]);
      if (conflict[0]) return res.status(409).json({ error: 'A location with that name already exists' });
    }

    // The code a parent types. Uppercased here as well as in the browser,
    // because the browser is not the only way to reach this.
    let code;
    if (center_code !== undefined) {
      code = String(center_code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{1,10}$/.test(code)) {
        return res.status(400).json({
          error: 'A center code is 1 to 10 letters or digits, nothing else.',
        });
      }
      const { rows: taken } = await pool.query(
        'SELECT id FROM locations WHERE UPPER(center_code) = $1 AND id != $2',
        [code, id]
      );
      if (taken[0]) {
        return res.status(409).json({ error: 'Another center already uses that code.' });
      }
    }

    // The address a maps app is handed. Bounded and whitespace-collapsed like
    // any other free text here; emptying it is allowed and means "we do not
    // have one", which puts the directions link back to searching the center
    // by name. That is why it is a three-way check rather than COALESCE:
    // undefined leaves it alone, a blank string clears it.
    let addr;
    if (address !== undefined) {
      addr = String(address ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
    }

    const { rows } = await pool.query(
      `UPDATE locations SET
         name        = COALESCE($1, name),
         active      = COALESCE($2, active),
         center_code = COALESCE($3, center_code),
         address     = CASE WHEN $5::boolean THEN NULLIF($6, '') ELSE address END
       WHERE id = $4
       RETURNING id, name, slug, active, created_at, center_code, address`,
      [name?.trim() ?? null, active ?? null, code ?? null, id, address !== undefined, addr ?? null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /api/admin/locations/:id — cascade deletes all location data
router.delete('/locations/:id', requireAdmin, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check location exists
    const { rows: loc } = await client.query('SELECT id FROM locations WHERE id = $1', [id]);
    if (!loc[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Location not found' }); }

    // Club session dependents
    await client.query(`DELETE FROM club_attendees WHERE club_session_id IN (SELECT id FROM club_sessions WHERE location_id = $1)`, [id]);
    await client.query(`DELETE FROM club_session_comments WHERE session_id IN (SELECT id FROM club_sessions WHERE location_id = $1)`, [id]);
    await client.query('DELETE FROM club_sessions WHERE location_id = $1', [id]);
    await client.query('DELETE FROM club_profiles WHERE location_id = $1', [id]);
    await client.query('DELETE FROM club_resources WHERE location_id = $1', [id]);
    await client.query('DELETE FROM club_definitions WHERE location_id = $1', [id]);
    // club_members has CASCADE on location_id — handled automatically

    // Student dependents
    await client.query(`DELETE FROM progress_log_comments WHERE log_id IN (SELECT id FROM progress_logs WHERE student_id IN (SELECT id FROM students WHERE location_id = $1))`, [id]);
    await client.query(`DELETE FROM progress_logs WHERE student_id IN (SELECT id FROM students WHERE location_id = $1)`, [id]);
    await client.query(`DELETE FROM daily_assignments WHERE student_id IN (SELECT id FROM students WHERE location_id = $1)`, [id]);
    await client.query(`DELETE FROM student_programs WHERE student_id IN (SELECT id FROM students WHERE location_id = $1)`, [id]);
    await client.query('DELETE FROM students WHERE location_id = $1', [id]);

    // Nullify all FK references to users at this location before deleting them
    await client.query(`UPDATE progress_logs SET sensei_id = NULL WHERE sensei_id IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`UPDATE progress_log_comments SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`UPDATE club_sessions SET sensei_id = NULL WHERE sensei_id IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`UPDATE club_session_comments SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`UPDATE daily_assignments SET sensei_id = NULL WHERE sensei_id IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`UPDATE club_definitions SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`UPDATE app_settings SET updated_by = NULL WHERE updated_by IN (SELECT id FROM users WHERE location_id = $1)`, [id]);
    await client.query(`DELETE FROM users WHERE location_id = $1 AND role != 'admin'`, [id]);

    await client.query('DELETE FROM locations WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting location:', err);
    res.status(500).json({ error: 'Failed to delete location' });
  } finally {
    client.release();
  }
});

// GET /api/admin/users
router.get('/users', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { location_id, role, inactive } = req.query;
  const showInactive = inactive === 'true';
  const allowed = allowedLocationIds(req);

  try {
    let query = `
      SELECT u.id, u.username, u.display_name, u.role, u.active, u.location_id, u.created_at,
             u.must_reset_password, l.name AS location_name,
             COALESCE(array_agg(DISTINCT ul.location_id) FILTER (WHERE ul.location_id IS NOT NULL), '{}') AS location_ids
      FROM users u
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN user_locations ul ON ul.user_id = u.id
      WHERE u.role != 'admin'
        AND u.active = $1
    `;
    const params = [!showInactive];
    let p = 1;

    if (location_id) { p++; query += ` AND u.id IN (SELECT user_id FROM user_locations WHERE location_id = $${p})`; params.push(location_id); }
    // A director never sees staff from a center they do not belong to, whatever
    // the query string asks for. Admin accounts are already excluded above.
    if (allowed) {
      p++;
      query += ` AND (u.location_id = ANY($${p}) OR u.id IN (SELECT user_id FROM user_locations WHERE location_id = ANY($${p})))`;
      params.push(allowed);
    }
    if (role && ['manager', 'sensei'].includes(role)) { p++; query += ` AND u.role = $${p}`; params.push(role); }

    query += ` GROUP BY u.id, l.name ORDER BY l.name ASC, u.role ASC, u.display_name ASC`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users
router.post('/users', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { username, display_name, role, location_id, location_ids } = req.body;

  // Accept a list of centers; fall back to the single location_id for older callers.
  const requestedIds = Array.isArray(location_ids) && location_ids.length
    ? [...new Set(location_ids.map(Number).filter(Boolean))]
    : (location_id ? [Number(location_id)] : []);

  if (!username?.trim() || !display_name?.trim() || !role || !requestedIds.length) {
    return res.status(400).json({ error: 'username, display_name, role, and at least one center are required' });
  }
  // manager or sensei, never admin. A director minting an admin would hand
  // themselves every center, which would make the rest of this file decorative.
  if (!['manager', 'sensei'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (!requestedIds.every((locId) => mayTouchLocation(req, locId))) {
    return res.status(403).json({ error: 'You can only add staff to your own centers.' });
  }

  try {
    const checkedUser = validateUsername(username);
    if (checkedUser.error) return res.status(400).json({ error: checkedUser.error });
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [checkedUser.value]);
    if (existing[0]) return res.status(409).json({ error: 'Username already taken' });

    const { rows: validLocs } = await pool.query('SELECT id FROM locations WHERE id = ANY($1)', [requestedIds]);
    const validIds = validLocs.map((r) => r.id);
    if (!validIds.length) return res.status(400).json({ error: 'No valid centers selected' });
    const homeId = validIds[0];

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO users (username, password_hash, display_name, role, location_id, must_reset_password) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, username, display_name, role, location_id, active, created_at',
        [checkedUser.value, hash, display_name.trim(), role, homeId]
      );
      const newUser = rows[0];
      for (const locId of validIds) {
        await client.query('INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUser.id, locId]);
      }
      const { rows: locRows } = await client.query('SELECT name FROM locations WHERE id = $1', [homeId]);
      await client.query('COMMIT');
      res.status(201).json({ ...newUser, location_ids: validIds, location_name: locRows[0]?.name, temp_password: tempPassword });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { display_name, role, location_id, location_ids, active } = req.body;

  // Losing your own manager role, or switching yourself off, is a door that
  // locks from the outside: nobody left at that center could undo it.
  if (!isAdmin(req) && Number(id) === Number(req.session.userId)) {
    if (role !== undefined || active !== undefined) {
      return res.status(403).json({ error: 'You cannot change your own role or archive yourself.' });
    }
  }

  const target = await loadStaffTarget(req, req.app.get('db'), id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // When a center list is supplied, replace the user's membership and reset home.
  let validIds = null;
  if (Array.isArray(location_ids)) {
    const requestedIds = [...new Set(location_ids.map(Number).filter(Boolean))];
    if (!requestedIds.length) return res.status(400).json({ error: 'Select at least one center' });
    // A director cannot post somebody to a center they do not belong to
    // themselves, which is how a manager could otherwise reach across.
    if (!requestedIds.every((locId) => mayTouchLocation(req, locId))) {
      return res.status(403).json({ error: 'You can only assign your own centers.' });
    }
    const { rows: validLocs } = await pool.query('SELECT id FROM locations WHERE id = ANY($1)', [requestedIds]);
    validIds = validLocs.map((r) => r.id);
    if (!validIds.length) return res.status(400).json({ error: 'No valid centers selected' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query("SELECT * FROM users WHERE id = $1 AND role != 'admin'", [id]);
    if (!existing[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    const u = existing[0];

    // Keep the current home if still assigned, otherwise fall back to the first center.
    const homeId = validIds
      ? (validIds.includes(u.location_id) ? u.location_id : validIds[0])
      : (location_id ?? u.location_id);

    const { rows } = await client.query(
      `UPDATE users SET display_name = $1, role = $2, location_id = $3, active = $4
       WHERE id = $5 RETURNING id, username, display_name, role, location_id, active`,
      [
        display_name ?? u.display_name,
        (role && ['manager', 'sensei'].includes(role)) ? role : u.role,
        homeId,
        active !== undefined ? active : u.active,
        id,
      ]
    );

    if (validIds) {
      await client.query('DELETE FROM user_locations WHERE user_id = $1', [id]);
      for (const locId of validIds) {
        await client.query('INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2)', [id, locId]);
      }
    }

    const { rows: locRows } = await client.query('SELECT name FROM locations WHERE id = $1', [rows[0].location_id]);
    await client.query('COMMIT');
    res.json({ ...rows[0], location_ids: validIds ?? undefined, location_name: locRows[0]?.name });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating admin user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  } finally {
    client.release();
  }
});

// PATCH /api/admin/users/:id/reset-password
router.patch('/users/:id/reset-password', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  try {
    if (!(await loadStaffTarget(req, pool, id))) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { rows } = await pool.query("SELECT id, username FROM users WHERE id = $1 AND role != 'admin'", [id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1, must_reset_password = true WHERE id = $2', [hash, id]);
    res.json({ username: rows[0].username, temp_password: tempPassword });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/admin/users/:id
//
// An admin destroys the account. A director archives it.
//
// Different acts, deliberately behind one button. Archiving is reversible and
// keeps the person's history attached to their name; the hard delete below
// scrubs them out of every log they ever wrote and cannot be undone. A director
// removing somebody from their center means "they do not work here any more",
// which is archive, and giving them the other one would be handing an
// irreversible operation to the role most likely to reach for it in a hurry.
router.delete('/users/:id', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;

  if (Number(id) === Number(req.session.userId)) {
    return res.status(403).json({ error: 'You cannot remove your own account.' });
  }

  try {
    const target = await loadStaffTarget(req, pool, id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (!isAdmin(req)) {
      await pool.query('UPDATE users SET active = false WHERE id = $1', [id]);
      return res.json({ ok: true, archived: true });
    }

    const { rows } = await pool.query("SELECT id, username, role FROM users WHERE id = $1 AND role != 'admin'", [id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Same rule as the center-level delete in routes/users.js: the person goes,
      // their session history stays and reads as "Deleted user". Nulling user_name
      // alongside user_id is what keeps their name from outliving the account.
      await client.query('UPDATE progress_logs SET sensei_id = NULL WHERE sensei_id = $1', [id]);
      await client.query('UPDATE progress_log_comments SET user_id = NULL, user_name = NULL WHERE user_id = $1', [id]);
      await client.query('UPDATE club_session_comments SET user_id = NULL, user_name = NULL WHERE user_id = $1', [id]);
      // Nullify the remaining FK references (all NO ACTION, so a miss fails the delete)
      await client.query('UPDATE daily_assignments SET sensei_id = NULL WHERE sensei_id = $1', [id]);
      await client.query('UPDATE club_sessions SET sensei_id = NULL WHERE sensei_id = $1', [id]);
      await client.query('UPDATE club_definitions SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE club_resources SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE app_settings SET updated_by = NULL WHERE updated_by = $1', [id]);
      await client.query('UPDATE announcements SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('UPDATE releases SET created_by = NULL WHERE created_by = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error hard-deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/settings
router.get('/settings', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const { rows } = await pool.query('SELECT key, value, updated_at FROM app_settings');
    const settings = rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings/:key
// Global, across every center. A director editing the announcement changes
// what Fullerton and Cerritos see too, which the screen says out loud.
router.put('/settings/:key', requireManager, async (req, res) => {
  const pool = req.app.get('db');
  const { key } = req.params;
  const { value } = req.body;

  const ALLOWED_KEYS = ['announcement'];
  if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Unknown setting key' });

  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
      [key, value || null, req.session.userId]
    );
    res.json({ ok: true, key, value: value || null });
  } catch (err) {
    console.error('Error saving setting:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

module.exports = router;
