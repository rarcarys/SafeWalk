const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkExpoAccount, expoEnvironment } = require('./expo-account.cjs');

test('checks the account online even when the parent has offline mode enabled', async () => {
  const original = { EXPO_OFFLINE: '1', EXPO_TOKEN: 'test-token' };
  assert.equal(expoEnvironment(original).EXPO_OFFLINE, '0');
  assert.equal(expoEnvironment(original).EXPO_TOKEN, 'test-token');
  assert.equal(original.EXPO_OFFLINE, '1');
  const username = await checkExpoAccount((file, args, options, done) => {
    assert.equal(file, process.execPath);
    assert.equal(args.at(-1), 'whoami');
    assert.equal(options.env.EXPO_OFFLINE, '0');
    assert.equal(options.timeout, 20000);
    done(null, 'rarcarys\n', '');
  });
  assert.equal(username, 'rarcarys');
});

test('reports missing login with a command to sign in', async () => {
  await assert.rejects(checkExpoAccount((file, args, options, done) => {
    done(new Error('exit 1'), 'Not logged in\n', '');
  }), /expo login --browser/);
});

test('does not mistake a connection failure or timeout for a missing login', async () => {
  for (const failure of [new Error('network failed'), Object.assign(new Error('timeout'), { killed: true })]) {
    await assert.rejects(checkExpoAccount((file, args, options, done) => {
      done(failure, '', 'private error details');
    }), error => {
      assert.match(error.message, /интернет и VPN/);
      assert.doesNotMatch(error.message, /private error details|expo login/);
      return true;
    });
  }
});
