const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./test-support.cjs');

test('chat clearing is personal, protects 24-hour alerts and preserves future messages', async t => {
  let time = Date.now() - 25 * 3600000;
  const { call, user } = await fixture(t, { now: () => time });
  const a = await user('clear-a'), b = await user('clear-b'), c = await user('clear-c');
  await call('circle/contacts', a.token, { email: b.user.email });
  await call(`circle/invitations/${a.user.id}/respond`, b.token, { decision: 'accepted' });
  const send = text => call(`circle/chats/${b.user.id}/messages`, a.token, { text, clientId: `clear_${time}_${text.length}` });
  const feed = async (owner, peer) => (await call(`circle/chats/${peer.user.id}/messages`, owner.token)).body;
  const clear = who => call(`circle/chats/${a.user.id}/messages`, who.token, {}, 'DELETE');
  await send('Old message');
  await call('journeys/sos/send', a.token, { clientId: 'clear_old_sos_01', includeLocation: false });
  time += 3600000;
  await call('journeys/sos/send', a.token, { clientId: 'clear_boundary_sos', includeLocation: false, note: '24-hour boundary' });
  time += 24 * 3600000;
  await call('journeys/sos/send', a.token, { clientId: 'clear_fresh_sos', includeLocation: false, note: 'Fresh alert' });
  const ordinary = (await send('New ordinary message')).body.message;
  assert.equal((await clear(c)).status, 403);
  assert.equal((await call(`circle/chats/${a.user.id}/messages`, null, {}, 'DELETE')).status, 401);
  const cleared = await clear(b);
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.cleared, 3);
  const remaining = await feed(b, a);
  assert.equal(remaining.messages.length, 2);
  assert.ok(remaining.messages.every(message => message.text.startsWith('SOS ')));
  assert.equal(remaining.visibilityVersion, 1);
  assert.equal((await feed(a, b)).messages.length, 5);
  assert.equal((await call('journeys/state', b.token)).body.unreadCount, 2);
  const chatList = (await call('circle/chats', b.token)).body.chats;
  assert.notEqual(chatList[0].lastMessage.id, ordinary.id);
  assert.equal(chatList[0].unreadCount, 2);
  assert.equal((await call('notifications/messages?after=0', b.token)).body.messages.length, 2);
  await send('Message after clearing');
  assert.equal((await feed(b, a)).messages.length, 3);
  time++;
  await clear(b);
  const afterBoundary = (await feed(b, a)).messages;
  assert.equal(afterBoundary.length, 1);
  assert.ok(afterBoundary[0].text.includes('Fresh alert'));
  assert.equal((await feed(a, b)).messages.length, 6);
});

test('recent delay, battery and SOS response messages are protected until the next clearing after 24 hours', async t => {
  let time = Date.now();
  const { call, user } = await fixture(t, { now: () => time });
  const a = await user('alert-clear-a'), b = await user('alert-clear-b');
  await call('circle/contacts', a.token, { email: b.user.email });
  await call(`circle/invitations/${a.user.id}/respond`, b.token, { decision: 'accepted' });
  for (const clientId of ['journey_trip_delay_peer', 'journey_trip_battery_peer', 'sos_ack_event_peer', 'sos_route_event_peer']) {
    assert.equal((await call(`circle/chats/${b.user.id}/messages`, a.token, { text: clientId, clientId })).status, 201);
  }
  const clear = () => call(`circle/chats/${a.user.id}/messages`, b.token, {}, 'DELETE');
  await clear();
  assert.equal((await call(`circle/chats/${a.user.id}/messages`, b.token)).body.messages.length, 4);
  time += 86400001;
  await clear();
  assert.equal((await call(`circle/chats/${a.user.id}/messages`, b.token)).body.messages.length, 0);
});
