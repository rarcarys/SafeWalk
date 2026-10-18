const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

if (process.platform !== 'darwin') throw new Error('Packaging an iOS app requires the macOS build worker.');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'build', 'ios-derived', 'Build', 'Products', 'Release-iphoneos', 'SafeWalk.app');
const output = path.join(root, 'build', 'ios');
const payload = path.join(output, 'Payload');
if (!fs.existsSync(path.join(app, 'Info.plist'))) throw new Error('The iPhone app was not produced by xcodebuild.');
fs.mkdirSync(payload, { recursive: true });
fs.cpSync(app, path.join(payload, 'SafeWalk.app'), { recursive: true });
execFileSync('ditto', ['-c', '-k', '--keepParent', 'Payload', 'SafeWalk-unsigned.ipa'], { cwd: output, stdio: 'inherit' });
console.log('Unsigned app archive: build/ios/SafeWalk-unsigned.ipa');
