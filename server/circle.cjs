const { mapAsync, filterAsync, someAsync, everyAsync } = require('./database.cjs');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { initializeRelationships, blocked, accepted } = require('./relationships.cjs');
const { contactPresences } = require('./presence.cjs');

async function createCircleRouter(database, now = Date.now) {
  await initializeRelationships(database);
  await database.exec(`
    CREATE TABLE IF NOT EXISTS circle_contacts (
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      peer_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT '',
      backup INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner_id, id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS circle_peer ON circle_contacts(owner_id, peer_id) WHERE peer_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS circle_settings (
      owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      primary_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      text TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      UNIQUE(sender_id, client_id)
    );
    CREATE INDEX IF NOT EXISTS chat_pair ON chat_messages(sender_id, recipient_id, id);
    CREATE INDEX IF NOT EXISTS chat_recipient ON chat_messages(recipient_id, sender_id, id);
  `);
  if (!(await database.prepare('PRAGMA table_info(circle_contacts)').all()).some((column) => column.name === 'phone')) await database.exec("ALTER TABLE circle_contacts ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  await database.exec(`
    DELETE FROM circle_contacts WHERE peer_id IS NULL AND phone = '' AND
      ((id = 'dana' AND name = 'Дана' AND relation = 'Подруга') OR (id = 'mom' AND name = 'Мама' AND relation = 'Семья'));
    UPDATE circle_settings SET primary_id = COALESCE((SELECT id FROM circle_contacts WHERE owner_id = circle_settings.owner_id ORDER BY rowid LIMIT 1), '')
      WHERE NOT EXISTS (SELECT 1 FROM circle_contacts WHERE owner_id = circle_settings.owner_id AND id = circle_settings.primary_id);
    UPDATE circle_contacts SET backup = 0 WHERE id = (SELECT primary_id FROM circle_settings WHERE owner_id = circle_contacts.owner_id);
    CREATE TABLE IF NOT EXISTS chat_reads (
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner_id, peer_id)
    );
  `);
  const router = express.Router();
  router.use('/links', await require('./contact-links.cjs').createContactLinks(database, now));
  await database.exec(`CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    PRIMARY KEY (message_id, owner_id)
  )`);
  await database.prepare('INSERT OR IGNORE INTO contact_requests(sender_id, recipient_id, created_at) SELECT owner_id, peer_id, ? FROM circle_contacts WHERE peer_id IS NOT NULL').run(now());
  const invite = async (owner, peer) => {
    if (peer && !(await accepted(database, owner, peer))) await database.prepare("INSERT INTO contact_requests(sender_id, recipient_id, created_at) VALUES (?, ?, ?) ON CONFLICT(sender_id, recipient_id) DO UPDATE SET status = 'pending', created_at = excluded.created_at").run(owner, peer, now());
  };
  async function initialize(owner) {
    await database.prepare("INSERT OR IGNORE INTO circle_settings (owner_id, primary_id) VALUES (?, '')").run(owner);
  }
  async function circle(owner) {
    const people = await database.prepare(`SELECT c.id, c.name, c.relation, c.phone, c.peer_id AS peerId, u.email, u.avatar
      FROM circle_contacts c LEFT JOIN users u ON u.id = c.peer_id WHERE c.owner_id = ? ORDER BY c.rowid`).all(owner);
    const { primary_id: primaryId } = await database.prepare('SELECT primary_id FROM circle_settings WHERE owner_id = ?').get(owner);
    const validPrimary = people.some((person) => person.id === primaryId) ? primaryId : people[0]?.id || null;
    if ((primaryId || null) !== validPrimary) {
      await database.prepare('UPDATE circle_settings SET primary_id = ? WHERE owner_id = ?').run(validPrimary || '', owner);
      if (validPrimary) await database.prepare('UPDATE circle_contacts SET backup = 0 WHERE owner_id = ? AND id = ?').run(owner, validPrimary);
    }
    const backupIds = (await database.prepare('SELECT id FROM circle_contacts WHERE owner_id = ? AND backup = 1 ORDER BY rowid').all(owner)).map((row) => row.id);
    const presences = await contactPresences(database, owner, people.map(person => person.peerId), now());
    for (const person of people) {
      person.presence = presences.get(person.peerId) || null;
      person.connectionStatus = !person.peerId ? 'phone' : (await blocked(database, owner, person.peerId)) ? 'blocked' : (await accepted(database, owner, person.peerId)) ? 'accepted' : (await database.prepare('SELECT status FROM contact_requests WHERE sender_id = ? AND recipient_id = ?').get(owner, person.peerId))?.status || 'pending';
    }
    const invitations = await filterAsync(await database.prepare("SELECT r.sender_id AS peerId, u.name, u.email, u.avatar, r.created_at AS createdAt FROM contact_requests r JOIN users u ON u.id = r.sender_id WHERE r.recipient_id = ? AND r.status = 'pending'").all(owner), async (row) => !(await blocked(database, owner, row.peerId)));
    const blockedPeople = await database.prepare('SELECT u.id AS peerId, u.name, u.avatar FROM user_blocks b JOIN users u ON u.id = b.peer_id WHERE b.owner_id = ?').all(owner);
    return { people, primaryId: validPrimary, backupIds, invitations, blockedPeople };
  }
  router.use(async (request, _response, next) => {await initialize(request.user.id);next();});
  router.get('/contacts', async (request, response) => response.json(await circle(request.user.id)));
  router.post('/invitations/:peer/respond', database.handle(async (request, response) => {
    const { decision } = request.body || {};
    if (!['accepted', 'declined'].includes(decision)) return response.status(400).json({ message: 'Выберите принять или отклонить' });
    const owner = request.user.id,peer = request.params.peer;
    if (await blocked(database, owner, peer)) return response.status(403).json({ message: 'Контакт заблокирован' });
    const row = await database.prepare('SELECT status FROM contact_requests WHERE sender_id = ? AND recipient_id = ?').get(peer, owner);
    if (!row) return response.status(404).json({ message: 'Приглашение не найдено' });
    await database.prepare('UPDATE contact_requests SET status = ? WHERE sender_id = ? AND recipient_id = ?').run(decision, peer, owner);
    if (decision === 'accepted') {
      const user = await database.prepare('SELECT name FROM users WHERE id = ?').get(peer);
      await database.prepare('INSERT OR IGNORE INTO circle_contacts(owner_id, id, peer_id, name) VALUES (?, ?, ?, ?)').run(owner, randomUUID(), peer, user.name);
      await database.prepare("UPDATE circle_settings SET primary_id = (SELECT id FROM circle_contacts WHERE owner_id = ? AND peer_id = ?) WHERE owner_id = ? AND primary_id = ''").run(owner, peer, owner);
    }
    response.json(await circle(owner));
  }));
  router.post('/blocks/:peer', database.handle(async (request, response) => {
    const owner = request.user.id,peer = request.params.peer;
    if (peer === owner || !(await database.prepare('SELECT 1 FROM users WHERE id = ?').get(peer))) return response.status(404).json({ message: 'Контакт не найден' });await database.transaction(async () => {


      await database.prepare('INSERT OR IGNORE INTO user_blocks(owner_id, peer_id) VALUES (?, ?)').run(owner, peer);
      await database.prepare("UPDATE contact_requests SET status = 'declined' WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)").run(owner, peer, peer, owner);
      await database.prepare('DELETE FROM journey_recipients WHERE (peer_id = ? AND journey_id IN (SELECT id FROM journeys WHERE owner_id = ?)) OR (peer_id = ? AND journey_id IN (SELECT id FROM journeys WHERE owner_id = ?))').run(owner, peer, peer, owner);});


    response.json(await circle(owner));
  }));
  router.delete('/blocks/:peer', database.handle(async (request, response) => {
    await database.prepare('DELETE FROM user_blocks WHERE owner_id = ? AND peer_id = ?').run(request.user.id, request.params.peer);
    response.json(await circle(request.user.id));
  }));
  async function findPeer(request, response) {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) {response.status(400).json({ message: 'Введите email контакта' });return;}
    const peer = await database.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
    if (!peer) {response.status(404).json({ message: 'Аккаунт не найден. Попросите контакт зарегистрироваться в SafeWalk.' });return;}
    if (peer.id === request.user.id) {response.status(400).json({ message: 'Выберите email другого человека' });return;}
    if (await blocked(database, request.user.id, peer.id)) {response.status(403).json({ message: 'Контакт недоступен' });return;}
    if (await database.prepare('SELECT id FROM circle_contacts WHERE owner_id = ? AND peer_id = ? AND id != ?').get(request.user.id, peer.id, request.params.id || '')) {
      response.status(409).json({ message: 'Этот человек уже есть в контактах' });return;
    }
    return peer;
  }
  router.post('/contacts', database.handle(async (request, response) => {
    if (!request.body) return response.status(400).json({ message: 'Укажите данные контакта' });
    const peer = request.body?.email ? await findPeer(request, response) : null;
    if (request.body?.email && !peer) return;
    const relation = typeof request.body.relation === 'string' ? request.body.relation.trim() : '';
    const name = typeof request.body.name === 'string' && request.body.name.trim() ? request.body.name.trim() : peer?.name || '';
    const phone = typeof request.body.phone === 'string' ? request.body.phone.replace(/[\s()-]/g, '') : '';
    if (!name || name.length > 50 || relation.length > 50 || phone && !/^\+?\d{8,15}$/.test(phone) || !peer && !phone) return response.status(400).json({ message: 'Укажите имя и телефон либо email аккаунта SafeWalk. Телефон: от 8 до 15 цифр.' });
    const id = randomUUID();
    await database.prepare('INSERT INTO circle_contacts (owner_id, id, peer_id, name, relation, phone) VALUES (?, ?, ?, ?, ?, ?)').run(request.user.id, id, peer?.id || null, name, relation, phone);
    await invite(request.user.id, peer?.id);
    await database.prepare("UPDATE circle_settings SET primary_id = ? WHERE owner_id = ? AND primary_id = ''").run(id, request.user.id);
    response.status(201).json(await circle(request.user.id));
  }));
  router.put('/contacts/:id', database.handle(async (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const relation = typeof request.body?.relation === 'string' ? request.body.relation.trim() : '';
    const phone = typeof request.body?.phone === 'string' ? request.body.phone.replace(/[\s()-]/g, '') : '';
    const contact = await database.prepare('SELECT peer_id FROM circle_contacts WHERE owner_id = ? AND id = ?').get(request.user.id, request.params.id);
    if (!contact) return response.status(404).json({ message: 'Контакт не найден' });
    if (!name || name.length > 50 || relation.length > 50 || phone && !/^\+?\d{8,15}$/.test(phone) || !contact.peer_id && !phone) return response.status(400).json({ message: 'Проверьте имя и телефон контакта' });
    await database.prepare('UPDATE circle_contacts SET name = ?, relation = ?, phone = ? WHERE owner_id = ? AND id = ?').run(name, relation, phone, request.user.id, request.params.id);
    response.json(await circle(request.user.id));
  }));
  router.delete('/contacts/:id', database.handle(async (request, response) => {
    const contact = await database.prepare('SELECT peer_id FROM circle_contacts WHERE owner_id = ? AND id = ?').get(request.user.id, request.params.id);
    if (!contact) return response.status(404).json({ message: 'Контакт не найден' });await database.transaction(async () => {


      await database.prepare('DELETE FROM circle_contacts WHERE owner_id = ? AND id = ?').run(request.user.id, request.params.id);
      if (contact.peer_id) await database.prepare("UPDATE contact_requests SET status = 'declined' WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)").run(request.user.id, contact.peer_id, contact.peer_id, request.user.id);
      if (contact.peer_id) await database.prepare('DELETE FROM journey_recipients WHERE (peer_id = ? AND journey_id IN (SELECT id FROM journeys WHERE owner_id = ?)) OR (peer_id = ? AND journey_id IN (SELECT id FROM journeys WHERE owner_id = ?))').run(contact.peer_id, request.user.id, request.user.id, contact.peer_id);
      await database.prepare("UPDATE circle_settings SET primary_id = COALESCE((SELECT id FROM circle_contacts WHERE owner_id = ? ORDER BY rowid LIMIT 1), '') WHERE owner_id = ? AND primary_id = ?").run(request.user.id, request.user.id, request.params.id);
      await database.prepare('UPDATE circle_contacts SET backup = 0 WHERE owner_id = ? AND id = (SELECT primary_id FROM circle_settings WHERE owner_id = ?)').run(request.user.id, request.user.id);});


    response.json(await circle(request.user.id));
  }));
  router.put('/contacts/:id/link', database.handle(async (request, response) => {
    const contact = await database.prepare('SELECT peer_id FROM circle_contacts WHERE owner_id = ? AND id = ?').get(request.user.id, request.params.id);
    if (!contact) return response.status(404).json({ message: 'Контакт не найден' });
    const peer = await findPeer(request, response);
    if (!peer) return;
    if (contact.peer_id && contact.peer_id !== peer.id) return response.status(409).json({ message: 'Аккаунт уже подключён. Для другого человека создайте отдельный контакт.' });
    await database.prepare('UPDATE circle_contacts SET peer_id = ? WHERE owner_id = ? AND id = ?').run(peer.id, request.user.id, request.params.id);
    await invite(request.user.id, peer.id);
    response.json(await circle(request.user.id));
  }));
  router.put('/selection', database.handle(async (request, response) => {
    const { primaryId, backupIds } = request.body || {};
    const ids = new Set((await circle(request.user.id)).people.map((person) => person.id));
    if ((ids.size ? typeof primaryId !== 'string' || !ids.has(primaryId) : primaryId !== null) || !Array.isArray(backupIds) || backupIds.length > ids.size || new Set(backupIds).size !== backupIds.length || backupIds.some((id) => typeof id !== 'string' || !ids.has(id) || id === primaryId)) {
      return response.status(400).json({ message: 'Выберите основной контакт и отдельные резервные контакты' });
    }await database.transaction(async () => {


      await database.prepare('UPDATE circle_settings SET primary_id = ? WHERE owner_id = ?').run(primaryId || '', request.user.id);
      await database.prepare('UPDATE circle_contacts SET backup = 0 WHERE owner_id = ?').run(request.user.id);
      const update = database.prepare('UPDATE circle_contacts SET backup = 1 WHERE owner_id = ? AND id = ?');
      for (const id of backupIds) await update.run(request.user.id, id);});


    response.json(await circle(request.user.id));
  }));
  router.get('/chats', async (request, response) => {
    const owner = request.user.id;
    const peers = await database.prepare(`SELECT DISTINCT u.id, u.name, u.avatar FROM users u WHERE u.id IN (
      SELECT peer_id FROM circle_contacts WHERE owner_id = ? AND peer_id IS NOT NULL
      UNION SELECT sender_id FROM chat_messages WHERE recipient_id = ?
      UNION SELECT recipient_id FROM chat_messages WHERE sender_id = ?
    )`).all(owner, owner, owner);
    const latest = database.prepare(`SELECT id, sender_id AS senderId, text, sent_at AS sentAt FROM chat_messages
      WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 1`);
    const unread = database.prepare('SELECT COUNT(*) AS count FROM chat_messages WHERE recipient_id = ? AND sender_id = ? AND id > COALESCE((SELECT last_id FROM chat_reads WHERE owner_id = ? AND peer_id = ?), 0)');
    const presences = await contactPresences(database, owner, peers.map(peer => peer.id), now());
    response.json({ chats: (await mapAsync(peers, async (peer) => ({ ...peer, presence: presences.get(peer.id) || null, unreadCount: (await unread.get(owner, peer.id, owner, peer.id)).count, lastMessage: (await latest.get(owner, peer.id, peer.id, owner)) || null }))).
      sort((a, b) => (b.lastMessage?.id || 0) - (a.lastMessage?.id || 0) || a.name.localeCompare(b.name, 'ru')) });
  });
  async function canChat(owner, peer) {
    if (await blocked(database, owner, peer)) return false;
    return owner !== peer && !!(await database.prepare(`SELECT 1 FROM circle_contacts WHERE (owner_id = ? AND peer_id = ?) OR (owner_id = ? AND peer_id = ?)
      UNION SELECT 1 FROM chat_messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) LIMIT 1`).get(owner, peer, peer, owner, owner, peer, peer, owner));
  }
  router.put('/chats/:peer/read', database.handle(async (request, response) => {
    if (!(await canChat(request.user.id, request.params.peer))) return response.status(403).json({ message: 'Чат недоступен' });
    const id = request.body?.lastId;
    if (!Number.isSafeInteger(id) || id < 1 || !(await database.prepare('SELECT 1 FROM chat_messages WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))').get(id, request.user.id, request.params.peer, request.params.peer, request.user.id))) return response.status(400).json({ message: 'Сообщение не найдено в этом чате' });
    await database.prepare('INSERT INTO chat_reads (owner_id, peer_id, last_id) VALUES (?, ?, ?) ON CONFLICT(owner_id, peer_id) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)').run(request.user.id, request.params.peer, id);
    response.json({ ok: true });
  }));
  router.use('/chats/:peer/messages', async (request, response, next) => {
    if (!(await canChat(request.user.id, request.params.peer))) return response.status(403).json({ message: 'Добавьте человека в контакты, чтобы начать переписку' });
    next();
  });
  router.get('/chats/:peer/messages', async (request, response) => {
    const { before, after } = request.query;
    if (before !== undefined && !/^[1-9]\d{0,14}$/.test(before) || after !== undefined && !/^\d{1,15}$/.test(after) || before !== undefined && after !== undefined) return response.status(400).json({ message: 'Некорректная страница сообщений' });
    const ascending = after !== undefined;
    const rows = await database.prepare(`SELECT id, sender_id AS senderId, text, sent_at AS sentAt FROM chat_messages
      WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
      ${before !== undefined ? 'AND id < ?' : ascending ? 'AND id > ?' : ''} ORDER BY id ${ascending ? 'ASC' : 'DESC'} LIMIT 101`).
    all(request.user.id, request.params.peer, request.params.peer, request.user.id, ...((before ?? after) !== undefined ? [Number(before ?? after)] : []));
    const hasMore = rows.length > 100;
    const messages = rows.slice(0, 100);
    const reactionFrom = request.query.reactionFrom;
    if (reactionFrom !== undefined && !/^[1-9]\d{0,14}$/.test(reactionFrom)) return response.status(400).json({ message: 'Некорректный курсор реакций' });
    const from = reactionFrom ? Number(reactionFrom) : Math.min(...messages.map(item => item.id), Number.MAX_SAFE_INTEGER);
    const reactions = await database.prepare(`SELECT r.message_id AS messageId, r.owner_id AS ownerId, r.emoji FROM message_reactions r JOIN chat_messages m ON m.id = r.message_id
      WHERE m.id >= ? AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))`).all(from, request.user.id, request.params.peer, request.params.peer, request.user.id);
    const peerReadId = (await database.prepare('SELECT last_id FROM chat_reads WHERE owner_id = ? AND peer_id = ?').get(request.params.peer, request.user.id))?.last_id || 0;
    const presences = await contactPresences(database, request.user.id, [request.params.peer], now());
    response.json({ messages: ascending ? messages : messages.reverse(), hasMore, peerReadId, reactions, presence: presences.get(request.params.peer) || null });
  });
  router.put('/chats/:peer/messages/:message/reaction', database.handle(async (request, response) => {
    if (!(await canChat(request.user.id, request.params.peer))) return response.status(403).json({ message: 'Чат недоступен' });
    const { emoji } = request.body || {};
    if (!/^\d{1,15}$/.test(request.params.message) || (emoji !== null && !['❤️', '👍', '😂', '😮', '😢', '🙏'].includes(emoji))) return response.status(400).json({ message: 'Выберите реакцию' });
    const id = Number(request.params.message);
    if (!(await database.prepare('SELECT id FROM chat_messages WHERE id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))').get(id, request.user.id, request.params.peer, request.params.peer, request.user.id))) return response.status(404).json({ message: 'Сообщение не найдено' });
    if (emoji === null) await database.prepare('DELETE FROM message_reactions WHERE message_id = ? AND owner_id = ?').run(id, request.user.id);
    else await database.prepare('INSERT INTO message_reactions(message_id, owner_id, emoji) VALUES (?, ?, ?) ON CONFLICT(message_id, owner_id) DO UPDATE SET emoji = excluded.emoji').run(id, request.user.id, emoji);
    response.json({ reactions: await database.prepare('SELECT message_id AS messageId, owner_id AS ownerId, emoji FROM message_reactions WHERE message_id = ?').all(id) });
  }));
  router.post('/chats/:peer/messages', database.handle(async (request, response) => {
    if (!(await accepted(database, request.user.id, request.params.peer))) return response.status(403).json({ message: 'Дождитесь принятия приглашения в контакты' });
    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
    const clientId = request.body?.clientId;
    if (!text || text.length > 2000 || typeof clientId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(clientId)) return response.status(400).json({ message: 'Введите сообщение длиной от 1 до 2000 символов' });
    const existing = await database.prepare('SELECT id, sender_id AS senderId, recipient_id AS recipientId, text, sent_at AS sentAt FROM chat_messages WHERE sender_id = ? AND client_id = ?').get(request.user.id, clientId);
    if (existing) {
      if (existing.recipientId !== request.params.peer || existing.text !== text) return response.status(409).json({ message: 'Идентификатор сообщения уже использован' });
      const { recipientId, ...message } = existing;
      return response.json({ message });
    }
    const sentAt = now();
    const result = await database.prepare('INSERT INTO chat_messages (sender_id, recipient_id, client_id, text, sent_at) VALUES (?, ?, ?, ?, ?)').run(request.user.id, request.params.peer, clientId, text, sentAt);
    response.status(201).json({ message: { id: Number(result.lastInsertRowid), senderId: request.user.id, text, sentAt } });
  }));
  return router;
}
module.exports = { createCircleRouter };
