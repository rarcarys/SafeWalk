const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./test-support.cjs');

test('configurable check-in, SOS escalation, low battery and favorite routes', async t => {
  let time = Date.now();
  const { call, user, service } = await fixture(t, { now: () => time });
  const owner = await user('safety-owner'), primary = await user('safety-primary'), backup = await user('safety-backup');
  const ids = [];
  for (const person of [primary, backup]) {
    const added = await call('circle/contacts', owner.token, { email: person.user.email });
    ids.push(added.body.people.find(item => item.peerId === person.user.id).id);
    await call(`circle/invitations/${owner.user.id}/respond`, person.token, { decision: 'accepted' });
  }
  await call('circle/selection', owner.token, { primaryId: ids[0], backupIds: [ids[1]] }, 'PUT');
  const state = async who => (await call('journeys/state', who.token)).body;
  const messages = async who => (await call(`circle/chats/${owner.user.id}/messages`, who.token)).body.messages;
  const origin = { latitude: 43.24, longitude: 76.93, name: 'Старт' };
  const target = { latitude: 43.25, longitude: 76.94, name: 'Учёба' };
  let trip;
  await t.test('timings and saved plans validate input and isolate accounts', async () => {
    for (const value of [0, -1, 2, '5', 99]) assert.equal((await call('journeys/preferences', owner.token, { delayMinutes: value }, 'PUT')).status, 400);
    const result = await call('journeys/preferences', owner.token, { delayMinutes: 1, escalationMinutes: 3 }, 'PUT');
    assert.equal(result.body.preferences.delayMinutes, 1);
    assert.equal((await state(primary)).preferences.delayMinutes, 5);
    assert.equal((await call('journeys/places/study', owner.token, target, 'PUT')).status, 200);
    assert.equal((await call('journeys/favorites/study', owner.token, { origin, target, transport: 'walk' }, 'PUT')).status, 200);
    assert.equal((await call('journeys/favorites/home', owner.token, { origin, target: { ...target, latitude: 100 }, transport: 'walk' }, 'PUT')).status, 400);
    assert.equal((await state(owner)).favoriteRoutes[0].target.name, 'Учёба');
    assert.deepEqual((await state(primary)).favoriteRoutes, []);
    await call('journeys/favorites/study', primary.token, {}, 'DELETE');
    assert.equal((await state(owner)).favoriteRoutes.length, 1);
  });
  await t.test('server waits for configured grace and arrival stops further escalation', async () => {
    const created = await call('journeys', owner.token, { clientId: 'safety_trip_001', origin, target, transport: 'walk', minutes: 1, accompanied: true, route: { distance: 1000, duration: 60, coordinates: [origin, target] } });
    trip = created.body.journey;
    for (const person of [primary, backup]) await call(`journeys/${trip.id}/respond`, person.token, { decision: 'accepted' });
    trip = (await state(owner)).active;
    time = trip.expectedAt;
    await service.processDueJourneys();
    assert.equal((await messages(primary)).filter(item => item.text.includes('ещё не подтвердил')).length, 0);
    time += 60000;
    await service.processDueJourneys(); await service.processDueJourneys();
    assert.equal((await messages(primary)).filter(item => item.text.includes('ещё не подтвердил')).length, 1);
    assert.equal((await messages(backup)).filter(item => item.text.includes('ещё не подтвердил')).length, 0);
    assert.equal((await call(`journeys/${trip.id}/low-battery`, backup.token, { level: 15 })).status, 404);
    assert.equal((await call(`journeys/${trip.id}/low-battery`, owner.token, { level: 50 })).status, 400);
    for (let n = 0; n < 2; n++) assert.equal((await call(`journeys/${trip.id}/low-battery`, owner.token, { level: 15 })).status, 200);
    assert.equal((await messages(primary)).filter(item => item.text.includes('заряд телефона')).length, 1);
    assert.equal((await messages(backup)).filter(item => item.text.includes('заряд телефона')).length, 1);
    const arrived = await call(`journeys/${trip.id}/action`, owner.token, { action: 'arrive', clientId: 'safety_arrive_001' });
    assert.equal(arrived.body.journey.status, 'arrived');
    time += 10 * 60000;
    await service.processDueJourneys();
    assert.equal((await messages(backup)).filter(item => item.text.includes('ещё не подтвердил')).length, 0);
    assert.equal((await messages(primary)).filter(item => item.text.startsWith('safety-owner подтвердил(а) прибытие')).length, 1);
    assert.equal((await call(`journeys/${trip.id}/low-battery`, owner.token, { level: 10 })).status, 404);
  });
  await t.test('unconfirmed SOS repeats once to reserves, acknowledgement stops the next SOS escalation', async () => {
    await call('journeys/sos/send', owner.token, { clientId: 'safety_sos_001', includeLocation: false });
    time += 3 * 60000 - 1;
    await service.processDueJourneys();
    assert.equal((await messages(backup)).filter(item => item.text.includes('повторная тревога')).length, 0);
    time++;
    await service.processDueJourneys(); await service.processDueJourneys();
    assert.equal((await messages(backup)).filter(item => item.text.includes('повторная тревога')).length, 1);
    await call('journeys/sos/send', owner.token, { clientId: 'safety_sos_002', includeLocation: false });
    await call(`journeys/sos/${owner.user.id}/safety_sos_002/acknowledge`, primary.token, {});
    time += 4 * 60000;
    await service.processDueJourneys();
    assert.equal((await messages(backup)).filter(item => item.text.includes('повторная тревога')).length, 1);
  });
  await t.test('deleting favorites and places is scoped to the owner', async () => {
    await call('journeys/favorites/study', owner.token, {}, 'DELETE');
    await call('journeys/places/study', owner.token, {}, 'DELETE');
    assert.deepEqual((await state(owner)).favoriteRoutes, []);
    assert.deepEqual((await state(owner)).places, []);
  });
});
