const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { fixture } = require('./test-support.cjs');
const { inspectDatabase, testDatabaseOptions } = require('./test-database.cjs');
const { createAuthService } = require('./auth.cjs');
const { once } = require('node:events');

test('avatars are validated, account scoped, normalized and persist across service restarts', async t => {
  const { call, user, databasePath } = await fixture(t);
  const owner = await user('avatar-owner'), peer = await user('avatar-peer');
  assert.equal((await call('account/avatar', null, { avatar: 'preset:sun' }, 'PUT')).status, 401);
  await call('circle/contacts', peer.token, { email: owner.user.email });
  assert.equal((await call('account/avatar', owner.token, { avatar: 'preset:moon' }, 'PUT')).body.user.avatar, 'preset:moon');
  assert.equal((await call('circle/contacts', peer.token)).body.people[0].avatar, 'preset:moon');
  assert.equal((await call('me', peer.token)).body.user.avatar, null);
  for (const avatar of ['preset:unknown', 'https://example.com/avatar.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJj', 42, undefined]) {
    assert.equal((await call('account/avatar', owner.token, { avatar }, 'PUT')).status, 400);
  }
  const image = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#71b8a0' } }).png().withMetadata({ exif: { IFD0: { Artist: 'Private metadata' } } }).toBuffer();
  const stored = (await call('account/avatar', owner.token, { avatar: `data:image/png;base64,${image.toString('base64')}` }, 'PUT')).body.user.avatar;
  const metadata = await sharp(Buffer.from(stored.split(',')[1], 'base64')).metadata();
  assert.equal(metadata.width, 256); assert.equal(metadata.height, 256); assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.exif, undefined);
  const db = await inspectDatabase(databasePath);
  assert.equal((await db.prepare('SELECT avatar FROM users WHERE id = ?').get(owner.user.id)).avatar, stored);
  await db.close();
  const reopened = await createAuthService({ databasePath, ...testDatabaseOptions(databasePath), backgroundJobs: false });
  const server = reopened.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const me = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`, { headers: { Authorization: `Bearer ${owner.token}` } });
    assert.equal((await me.json()).user.avatar, stored);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await reopened.close(); }
  assert.equal((await call('login', null, { email: owner.user.email, password: 'test-password-2026' })).body.user.avatar, stored);
  assert.equal((await call('account/avatar', owner.token, { avatar: null }, 'PUT')).body.user.avatar, null);
  assert.equal((await call('circle/contacts', peer.token)).body.people[0].avatar, null);
});
