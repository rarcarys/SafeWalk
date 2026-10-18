const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./test-support.cjs');

test('history retention removes only completed walks belonging to the owner', async t => {
  let time = Date.now();
  const { call, user, service } = await fixture(t, { now: () => time });
  const alice = await user('retention'), bob = await user('other');
  const origin = { name: 'Start', latitude: 43, longitude: 76 }, target = { name: 'Home', latitude: 43.1, longitude: 76.1 };
  const plan = key => ({ clientId: key, origin, target, transport: 'walk', minutes: 10, accompanied: false, route: { distance: 1000, duration: 600, coordinates: [origin, target] } });
  const first = (await call('journeys', alice.token, plan('history_first'))).body.journey;
  await call(`journeys/${first.id}/action`, alice.token, { action: 'arrive', clientId: 'history_arrive' });
  const active = (await call('journeys', alice.token, plan('history_active'))).body.journey;
  await call('journeys', bob.token, plan('history_other'));
  assert.equal((await call('journeys/preferences', alice.token, { retentionDays: -1 }, 'PUT')).status, 400);
  await call('journeys/preferences', alice.token, { retentionDays: 1 }, 'PUT');
  time += 2 * 86400000;
  await service.processDueJourneys();
  const state = (await call('journeys/state', alice.token)).body;
  assert.deepEqual(state.history, []); assert.equal(state.active.id, active.id);
  assert.ok((await call('journeys/state', bob.token)).body.active);
});
