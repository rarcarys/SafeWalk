const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createMapsRouter } = require('./maps.cjs');

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const COOKIE = 'safewalk_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = token => createHash('sha256').update(token).digest('hex');

function defaultOrigins() {
  const hosts = ['localhost', '127.0.0.1', ...Object.values(os.networkInterfaces()).flat().filter(item => item.family === 'IPv4' && !item.internal).map(item => item.address)];
  return hosts.flatMap(host => [8081, 8082, 8083].map(port => `http://${host}:${port}`));
}

function createAuthService({ databasePath, origins = defaultOrigins(), secureCookies = false, loginLimit = 25, now = Date.now } = {}) {
  const dbPath = databasePath || path.resolve(__dirname, '..', '.data', 'accounts.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((request, response, next) => {
    if (request.headers.origin && !origins.includes(request.headers.origin)) return response.status(403).json({ message: 'Источник запроса не разрешён' });
    next();
  });
  app.use(cors({ origin: origins, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-SafeWalk-Client'] }));
  app.use(express.json({ limit: '8kb' }));
  app.use(cookieParser());
  app.use('/api/auth', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/auth', (request, response, next) => {
    if (request.method !== 'GET' && !request.is('application/json')) return response.status(415).json({ message: 'Требуется JSON' });
    next();
  });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: loginLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Слишком много попыток. Попробуйте позже.' },
  });
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: secureCookies, path: '/api/auth' };
  const publicUser = user => ({ id: user.id, name: user.name, email: user.email });
  const dummySalt = randomBytes(16).toString('hex');

  function credentials(body, registration) {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const fields = {};
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Введите корректный email';
    if (!password || password.length > 128) fields.password = 'Введите пароль длиной до 128 символов';
    if (registration && password.length < 15) fields.password = 'Не менее 15 символов';
    if (registration && (!name || Array.from(name).length > 50)) fields.name = 'Имя должно содержать от 1 до 50 символов';
    return { email, password, name, fields };
  }

  function issueSession(request, response, user, status = 200) {
    database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
    const token = randomBytes(32).toString('base64url');
    database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), user.id, now() + SESSION_MS);
    response.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_MS });
    const result = { user: publicUser(user) };
    if (!request.headers.origin && request.headers['x-safewalk-client'] === 'native') result.token = token;
    response.status(status).json(result);
  }

  function sessionToken(request) {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return request.cookies[COOKIE];
  }

  app.get('/health', (_request, response) => response.json({ service: 'safewalk-auth', status: 'ok' }));
  app.post('/api/auth/register', limiter, async (request, response) => {
    const { email, password, name, fields } = credentials(request.body, true);
    if (Object.keys(fields).length) return response.status(400).json({ message: 'Проверьте заполненные поля', fields });
    if (database.prepare('SELECT id FROM users WHERE email = ?').get(email)) return response.status(409).json({ message: 'Этот email уже зарегистрирован. Войдите в аккаунт.', fields: { email: 'Email уже зарегистрирован' } });
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await deriveKey(password, salt, 64, scryptOptions)).toString('hex');
    const user = { id: randomUUID(), name, email };
    try {
      database.prepare('INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, email, name, passwordHash, salt, now());
    } catch (error) {
      if (error.errcode === 2067 || error.message.includes('UNIQUE constraint')) return response.status(409).json({ message: 'Email уже зарегистрирован' });
      throw error;
    }
    issueSession(request, response, user, 201);
  });

  app.post('/api/auth/login', limiter, async (request, response) => {
    const { email, password, fields } = credentials(request.body, false);
    if (Object.keys(fields).length) return response.status(400).json({ message: 'Проверьте заполненные поля', fields });
    const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const derived = await deriveKey(password, user?.password_salt || dummySalt, 64, scryptOptions);
    if (!user || !timingSafeEqual(derived, Buffer.from(user.password_hash, 'hex'))) return response.status(401).json({ message: 'Неверный email или пароль' });
    issueSession(request, response, user);
  });

  function requireSession(request, response, next) {
    const token = sessionToken(request);
    const user = typeof token === 'string' && token.length <= 128
      ? database.prepare('SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?').get(hashToken(token), now())
      : null;
    if (!user) return response.status(401).json({ message: 'Войдите в аккаунт' });
    request.user = publicUser(user);
    next();
  }
  app.get('/api/auth/me', requireSession, (request, response) => response.json({ user: request.user }));
  app.use('/api/auth/maps', requireSession, rateLimit({ windowMs: 60000, limit: 20, message: { message: 'Слишком много запросов к карте. Подождите минуту.' } }), createMapsRouter());

  app.post('/api/auth/logout', (request, response) => {
    const token = sessionToken(request);
    if (typeof token === 'string' && token.length <= 128) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    response.clearCookie(COOKIE, cookieOptions);
    response.json({ ok: true });
  });

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return response.status(400).json({ message: 'Некорректный запрос' });
    console.error('Auth service error:', error.code || error.name);
    response.status(500).json({ message: 'Не удалось выполнить запрос. Попробуйте снова.' });
  });
  return { app, close: () => database.close() };
}

if (require.main === module) {
  const port = Number(process.env.AUTH_PORT || 3001);
  const origins = process.env.AUTH_ALLOWED_ORIGINS?.split(',').filter(Boolean);
  const service = createAuthService({ origins, secureCookies: process.env.NODE_ENV === 'production' });
  const server = service.app.listen(port, '0.0.0.0', () => console.log(`SafeWalk auth listening on port ${port}`));
  const stop = () => server.close(() => { service.close(); process.exit(0); });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createAuthService };
