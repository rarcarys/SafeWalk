const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { ensureLocalPostgres } = require('./postgres-local.cjs');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.preview');
const port = 3001;

function healthy() {
  return new Promise(resolve => {
    const request = http.get(`http://127.0.0.1:${port}/health`, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(response.statusCode === 200 && result.service === 'safewalk-auth' && result.status === 'ok' && (!process.env.DATABASE_URL || result.database === 'postgres'));
        }
        catch { resolve(false); }
      });
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => request.destroy());
  });
}

function free() {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

async function startAuthServer() {
  const envFile = path.join(root, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  await ensureLocalPostgres(process.env.DATABASE_URL);
  fs.mkdirSync(directory, { recursive: true });
  const stateFile = path.join(directory, 'auth-server.json');
  if (await healthy()) {
    return { port, reused: true };
  }
  if (!(await free())) throw new Error(`Порт ${port} занят другим сервисом. Освободите его и повторите запуск.`);
  const logFile = path.join(directory, 'auth.log');
  const stdout = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [path.join(root, 'server', 'auth.cjs')], {
    cwd: root, env: { ...process.env, AUTH_PORT: String(port) },
    detached: true, windowsHide: true, stdio: ['ignore', stdout, stdout],
  });
  child.unref();
  let startupError;
  child.on('error', error => { startupError = error; });
  fs.closeSync(stdout);
  const state = { pid: child.pid, port, logFile };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  for (let attempt = 0; attempt < 40; attempt++) {
    if (startupError) throw startupError;
    if (await healthy()) return state;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  child.kill();
  fs.rmSync(stateFile, { force: true });
  throw new Error(`Сервер SafeWalk не запустился. Подробности: ${logFile}`);
}

if (require.main === module) startAuthServer().then(state => console.log(JSON.stringify(state, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { startAuthServer };
