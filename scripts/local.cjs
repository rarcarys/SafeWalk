const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { startAuthServer } = require('./start-auth.cjs');
const { checkExpoAccount, expoEnvironment } = require('./expo-account.cjs');

const root = path.resolve(__dirname, '..');
const webPort = 8081;

function addresses() {
  return [...new Set(Object.values(os.networkInterfaces()).flat()
    .filter(item => item && item.family === 'IPv4' && !item.internal)
    .map(item => item.address))];
}

async function json(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function expoReady() {
  try {
    const manifest = await json(`http://127.0.0.1:${webPort}`, {
      'expo-platform': 'android', accept: 'application/expo+json',
    });
    const project = manifest.extra?.expoGo?.developer?.projectRoot;
    return project && path.resolve(project).toLowerCase() === root.toLowerCase();
  } catch { return false; }
}

function portFree(port = webPort) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

async function ensureHTTPS() {
  const caPath = path.join(root, '.data', 'certs', 'ca.crt');
  const ready = await new Promise(resolve => {
    if (!fs.existsSync(caPath)) return resolve(false);
    const req = https.get({ hostname: '127.0.0.1', port: 8443, path: '/health', ca: fs.readFileSync(caPath) }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body).service === 'safewalk-auth'); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false)); req.setTimeout(2000, () => req.destroy());
  });
  if (!ready) {
    if (!await portFree(8443) || !await portFree(8080)) throw new Error('Порты 8443/8080 заняты. Освободите их для запуска HTTPS.');
    require('./https.cjs').startHTTPS();
  }
  for (const host of addresses()) console.log(`iPhone: https://${host}:8443 · сертификат: http://${host}:8080/safewalk-ca.crt`);
}

function instructions() {
  console.log('\nSafeWalk: http://localhost:8081');
  console.log('API: http://localhost:3001/health');
  if (process.env.DATABASE_URL) {
    const database = new URL(process.env.DATABASE_URL);
    console.log(`Данные: PostgreSQL · ${database.hostname}:${database.port || 5432}${database.pathname} (сохраняются после перезапуска)`);
  } else console.log(`Данные: ${path.join(root, '.data', 'accounts.sqlite')} (сохраняются после перезапуска)`);
  const hosts = addresses();
  if (!hosts.length) console.log('Нет адреса локальной сети. Подключите компьютер к Wi-Fi для доступа с телефона.');
  for (const host of hosts) {
    console.log(`\nТелефон — браузер: http://${host}:8081`);
    console.log(`Телефон — Expo Go: exp://${host}:8081`);
    console.log(`Проверка API с телефона: http://${host}:3001/health`);
  }
  console.log('\nТелефон и компьютер должны быть в одной сети. При нескольких адресах выберите адрес Wi-Fi.');
  console.log('Если телефон не подключается: проверьте VPN, изоляцию Wi-Fi и доступ к портам 3001/8081 в брандмауэре.');
  console.log('В браузере телефона геолокация по HTTP может быть недоступна; для неё используйте Expo Go.');
}

async function check() {
  let accountReady = false;
  try {
    console.log(`Expo CLI: выполнен вход как ${await checkExpoAccount()}`);
    accountReady = true;
  } catch (error) {
    console.error(`Expo CLI: ${error.message}`);
  }
  let healthy = false;
  try {
    const result = await json('http://127.0.0.1:3001/health');
    healthy = result.service === 'safewalk-auth' && result.status === 'ok' && (!process.env.DATABASE_URL || result.database === 'postgres');
  } catch {}
  const frontend = !!await expoReady();
  console.log(`API: ${healthy ? 'работает' : 'недоступен — выполните npm.cmd run local'}`);
  console.log(`Интерфейс: ${frontend ? 'работает' : 'недоступен или порт 8081 занят другим проектом'}`);
  instructions();
  if (!accountReady || !healthy || !frontend) process.exitCode = 1;
}

async function main() {
  if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Нужен Node.js 24 или новее.');
  if (process.argv.includes('--check')) return check();
  const cli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
  if (!fs.existsSync(cli)) throw new Error('Зависимости не установлены. Выполните npm.cmd install.');
  console.log('Проверяем вход в Expo CLI…');
  console.log(`Expo CLI: выполнен вход как ${await checkExpoAccount()}`);
  const existing = !!await expoReady();
  if (!existing && !await portFree()) throw new Error('Порт 8081 занят другим приложением. Освободите его и повторите запуск.');
  await startAuthServer();
  if (process.argv.includes('--https')) await ensureHTTPS();
  console.log('Сервер SafeWalk готов.');
  if (existing) {
    console.log('Используется уже запущенный интерфейс этого проекта.');
    instructions();
    return;
  }
  const child = spawn(process.execPath, [cli, 'start', '--lan', '--go', '--clear', '--port', String(webPort),
    ...(process.argv.includes('--web') ? ['--web'] : []),
    ...(process.argv.includes('--android') ? ['--android'] : [])], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: expoEnvironment(),
  });
  let stopped = false;
  child.on('error', error => { console.error(error.message); process.exitCode = 1; stopped = true; });
  child.on('exit', code => { stopped = true; process.exitCode = code ?? 0; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  for (let attempt = 0; attempt < 90 && !stopped; attempt++) {
    if (await expoReady()) { instructions(); return; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!stopped) {
    child.kill();
    throw new Error('Expo не запустился за отведённое время. Проверьте сообщения выше. API продолжает работать.');
  }
}

if (require.main === module) main().catch(error => {
  console.error(`\nSafeWalk: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { addresses, expoReady };
