const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const { binary } = require('./postgres-local.cjs');
const execute = promisify(execFile);
function credentials(databaseUrl) {
  const url = new URL(databaseUrl);
  const password = decodeURIComponent(url.password);
  url.password = '';
  return { url: url.toString(), env: { ...process.env, PGPASSWORD: password } };
}
async function postgresCommand(name, args, databaseUrl) {
  const { env } = credentials(databaseUrl);
  return execute(binary(name), args, { env, windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
}
async function createPostgresBackup(databaseUrl, destination, { databaseSchema } = {}) {
  const { url } = credentials(databaseUrl);
  if (fs.existsSync(destination)) throw new Error('Файл назначения уже существует');
  try {
    await postgresCommand('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', destination, '--dbname', url, ...(databaseSchema ? ['--schema', databaseSchema] : [])], databaseUrl);
    await postgresCommand('pg_restore', ['--list', destination], databaseUrl);
    return { destination, engine: 'postgres' };
  } catch (error) {
    fs.rmSync(destination, { force: true });
    throw new Error(`Не удалось создать копию PostgreSQL (${error.code || 'pg_dump'}). Проверьте подключение и POSTGRES_BIN.`);
  }
}
module.exports = { createPostgresBackup, postgresCommand, credentials };
