const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

async function createBackup(source = path.join(root, '.data', 'accounts.sqlite'), destination) {
  if (/^postgres(?:ql)?:\/\//.test(source)) {
    destination ||= path.join(root, '.data', 'backups', `postgres-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    return require('./postgres-backup.cjs').createPostgresBackup(source, destination);
  }
  if (!fs.existsSync(source)) throw new Error('База данных не найдена. Сначала запустите SafeWalk.');
  destination ||= path.join(root, '.data', 'backups', `accounts-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  if (fs.existsSync(destination)) throw new Error('Файл назначения уже существует');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const database = new DatabaseSync(source, { readOnly: true });
  try { await backup(database, destination); }
  finally { database.close(); }
  const restored = new DatabaseSync(destination);
  try {
    // Make the snapshot a standalone file with no WAL sidecars to copy.
    restored.exec('PRAGMA journal_mode = DELETE');
    if (restored.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Проверка резервной копии не пройдена');
    if (restored.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Нарушены связи в резервной копии');
    return { destination, users: restored.prepare('SELECT COUNT(*) AS count FROM users').get().count };
  } finally { restored.close(); }
}
if (require.main === module) {
  if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
  createBackup(process.env.DATABASE_URL || undefined).then(result => console.log(`Резервная копия проверена: ${result.destination}${result.users === undefined ? '' : `\nАккаунтов: ${result.users}`}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { createBackup };
