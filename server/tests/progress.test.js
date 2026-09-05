import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import app from '../index.js';
import { csrf, resetDb, login, pool } from './helpers.js';

let world;
beforeEach(async () => { world = await resetDb(); });
afterAll(async () => { await pool.end(); });

// Body that satisfies the required fields; override per test.
const logBody = (over = {}) => ({ student_id: world.studentA, program: 'CREATE', notes: 'worked on it', ...over });

describe('POST /api/progress — write validation (security regressions)', () => {
  it('logs progress for an enrolled program (happy path, 201)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  // Session 26: an authenticated user could write an arbitrary `program` string
  // (ZAP injection) that polluted the TodayBoard filter. The enrollment guard
  // must reject any program the student is not enrolled in.
  it('rejects a program the student is NOT enrolled in (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({ program: 'Robotics Academy' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enrolled/i);
  });

  it('rejects an outright junk program string (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({ program: "'; DROP TABLE students;--" }));
    expect(res.status).toBe(400);
  });

  // Session 27: a sensei replayed the request with belt_sublevel_at: 1000 and set a
  // student's belt to 1000 (integer column, no range guard). validateSublevel now
  // bounds it against the real per-belt max (White = 4).
  it('rejects an out-of-range belt_sublevel_at like 1000 (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress'))
      .send(logBody({ belt_level_at: 'White', belt_sublevel_at: 1000, update_student: true }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/belt level/i);
  });

  it('accepts belt_sublevel_at at the real max for the belt (White 4, 201)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress'))
      .send(logBody({ belt_level_at: 'White', belt_sublevel_at: 4 }));
    expect(res.status).toBe(201);
  });

  it('rejects a non-real belt label (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({ belt_level_at: 'Rainbow' }));
    expect(res.status).toBe(400);
  });

  // A CREATE class can carry a ninja past a level, or past a belt, in one
  // sitting. Each project keeps the belt and level it was worked on, so the
  // session reads back as what happened instead of being filed under one
  // snapshot and needing a second check-in to record the rest.
  it('keeps a per-entry belt and level when a session crosses a boundary (201)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({
      belt_level_at: 'Yellow',
      belt_sublevel_at: 1,
      project_at: 'Second Project',
      lesson_entries: [
        { project_at: 'First Project', status: 'Completed', belt_level_at: 'White', belt_sublevel_at: 4 },
        { project_at: 'Second Project', status: 'Working On', belt_level_at: 'Yellow', belt_sublevel_at: 1 },
      ],
    }));
    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      'SELECT project_at, belt_level_at, belt_sublevel_at FROM progress_logs WHERE student_id = $1 ORDER BY id',
      [world.studentA]
    );
    expect(rows.map((r) => [r.project_at, r.belt_level_at, r.belt_sublevel_at])).toEqual([
      ['First Project', 'White', 4],
      ['Second Project', 'Yellow', 1],
    ]);
  });

  // The per-entry fields are a second way into the same two columns, so they
  // get the same two bounds. Validating only the top-level values would hand
  // back the out-of-range write session 27 closed, one nesting deeper.
  it('rejects an out-of-range belt_sublevel_at hidden in an entry (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({
      belt_level_at: 'White',
      belt_sublevel_at: 2,
      lesson_entries: [
        { project_at: 'First Project', belt_level_at: 'White', belt_sublevel_at: 2 },
        { project_at: 'Second Project', belt_level_at: 'White', belt_sublevel_at: 1000 },
      ],
    }));
    expect(res.status).toBe(400);

    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM progress_logs WHERE student_id = $1', [world.studentA]);
    expect(rows[0].n).toBe(0);
  });

  it('rejects a junk belt label hidden in an entry (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({
      belt_level_at: 'White',
      belt_sublevel_at: 1,
      lesson_entries: [
        { project_at: 'First Project', belt_level_at: 'White', belt_sublevel_at: 1 },
        { project_at: 'Second Project', belt_level_at: 'Rainbow', belt_sublevel_at: 1 },
      ],
    }));
    expect(res.status).toBe(400);
  });

  // White tops out at 4 and Yellow at 4, but Brown runs to 10: a level is only
  // in range against the belt it was logged on, and the entry's own belt is
  // what it must be checked against, not the session's.
  it('bounds an entry level against that entry\'s own belt (400)', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody({
      belt_level_at: 'Brown',
      belt_sublevel_at: 9,
      lesson_entries: [
        { project_at: 'First Project', belt_level_at: 'Brown', belt_sublevel_at: 9 },
        { project_at: 'Second Project', belt_level_at: 'White', belt_sublevel_at: 9 },
      ],
    }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/progress/:id — ownership', () => {
  async function makeLog() {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/progress')).send(logBody());
    return res.body.id;
  }

  it('lets a sensei delete their own log (200)', async () => {
    const id = await makeLog();
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.delete(`/api/progress/${id}`)).send();
    expect(res.status).toBe(200);
  });

  it('forbids a different sensei from deleting another sensei\'s log (404)', async () => {
    const id = await makeLog();
    const { agent } = await login(app, 'sensei_a2'); // same center, different sensei
    const res = await csrf(agent.delete(`/api/progress/${id}`)).send();
    expect(res.status).toBe(404);
    // and the log still exists
    const { rows } = await pool.query('SELECT 1 FROM progress_logs WHERE id = $1', [id]);
    expect(rows.length).toBe(1);
  });

  it('lets a manager delete any log in their center (200)', async () => {
    const id = await makeLog();
    const { agent } = await login(app, 'mgr_a');
    const res = await csrf(agent.delete(`/api/progress/${id}`)).send();
    expect(res.status).toBe(200);
  });
});
