const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./test-support.cjs');
const { createAuthService } = require('./auth.cjs');
const { testDatabaseOptions } = require('./test-database.cjs');
const { contactPresences, ONLINE_WINDOW_MS, BATTERY_WINDOW_MS } = require('./presence.cjs');

async function connect(call, owner, peer) {
  assert.equal((await call('circle/contacts', owner.token, { email: peer.user.email })).status, 201);
  assert.equal((await call(`circle/invitations/${owner.user.id}/respond`, peer.token, { decision: 'accepted' })).status, 200);
}

test('presence heartbeat authenticates its owner and validates real battery samples', async t => {
  let timestamp = Date.now();
  const { call, user, service } = await fixture(t, { now: () => timestamp, backgroundJobs: false });
  const alice = await user('presence-owner'), bob = await user('presence-other');
  const battery = { level: 37, charging: true };
  assert.equal((await call('presence', null, { battery }, 'PUT')).status, 401);
  for (const invalid of [{}, { battery: [] }, { battery: false }, { battery: { level: -1, charging: false } },
    { battery: { level: 101, charging: false } }, { battery: { level: 1.5, charging: false } },
    { battery: { level: '37', charging: false } }, { battery: { level: 37, charging: 1 } }, { battery: { level: 37 } }]) {
    assert.equal((await call('presence', alice.token, invalid, 'PUT')).status, 400);
  }
  assert.equal((await call('presence', alice.token, { battery, ownerId: bob.user.id, lastSeenAt: 1 }, 'PUT')).status, 200);
  const stored = await service.database.prepare('SELECT * FROM user_presence').all();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].owner_id, alice.user.id);
  assert.equal(stored[0].last_seen_at, timestamp);
  assert.equal(stored[0].battery_level, 37);
  assert.equal(stored[0].battery_charging, 1);
  timestamp += 1000;
  assert.deepEqual((await call('presence', alice.token, { battery: null }, 'PUT')).body, { ok: true });
  const cleared = await service.database.prepare('SELECT * FROM user_presence').get();
  assert.equal(cleared.last_seen_at, timestamp);
  assert.equal(cleared.battery_level, null);
  assert.equal(cleared.battery_updated_at, null);
});

test('only accepted connected contacts can see presence in contacts, chats and a chat header', async t => {
  const timestamp = Date.now();
  const { call, user } = await fixture(t, { now: () => timestamp, backgroundJobs: false });
  const alice = await user('presence-alice'), bob = await user('presence-bob'), outsider = await user('presence-outsider');
  await call('presence', bob.token, { battery: { level: 0, charging: false } }, 'PUT');
  await call('circle/contacts', alice.token, { email: bob.user.email });
  assert.equal((await call('circle/contacts', alice.token)).body.people[0].presence, null);
  assert.equal((await call('circle/chats', alice.token)).body.chats[0].presence, null);
  assert.equal((await call(`circle/chats/${bob.user.id}/messages`, alice.token)).body.presence, null);
  await call(`circle/invitations/${alice.user.id}/respond`, bob.token, { decision: 'accepted' });
  const expected = { online: true, lastSeenAt: timestamp, battery: { level: 0, charging: false, updatedAt: timestamp } };
  assert.deepEqual((await call('circle/contacts', alice.token)).body.people[0].presence, expected);
  assert.deepEqual((await call('circle/chats', alice.token)).body.chats[0].presence, expected);
  assert.deepEqual((await call(`circle/chats/${bob.user.id}/messages`, alice.token)).body.presence, expected);
  assert.deepEqual((await call('circle/contacts', outsider.token)).body.people, []);
  assert.equal((await call(`circle/chats/${bob.user.id}/messages`, outsider.token)).status, 403);
  // Blocking in either direction hides even a heartbeat recorded afterward.
  await call(`circle/blocks/${alice.user.id}`, bob.token, {});
  await call('presence', bob.token, { battery: { level: 100, charging: true } }, 'PUT');
  assert.equal((await call('circle/contacts', alice.token)).body.people[0].presence, null);
  assert.equal((await call('circle/chats', alice.token)).body.chats[0].presence, null);
  await call(`circle/blocks/${alice.user.id}`, bob.token, {}, 'DELETE');
  assert.equal((await call('circle/contacts', alice.token)).body.people[0].presence, null);
});

test('presence expires online and battery independently and immediately reflects revoked sessions', async t => {
  let timestamp = Date.now();
  const { call, user, service } = await fixture(t, { now: () => timestamp, backgroundJobs: false });
  const alice = await user('fresh-alice'), bob = await user('fresh-bob');
  await connect(call, alice, bob);
  await call('presence', bob.token, { battery: { level: 82, charging: false } }, 'PUT');
  const read = async () => (await call('circle/contacts', alice.token)).body.people[0].presence;
  assert.equal((await read()).online, true);
  timestamp += ONLINE_WINDOW_MS + 1;
  const offline = await read();
  assert.equal(offline.online, false);
  assert.equal(offline.battery.level, 82);
  timestamp += BATTERY_WINDOW_MS - ONLINE_WINDOW_MS;
  assert.equal((await read()).battery, null);
  await call('presence', bob.token, { battery: { level: 81, charging: true } }, 'PUT');
  assert.equal((await read()).online, true);
  const secondSession = (await call('login', null, { email: bob.user.email, password: 'test-password-2026' })).body.token;
  await call('logout', bob.token, {});
  assert.equal((await read()).online, true);
  await call('logout', secondSession, {});
  assert.equal((await read()).online, false);
  const newSession = (await call('login', null, { email: bob.user.email, password: 'test-password-2026' })).body.token;
  await call('presence', newSession, { battery: null }, 'PUT');
  await service.database.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').run(timestamp - 1, bob.user.id);
  assert.equal((await read()).online, false);
});

test('presence persists across database connections and cascades with account deletion', async t => {
  const timestamp = Date.now();
  const { call, user, databasePath, service } = await fixture(t, { now: () => timestamp, backgroundJobs: false });
  const alice = await user('persist-alice'), bob = await user('persist-bob');
  await connect(call, alice, bob);
  await call('presence', bob.token, { battery: { level: 100, charging: true } }, 'PUT');
  const second = await createAuthService({ databasePath, ...testDatabaseOptions(databasePath), now: () => timestamp, backgroundJobs: false });
  try {
    assert.deepEqual((await contactPresences(second.database, alice.user.id, [bob.user.id], timestamp)).get(bob.user.id), {
      online: true, lastSeenAt: timestamp, battery: { level: 100, charging: true, updatedAt: timestamp },
    });
    assert.equal((await second.database.prepare('SELECT COUNT(*) AS count FROM user_presence').get()).count, 1);
  } finally { await second.close(); }
  assert.equal((await call('account/delete', bob.token, { password: 'test-password-2026', confirmation: 'DELETE' })).status, 200);
  assert.equal((await service.database.prepare('SELECT COUNT(*) AS count FROM user_presence').get()).count, 0);
});
