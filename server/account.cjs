const express = require('express');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');

async function createAccountRouter({ database, requireSession, deriveKey, scryptOptions, hashToken, sessionToken, cookieOptions, cookie, now }) {
  await database.exec(`CREATE TABLE IF NOT EXISTS recovery_codes (
    owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
  )`);
  if (!(await database.prepare('PRAGMA table_info(sessions)').all()).some((column) => column.name === 'created_at')) {
    await database.exec('ALTER TABLE sessions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
  }
  const router = express.Router();
  const sensitive = rateLimit({ windowMs: 15 * 60000, limit: 12, message: { message: 'Слишком много попыток. Попробуйте позже.' } });
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const validPassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128;
  const transaction = async (operation) => await database.transaction(operation);
  async function verify(request, response) {
    const password = request.body?.password;
    if (typeof password !== 'string' || !password || password.length > 128) {
      response.status(400).json({ message: 'Введите текущий пароль' });return;
    }
    const user = await database.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
    if (!user) {response.status(401).json({ message: 'Войдите в аккаунт' });return;}
    const derived = await deriveKey(password, user.password_salt, 64, scryptOptions);
    if (!timingSafeEqual(derived, Buffer.from(user.password_hash, 'hex'))) {
      response.status(403).json({ message: 'Неверный текущий пароль' });return;
    }
    if ((await database.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id))?.password_hash !== user.password_hash) {
      response.status(409).json({ message: 'Данные аккаунта изменились. Повторите действие.' });return;
    }
    return user;
  }
  router.post('/recover', sensitive, database.handle(async (request, response) => {
    const { email, code, newPassword } = request.body || {};
    if (typeof email !== 'string' || email.length > 254 || typeof code !== 'string' || code.length > 100 || !validPassword(newPassword)) {
      return response.status(400).json({ message: 'Укажите email, код восстановления и новый пароль от 8 до 128 символов' });
    }
    const normalized = code.replace(/[\s-]/g, '').toLowerCase();
    const row = await database.prepare('SELECT u.id, r.code_hash FROM users u JOIN recovery_codes r ON r.owner_id = u.id WHERE u.email = ? AND r.code_hash = ?').get(email.trim().toLowerCase(), digest(normalized));
    if (!row) return response.status(403).json({ message: 'Неверный email или код восстановления' });
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(newPassword, salt, 64, scryptOptions)).toString('hex');
    const changed = await transaction(async () => {
      const removed = await database.prepare('DELETE FROM recovery_codes WHERE owner_id = ? AND code_hash = ?').run(row.id, row.code_hash);
      if (!removed.changes) return false;
      await database.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, row.id);
      await database.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
      return true;
    });
    if (!changed) return response.status(403).json({ message: 'Код уже использован. Войдите с новым паролем.' });
    response.clearCookie(cookie, cookieOptions);
    response.json({ ok: true });
  }));
  router.use(requireSession);
  router.put('/avatar', database.handle(async (request, response) => {
    let avatar;
    try { avatar = await require('./avatars.cjs').normalizeAvatar(request.body?.avatar); }
    catch (error) { return response.status(400).json({ message: error.message }); }
    await database.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, request.user.id);
    const user = await database.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get(request.user.id);
    response.json({ user });
  }));
  router.patch('/profile', database.handle(async (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    if (!name || Array.from(name).length > 50) return response.status(400).json({ message: 'Имя должно содержать от 1 до 50 символов' });
    await database.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, request.user.id);
    response.json({ user: { ...request.user, name } });
  }));
  router.get('/sessions', async (request, response) => {
    const current = hashToken(sessionToken(request));
    const sessions = await database.prepare('SELECT token_hash, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC').all(request.user.id, now());
    response.json({ sessions: sessions.map((row) => ({ id: row.token_hash, current: row.token_hash === current, createdAt: row.created_at || null, expiresAt: row.expires_at })) });
  });
  router.post('/sessions/revoke-others', sensitive, database.handle(async (request, response) => {
    if (!(await verify(request, response))) return;
    await database.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(request.user.id, hashToken(sessionToken(request)));
    response.json({ ok: true });
  }));
  router.post('/password', sensitive, database.handle(async (request, response) => {
    if (!validPassword(request.body?.newPassword)) return response.status(400).json({ message: 'Новый пароль должен содержать от 8 до 128 символов' });
    const user = await verify(request, response);
    if (!user) return;
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(request.body.newPassword, salt, 64, scryptOptions)).toString('hex');
    const changed = await transaction(async () => {
      const result = await database.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ? AND password_hash = ?').run(hash, salt, user.id, user.password_hash);
      if (!result.changes) return false;
      await database.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(user.id, hashToken(sessionToken(request)));
      await database.prepare('DELETE FROM recovery_codes WHERE owner_id = ?').run(user.id);
      return true;
    });
    if (!changed) return response.status(409).json({ message: 'Данные аккаунта изменились. Повторите действие.' });
    response.json({ ok: true });
  }));
  router.post('/recovery-code', sensitive, database.handle(async (request, response) => {
    if (!(await verify(request, response))) return;
    const code = randomBytes(20).toString('hex');
    await database.prepare('INSERT INTO recovery_codes (owner_id, code_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET code_hash = excluded.code_hash, created_at = excluded.created_at').run(request.user.id, digest(code), now());
    response.json({ code: code.match(/.{1,5}/g).join('-') });
  }));
  router.post('/delete', sensitive, database.handle(async (request, response) => {
    if (request.body?.confirmation !== 'DELETE') return response.status(400).json({ message: 'Для удаления введите DELETE' });
    const user = await verify(request, response);
    if (!user) return;
    await database.prepare('DELETE FROM users WHERE id = ? AND password_hash = ?').run(user.id, user.password_hash);
    response.clearCookie(cookie, cookieOptions);
    response.json({ ok: true });
  }));
  return router;
}
module.exports = { createAccountRouter };
