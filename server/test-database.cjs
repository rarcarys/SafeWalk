const { createHash } = require('node:crypto');
const { openDatabase } = require('./database.cjs');
function testDatabaseOptions(databasePath) {
  const databaseUrl = process.env.SAFEWALK_TEST_DATABASE_URL;
  return databaseUrl ? { databaseUrl, databaseSchema: 'sw_test_' + createHash('sha256').update(databasePath).digest('hex').slice(0, 24) } : {};
}
const inspectDatabase = databasePath => openDatabase({ databasePath, ...testDatabaseOptions(databasePath) });
async function cleanupTestDatabase(databasePath) {
  const { databaseUrl, databaseSchema } = testDatabaseOptions(databasePath);
  if (!databaseUrl) return;
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  try { await client.connect(); await client.query(`DROP SCHEMA IF EXISTS "${databaseSchema}" CASCADE`); }
  finally { await client.end(); }
}
module.exports = { testDatabaseOptions, inspectDatabase, cleanupTestDatabase };
