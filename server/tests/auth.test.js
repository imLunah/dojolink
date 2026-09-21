import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { csrf, resetDb, login, pool } from './helpers.js';

let world;
beforeEach(async () => { world = await resetDb(); });
afterAll(async () => { await pool.end(); });

describe('auth + access control', () => {
  it('rejects wrong credentials with 401', async () => {
    const res = await csrf(request(app).post('/api/auth/login')).send({ username: 'sensei_a', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('logs in valid staff and issues a session', async () => {
    const { res } = await login(app, 'sensei_a');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('sensei');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('blocks protected reads without a session (401)', async () => {
    const res = await request(app).get('/api/daily');
    expect(res.status).toBe(401);
  });

  it('rejects state-changing requests missing the CSRF header (403)', async () => {
    // No x-requested-with header -> the global CSRF guard fires before auth.
    const res = await request(app).post('/api/auth/login').send({ username: 'sensei_a', password: 'test1234' });
    expect(res.status).toBe(403);
  });

  it('admin bypasses requireOwnLocation for cross-center writes', async () => {
    const { agent } = await login(app, 'admin_t');
    // admin's home is A; switch the active center to B, then write against B.
    await csrf(agent.post('/api/auth/switch-location')).send({ locationId: world.locB });
    const res = await csrf(agent.post('/api/daily')).send({ student_id: world.studentB, program: 'CREATE' });
    expect(res.status).toBe(201);
  });

  it('requireOwnLocation blocks a manager writing at a center they are not assigned to', async () => {
    const { agent } = await login(app, 'mgr_a'); // assigned to A only
    // Managers may VIEW any center, so the switch succeeds...
    const sw = await csrf(agent.post('/api/auth/switch-location')).send({ locationId: world.locB });
    expect(sw.status).toBe(200);
    // ...but a WRITE at B must be refused.
    const res = await csrf(agent.post('/api/daily')).send({ student_id: world.studentB, program: 'CREATE' });
    expect(res.status).toBe(403);
  });

  it('allows a sensei to check in a ninja at their assigned center', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await csrf(agent.post('/api/daily')).send({ student_id: world.studentA, program: 'CREATE' });
    expect(res.status).toBe(201);
  });

  it('allows a sensei to view attendance at their active center', async () => {
    const { agent } = await login(app, 'sensei_a');
    const res = await agent.get('/api/reports/attendance?range=all');
    expect(res.status).toBe(200);
  });
});
