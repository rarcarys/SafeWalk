const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const { Client } = require('pg');
const { createAuthService } = require('../server/auth.cjs');
const { createBackup } = require('./backup.cjs');
const root = path.resolve(__dirname, '..');
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const digest = (rows, columns) => createHash('sha256').update(JSON.stringify(rows.map(row => JSON.stringify(columns.map(column => row[column]))).sort())).digest('hex');

async function migrate({ source = path.join(root, '.data', 'accounts.sqlite'), databaseUrl, databaseSchema, backupDestination } = {}) {
  if (!databaseUrl) throw new Error('Укажите DATABASE_URL для PostgreSQL.');
  // SQLite's online backup includes uncheckpointed WAL records.
  const snapshot = await createBackup(source, backupDestination);
  const sqlite = new DatabaseSync(snapshot.destination, { readOnly: true });
  let service, client;
  try {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
    const dependencies = new Map(tables.map(table => [table, sqlite.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all().map(row => row.table)]));
    const ordered = [], visiting = new Set();
    function visit(table) {
      if (ordered.includes(table)) return;
      if (visiting.has(table)) throw new Error('Циклические внешние ключи: перенос остановлен.');
      visiting.add(table);
      for (const dependency of dependencies.get(table)) visit(dependency);
      ordered.push(table); visiting.delete(table);
    }
    tables.forEach(visit);
    if (databaseSchema && !/^[a-z_][a-z0-9_]{0,62}$/.test(databaseSchema)) throw new Error('Invalid database schema');
    client = new Client({ connectionString: databaseUrl, ...(databaseSchema ? { options: `-c search_path=${databaseSchema}` } : {}) });
    await client.connect();
    const existing = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'")).rows;
    for (const { table_name: table } of existing) {
      if ((await client.query(`SELECT 1 FROM ${quote(table)} LIMIT 1`)).rowCount) throw new Error('База назначения содержит данные. Перезапись запрещена.');
    }
    service = await createAuthService({ databaseUrl, databaseSchema, backgroundJobs: false });
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended(current_database() || ':' || current_schema(), 0))");
    const targets = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'")).rows.map(row => row.table_name);
    await client.query(`LOCK TABLE ${targets.map(quote).join(', ')} IN ACCESS EXCLUSIVE MODE`);
    for (const table of targets) {
      if ((await client.query(`SELECT 1 FROM ${quote(table)} LIMIT 1`)).rowCount) throw new Error('База назначения содержит данные. Перезапись запрещена.');
    }
    // Imported push jobs and revision counters are already exact snapshots;
    // regenerating them with insert triggers would duplicate notifications.
    for (const table of targets) await client.query(`ALTER TABLE ${quote(table)} DISABLE TRIGGER USER`);
    const counts = {};
    for (const table of ordered) {
      if (!targets.includes(table)) throw new Error(`Неизвестная таблица: ${table}`);
      const columns = sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row => row.name);
      if (table === 'circle_contacts') columns.push('sort_order');
      const rows = sqlite.prepare(`SELECT *${table === 'circle_contacts' ? ', rowid AS sort_order' : ''} FROM ${quote(table)}`).all();
      for (const row of rows) await client.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES (${columns.map((_, index) => '$' + (index + 1)).join(', ')})`, columns.map(column => row[column]));
      const copied = (await client.query(`SELECT ${columns.map(quote).join(', ')} FROM ${quote(table)}`)).rows;
      if (digest(rows, columns) !== digest(copied, columns)) throw new Error(`Данные не совпали: ${table}. Транзакция отменена.`);
      counts[table] = rows.length;
    }
    for (const [table, column] of [['chat_messages', 'id'], ['push_jobs', 'id'], ['circle_contacts', 'sort_order']]) {
      const maximum = (await client.query(`SELECT MAX(${quote(column)}) AS n FROM ${quote(table)}`)).rows[0].n;
      await client.query('SELECT setval(pg_get_serial_sequence($1, $2), $3, $4)', [table, column, maximum ?? 1, maximum !== null]);
    }
    for (const table of targets) await client.query(`ALTER TABLE ${quote(table)} ENABLE TRIGGER USER`);
    await client.query('COMMIT');
    return { completedAt: new Date().toISOString(), backup: snapshot.destination, counts };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { sqlite.close(); if (client) await client.end(); if (service) await service.close(); }
}
async function main() {
  const envFile = path.join(root, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.AUTH_PORT || 3001}/health`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) throw new Error('Сначала остановите API SafeWalk, чтобы во время переноса не появились новые записи.');
  } catch (error) { if (error.message.startsWith('Сначала')) throw error; }
  const stateFile = path.join(root, '.data', 'postgres-local.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const databaseUrl = process.env.DATABASE_URL || state.databaseUrl;
  const result = await migrate({ databaseUrl });
  fs.writeFileSync(path.join(root, '.data', 'migration-postgres-last.json'), JSON.stringify(result, null, 2));
  console.log(`Перенос проверен: ${Object.keys(result.counts).length} таблиц, ${result.counts.users} аккаунтов. Резервная копия: ${result.backup}`);
}
if (require.main === module) main().catch(error => { console.error('Перенос остановлен:', error.code || error.message); process.exitCode = 1; });
module.exports = { migrate };
