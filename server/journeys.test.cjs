const { testDatabaseOptions, inspectDatabase, cleanupTestDatabase } = require('./test-database.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAuthService } = require('./auth.cjs');

test('journey lifecycle, privacy and server escalation work across sessions', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'safewalk-journeys-'));
  const databasePath = path.join(directory, 'accounts.sqlite');
  let time = Date.now();
  let service, server, base;
  async function start() {
    service = await createAuthService({ ...testDatabaseOptions(databasePath), databasePath, now: () => time, loginLimit: 100 });
    server = service.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api/auth`;
  }
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await service.close();
  }
  await start();
  t.after(async () => {await stop();await cleanupTestDatabase(databasePath);fs.rmSync(directory, { recursive: true });});
  async function call(endpoint, token, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(`${base}/${endpoint}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-SafeWalk-Client': 'native', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = { status: response.status, body: await response.json() };
    // These regression cases exercise an already accepted accompaniment.
    // The invitation/pending boundary is covered separately in consent.test.cjs.
    if (endpoint === 'journeys' && result.body.journey?.status === 'pending') {
      for (const person of [bob, cara]) {
        if (result.body.journey.recipients.some((recipient) => recipient.peerId === person.user.id))
        await call(`journeys/${result.body.journey.id}/respond`, person.token, { decision: 'accepted' });
      }
      result.body.journey = (await call('journeys/state', token)).body.active;
    }
    return result;
  }
  async function register(name, email) {
    const result = await call('register', null, { name, email, password: 'journey-passphrase-2026' });
    assert.equal(result.status, 201);
    return result.body;
  }
  const alice = await register('Алия', 'alice@example.com');
  const bob = await register('Бек', 'bob@example.com');
  const cara = await register('Карина', 'cara@example.com');
  const outsider = await register('Другой', 'outsider@example.com');
  const contacts = [];
  for (const peer of [bob, cara]) {
    const result = await call('circle/contacts', alice.token, { email: peer.user.email });
    assert.equal(result.status, 201);
    contacts.push(result.body.people.find((person) => person.peerId === peer.user.id).id);
    assert.equal((await call(`circle/invitations/${alice.user.id}/respond`, peer.token, { decision: 'accepted' })).status, 200);
  }
  await call('circle/selection', alice.token, { primaryId: contacts[0], backupIds: [contacts[1]] }, 'PUT');
  const origin = { name: 'Старт', latitude: 43.24, longitude: 76.93 };
  const target = { name: 'Дом', latitude: 43.25, longitude: 76.94 };
  const payload = (key) => ({ clientId: key, origin, target, transport: 'walk', minutes: 10, accompanied: true, route: { distance: 1500, duration: 600, coordinates: [origin, target] } });
  const state = async (who) => (await call('journeys/state', who.token)).body;
  const messages = async (who) => (await call(`circle/chats/${alice.user.id}/messages`, who.token)).body.messages;
  const delays = async (who) => (await messages(who)).filter((message) => message.text.includes('ещё не подтвердил'));
  let trip;
  await t.test('authentication, validated inputs and preferences are account scoped', async () => {
    assert.equal((await call('journeys/state')).status, 401);
    assert.equal((await call('journeys', alice.token, { ...payload('invalid_point'), target: { ...target, latitude: 200 } })).status, 400);
    assert.equal((await call('journeys/preferences', alice.token, { sharing: 'yes' }, 'PUT')).status, 400);
    assert.equal((await call('journeys/preferences', alice.token, { unknown: true }, 'PUT')).status, 400);
    assert.equal((await call('journeys/preferences', alice.token, { sharing: true }, 'PUT')).status, 200);
    assert.equal((await state(bob)).preferences.sharing, false);
    assert.equal((await call('journeys/places/home', alice.token, target, 'PUT')).status, 200);
    assert.equal((await call('journeys/places/other', alice.token, target, 'PUT')).status, 400);
    assert.equal((await state(bob)).places.length, 0);
  });
  await t.test('start is idempotent, rejects simultaneous trips and restores after a server restart', async () => {
    const started = await call('journeys', alice.token, payload('first_journey'));
    assert.equal(started.status, 201);
    trip = started.body.journey;
    assert.equal(trip.recipients.length, 2);
    assert.equal(trip.sharing, true);
    assert.equal((await call('journeys', alice.token, payload('first_journey'))).body.journey.id, trip.id);
    assert.equal((await call('journeys', alice.token, payload('second_journey'))).status, 409);
    assert.equal((await messages(bob)).filter((message) => message.senderId === alice.user.id).length, 1);
    await stop();await start();
    assert.equal((await state(alice)).active.id, trip.id);
    assert.equal((await state(alice)).places[0].name, 'Дом');
    assert.equal((await state(alice)).preferences.sharing, true);
  });
  await t.test('only selected recipients see the trip and turning sharing off revokes coordinates', async () => {
    const position = { latitude: 43.245, longitude: 76.935, accuracy: 8 };
    assert.equal((await call(`journeys/${trip.id}/position`, alice.token, position, 'PUT')).status, 200);
    let shared = (await state(bob)).received[0];
    assert.equal(shared.position.latitude, position.latitude);
    assert.equal(shared.route.coordinates.length, 2);
    assert.equal(shared.recipients, undefined);
    assert.deepEqual((await state(outsider)).received, []);
    assert.equal((await call(`journeys/${trip.id}/position`, bob.token, position, 'PUT')).status, 404);
    assert.equal((await call(`journeys/${trip.id}/action`, bob.token, { action: 'cancel', clientId: 'foreign_cancel' })).status, 404);
    assert.equal((await call(`journeys/${trip.id}/acknowledge`, outsider.token, {})).status, 404);
    await call('journeys/preferences', alice.token, { sharing: false }, 'PUT');
    shared = (await state(bob)).received[0];
    assert.equal(shared.target.latitude, undefined);
    assert.equal(shared.origin.longitude, undefined);
    assert.equal(shared.route.coordinates, undefined);
    assert.equal(shared.position, null);
    assert.equal(shared.target.name, 'Дом');
    assert.equal((await call(`journeys/${trip.id}/position`, alice.token, position, 'PUT')).status, 409);
    await call('journeys/preferences', alice.token, { sharing: true }, 'PUT');
    assert.equal((await state(bob)).received[0].position, null);
  });
  await t.test('primary and backup delay messages are scheduled once without the sender being online', async () => {
    time = trip.expectedAt + 5 * 60000 - 1;
    await service.processDueJourneys();
    assert.equal((await delays(bob)).length, 0);
    time++;
    await service.processDueJourneys();await service.processDueJourneys();
    assert.equal((await delays(bob)).length, 1);
    assert.equal((await delays(cara)).length, 0);
    time = trip.expectedAt + 10 * 60000;
    await service.processDueJourneys();await service.processDueJourneys();
    assert.equal((await delays(cara)).length, 1);
    await stop();await start();
    await service.processDueJourneys();
    assert.equal((await delays(bob)).length, 1);
    assert.equal((await delays(cara)).length, 1);
  });
  await t.test('extension and arrival are idempotent and finishing clears live location', async () => {
    const extension = { action: 'extend', clientId: 'extend_first_trip' };
    const extended = await call(`journeys/${trip.id}/action`, alice.token, extension);
    assert.equal(extended.body.journey.expectedAt, trip.expectedAt + 300000);
    assert.equal((await call(`journeys/${trip.id}/action`, alice.token, extension)).body.journey.extraMinutes, 5);
    assert.equal((await call(`journeys/${trip.id}/action`, alice.token, { ...extension, action: 'cancel' })).status, 409);
    const arrive = { action: 'arrive', clientId: 'arrive_first_trip' };
    assert.equal((await call(`journeys/${trip.id}/action`, alice.token, arrive)).body.journey.status, 'arrived');
    assert.equal((await call(`journeys/${trip.id}/action`, alice.token, arrive)).body.journey.status, 'arrived');
    const current = await state(alice);
    assert.equal(current.active, null);
    assert.equal(current.history[0].id, trip.id);
    assert.equal(current.history[0].route.coordinates, undefined);
    assert.equal((await state(bob)).received[0].position, null);
    assert.equal((await call(`journeys/${trip.id}/acknowledge`, bob.token, {})).status, 404);
  });
  await t.test('primary acknowledgement suppresses escalation and deletion revokes trip access', async () => {
    trip = (await call('journeys', alice.token, payload('ack_journey'))).body.journey;
    const previousCount = (await messages(bob)).length;
    assert.equal((await call(`journeys/${trip.id}/acknowledge`, bob.token, {})).status, 200);
    assert.equal((await call(`journeys/${trip.id}/acknowledge`, bob.token, {})).status, 200);
    assert.equal((await messages(bob)).length, previousCount + 1);
    time = trip.expectedAt + 11 * 60000;
    await service.processDueJourneys();
    assert.equal((await delays(bob)).length, 1);
    assert.equal((await delays(cara)).length, 1);
    assert.equal((await call(`circle/contacts/${contacts[1]}`, alice.token, {}, 'DELETE')).status, 200);
    assert.deepEqual((await state(cara)).received, []);
    assert.equal((await call(`journeys/${trip.id}/acknowledge`, cara.token, {})).status, 404);
    await call(`journeys/${trip.id}/action`, alice.token, { action: 'cancel', clientId: 'cancel_ack_trip' });
    assert.equal((await state(alice)).history[0].status, 'cancelled');
  });
  await t.test('phone-only contacts cannot receive accompaniment, but solo journeys remain available', async () => {
    const added = await call('circle/contacts', alice.token, { name: 'Телефон', phone: '+77011234567' });
    const phone = added.body.people.find((person) => !person.peerId);
    await call('circle/selection', alice.token, { primaryId: phone.id, backupIds: [contacts[0]] }, 'PUT');
    assert.equal((await call('journeys', alice.token, payload('phone_journey'))).status, 400);
    const solo = await call('journeys', alice.token, { ...payload('solo_journey'), accompanied: false });
    assert.equal(solo.status, 201);
    assert.deepEqual(solo.body.journey.recipients, []);
    assert.equal(solo.body.journey.sharing, false);
    time = solo.body.journey.expectedAt + 20 * 60000;
    await service.processDueJourneys();
    assert.equal((await delays(bob)).length, 1);
    await call(`journeys/${solo.body.journey.id}/action`, alice.token, { action: 'cancel', clientId: 'cancel_solo_trip' });
  });
  await t.test('SOS sends to selected accounts, reports phone contacts and does not duplicate on retry', async () => {
    const count = (await messages(bob)).length;
    const body = { clientId: 'sos_without_location', includeLocation: false };
    const result = await call('journeys/sos/send', alice.token, body);
    assert.equal(result.status, 201);
    assert.equal(result.body.sentCount, 1);
    assert.deepEqual(result.body.skippedNames, ['Телефон']);
    assert.equal((await messages(bob)).at(-1).text.includes('openstreetmap'), false);
    assert.deepEqual((await call('journeys/sos/send', alice.token, body)).body, result.body);
    assert.equal((await messages(bob)).length, count + 1);
    assert.equal((await call('journeys/sos/send', alice.token, { clientId: 'sos_bad_location', includeLocation: true })).status, 400);
    const locationSOS = await call('journeys/sos/send', alice.token, { clientId: 'sos_with_location', includeLocation: true, position: origin });
    assert.equal(locationSOS.status, 201);
    assert.match((await messages(bob)).at(-1).text, /https:\/\/www\.openstreetmap\.org/);
    assert.equal((await state(bob)).unreadCount > 0, true);
    await call('journeys/places/home', alice.token, {}, 'DELETE');
    assert.deepEqual((await state(alice)).places, []);
  });
});
