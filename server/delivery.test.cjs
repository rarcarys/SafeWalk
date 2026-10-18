const { testDatabaseOptions, inspectDatabase, cleanupTestDatabase } = require('./test-database.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { fixture } = require('./test-support.cjs');

test('live updates are authenticated and scoped to participants', async (t) => {
  const { call, user, base } = await fixture(t);
  const alice = await user('alice'),bob = await user('bob'),other = await user('other');
  assert.equal((await call('sync')).status, 401);
  await call('circle/contacts', alice.token, { email: bob.user.email });
  await call(`circle/invitations/${alice.user.id}/respond`, bob.token, { decision: 'accepted' });
  const cursor = (await call('sync', bob.token)).body.revision;
  const otherCursor = (await call('sync', other.token)).body.revision;
  const waiting = call(`sync?since=${cursor}`, bob.token);
  await call(`circle/chats/${bob.user.id}/messages`, alice.token, { text: 'Live message', clientId: 'live_message' });
  const received = await waiting;
  assert.ok(received.body.revision > cursor);
  assert.equal((await call('sync', other.token)).body.revision, otherCursor);
  const wrongOwner = await fetch(base + `circle/chats/${bob.user.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alice.token}`, 'X-SafeWalk-Owner': other.user.id }, body: JSON.stringify({ text: 'Wrong user', clientId: 'wrong_owner_key' }) });
  assert.equal(wrongOwner.status, 409);
  await wrongOwner.json();
});

test('durable push retries, provider receipts and session-bound devices', async (t) => {
  let time = Date.now(),fail = true;
  const requests = [];
  const { call, user, service, databasePath } = await fixture(t, { now: () => time, notificationOptions: { enabled: true, fetcher: async (url, options) => {
        const body = JSON.parse(options.body);requests.push({ url, body });
        if (fail) throw new Error('Simulated network failure');
        return { ok: true, json: async () => url.endsWith('getReceipts') ? { data: { ticket1: { status: 'ok' } } } : { data: { status: 'ok', id: 'ticket1' } } };
      } } });
  const alice = await user('alice'),bob = await user('bob');
  const device = 'ExpoPushToken[test_device_123456]';
  assert.equal((await call('notifications/devices', bob.token, { token: 'invalid' })).status, 400);
  assert.equal((await call('notifications/devices', bob.token, { token: device })).status, 200);
  await call('circle/contacts', alice.token, { email: bob.user.email });
  await service.processPushNotifications();
  let db = await inspectDatabase(databasePath);
  assert.equal((await db.prepare('SELECT attempts FROM push_deliveries').get()).attempts, 1);
  await db.close();
  fail = false;time += 3000;
  await service.processPushNotifications();
  assert.equal(requests.at(-1).body.body, 'Новое приглашение в контакты');
  assert.equal(requests.at(-1).body.data.ownerId, bob.user.id);
  time += 16 * 60000;
  await service.processPushNotifications();
  db = await inspectDatabase(databasePath);
  assert.equal((await db.prepare('SELECT status FROM push_deliveries').get()).status, 'provider_confirmed');
  await db.close();
  await call('logout', bob.token, {});
  db = await inspectDatabase(databasePath);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM push_devices').get()).n, 0);
  await db.close();
});
