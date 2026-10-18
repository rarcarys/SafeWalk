const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { Client } = require('pg');
const { fixture } = require('./test-support.cjs');
const { testDatabaseOptions, cleanupTestDatabase } = require('./test-database.cjs');
const { createAuthService } = require('./auth.cjs');
const { migrate } = require('../scripts/migrate-postgres.cjs');
const { createPostgresBackup, postgresCommand, credentials } = require('../scripts/postgres-backup.cjs');
const { postgresSQL } = require('./database.cjs');

test('PostgreSQL placeholders preserve question marks in quoted values and comments', () => {
  assert.equal(postgresSQL("SELECT '?' AS sample, ? AS ownerId -- ?\n"), "SELECT '?' AS sample, $1 AS \"ownerId\" -- ?\n");
});

test('PostgreSQL migration, simultaneous retries, rollback and backup restore', { skip: !process.env.SAFEWALK_TEST_DATABASE_URL }, async t => {
  const f = await fixture(t, { sqliteOnly: true });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'safewalk-pg-transfer-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const options = testDatabaseOptions(path.join(directory, 'target'));
  t.after(() => cleanupTestDatabase(path.join(directory, 'target')));
  const owner = await f.user('transfer-owner'), peer = await f.user('transfer-peer');
  const contact = (await f.call('circle/contacts', owner.token, { email: peer.user.email })).body.people[0];
  await f.call(`circle/invitations/${owner.user.id}/respond`, peer.token, { decision: 'accepted' });
  const sample = 'Проверка: кавычки \' " и вопрос ? — 安全 🚶';
  const original = (await f.call(`circle/chats/${peer.user.id}/messages`, owner.token, { text: sample, clientId: 'transfer_message' })).body.message;
  await f.call('safety/presets/taxi', owner.token, { primaryId: contact.id, backupIds: [], minutes: 30, sharing: true }, 'PUT');
  const timer = (await f.call('safety/timers', owner.token, { clientId: 'transfer_timer', minutes: 15, contactIds: [contact.id] })).body.timer;
  const migrated = await migrate({ ...options, source: f.databasePath, backupDestination: path.join(directory, 'source.sqlite') });
  assert.equal(migrated.counts.users, 2);
  assert.ok(migrated.counts.chat_messages >= 2);

  async function start() {
    const service = await createAuthService({ ...options, loginLimit: 200 });
    const server = service.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await service.close(); });
    const base = `http://127.0.0.1:${server.address().port}/api/auth/`;
    return { service, call: async (endpoint, token, body) => {
      const response = await fetch(base + endpoint, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-SafeWalk-Client': 'native', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    } };
  }
  const first = await start(), second = await start();
  assert.equal((await first.call('me', owner.token)).body.user.id, owner.user.id);
  assert.equal((await first.call('login', '', { email: owner.user.email, password: 'test-password-2026' })).status, 200);
  const state = (await first.call('safety/state', owner.token)).body;
  assert.equal(state.timer.id, timer.id); assert.equal(state.presets[0].slot, 'taxi');
  const messages = (await first.call(`circle/chats/${peer.user.id}/messages`, owner.token)).body.messages;
  assert.deepEqual(messages.find(message => message.id === original.id), original);
  const retryBody = { text: 'Concurrent message', clientId: 'concurrent_message' };
  const retries = await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? first : second).call(`circle/chats/${peer.user.id}/messages`, owner.token, retryBody)));
  assert.equal(retries.filter(result => result.status === 201).length, 1);
  assert.equal(new Set(retries.map(result => result.body.message.id)).size, 1);
  assert.ok(retries[0].body.message.id > Math.max(...messages.map(message => message.id)));
  const sos = await Promise.all([first, second, first, second].map(api => api.call('journeys/sos/send', owner.token, { clientId: 'concurrent_sos', includeLocation: false })));
  assert.equal(sos.filter(result => result.status === 201).length, 1);
  assert.ok(sos.every(result => result.body.sentCount === 1));
  await assert.rejects(migrate({ ...options, source: f.databasePath, backupDestination: path.join(directory, 'refused.sqlite') }), /содержит данные/);
  assert.equal((await first.call('me', owner.token)).status, 200);

  const rollbackOptions = testDatabaseOptions(path.join(directory, 'rollback'));
  t.after(() => cleanupTestDatabase(path.join(directory, 'rollback')));
  await f.service.database.exec('CREATE TABLE unsupported_legacy (id TEXT PRIMARY KEY)');
  await assert.rejects(migrate({ ...rollbackOptions, source: f.databasePath, backupDestination: path.join(directory, 'rollback.sqlite') }), /Неизвестная таблица/);
  const check = new Client({ connectionString: options.databaseUrl });
  try {
    await check.connect();
    assert.equal((await check.query(`SELECT COUNT(*) AS n FROM "${rollbackOptions.databaseSchema}".users`)).rows[0].n, 0);
    assert.equal((await check.query("SELECT COUNT(*) AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND t.tgenabled = 'D'", [rollbackOptions.databaseSchema])).rows[0].n, 0);
  } finally { await check.end(); }

  const dump = path.join(directory, 'postgres.dump');
  await createPostgresBackup(options.databaseUrl, dump, { databaseSchema: options.databaseSchema });
  // Restore only this test's randomly named schema; real application data is excluded.
  await cleanupTestDatabase(path.join(directory, 'target'));
  await postgresCommand('pg_restore', ['--exit-on-error', '--no-owner', '--no-privileges', '--dbname', credentials(options.databaseUrl).url, dump], options.databaseUrl);
  assert.equal((await second.call('me', owner.token)).status, 200);
  assert.equal((await second.call(`circle/chats/${peer.user.id}/messages`, owner.token)).body.messages.find(message => message.id === original.id).text, sample);
});
