const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./test-support.cjs');
const { inspectDatabase } = require('./test-database.cjs');

test('contact links require confirmation, expire, revoke, and can be claimed by only one account', async t => {
  let time = Date.now();
  const { call, user, databasePath } = await fixture(t, { now: () => time });
  const alice = await user('link-alice'), bob = await user('link-bob'), eve = await user('link-eve');
  const make = async () => {
    const result = await call('circle/links', alice.token, {});
    assert.equal(result.status, 201);
    return result.body.link;
  };
  const link = await make();
  assert.equal((await call('circle/links/preview', null, { token: link.token })).status, 401);
  const preview = await call('circle/links/preview', bob.token, { token: link.token });
  assert.equal(preview.body.invitation.name, alice.user.name);
  assert.equal(preview.body.invitation.email, undefined);
  assert.equal((await call('circle/contacts', bob.token)).body.people.length, 0);
  assert.equal((await call('circle/links/accept', alice.token, { token: link.token })).status, 400);
  assert.equal((await call(`circle/links/${link.id}`, bob.token, {}, 'DELETE')).status, 404);
  const claims = await Promise.all([bob, eve].map(person => call('circle/links/accept', person.token, { token: link.token })));
  assert.deepEqual(claims.map(result => result.status).sort(), [200, 404]);
  const winner = claims[0].status === 200 ? bob : eve;
  assert.equal((await call('circle/links/accept', winner.token, { token: link.token })).status, 200);
  assert.equal((await call('circle/contacts', winner.token)).body.people[0].connectionStatus, 'accepted');
  assert.equal((await call('circle/contacts', alice.token)).body.people[0].peerId, winner.user.id);
  assert.equal((await call('circle/links', alice.token)).body.links.length, 0);
  const db = await inspectDatabase(databasePath);
  try { assert.notEqual((await db.prepare('SELECT token_hash FROM contact_links WHERE id = ?').get(link.id)).token_hash, link.token); }
  finally { await db.close(); }
  const revoked = await make();
  await call(`circle/links/${revoked.id}`, alice.token, {}, 'DELETE');
  assert.equal((await call('circle/links/accept', bob.token, { token: revoked.token })).status, 404);
  const expired = await make();
  time += 86400001;
  assert.equal((await call('circle/links/preview', bob.token, { token: expired.token })).status, 404);
  assert.equal((await call('circle/links/accept', bob.token, { token: expired.token })).status, 404);
  const blocked = await make();
  await call(`circle/blocks/${alice.user.id}`, bob.token, {});
  assert.equal((await call('circle/links/accept', bob.token, { token: blocked.token })).status, 404);
  assert.equal((await call('circle/links/preview', bob.token, { token: 'invalid' })).status, 404);
});
