const { testDatabaseOptions, inspectDatabase, cleanupTestDatabase } = require('./test-database.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { fixture } = require('./test-support.cjs');

test('safety timers, presets and temporary guest links protect accounts and access', async (t) => {
  let time = Date.now();
  const f = await fixture(t, { now: () => time });
  const { call, user, service } = f;
  const owner = await user('tools-owner'),peer = await user('tools-peer'),stranger = await user('tools-stranger');
  const added = await call('circle/contacts', owner.token, { email: peer.user.email });
  const contactId = added.body.people.find((person) => person.peerId === peer.user.id).id;
  await call(`circle/invitations/${owner.user.id}/respond`, peer.token, { decision: 'accepted' });
  await call('circle/selection', owner.token, { primaryId: contactId, backupIds: [] }, 'PUT');
  const messages = async () => (await call(`circle/chats/${owner.user.id}/messages`, peer.token)).body.messages;

  await t.test('timer validates recipients, starts once and alerts once without a foreground client', async () => {
    assert.equal((await call('safety/timers', null, { clientId: 'timer_unauth', minutes: 15, contactIds: [contactId] })).status, 401);
    for (const body of [{ minutes: 0, contactIds: [contactId] }, { minutes: 15, contactIds: ['foreign-contact'] }, { minutes: 15, contactIds: [contactId, contactId] }]) {
      assert.equal((await call('safety/timers', owner.token, { clientId: 'timer_invalid', ...body })).status, 400);
    }
    const body = { clientId: 'timer_valid_001', minutes: 15, contactIds: [contactId] };
    const started = await call('safety/timers', owner.token, body);
    assert.equal(started.status, 201);
    const id = started.body.timer.id;
    assert.equal((await call('safety/timers', owner.token, body)).body.timer.id, id);
    assert.equal((await messages()).filter((item) => item.text.includes('включена проверка')).length, 1);
    assert.equal((await call(`safety/timers/${id}/action`, stranger.token, { action: 'confirm', clientId: 'timer_stolen_01' })).status, 404);
    time += 15 * 60000;
    await service.processDueJourneys();
    assert.equal((await messages()).filter((item) => item.text.startsWith('SOS — проверка')).length, 0);
    time += 60000;
    await service.processDueJourneys();await service.processDueJourneys();
    assert.equal((await messages()).filter((item) => item.text.startsWith('SOS — проверка')).length, 1);
    const confirmed = await call(`safety/timers/${id}/action`, owner.token, { action: 'confirm', clientId: 'timer_confirm_001' });
    assert.equal(confirmed.body.timer.status, 'confirmed');
    assert.equal((await call('safety/state', owner.token)).body.timer, null);
  });
  await t.test('extension is idempotent and cancellation prevents the alert', async () => {
    const started = await call('safety/timers', owner.token, { clientId: 'timer_valid_002', minutes: 15, contactIds: [contactId] });
    const timer = started.body.timer;
    for (let n = 0; n < 2; n++) assert.equal((await call(`safety/timers/${timer.id}/action`, owner.token, { action: 'extend', clientId: 'timer_extend_001' })).status, 200);
    assert.equal((await call('safety/state', owner.token)).body.timer.expectedAt, timer.expectedAt + 900000);
    await call(`safety/timers/${timer.id}/action`, owner.token, { action: 'cancel', clientId: 'timer_cancel_001' });
    time += 31 * 60000;await service.processDueJourneys();
    assert.equal((await messages()).filter((item) => item.text.startsWith('SOS — проверка')).length, 1);
  });
  await t.test('saved presets are isolated and apply validated settings together', async () => {
    const config = { minutes: 30, sharing: true, primaryId: contactId, backupIds: [] };
    assert.equal((await call('safety/presets/taxi', owner.token, config, 'PUT')).status, 200);
    assert.equal((await call('safety/state', stranger.token)).body.presets.length, 0);
    assert.equal((await call('safety/presets/taxi/apply', stranger.token, {})).status, 404);
    const applied = await call('safety/presets/taxi/apply', owner.token, {});
    assert.equal(applied.body.preset.minutes, 30);
    assert.equal((await call('safety/state', owner.token)).body.appliedPreset.slot, 'taxi');
    assert.equal((await call('journeys/state', owner.token)).body.preferences.sharing, true);
    assert.equal((await call('safety/presets/walk', owner.token, { ...config, backupIds: [contactId] }, 'PUT')).status, 400);
  });
  let trip;
  const point = { name: 'Дом', latitude: 43.24, longitude: 76.93 };
  async function startJourney(key) {
    const started = await call('journeys', owner.token, { clientId: key, origin: point, target: { ...point, name: 'Парк' }, transport: 'walk', minutes: 15, accompanied: true, route: { distance: 1000, duration: 900, coordinates: [point, point] } });
    assert.equal(started.status, 201);
    const journey = started.body.journey;
    await call(`journeys/${journey.id}/respond`, peer.token, { decision: 'accepted' });
    return journey;
  }
  const guest = async (token) => {
    const response = await fetch(f.base.replace('/api/auth/', '') + '/api/public/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  await t.test('guest access needs an explicit token and exposes no private account or contact details', async () => {
    const page = await fetch(f.base.replace('/api/auth/', '') + '/share');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.doesNotMatch(page.headers.get('content-security-policy'), /upgrade-insecure-requests/);
    trip = await startJourney('guest_trip_0001');
    assert.equal((await call('safety/links', stranger.token, { journeyId: trip.id, minutes: 15 })).status, 400);
    assert.equal((await call('safety/presets/taxi/apply', owner.token, {})).status, 409);
    const created = await call('safety/links', owner.token, { journeyId: trip.id, minutes: 15 });
    assert.equal(created.status, 201);
    const token = created.body.link.path.split('#')[1];
    assert.equal(token.length, 43);
    const result = await guest(token);
    assert.equal(result.status, 200);assert.equal(result.body.target.name, 'Парк');
    assert.deepEqual(Object.keys(result.body).sort(), ['expectedAt', 'expiresAt', 'position', 'target']);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal((await guest('invalid')).status, 404);
    const db = await inspectDatabase(f.databasePath);
    try {assert.notEqual((await db.prepare('SELECT token_hash FROM journey_links WHERE id = ?').get(created.body.link.id)).token_hash, token);} finally {await db.close();}
    assert.equal((await call(`safety/links/${created.body.link.id}`, stranger.token, {}, 'DELETE')).status, 404);
    await call(`safety/links/${created.body.link.id}`, owner.token, {}, 'DELETE');
    assert.equal((await guest(token)).status, 404);
  });
  await t.test('turning sharing off permanently revokes links, and completion closes every link', async () => {
    const first = await call('safety/links', owner.token, { journeyId: trip.id, minutes: 15 });
    const token = first.body.link.path.split('#')[1];
    await call('journeys/preferences', owner.token, { sharing: false }, 'PUT');
    assert.equal((await guest(token)).status, 404);
    await call('journeys/preferences', owner.token, { sharing: true }, 'PUT');
    assert.equal((await guest(token)).status, 404);
    const second = await call('safety/links', owner.token, { journeyId: trip.id, minutes: 15 });
    await call(`journeys/${trip.id}/action`, owner.token, { action: 'arrive', clientId: 'guest_arrive_001' });
    assert.equal((await guest(second.body.link.path.split('#')[1])).status, 404);
  });
  await t.test('time expiry and contact blocking prevent later access or alerts', async () => {
    const journey = await startJourney('guest_trip_0002');
    const created = await call('safety/links', owner.token, { journeyId: journey.id, minutes: 15 });
    time += 15 * 60000;
    assert.equal((await guest(created.body.link.path.split('#')[1])).status, 404);
    await call(`journeys/${journey.id}/action`, owner.token, { action: 'cancel', clientId: 'guest_cancel_001' });
    await call('safety/timers', owner.token, { clientId: 'timer_block_001', minutes: 15, contactIds: [contactId] });
    const before = (await messages()).filter((item) => item.text.startsWith('SOS — проверка')).length;
    await call(`circle/blocks/${owner.user.id}`, peer.token, {});
    time += 16 * 60000;await service.processDueJourneys();
    const db = await inspectDatabase(f.databasePath);
    try {assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE text LIKE 'SOS — проверка%'").get()).n, before);} finally {await db.close();}
    assert.equal((await call('safety/presets/taxi/apply', owner.token, {})).status, 409);
  });
});
