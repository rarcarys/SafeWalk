const { mapAsync, filterAsync, someAsync, everyAsync } = require('./database.cjs');
const express = require('express');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { accepted } = require('./relationships.cjs');
const { guestPage } = require('./share-page.cjs');

async function createSafetyTools(database, now = Date.now) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS checkin_timers (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL, minutes INTEGER NOT NULL, expected_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', peers TEXT NOT NULL,
      notified_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(owner_id, client_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_checkin_timer ON checkin_timers(owner_id) WHERE status IN ('active', 'alerted');
    CREATE TABLE IF NOT EXISTS checkin_actions (
      timer_id TEXT NOT NULL REFERENCES checkin_timers(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL, action TEXT NOT NULL, PRIMARY KEY(timer_id, client_id)
    );
    CREATE TABLE IF NOT EXISTS safety_presets (
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot TEXT NOT NULL, config TEXT NOT NULL, PRIMARY KEY(owner_id, slot)
    );
    CREATE TABLE IF NOT EXISTS safety_settings (
      owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, applied_slot TEXT
    );
    CREATE TABLE IF NOT EXISTS journey_links (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS journey_links_expiry ON journey_links(expires_at);
    CREATE TRIGGER IF NOT EXISTS revoke_journey_links AFTER UPDATE ON journeys
      WHEN NEW.status != 'active' OR NEW.sharing = 0 BEGIN
      UPDATE journey_links SET revoked = 1 WHERE journey_id = NEW.id;
    END;
  `);
  if (!(await database.prepare('PRAGMA table_info(checkin_timers)').all()).some((column) => column.name === 'notified_count')) await database.exec('ALTER TABLE checkin_timers ADD COLUMN notified_count INTEGER NOT NULL DEFAULT 0');
  const router = express.Router(),publicRouter = express.Router();
  const hash = (token) => createHash('sha256').update(token).digest('hex');
  const keyValid = (key) => typeof key === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(key);
  const slots = ['taxi', 'meeting', 'walk'];
  const transaction = async (operation) => await database.transaction(operation);
  const timerJSON = (row) => row ? { id: row.id, minutes: row.minutes, expectedAt: row.expected_at, alertAt: row.expected_at + 60000, status: row.status, notifiedCount: row.notified_count, peers: JSON.parse(row.peers).map(({ name }) => ({ name })) } : null;
  const message = async (owner, peer, key, text) => await database.prepare('INSERT OR IGNORE INTO chat_messages(sender_id, recipient_id, client_id, text, sent_at) VALUES (?, ?, ?, ?, ?)').run(owner, peer, key, text, now());
  async function selection(owner, ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 10 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || id.length > 100)) return null;
    const contacts = await database.prepare('SELECT id, peer_id AS peerId, name FROM circle_contacts WHERE owner_id = ?').all(owner);
    const people = ids.map((id) => contacts.find((person) => person.id === id));
    return (await everyAsync(people, async (person) => person?.peerId && (await accepted(database, owner, person.peerId)))) ? people : null;
  }
  async function broadcast(row, event, text) {
    let count = 0;
    for (const person of JSON.parse(row.peers)) {
      if ((await accepted(database, row.owner_id, person.peerId)) && (await database.prepare('SELECT 1 FROM circle_contacts WHERE owner_id = ? AND peer_id = ?').get(row.owner_id, person.peerId))) {
        await message(row.owner_id, person.peerId, `timer_${row.id}_${event}_${person.peerId}`, text);
        count++;
      }
    }
    return count;
  }
  async function processDue() {
    await transaction(async () => {
      for (const row of await database.prepare("SELECT c.*, u.name FROM checkin_timers c JOIN users u ON u.id = c.owner_id WHERE status = 'active' AND expected_at + 60000 <= ?").all(now())) {
        const count = await broadcast(row, 'alert', `SOS — проверка безопасности: ${row.name} не подтвердил(а), что всё в порядке. Пожалуйста, свяжитесь с отправителем.`);
        await database.prepare("UPDATE checkin_timers SET status = 'alerted', notified_count = ? WHERE id = ?").run(count, row.id);
      }
      await database.prepare("DELETE FROM checkin_timers WHERE status NOT IN ('active', 'alerted') AND created_at < ?").run(now() - 30 * 86400000);
      await database.prepare('DELETE FROM journey_links WHERE expires_at < ?').run(now() - 86400000);
    });
  }
  router.get('/state', async (request, response) => {
    await processDue();
    const owner = request.user.id;
    response.json({
      timer: timerJSON(await database.prepare("SELECT * FROM checkin_timers WHERE owner_id = ? AND status IN ('active', 'alerted')").get(owner)),
      presets: (await database.prepare('SELECT slot, config FROM safety_presets WHERE owner_id = ?').all(owner)).map((row) => ({ slot: row.slot, ...JSON.parse(row.config) })),
      appliedPreset: await (async () => {const row = await database.prepare('SELECT p.slot, p.config FROM safety_settings s JOIN safety_presets p ON p.owner_id = s.owner_id AND p.slot = s.applied_slot WHERE s.owner_id = ?').get(owner);return row ? { slot: row.slot, ...JSON.parse(row.config) } : null;})(),
      links: await database.prepare(`SELECT l.id, l.journey_id AS journeyId, l.expires_at AS expiresAt FROM journey_links l JOIN journeys j ON j.id = l.journey_id
        WHERE l.owner_id = ? AND l.revoked = 0 AND l.expires_at > ? AND j.status = 'active' AND j.sharing = 1`).all(owner, now())
    });
  });
  router.post('/timers', database.handle(async (request, response) => {
    const body = request.body || {},owner = request.user.id;
    if (!keyValid(body.clientId)) return response.status(400).json({ message: 'Некорректный идентификатор таймера' });
    const previous = await database.prepare('SELECT * FROM checkin_timers WHERE owner_id = ? AND client_id = ?').get(owner, body.clientId);
    if (previous) return response.json({ timer: timerJSON(previous) });
    const peers = await selection(owner, body.contactIds);
    if (![15, 30, 60].includes(body.minutes) || !peers) return response.status(400).json({ message: 'Выберите время и контакты с принятым приглашением' });
    if (await database.prepare("SELECT id FROM checkin_timers WHERE owner_id = ? AND status IN ('active', 'alerted')").get(owner)) return response.status(409).json({ message: 'Сначала завершите текущую проверку' });
    const id = randomUUID();
    await transaction(async () => {
      await database.prepare('INSERT INTO checkin_timers(id, owner_id, client_id, minutes, expected_at, created_at, peers) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, owner, body.clientId, body.minutes, now() + body.minutes * 60000, now(), JSON.stringify(peers));
      await broadcast(await database.prepare('SELECT * FROM checkin_timers WHERE id = ?').get(id), 'start', `${request.user.name}: включена проверка безопасности через ${body.minutes} мин. Если я не отвечу в течение минуты после таймера, вам придёт тревога.`);
    });
    response.status(201).json({ timer: timerJSON(await database.prepare('SELECT * FROM checkin_timers WHERE id = ?').get(id)) });
  }));
  router.post('/timers/:id/action', database.handle(async (request, response) => {
    const row = await database.prepare('SELECT * FROM checkin_timers WHERE id = ? AND owner_id = ?').get(request.params.id, request.user.id);
    if (!row) return response.status(404).json({ message: 'Таймер не найден' });
    const { action, clientId } = request.body || {};
    if (!['confirm', 'cancel', 'extend'].includes(action) || !keyValid(clientId)) return response.status(400).json({ message: 'Некорректное действие таймера' });
    const previous = await database.prepare('SELECT action FROM checkin_actions WHERE timer_id = ? AND client_id = ?').get(row.id, clientId);
    if (previous) return previous.action === action ? response.json({ timer: timerJSON(row) }) : response.status(409).json({ message: 'Идентификатор действия уже использован' });
    if (!['active', 'alerted'].includes(row.status)) return response.status(409).json({ message: 'Проверка уже завершена' });
    if (action === 'extend' && (row.status !== 'active' || row.expected_at > now() + 24 * 60 * 60000)) return response.status(409).json({ message: 'Эту проверку уже нельзя продлить' });
    await transaction(async () => {
      await database.prepare('INSERT INTO checkin_actions VALUES (?, ?, ?)').run(row.id, clientId, action);
      if (action === 'extend') await database.prepare('UPDATE checkin_timers SET expected_at = MAX(expected_at, ?) + 900000 WHERE id = ?').run(now(), row.id);else
      await database.prepare('UPDATE checkin_timers SET status = ? WHERE id = ?').run(action === 'confirm' ? 'confirmed' : 'cancelled', row.id);
      await broadcast(row, clientId, `${request.user.name}: ${action === 'confirm' ? 'всё в порядке, проверка завершена.' : action === 'cancel' ? 'проверка безопасности отменена.' : 'проверка безопасности продлена на 15 минут.'}`);
    });
    response.json({ timer: timerJSON(await database.prepare('SELECT * FROM checkin_timers WHERE id = ?').get(row.id)) });
  }));
  router.put('/presets/:slot', database.handle(async (request, response) => {
    const body = request.body || {},owner = request.user.id;
    if (!slots.includes(request.params.slot) || ![15, 30, 60].includes(body.minutes) || typeof body.sharing !== 'boolean' || !Array.isArray(body.backupIds) || body.backupIds.includes(body.primaryId) ||
    !(await selection(owner, [body.primaryId, ...body.backupIds]))) return response.status(400).json({ message: 'Проверьте время, геопозицию и контакты сценария' });
    const config = { minutes: body.minutes, sharing: body.sharing, primaryId: body.primaryId, backupIds: body.backupIds };
    await database.prepare('INSERT INTO safety_presets VALUES (?, ?, ?) ON CONFLICT(owner_id, slot) DO UPDATE SET config = excluded.config').run(owner, request.params.slot, JSON.stringify(config));
    response.json({ preset: { slot: request.params.slot, ...config } });
  }));
  router.post('/presets/:slot/apply', database.handle(async (request, response) => {
    const row = await database.prepare('SELECT config FROM safety_presets WHERE owner_id = ? AND slot = ?').get(request.user.id, request.params.slot);
    if (!row) return response.status(404).json({ message: 'Сценарий не найден' });
    const config = JSON.parse(row.config),owner = request.user.id;
    if (!(await selection(owner, [config.primaryId, ...config.backupIds]))) return response.status(409).json({ message: 'Обновите контакты сохранённого сценария' });
    if (await database.prepare("SELECT id FROM journeys WHERE owner_id = ? AND status IN ('active', 'pending')").get(owner)) return response.status(409).json({ message: 'Сценарий можно применить перед началом поездки' });
    await transaction(async () => {
      await database.prepare('INSERT INTO safety_settings(owner_id, applied_slot) VALUES (?, ?) ON CONFLICT(owner_id) DO UPDATE SET applied_slot = excluded.applied_slot').run(owner, request.params.slot);
      await database.prepare('INSERT INTO circle_settings VALUES (?, ?) ON CONFLICT(owner_id) DO UPDATE SET primary_id = excluded.primary_id').run(owner, config.primaryId);
      await database.prepare('UPDATE circle_contacts SET backup = 0 WHERE owner_id = ?').run(owner);
      for (const id of config.backupIds) await database.prepare('UPDATE circle_contacts SET backup = 1 WHERE owner_id = ? AND id = ?').run(owner, id);
      await database.prepare('INSERT OR IGNORE INTO preferences(owner_id) VALUES (?)').run(owner);
      await database.prepare('UPDATE preferences SET sharing = ? WHERE owner_id = ?').run(+config.sharing, owner);
    });
    response.json({ preset: { slot: request.params.slot, ...config } });
  }));
  router.delete('/presets/:slot', database.handle(async (request, response) => {
    await database.prepare('DELETE FROM safety_presets WHERE owner_id = ? AND slot = ?').run(request.user.id, request.params.slot);
    response.json({ ok: true });
  }));
  router.post('/links', database.handle(async (request, response) => {
    const { journeyId, minutes } = request.body || {};
    const journey = typeof journeyId === 'string' && (await database.prepare("SELECT * FROM journeys WHERE id = ? AND owner_id = ? AND status = 'active' AND sharing = 1").get(journeyId, request.user.id));
    if (!journey || ![15, 30, 60].includes(minutes)) return response.status(400).json({ message: 'Для ссылки нужна активная прогулка с передачей геопозиции' });
    if ((await database.prepare('SELECT COUNT(*) AS n FROM journey_links WHERE owner_id = ? AND revoked = 0 AND expires_at > ?').get(request.user.id, now())).n >= 5) return response.status(409).json({ message: 'Можно создать не более пяти активных ссылок' });
    const token = randomBytes(32).toString('base64url'),id = randomUUID(),expiresAt = now() + minutes * 60000;
    await database.prepare('INSERT INTO journey_links(id, token_hash, owner_id, journey_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, hash(token), request.user.id, journey.id, now(), expiresAt);
    // The fragment keeps the access key out of ordinary HTTP access logs.
    response.status(201).json({ link: { id, expiresAt, path: `/share#${token}` } });
  }));
  router.delete('/links/:id', database.handle(async (request, response) => {
    const result = await database.prepare('UPDATE journey_links SET revoked = 1 WHERE id = ? AND owner_id = ?').run(request.params.id, request.user.id);
    if (!result.changes) return response.status(404).json({ message: 'Ссылка не найдена' });
    response.json({ ok: true });
  }));
  publicRouter.use((request, response, next) => {
    if (['/share', '/share.js', '/api/public/journey'].includes(request.path)) response.set({
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      // A local Wi-Fi API may serve HTTP. Do not upgrade its script/fetch URLs
      // to a nonexistent HTTPS listener; keep all page resources on this origin.
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    });
    next();
  });
  publicRouter.get('/share', (_request, response) => response.type('html').send(guestPage));
  publicRouter.post('/api/public/journey', async (request, response) => {
    const token = request.body?.token;
    if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return response.status(404).json({ message: 'Ссылка недоступна или срок её действия истёк' });
    const row = await database.prepare(`SELECT j.*, l.expires_at FROM journey_links l JOIN journeys j ON j.id = l.journey_id
      WHERE token_hash = ? AND revoked = 0 AND expires_at > ? AND j.status = 'active' AND j.sharing = 1`).get(hash(token), now());
    if (!row) return response.status(404).json({ message: 'Ссылка недоступна или срок её действия истёк' });
    const details = JSON.parse(row.details);
    response.json({ target: details.target, expectedAt: row.expected_at, expiresAt: row.expires_at, position: row.position ? JSON.parse(row.position) : null });
  });
  publicRouter.get('/share.js', (_request, response) => response.type('js').send(require('./share-page.cjs').guestScript));
  const timer = setInterval(async () => {try {await processDue();} catch (error) {console.error('Safety timer:', error.code || error.name);}}, 10000);
  timer.unref();
  return { router, publicRouter, processDue, close: () => clearInterval(timer) };
}
module.exports = { createSafetyTools };
