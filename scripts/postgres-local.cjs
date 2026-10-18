const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
const stateFile = path.join(root, '.data', 'postgres-local.json');

function binary(name) {
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  if (process.env.POSTGRES_BIN) return path.join(process.env.POSTGRES_BIN, executable);
  if (process.platform !== 'win32') return name;
  const base = 'C:\\Program Files\\PostgreSQL';
  const versions = fs.existsSync(base) ? fs.readdirSync(base).sort((a, b) => Number(b) - Number(a)) : [];
  for (const version of versions) {
    const candidate = path.join(base, version, 'bin', `${name}.exe`);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Укажите POSTGRES_BIN — папку bin установленного PostgreSQL.');
}
function command(name, args) {
  const result = spawnSync(binary(name), args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 60000, ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}) });
  if (result.error || result.status !== 0) throw new Error(`PostgreSQL ${name}: ${result.error?.code || result.stderr?.trim() || 'ошибка запуска'}`);
}
async function connect(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try { await client.connect(); await client.query('SELECT 1'); return true; }
  catch { return false; }
  finally { await client.end().catch(() => {}); }
}
async function ensureLocalPostgres(databaseUrl) {
  if (!databaseUrl || !fs.existsSync(stateFile)) return;
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (databaseUrl !== state.databaseUrl || await connect(databaseUrl)) return;
  command('pg_ctl', ['-D', state.directory, '-l', path.join(root, '.data', 'postgres.log'), '-o', `-h 127.0.0.1 -p ${state.port}`, '-w', 'start']);
  if (!await connect(databaseUrl)) throw new Error('Не удалось подключиться к локальной базе SafeWalk.');
}
async function setupLocalPostgres() {
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!await connect(state.adminUrl)) command('pg_ctl', ['-D', state.directory, '-l', path.join(root, '.data', 'postgres.log'), '-o', `-h 127.0.0.1 -p ${state.port}`, '-w', 'start']);
    await initializeDatabase(state);
    return state;
  }
  const directory = path.join(root, '.data', 'postgres');
  if (fs.existsSync(directory)) throw new Error('Каталог PostgreSQL уже существует. Автоматическая перезапись запрещена.');
  const port = 5433;
  await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', () => reject(new Error('Порт 5433 занят.'))); server.listen(port, '127.0.0.1', () => server.close(resolve)); });
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const adminPassword = randomBytes(32).toString('hex'), password = randomBytes(32).toString('hex');
  const pwfile = path.join(root, '.data', 'postgres-init-password');
  fs.writeFileSync(pwfile, adminPassword, { mode: 0o600, flag: 'wx' });
  try { command('initdb', ['-D', directory, '-U', 'safewalk_admin', '--pwfile', pwfile, '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256']); }
  finally { fs.rmSync(pwfile, { force: true }); }
  const adminUrl = `postgresql://safewalk_admin:${adminPassword}@127.0.0.1:${port}/postgres`;
  const databaseUrl = `postgresql://safewalk:${password}@127.0.0.1:${port}/safewalk`;
  const state = { directory, port, adminUrl, databaseUrl };
  // Store recovery credentials before launching; never print them or commit them.
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
  command('pg_ctl', ['-D', directory, '-l', path.join(root, '.data', 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  await initializeDatabase(state);
  return state;
}
async function initializeDatabase(state) {
  const password = new URL(state.databaseUrl).password;
  if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Некорректный локальный пароль');
  const admin = new Client({ connectionString: state.adminUrl });
  try {
    await admin.connect();
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'safewalk'")).rowCount) await admin.query(`CREATE ROLE safewalk LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = 'safewalk'")).rowCount) await admin.query('CREATE DATABASE safewalk OWNER safewalk ENCODING \'UTF8\'');
  } finally { await admin.end(); }
}
if (require.main === module) setupLocalPostgres().then(() => console.log('Локальная база SafeWalk готова: PostgreSQL, 127.0.0.1:5433/safewalk.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { setupLocalPostgres, ensureLocalPostgres, binary };
