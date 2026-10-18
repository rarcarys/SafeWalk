const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { createAuthService } = require('./auth.cjs');
const { testDatabaseOptions, cleanupTestDatabase } = require('./test-database.cjs');

async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'safewalk-integration-'));
  const databasePath = path.join(directory, 'accounts.sqlite');
  const service = await createAuthService({ ...(options.sqliteOnly ? {} : testDatabaseOptions(databasePath)), ...options, databasePath, loginLimit: 200 });
  const server = service.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/auth/`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await service.close();
    if (!options.databaseUrl && !options.sqliteOnly) await cleanupTestDatabase(databasePath);
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(databasePath + suffix)) fs.unlinkSync(databasePath + suffix);
    fs.rmdirSync(directory);
  });
  async function call(endpoint, token, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', 'X-SafeWalk-Client': 'native', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  async function user(name) {
    return (await call('register', null, { name, email: `${name}@example.com`, password: 'test-password-2026' })).body;
  }
  return { call, user, databasePath, base, service };
}
module.exports = { fixture };
