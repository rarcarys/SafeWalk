const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createActionSOSProcessor } = require('../src/services/actionSOSCore.cjs');

function fixture(overrides = {}) {
  let pending = { id: 'action_test-uuid', ownerId: 'alice', createdAt: 1000, ...overrides };
  const sent = [], results = [], errors = [];
  const bridge = {
    pendingRequest: () => pending,
    acknowledge: id => { if (pending?.id === id) pending = null; },
  };
  const processPending = createActionSOSProcessor(bridge);
  const options = {
    ownerId: 'alice', ready: true, active: true, now: 2000,
    sendSOS: async body => { sent.push(body); return { sentCount: 2 }; },
    onResult: result => results.push(result),
    onError: error => errors.push(error.message),
  };
  return { processPending, options, bridge, sent, results, errors };
}

test('a cold-start request waits for account loading and foreground, then sends only once', async () => {
  const f = fixture();
  await f.processPending({ ...f.options, ready: false });
  await f.processPending({ ...f.options, active: false });
  assert.equal(f.sent.length, 0);
  await f.processPending(f.options);
  await f.processPending(f.options);
  assert.deepEqual(f.sent, [{ clientId: 'action_test-uuid', includeLocation: false }]);
  assert.equal(f.results.length, 1);
});

test('does not send commands for another account, stale commands or invalid identifiers', async () => {
  for (const overrides of [{ ownerId: 'bob' }, { createdAt: -120000 }, { createdAt: 3000 }, { id: '../bad' }]) {
    const f = fixture(overrides);
    await f.processPending(f.options);
    assert.equal(f.sent.length, 0);
    assert.equal(f.errors.length, 1);
    assert.equal(f.bridge.pendingRequest(), null);
  }
});

test('concurrent foreground and timer checks do not duplicate a request', async () => {
  const f = fixture();
  let finish;
  f.options.sendSOS = body => {
    f.sent.push(body);
    return new Promise(resolve => { finish = resolve; });
  };
  const first = f.processPending(f.options);
  await f.processPending(f.options);
  assert.equal(f.sent.length, 1);
  finish({ sentCount: 2 });
  await first;
});

test('offline queue results are reported as queued rather than delivered', async () => {
  const f = fixture();
  f.options.sendSOS = async () => ({ queued: true });
  await f.processPending(f.options);
  assert.deepEqual(f.results, [{ queued: true }]);
  assert.equal(f.bridge.pendingRequest(), null);
});

test('server rejection is shown without retrying repeatedly', async () => {
  const f = fixture();
  f.options.sendSOS = async body => { f.sent.push(body); throw new Error('No contacts'); };
  await f.processPending(f.options);
  await f.processPending(f.options);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.errors, ['No contacts']);
});

test('an acknowledgement failure does not resend an accepted SOS', async () => {
  const f = fixture();
  f.bridge.acknowledge = () => { throw new Error('native failure'); };
  await f.processPending(f.options);
  await f.processPending(f.options);
  assert.equal(f.sent.length, 1);
  assert.equal(f.results.length, 1);
  assert.equal(f.errors.length, 0);
});
