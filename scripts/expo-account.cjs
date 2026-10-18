const { execFile } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');

function expoEnvironment(environment = process.env) {
  return { ...environment, EXPO_OFFLINE: '0' };
}

function checkExpoAccount(run = execFile) {
  return new Promise((resolve, reject) => {
    run(process.execPath, [cli, 'whoami'], {
      cwd: root,
      env: { ...expoEnvironment(), FORCE_COLOR: '0' },
      windowsHide: true,
      timeout: 20000,
      maxBuffer: 64 * 1024,
      encoding: 'utf8',
    }, (error, stdout = '', stderr = '') => {
      if (/Not logged in/i.test(`${stdout}\n${stderr}`)) {
        reject(new Error('Вход в Expo CLI не выполнен. Выполните npx.cmd expo login --browser, затем повторите npm.cmd start.'));
      } else if (error || !stdout.trim()) {
        reject(new Error('Не удалось проверить аккаунт Expo. Проверьте интернет и VPN, затем выполните npx.cmd expo whoami. Сохранённый вход не сбрасывался.'));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

module.exports = { checkExpoAccount, expoEnvironment };
