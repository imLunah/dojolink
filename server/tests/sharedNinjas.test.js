import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import app from '../index.js';
import { csrf, resetDb, login, pool } from './helpers.js';

// A ninja can belong to more than one center (migration 027). These tests pin
// the two things that make that safe: membership is what every scoped read
// uses, and removing a ninja from a center that only shares them never touches
// the record itself.
//
// mgr_a is a manager at Test Fullerton (locA). Ninja B calls Test Cerritos
// (locB) home. The fixture gives every ninja their home membership row.

let world;
beforeEach(async () => { world = await resetDb(); });
afterAll(async () => { await pool.end(); });

const share = (agent, locId, studentId) =>
  csrf(agent.post(`/api/admin/locations/${locId}/students`)).send({ studentId });

describe('sharing a ninja into another center', () => {
  it('a ninja from another center is not on my roster until shared', async () => {
    const { agent } = await login(app, 'mgr_a');
    const before = await agent.get('/api/students');
    expect(before.status).toBe(200);
    expect(before.body.map((s) => s.id)).not.toContain(world.studentB);
  });

  it('search finds ninjas at OTHER centers only, and never ones already here', async () => {
    const { agent } = await login(app, 'mgr_a');
    const res = await agent.get(`/api/admin/locations/${world.locA}/students/search?q=ninja`);
    expect(res.status).toBe(200);
    const ids = res.body.map((s) => s.id);
    expect(ids).toContain(world.studentB);
    expect(ids).not.toContain(world.studentA);
    // What the search reveals about a child at another center is deliberately small.
    const row = res.body.find((s) => s.id === world.studentB);
    expect(row.home_location_name).toBe('Test Cerritos');
    expect(row).not.toHaveProperty('parent_email');
    expect(row).not.toHaveProperty('parent_phone');
  });

  it('after sharing, the ninja is on my roster AND still on their home roster', async () => {
    const { agent } = await login(app, 'mgr_a');
    const res = await share(agent, world.locA, world.studentB);
    expect(res.status).toBe(201);

    const mine = await agent.get('/api/students');
    expect(mine.body.map((s) => s.id)).toContain(world.studentB);

    // Home is untouched: still Cerritos, still active, still a member there.
    const { rows } = await pool.query(
      `SELECT s.location_id, s.active,
              (SELECT COUNT(*)::int FROM student_locations sl WHERE sl.student_id = s.id) AS memberships
         FROM students s WHERE s.id = $1`,
      [world.studentB]
    );
    expect(rows[0].location_id).toBe(world.locB);
    expect(rows[0].active).toBe(true);
    expect(rows[0].memberships).toBe(2);
  });

  it('a manager cannot share a ninja INTO a center they do not belong to', async () => {
    const { agent } = await login(app, 'mgr_a');
    const res = await share(agent, world.locB, world.studentA);
    expect(res.status).toBe(403);
  });

  it('sharing a ninja into their own home center is refused', async () => {
    const { agent } = await login(app, 'mgr_a');
    const res = await share(agent, world.locA, world.studentA);
    expect(res.status).toBe(400);
  });
});

describe('removing a shared ninja', () => {
  it('archiving from the sharing center removes the share and leaves the ninja active at home', async () => {
    const { agent } = await login(app, 'mgr_a');
    await share(agent, world.locA, world.studentB);

    const res = await csrf(agent.delete(`/api/students/${world.studentB}`));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('removed');

    const { rows } = await pool.query(
      `SELECT s.active,
              EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = $2) AS at_a,
              EXISTS (SELECT 1 FROM student_locations sl WHERE sl.student_id = s.id AND sl.location_id = $3) AS at_home
         FROM students s WHERE s.id = $1`,
      [world.studentB, world.locA, world.locB]
    );
    expect(rows[0].active).toBe(true);
    expect(rows[0].at_a).toBe(false);
    expect(rows[0].at_home).toBe(true);
  });

  it('archiving at the HOME center still archives outright', async () => {
    const { agent } = await login(app, 'mgr_a');
    const res = await csrf(agent.delete(`/api/students/${world.studentA}`));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('archived');
    const { rows } = await pool.query('SELECT active FROM students WHERE id = $1', [world.studentA]);
    expect(rows[0].active).toBe(false);
  });

  it('the admin unshare route refuses to unshare a home membership', async () => {
    const { agent } = await login(app, 'mgr_a');
    const res = await csrf(agent.delete(`/api/admin/locations/${world.locA}/students/${world.studentA}`));
    expect(res.status).toBe(400);
  });

  it('a permanent delete from the sharing center only removes the share', async () => {
    const { agent } = await login(app, 'mgr_a');
    await share(agent, world.locA, world.studentB);
    const res = await csrf(agent.delete(`/api/students/${world.studentB}/permanent`));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('removed');
    const { rows } = await pool.query('SELECT id FROM students WHERE id = $1', [world.studentB]);
    expect(rows).toHaveLength(1);
  });
});
