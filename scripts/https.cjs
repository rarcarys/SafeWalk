const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
const directory = path.resolve(__dirname, '..', '.data', 'certs');

function certificates() {
  fs.mkdirSync(directory, { recursive: true });
  const hosts = ['127.0.0.1', ...Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address)].sort();
  const openssl = process.env.SAFEWALK_OPENSSL || (process.platform === 'win32' && fs.existsSync('C:/Program Files/Git/usr/bin/openssl.exe') ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  const run = args => execFileSync(openssl, args, { cwd: directory, stdio: 'pipe', windowsHide: true });
  if (!fs.existsSync(path.join(directory, 'ca.key'))) run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '365', '-subj', '/CN=SafeWalk Local CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  const signature = hosts.join(',');
  let valid = false;
  try { run(['x509', '-checkend', '86400', '-noout', '-in', 'server.crt']); valid = true; } catch {}
  if (!valid || !fs.existsSync(path.join(directory, 'hosts.txt')) || fs.readFileSync(path.join(directory, 'hosts.txt'), 'utf8') !== signature) {
    fs.writeFileSync(path.join(directory, 'server.ext'), `subjectAltName=DNS:localhost,${hosts.map(host => `IP:${host}`).join(',')}\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n`);
    run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=SafeWalk Local']);
    run(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '90', '-extfile', 'server.ext']);
    fs.writeFileSync(path.join(directory, 'hosts.txt'), signature);
  }
  return { key: fs.readFileSync(path.join(directory, 'server.key')), cert: fs.readFileSync(path.join(directory, 'server.crt')), hosts };
}

function startHTTPS() {
  const certs = certificates();
  const allowedOrigins = new Set(['https://localhost:8443', ...certs.hosts.map(host => `https://${host}:8443`)]);
  const proxy = https.createServer(certs, (request, response) => {
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) { response.writeHead(403); response.end(); return; }
    const api = request.url.startsWith('/api/') || ['/health', '/share', '/share.js'].includes(request.url.split('?')[0]);
    const upstream = http.request({ hostname: '127.0.0.1', port: api ? 3001 : 8081, path: request.url, method: request.method,
      headers: { ...request.headers, host: 'localhost:8081', ...(request.headers.origin ? { origin: 'http://localhost:8081' } : {}) },
    }, result => { response.writeHead(result.statusCode, result.headers); result.pipe(response); });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('SafeWalk недоступен. Запустите npm.cmd run local.'); });
    response.on('close', () => upstream.destroy());
    request.pipe(upstream);
  });
  proxy.on('upgrade', (request, socket, head) => {
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) { socket.destroy(); return; }
    const upstream = net.connect(8081, '127.0.0.1', () => {
      upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${Object.entries({ ...request.headers, host: 'localhost:8081' }).map(([name, value]) => `${name}: ${value}`).join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
  });
  // Serves only the public CA certificate, never private keys or application data.
  const installer = http.createServer((request, response) => {
    if (request.url !== '/safewalk-ca.crt') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="SafeWalk-Local-CA.crt"' });
    response.end(fs.readFileSync(path.join(directory, 'ca.crt')));
  });
  const stop = () => { proxy.close(); installer.close(); };
  for (const server of [proxy, installer]) server.on('error', error => {
    console.error(`Локальный HTTPS: ${error.code === 'EADDRINUSE' ? 'Порт 8443 или 8080 уже занят' : error.code}`); stop(); process.exitCode = 1;
  });
  proxy.listen(8443, '0.0.0.0', () => {
    for (const host of certs.hosts) console.log(`SafeWalk HTTPS: https://${host}:8443\nСертификат для iPhone: http://${host}:8080/safewalk-ca.crt`);
    console.log('Инструкция установки доверия: README.md. Сертификат устанавливается вручную владельцем устройства.');
  });
  installer.listen(8080, '0.0.0.0');
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  return { proxy, installer };
}
if (require.main === module) {
  try { startHTTPS(); } catch (error) { console.error(`Не удалось запустить HTTPS. Нужен OpenSSL (в Windows входит в Git). ${error.code || error.name}`); process.exitCode = 1; }
}
module.exports = { startHTTPS, certificates };
