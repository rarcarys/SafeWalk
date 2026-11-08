// Mechanical asset packaging: keep the browser runtime and native offline bundle in sync.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeDirectory = path.dirname(require.resolve('@rive-app/canvas-lite/package.json'));
const version = require('@rive-app/canvas-lite/package.json').version;
const destination = path.join(root, 'public', 'mascot');
fs.mkdirSync(destination, { recursive: true });
const animation = fs.readFileSync(path.join(root, 'assets', 'mascot', 'teddy-login.riv'));
if (animation.subarray(0, 4).toString() !== 'RIVE') throw new Error('Invalid Teddy animation file');
fs.copyFileSync(path.join(runtimeDirectory, 'rive.wasm'), path.join(destination, `rive-${version}.wasm`));
fs.copyFileSync(path.join(runtimeDirectory, 'rive_fallback.wasm'), path.join(destination, `rive-${version}-fallback.wasm`));
fs.writeFileSync(path.join(destination, 'teddy-login.riv'), animation);
fs.copyFileSync(path.join(root, 'assets', 'mascot', 'RIVE-LICENSE.txt'), path.join(destination, 'RIVE-LICENSE.txt'));
const bundle = {
  version,
  javascript: fs.readFileSync(path.join(runtimeDirectory, 'rive.js'), 'utf8'),
  controller: fs.readFileSync(path.join(root, 'src', 'services', 'fireflyController.js'), 'utf8').replace('export function createFireflyController', 'function createFireflyController'),
  wasm: `data:application/wasm;base64,${fs.readFileSync(path.join(runtimeDirectory, 'rive.wasm')).toString('base64')}`,
  animation: animation.toString('base64'),
};
fs.writeFileSync(path.join(root, 'assets', 'mascot', 'firefly-native-runtime.json'), JSON.stringify(bundle));
console.log(`Packaged auth mascot and offline Rive runtime ${version}`);
