// Integration tests. Requires a migrated + seeded database (npm run db:setup).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/db');

let server, base;
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const login = async (email, password) => (await call('POST', '/api/auth/login', { body: { email, password } })).body.data.token;

const rand = Math.random().toString(36).slice(2, 8);
const email2 = `second_${rand}@example.com`;
let adminToken, userToken, user2Token, userTaskId, adminTaskId;

before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
  adminToken = await login('admin@example.com', 'Admin@123');
  userToken = await login('user@example.com', 'User@123');
});

after(async () => {
  await db('users').where({ email: email2 }).del();
  server.close();
  await db.destroy();
});

test('register creates a regular user and ignores attempts to set role', async () => {
  let r = await call('POST', '/api/auth/register', { body: { name: 'Second', email: email2, password: 'Password1' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.user.role, 'user');
  assert.equal(r.body.data.user.password, undefined);
  user2Token = r.body.data.token;

  r = await call('POST', '/api/auth/register', { body: { name: 'Evil', email: `evil_${rand}@example.com`, password: 'Password1', role: 'admin' } });
  assert.equal(r.status, 400);
});

test('register rejects duplicate email and weak password', async () => {
  let r = await call('POST', '/api/auth/register', { body: { name: 'Dup', email: email2, password: 'Password1' } });
  assert.equal(r.status, 409);
  r = await call('POST', '/api/auth/register', { body: { name: 'Dup', email: 'new@example.com', password: 'short' } });
  assert.equal(r.status, 400);
});

test('login: success returns JWT, wrong credentials return 401', async () => {
  const ok = await call('POST', '/api/auth/login', { body: { email: 'user@example.com', password: 'User@123' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.token);
  const bad = await call('POST', '/api/auth/login', { body: { email: 'user@example.com', password: 'nope' } });
  assert.equal(bad.status, 401);
  const unknown = await call('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'nope' } });
  assert.equal(unknown.status, 401);
});

test('task routes require authentication', async () => {
  assert.equal((await call('GET', '/api/tasks')).status, 401);
  assert.equal((await call('GET', '/api/tasks', { token: 'garbage' })).status, 401);
});

test('user creates a task (status defaults to Pending, cannot set status)', async () => {
  let r = await call('POST', '/api/tasks', { token: userToken, body: { title: 'My task', description: 'desc' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.task.status, 'Pending');
  userTaskId = r.body.data.task.id;

  r = await call('POST', '/api/tasks', { token: userToken, body: { title: 'x', status: 'Completed' } });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/tasks', { token: userToken, body: { description: 'no title' } });
  assert.equal(r.status, 400);
});

test('user sees only their own tasks; admin sees all', async () => {
  const mine = await call('GET', '/api/tasks?limit=100', { token: userToken });
  assert.equal(mine.status, 200);
  assert.ok(mine.body.data.tasks.length > 0);
  const me = (await call('GET', '/api/auth/me', { token: userToken })).body.data.user.id;
  assert.ok(mine.body.data.tasks.every((t) => t.user_id === me));

  const other = await call('GET', '/api/tasks', { token: user2Token });
  assert.equal(other.body.data.tasks.length, 0);

  const all = await call('GET', '/api/tasks?limit=100', { token: adminToken });
  const owners = new Set(all.body.data.tasks.map((t) => t.user_id));
  assert.ok(owners.size >= 2);
});

test('list supports status filter and pagination', async () => {
  const r = await call('GET', '/api/tasks?status=Pending&page=1&limit=1', { token: adminToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.tasks.length, 1);
  assert.equal(r.body.data.tasks[0].status, 'Pending');
  assert.ok(r.body.pagination.total >= 1);
  assert.equal((await call('GET', '/api/tasks?status=Bogus', { token: adminToken })).status, 400);
});

test('user can view and edit own task', async () => {
  let r = await call('GET', `/api/tasks/${userTaskId}`, { token: userToken });
  assert.equal(r.status, 200);
  r = await call('PUT', `/api/tasks/${userTaskId}`, { token: userToken, body: { title: 'Renamed' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.task.title, 'Renamed');
  assert.equal(r.body.data.task.description, 'desc'); // partial update keeps other fields
  r = await call('PUT', `/api/tasks/${userTaskId}`, { token: userToken, body: { status: 'Completed' } });
  assert.equal(r.status, 400); // status is not editable through this route
  r = await call('PUT', `/api/tasks/${userTaskId}`, { token: userToken, body: {} });
  assert.equal(r.status, 400);
});

test("user cannot see or modify another user's task", async () => {
  assert.equal((await call('GET', `/api/tasks/${userTaskId}`, { token: user2Token })).status, 404);
  assert.equal((await call('PUT', `/api/tasks/${userTaskId}`, { token: user2Token, body: { title: 'hijack' } })).status, 404);
});

test('status update is admin-only', async () => {
  let r = await call('PATCH', `/api/tasks/${userTaskId}/status`, { token: userToken, body: { status: 'Completed' } });
  assert.equal(r.status, 403);
  r = await call('PATCH', `/api/tasks/${userTaskId}/status`, { token: adminToken, body: { status: 'In Progress' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.task.status, 'In Progress');
  r = await call('PATCH', `/api/tasks/${userTaskId}/status`, { token: adminToken, body: { status: 'Done' } });
  assert.equal(r.status, 400);
  r = await call('PATCH', '/api/tasks/999999/status', { token: adminToken, body: { status: 'Testing' } });
  assert.equal(r.status, 404);
});

test('admin can create and edit tasks, including other users\' tasks', async () => {
  let r = await call('POST', '/api/tasks', { token: adminToken, body: { title: 'Admin task' } });
  assert.equal(r.status, 201);
  adminTaskId = r.body.data.task.id;
  r = await call('PUT', `/api/tasks/${userTaskId}`, { token: adminToken, body: { description: 'edited by admin' } });
  assert.equal(r.status, 200);
  // but a regular user cannot touch the admin's task
  assert.equal((await call('PUT', `/api/tasks/${adminTaskId}`, { token: userToken, body: { title: 'x' } })).status, 404);
});

test('invalid ids and unknown routes', async () => {
  assert.equal((await call('GET', '/api/tasks/abc', { token: userToken })).status, 400);
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('cleanup created tasks', async () => {
  await db('tasks').whereIn('id', [userTaskId, adminTaskId]).del();
});
