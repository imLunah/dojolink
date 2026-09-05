// Shared test fixtures + request helpers.
//
// resetDb() wipes and re-seeds a known-minimal world before each test so every
// test is fully isolated:
//   locations : A (test-fullerton), B (test-cerritos)
//   users     : admin_t (admin@A), mgr_a (manager@A), sensei_a (@A),
//               sensei_a2 (@A), sensei_b (@B) — all password TEST_PW
//   belts     : White has 4 sublevels -> validateSublevel max = 4
//   students  : ninjaA (@A), ninjaB (@B), both enrolled in CREATE (White/1)
import bcrypt from 'bcryptjs';
import request from 'supertest';
import pool from '../db/pool.js';

const TEST_PW = 'test1234';

// Every state-changing request must carry the CSRF header the app requires
// (server/index.js rejects non-safe methods without it with 403).
function csrf(req) {
  return req.set('x-requested-with', 'XMLHttpRequest');
}

async function resetDb() {
  await pool.query(`TRUNCATE
    progress_logs, daily_assignments, student_programs, student_locations, students,
    user_locations, belt_level_projects, users, locations, session
    RESTART IDENTITY CASCADE`);

  const { rows: locs } = await pool.query(
    `INSERT INTO locations (name, slug, active) VALUES
       ('Test Fullerton', 'test-fullerton', true),
       ('Test Cerritos',  'test-cerritos',  true)
     RETURNING id`
  );
  const locA = locs[0].id;
  const locB = locs[1].id;

  const hash = await bcrypt.hash(TEST_PW, 10);
  const { rows: users } = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, location_id, active) VALUES
       ('admin_t',   $1, 'Admin',      'admin',   $2, true),
       ('mgr_a',     $1, 'Manager A',  'manager', $2, true),
       ('sensei_a',  $1, 'Sensei A',   'sensei',  $2, true),
       ('sensei_a2', $1, 'Sensei A2',  'sensei',  $2, true),
       ('sensei_b',  $1, 'Sensei B',   'sensei',  $3, true)
     RETURNING id, username`,
    [hash, locA, locB]
  );
  const uid = Object.fromEntries(users.map((u) => [u.username, u.id]));

  // White belt -> 4 sublevels. validateSublevel() caps belt_sublevel_at at MAX(sublevel).
  await pool.query(
    `INSERT INTO belt_level_projects (belt_name, sublevel, project_name, project_order) VALUES
       ('White', 1, 'P1', 1), ('White', 2, 'P2', 2),
       ('White', 3, 'P3', 3), ('White', 4, 'P4', 4)`
  );

  const { rows: studs } = await pool.query(
    `INSERT INTO students (full_name, location_id, active) VALUES
       ('Ninja A', $1, true), ('Ninja B', $2, true)
     RETURNING id`,
    [locA, locB]
  );
  const studentA = studs[0].id;
  const studentB = studs[1].id;

  // Every read is scoped by membership now (migration 027), so a fixture that
  // inserts students directly has to give them their home membership row too,
  // exactly as the backfill does for real data.
  await pool.query(
    `INSERT INTO student_locations (student_id, location_id) VALUES ($1, $2), ($3, $4)`,
    [studentA, locA, studentB, locB]
  );

  await pool.query(
    `INSERT INTO student_programs (student_id, program, belt_level, belt_sublevel) VALUES
       ($1, 'CREATE', 'White', 1), ($2, 'CREATE', 'White', 1)`,
    [studentA, studentB]
  );

  return { locA, locB, uid, studentA, studentB };
}

// Log in and return a cookie-carrying supertest agent + the login response.
async function login(app, username, password = TEST_PW) {
  const agent = request.agent(app);
  const res = await csrf(agent.post('/api/auth/login')).send({ username, password });
  return { agent, res };
}

export { TEST_PW, csrf, resetDb, login, pool };
