const { testDatabaseOptions, inspectDatabase, cleanupTestDatabase } = require('./test-database.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { fixture } = require('./test-support.cjs');

test('account management, session revocation and single-use recovery', async (t) => {
  const { call, user, databasePath } = await fixture(t);
  const alice = await user('alice');
  const credentials = { email: alice.user.email, password: 'test-password-2026' };
  const other = (await call('login', null, credentials)).body;
  assert.equal((await call('account/profile', null, { name: 'Hacked' }, 'PATCH')).status, 401);
  assert.equal((await call('account/profile', alice.token, { name: 'Alice Updated' }, 'PATCH')).body.user.name, 'Alice Updated');
  assert.equal((await call('account/sessions', alice.token)).body.sessions.length, 2);
  assert.equal((await call('account/password', alice.token, { password: 'wrong', newPassword: 'new-password-2026' })).status, 403);
  assert.equal((await call('account/sessions/revoke-others', alice.token, { password: credentials.password })).status, 200);
  assert.equal((await call('me', other.token)).status, 401);
  const before = (await call('account/recovery-code', alice.token, { password: credentials.password })).body.code;
  const code = (await call('account/recovery-code', alice.token, { password: credentials.password })).body.code;
  const inspection = await inspectDatabase(databasePath);
  assert.notEqual((await inspection.prepare('SELECT code_hash FROM recovery_codes').get()).code_hash, code.replaceAll('-', ''));
  await inspection.close();
  assert.equal((await call('account/recover', null, { email: credentials.email, code: before, newPassword: 'new-password-2026' })).status, 403);
  assert.equal((await call('account/recover', null, { email: credentials.email, code, newPassword: 'new-password-2026' })).status, 200);
  assert.equal((await call('account/recover', null, { email: credentials.email, code, newPassword: 'new-password-2026' })).status, 403);
  assert.equal((await call('me', alice.token)).status, 401);
  assert.equal((await call('login', null, credentials)).status, 401);
  const recovered = (await call('login', null, { ...credentials, password: 'new-password-2026' })).body;
  assert.equal((await call('account/password', recovered.token, { password: 'new-password-2026', newPassword: 'changed-password-2026' })).status, 200);
  assert.equal((await call('account/delete', recovered.token, { password: 'changed-password-2026', confirmation: 'wrong' })).status, 400);
  assert.equal((await call('account/delete', recovered.token, { password: 'changed-password-2026', confirmation: 'DELETE' })).status, 200);
  assert.equal((await call('me', recovered.token)).status, 401);
  const inspect = await inspectDatabase(databasePath);
  assert.equal((await inspect.prepare('SELECT COUNT(*) AS n FROM users').get()).n, 0);
  await inspect.close();
});
