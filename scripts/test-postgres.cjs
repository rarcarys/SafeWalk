const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { ensureLocalPostgres } = require('./postgres-local.cjs');
const root = path.resolve(__dirname, '..');
async function main() {
  let url = process.env.SAFEWALK_TEST_DATABASE_URL;
  const stateFile = path.join(root, '.data', 'postgres-local.json');
  if (!url && fs.existsSync(stateFile)) url = JSON.parse(fs.readFileSync(stateFile, 'utf8')).databaseUrl;
  if (!url) throw new Error('Укажите SAFEWALK_TEST_DATABASE_URL для отдельной тестовой базы.');
  await ensureLocalPostgres(url);
  const files = process.argv.slice(2).length ? process.argv.slice(2) : ['server/*.test.cjs'];
  const child = spawn(process.execPath, ['--test', ...files], { cwd: root, env: { ...process.env, SAFEWALK_TEST_DATABASE_URL: url }, windowsHide: true, stdio: 'inherit' });
  child.once('error', error => { console.error(error.code); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
