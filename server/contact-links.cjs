const express = require('express');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { blocked } = require('./relationships.cjs');

async function createContactLinks(database, now = Date.now) {
  await database.exec(`CREATE TABLE IF NOT EXISTS contact_links (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0, used_by TEXT REFERENCES users(id) ON DELETE CASCADE
  )`);
  const router = express.Router();
  const hash = value => createHash('sha256').update(value).digest('hex');
  const lookup = async token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? await database.prepare('SELECT l.*, u.name FROM contact_links l JOIN users u ON u.id = l.owner_id WHERE token_hash = ? AND revoked = 0 AND expires_at > ?').get(hash(token), now()) : null;
  const unavailable = response => response.status(404).json({ message: 'Приглашение недоступно, использовано или срок истёк' });
  router.get('/', database.handle(async (request, response) => {
    response.json({ links: await database.prepare('SELECT id, expires_at AS expiresAt FROM contact_links WHERE owner_id = ? AND revoked = 0 AND used_by IS NULL AND expires_at > ? ORDER BY created_at DESC').all(request.user.id, now()) });
  }));
  router.post('/', database.handle(async (request, response) => {
    if ((await database.prepare('SELECT COUNT(*) AS n FROM contact_links WHERE owner_id = ? AND revoked = 0 AND used_by IS NULL AND expires_at > ?').get(request.user.id, now())).n >= 5) return response.status(409).json({ message: 'Можно создать не более пяти активных приглашений' });
    const token = randomBytes(32).toString('base64url'), id = randomUUID(), expiresAt = now() + 86400000;
    await database.prepare('INSERT INTO contact_links(id, owner_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(id, request.user.id, hash(token), now(), expiresAt);
    response.status(201).json({ link: { id, token, expiresAt } });
  }));
  router.delete('/:id', database.handle(async (request, response) => {
    const result = await database.prepare('UPDATE contact_links SET revoked = 1 WHERE id = ? AND owner_id = ?').run(request.params.id, request.user.id);
    if (!result.changes) return response.status(404).json({ message: 'Приглашение не найдено' });
    response.json({ ok: true });
  }));
  router.post('/preview', database.handle(async (request, response) => {
    const row = await lookup(request.body?.token);
    if (!row || row.used_by || await blocked(database, row.owner_id, request.user.id)) return unavailable(response);
    response.json({ invitation: { name: row.name, self: row.owner_id === request.user.id, expiresAt: row.expires_at } });
  }));
  router.post('/accept', database.handle(async (request, response) => {
    let result = 'unavailable';
    await database.transaction(async () => {
      const row = await lookup(request.body?.token), owner = request.user.id;
      if (!row || await blocked(database, row.owner_id, owner)) return;
      if (row.owner_id === owner) { result = 'self'; return; }
      if (row.used_by) { if (row.used_by === owner) result = 'ok'; return; }
      const claimed = await database.prepare('UPDATE contact_links SET used_by = ? WHERE id = ? AND used_by IS NULL AND revoked = 0 AND expires_at > ?').run(owner, row.id, now());
      if (!claimed.changes) return;
      await database.prepare("INSERT INTO contact_requests(sender_id, recipient_id, status, created_at) VALUES (?, ?, 'accepted', ?) ON CONFLICT(sender_id, recipient_id) DO UPDATE SET status = 'accepted', created_at = excluded.created_at").run(row.owner_id, owner, now());
      await database.prepare("UPDATE contact_requests SET status = 'accepted' WHERE sender_id = ? AND recipient_id = ?").run(owner, row.owner_id);
      for (const [user, peer, name] of [[owner, row.owner_id, row.name], [row.owner_id, owner, request.user.name]]) {
        const id = randomUUID();
        await database.prepare('INSERT OR IGNORE INTO circle_contacts(owner_id, id, peer_id, name) VALUES (?, ?, ?, ?)').run(user, id, peer, name);
      }
      result = 'ok';
    });
    if (result === 'self') return response.status(400).json({ message: 'Нельзя принять собственное приглашение' });
    if (result !== 'ok') return unavailable(response);
    response.json({ ok: true });
  }));
  return router;
}
module.exports = { createContactLinks };
