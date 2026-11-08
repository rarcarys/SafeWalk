const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env.docker');
if (!fs.existsSync(envFile)) {
  const hosts = ['localhost', '127.0.0.1', ...Object.values(os.networkInterfaces()).flat().filter(item => item.family === 'IPv4' && !item.internal).map(item => item.address)];
  const origins = hosts.map(host => `http://${host}:8081`).join(',');
  fs.writeFileSync(envFile, `DOCKER_POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nDOCKER_POSTGRES_PORT=5434\nDOCKER_API_PORT=3001\nSAFEWALK_PUSH_ENABLED=0\nDOCKER_AUTH_ALLOWED_ORIGINS=${origins}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created .env.docker with a generated database password.');
}
const action = process.argv[2] || 'up';
const commands = {
  up: ['up', '-d', '--build', '--wait'],
  build: ['build'],
  down: ['down'],
  logs: ['logs', '--tail', '100'],
  status: ['ps'],
  config: ['config', '--quiet'],
};
if (action !== 'setup') {
  if (!commands[action]) throw new Error(`Unknown action: ${action}`);
  const result = spawnSync('docker', ['compose', '--env-file', envFile, ...commands[action]], {
    cwd: root, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
