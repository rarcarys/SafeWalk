const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAuthService } = require('./auth.cjs');

const password = 'SafeWalk-test-passphrase-2026';

test('real accounts, sessions, browser cookies and request boundaries', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'safewalk-auth-test-'));
  const databasePath = path.join(directory, 'accounts.sqlite');
  let time = Date.now();
  let service;
  let server;
  let base;
  const origin = 'http://localhost:8081';
  async function start() {
    service = createAuthService({ databasePath, origins: [origin], loginLimit: 100, now: () => time });
    server = service.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise(resolve => server.close(resolve));
    service.close();
  }
  async function call(endpoint, body, headers = {}) {
    const response = await fetch(`${base}/api/auth/${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SafeWalk-Client': 'native', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  await start();
  t.after(async () => {
    await stop();
    for (const suffix of ['', '-wal', '-shm']) {
      const file = `${databasePath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(directory);
  });
  let token;
  await t.test('unauthenticated and invented sessions are rejected', async () => {
    assert.equal((await call('me')).status, 401);
    assert.equal((await call('me', undefined, { Authorization: 'Bearer invented' })).status, 401);
    assert.equal((await call('maps/search', { query: 'Алматы' })).status, 401);
    assert.equal((await call('maps/route', {})).status, 401);
  });
  await t.test('registration creates an account and verifies input', async () => {
    assert.equal((await call('register', { name: '', email: 'bad', password: 'short' })).status, 400);
    const result = await call('register', { name: 'Рената', email: 'RENATA@example.com', password });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.email, 'renata@example.com');
    assert.equal(result.body.user.name, 'Рената');
    assert.equal(typeof result.body.token, 'string');
    assert.equal(result.body.user.password_hash, undefined);
    token = result.body.token;
    assert.equal((await call('register', { name: 'Other', email: 'renata@example.com', password })).status, 409);
  });
  await t.test('only a correct password signs in', async () => {
    assert.equal((await call('login', { email: 'renata@example.com', password: 'wrong-password' })).status, 401);
    assert.equal((await call('login', { email: 'missing@example.com', password })).status, 401);
    const result = await call('login', { email: 'RENATA@example.com', password });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.name, 'Рената');
  });
  await t.test('credentials are salted hashes, not readable passwords', async () => {
    await call('register', { name: 'Дана', email: 'dana@example.com', password });
    const inspection = new DatabaseSync(databasePath, { readOnly: true });
    const rows = inspection.prepare('SELECT password_hash, password_salt FROM users ORDER BY email').all();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].password_hash, password);
    assert.notEqual(rows[0].password_hash, rows[1].password_hash);
    assert.notEqual(rows[0].password_salt, rows[1].password_salt);
    inspection.close();
  });
  await t.test('browser uses an HttpOnly cookie without a JSON token', async () => {
    const login = await call('login', { email: 'renata@example.com', password }, { Origin: origin, 'X-SafeWalk-Client': 'web' });
    assert.equal(login.status, 200);
    assert.equal(login.body.token, undefined);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(login.headers.get('cache-control'), 'no-store');
    assert.equal((await call('me', undefined, { Cookie: cookie.split(';')[0], Origin: origin })).status, 200);
    const logout = await call('logout', {}, { Cookie: cookie.split(';')[0], Origin: origin });
    assert.equal(logout.status, 200);
    assert.equal((await call('me', undefined, { Cookie: cookie.split(';')[0], Origin: origin })).status, 401);
  });
  await t.test('cross-site and malformed submissions are rejected', async () => {
    assert.equal((await call('login', { email: 'renata@example.com', password }, { Origin: 'https://untrusted.example' })).status, 403);
    const response = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
    assert.equal(response.status, 415);
    const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  });
  await t.test('accounts and sessions survive a server restart', async () => {
    await stop();
    await start();
    assert.equal((await call('me', undefined, { Authorization: `Bearer ${token}` })).body.user.name, 'Рената');
    assert.equal((await call('login', { email: 'renata@example.com', password })).status, 200);
  });
  await t.test('native logout revokes the bearer token', async () => {
    await call('logout', {}, { Authorization: `Bearer ${token}` });
    assert.equal((await call('me', undefined, { Authorization: `Bearer ${token}` })).status, 401);
  });
  await t.test('expired sessions cannot access an account', async () => {
    const login = await call('login', { email: 'renata@example.com', password });
    time += 8 * 24 * 60 * 60 * 1000;
    assert.equal((await call('me', undefined, { Authorization: `Bearer ${login.body.token}` })).status, 401);
  });
});

test('repeated sign-in attempts are rate limited', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'safewalk-rate-test-'));
  const databasePath = path.join(directory, 'accounts.sqlite');
  const service = createAuthService({ databasePath, loginLimit: 1 });
  const server = service.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    const address = `http://127.0.0.1:${server.address().port}/api/auth/login`;
    assert.equal((await fetch(address, options)).status, 400);
    assert.equal((await fetch(address, options)).status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
    service.close();
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(`${databasePath}${suffix}`)) fs.unlinkSync(`${databasePath}${suffix}`);
    fs.rmdirSync(directory);
  }
});
