const { testDatabaseOptions, inspectDatabase, cleanupTestDatabase } = require('./test-database.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAuthService } = require('./auth.cjs');

test('contacts, multiple reserves and private conversations survive restarts', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'safewalk-circle-'));
  const databasePath = path.join(directory, 'accounts.sqlite');
  let service, server, base;
  async function start() {
    service = await createAuthService({ ...testDatabaseOptions(databasePath), databasePath, loginLimit: 100 });
    server = service.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api/auth`;
  }
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
  await start();
  t.after(async () => {
    await stop();
    for (const suffix of ['', '-wal', '-shm']) {
      const file = `${databasePath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    await cleanupTestDatabase(databasePath);fs.rmdirSync(directory);
  });
  async function call(endpoint, token, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(`${base}/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-SafeWalk-Client': 'native', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }
  async function register(name, email) {
    const result = await call('register', null, { name, email, password: 'circle-test-passphrase-2026' });
    assert.equal(result.status, 201);
    return result.body;
  }
  const alice = await register('Алия', 'alice@example.com');
  const bob = await register('Бек', 'bob@example.com');
  const cara = await register('Карина', 'cara@example.com');
  let caraContact;
  let bobContact;
  let momContact;
  await t.test('authentication and account ownership protect contacts and chats', async () => {
    assert.equal((await call('circle/contacts')).status, 401);
    assert.equal((await call(`circle/chats/${bob.user.id}/messages`)).status, 401);
    const result = await call('circle/contacts', alice.token);
    assert.equal(result.body.primaryId, null);
    assert.deepEqual(result.body.people, []);
    assert.deepEqual(result.body.backupIds, []);
    assert.equal((await call(`circle/chats/${bob.user.id}/messages`, alice.token)).status, 403);
    assert.equal((await call('circle/contacts', alice.token, { email: 'alice@example.com' })).status, 400);
    assert.equal((await call('circle/contacts', alice.token, { email: 'missing@example.com' })).status, 404);
  });
  await t.test('existing and new contacts connect to real accounts', async () => {
    const linked = await call('circle/contacts', alice.token, { email: ' BOB@example.com ' });
    assert.equal(linked.status, 201);
    bobContact = linked.body.people[0].id;
    assert.equal(linked.body.people[0].peerId, bob.user.id);
    assert.equal(linked.body.primaryId, bobContact);
    assert.equal((await call('circle/contacts', alice.token, { email: 'bob@example.com' })).status, 409);
    const mom = await call('circle/contacts', alice.token, { name: 'Мама', phone: '+7 (701) 123-45-67', relation: 'Семья' });
    assert.equal(mom.status, 201);
    momContact = mom.body.people.find((person) => person.name === 'Мама').id;
    assert.equal(mom.body.people.find((person) => person.id === momContact).phone, '+77011234567');
    const added = await call('circle/contacts', alice.token, { name: 'Карина', phone: '+77017654321', relation: 'Сестра' });
    assert.equal(added.status, 201);
    caraContact = added.body.people.find((person) => person.name === 'Карина').id;
    assert.equal((await call(`circle/contacts/${caraContact}/link`, alice.token, { email: 'cara@example.com' }, 'PUT')).status, 200);
    assert.equal((await call(`circle/contacts/${caraContact}/link`, alice.token, { email: 'bob@example.com' }, 'PUT')).status, 409);
    assert.equal((await call(`circle/contacts/${caraContact}/link`, bob.token, { email: 'cara@example.com' }, 'PUT')).status, 404);
    assert.equal((await call(`circle/invitations/${alice.user.id}/respond`, bob.token, { decision: 'accepted' })).status, 200);
    assert.equal((await call(`circle/invitations/${alice.user.id}/respond`, cara.token, { decision: 'accepted' })).status, 200);
  });
  await t.test('multiple reserves are explicit, distinct and separate from the primary', async () => {
    const selected = await call('circle/selection', alice.token, { primaryId: bobContact, backupIds: [momContact, caraContact] }, 'PUT');
    assert.equal(selected.status, 200);
    assert.deepEqual(selected.body.backupIds, [momContact, caraContact]);
    for (const body of [
    { primaryId: bobContact, backupIds: [bobContact] },
    { primaryId: bobContact, backupIds: [momContact, momContact] },
    { primaryId: 'unknown', backupIds: [] },
    { primaryId: bobContact, backupIds: [bob.user.id] },
    { primaryId: bobContact, backupIds: null }])
    assert.equal((await call('circle/selection', alice.token, body, 'PUT')).status, 400);
    assert.deepEqual((await call('circle/contacts', bob.token)).body.backupIds, []);
  });
  let messageId;
  await t.test('messages arrive for both participants with safe retry and no third-party access', async () => {
    const endpoint = `circle/chats/${bob.user.id}/messages`;
    assert.equal((await call(endpoint, alice.token, { text: ' ', clientId: 'empty_message' })).status, 400);
    assert.equal((await call(endpoint, alice.token, { text: 'x'.repeat(2001), clientId: 'long_message' })).status, 400);
    const sent = await call(endpoint, alice.token, { text: 'Я в пути', clientId: 'first_message' });
    assert.equal(sent.status, 201);
    messageId = sent.body.message.id;
    const retry = await call(endpoint, alice.token, { text: 'Я в пути', clientId: 'first_message' });
    assert.equal(retry.body.message.id, messageId);
    assert.equal((await call(endpoint, alice.token, { text: 'Другое', clientId: 'first_message' })).status, 409);
    const incoming = await call(`circle/chats/${alice.user.id}/messages`, bob.token);
    assert.deepEqual(incoming.body.messages.map((message) => message.text), ['Я в пути']);
    assert.equal((await call('circle/chats', bob.token)).body.chats[0].id, alice.user.id);
    const reply = await call(`circle/chats/${alice.user.id}/messages`, bob.token, { text: 'Напиши, когда придёшь', clientId: 'reply_message' });
    assert.equal(reply.status, 201);
    assert.deepEqual((await call(`circle/chats/${alice.user.id}/messages`, cara.token)).body.messages, []);
    assert.equal((await call(`circle/chats/${bob.user.id}/messages`, cara.token)).status, 403);
    assert.equal((await call('circle/chats', cara.token)).body.chats.every((chat) => !chat.lastMessage), true);
    assert.deepEqual((await call(`circle/chats/${bob.user.id}/messages?after=${messageId}`, alice.token)).body.messages.map((message) => message.text), ['Напиши, когда придёшь']);
  });
  await t.test('history pages stay ordered and cannot include another conversation', async () => {
    for (let index = 0; index < 102; index++) {
      assert.equal((await call(`circle/chats/${bob.user.id}/messages`, alice.token, { text: `Сообщение ${index}`, clientId: `history_message_${index}` })).status, 201);
    }
    // An interleaved message to another contact must never appear in Bob's history.
    assert.equal((await call(`circle/chats/${cara.user.id}/messages`, alice.token, { text: 'Для Карины', clientId: 'other_conversation' })).status, 201);
    const latest = await call(`circle/chats/${bob.user.id}/messages`, alice.token);
    assert.equal(latest.body.messages.length, 100);
    assert.equal(latest.body.hasMore, true);
    assert.equal(latest.body.messages.at(-1).text, 'Сообщение 101');
    const older = await call(`circle/chats/${bob.user.id}/messages?before=${latest.body.messages[0].id}`, alice.token);
    assert.equal(older.body.messages.length, 4);
    assert.equal(older.body.hasMore, false);
    assert.equal(older.body.messages[0].text, 'Я в пути');
    assert.equal((await call(`circle/chats/${bob.user.id}/messages?before=bad`, alice.token)).status, 400);
  });
  await t.test('history and selection persist after restart, including an empty reserve list', async () => {
    await stop();
    await start();
    assert.deepEqual((await call('circle/contacts', alice.token)).body.backupIds, [momContact, caraContact]);
    assert.equal((await call(`circle/chats/${alice.user.id}/messages`, bob.token)).body.messages.at(-1).text, 'Сообщение 101');
    const selected = await call('circle/selection', alice.token, { primaryId: caraContact, backupIds: [] }, 'PUT');
    assert.equal(selected.status, 200);
    assert.equal(selected.body.primaryId, caraContact);
    assert.deepEqual(selected.body.backupIds, []);
    assert.equal((await call('circle/contacts', alice.token)).body.primaryId, caraContact);
  });
  await t.test('contacts can be edited and removed without destroying chat history', async () => {
    const edited = await call(`circle/contacts/${caraContact}`, alice.token, { name: 'Сестра', phone: '+77017654321', relation: 'Семья' }, 'PUT');
    assert.equal(edited.status, 200);
    assert.equal(edited.body.people.find((person) => person.id === caraContact).name, 'Сестра');
    assert.equal((await call(`circle/contacts/${caraContact}`, bob.token, {}, 'DELETE')).status, 404);
    const removed = await call(`circle/contacts/${caraContact}`, alice.token, {}, 'DELETE');
    assert.equal(removed.status, 200);
    assert.equal(removed.body.primaryId, bobContact);
    assert.equal(removed.body.people.length, 2);
    assert.ok((await call('circle/chats', alice.token)).body.chats.some((person) => person.id === cara.user.id));
  });
  await t.test('unread counts and read cursors belong to the authenticated user', async () => {
    assert.ok((await call('circle/chats', bob.token)).body.chats.find((peer) => peer.id === alice.user.id).unreadCount > 0);
    const messages = (await call(`circle/chats/${alice.user.id}/messages`, bob.token)).body.messages;
    assert.equal((await call(`circle/chats/${alice.user.id}/read`, bob.token, { lastId: messages.at(-1).id }, 'PUT')).status, 200);
    assert.equal((await call('circle/chats', bob.token)).body.chats.find((peer) => peer.id === alice.user.id).unreadCount, 0);
    assert.equal((await call(`circle/chats/${alice.user.id}/read`, bob.token, { lastId: messages[0].id }, 'PUT')).status, 200);
    assert.equal((await call('circle/chats', bob.token)).body.chats.find((peer) => peer.id === alice.user.id).unreadCount, 0);
    assert.equal((await call(`circle/chats/${bob.user.id}/read`, cara.token, { lastId: messages.at(-1).id }, 'PUT')).status, 403);
  });
});
