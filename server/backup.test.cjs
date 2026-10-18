const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { fixture } = require('./test-support.cjs');
const { createBackup } = require('../scripts/backup.cjs');

test('online backup restores a consistent database including live WAL data', async t => {
  const { user, databasePath } = await fixture(t, { sqliteOnly: true });
  const account = await user('backup');
  const destination = `${databasePath}.backup`;
  try {
    await createBackup(databasePath, destination);
    const restored = new DatabaseSync(destination, { readOnly: true });
    assert.equal(restored.prepare('SELECT email FROM users').get().email, account.user.email);
    assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
    assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    restored.close();
  } finally { if (fs.existsSync(destination)) fs.unlinkSync(destination); }
});
