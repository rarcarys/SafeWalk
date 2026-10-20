const express = require('express');

async function createNotificationService(database, { now = Date.now, enabled = process.env.SAFEWALK_PUSH_ENABLED === '1', fetcher = fetch } = {}) {
  await database.exec(`CREATE TABLE IF NOT EXISTS push_devices (
    token TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS push_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, reference TEXT NOT NULL, created_at INTEGER NOT NULL,
    UNIQUE(owner_id, kind, reference)
  );
  CREATE TABLE IF NOT EXISTS push_deliveries (
    job_id INTEGER NOT NULL REFERENCES push_jobs(id) ON DELETE CASCADE,
    token TEXT NOT NULL REFERENCES push_devices(token) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    next_at INTEGER NOT NULL DEFAULT 0, ticket TEXT, error TEXT,
    PRIMARY KEY(job_id, token)
  );
  CREATE TRIGGER IF NOT EXISTS push_chat_insert AFTER INSERT ON chat_messages BEGIN
    INSERT OR IGNORE INTO push_jobs(owner_id, kind, reference, created_at)
    VALUES (NEW.recipient_id, CASE WHEN NEW.text LIKE 'SOS %' THEN 'sos' ELSE 'message' END, CAST(NEW.id AS TEXT), NEW.sent_at);
  END;
  CREATE TRIGGER IF NOT EXISTS push_invite_insert AFTER INSERT ON contact_requests BEGIN
    INSERT OR IGNORE INTO push_jobs(owner_id, kind, reference, created_at) VALUES (NEW.recipient_id, 'invitation', NEW.sender_id, NEW.created_at);
  END;`);
  const router = express.Router();
  router.get('/sos', database.handle(async (request, response) => {
    const alerts = await database.prepare(`SELECT e.owner_id AS senderId, e.client_id AS clientId, e.created_at AS sentAt,
      u.name AS senderName, m.id, m.text, e.payload FROM sos_recipients r
      JOIN sos_events e ON e.owner_id = r.owner_id AND e.client_id = r.client_id
      JOIN users u ON u.id = e.owner_id JOIN chat_messages m ON m.id = r.message_id
      WHERE r.peer_id = ? AND r.acknowledged_at IS NULL AND e.created_at >= ?
      AND EXISTS (SELECT 1 FROM contact_requests c WHERE c.status = 'accepted' AND
        ((c.sender_id = e.owner_id AND c.recipient_id = r.peer_id) OR (c.sender_id = r.peer_id AND c.recipient_id = e.owner_id)))
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.owner_id = r.peer_id AND b.peer_id = e.owner_id) OR (b.owner_id = e.owner_id AND b.peer_id = r.peer_id))
      ORDER BY e.created_at, e.owner_id, e.client_id LIMIT 50`).all(request.user.id, now() - 86400000);
    response.json({ alerts: alerts.map(({ payload, ...alert }) => ({ ...alert, kind: 'sos', note: JSON.parse(payload).note || '' })) });
  }));
  await database.exec(`CREATE TABLE IF NOT EXISTS message_receipts (
    message_id INTEGER PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,
    received_at INTEGER NOT NULL
  )`);
  router.post('/received', database.handle(async (request, response) => {
    const ids = request.body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) return response.status(400).json({ message: 'Некорректные сообщения' });
    await database.transaction(async () => {
      for (const id of ids) await database.prepare(`INSERT OR IGNORE INTO message_receipts(message_id, received_at)
        SELECT id, ? FROM chat_messages WHERE id = ? AND recipient_id = ?`).run(now(), id, request.user.id);
    });
    response.json({ ok: true });
  }));
  router.get('/messages', database.handle(async (request, response) => {
    const after = request.query.after;
    if (after !== undefined && !/^\d{1,15}$/.test(after)) return response.status(400).json({ message: 'Некорректный курсор уведомлений' });
    const latest = (await database.prepare('SELECT MAX(id) AS id FROM chat_messages WHERE recipient_id = ?').get(request.user.id))?.id || 0;
    if (after === undefined) return response.json({ messages: [], cursor: latest, hasMore: false });
    const messages = await database.prepare(`SELECT m.id, m.sender_id AS senderId, u.name AS senderName, m.text, m.sent_at AS sentAt,
      CASE WHEN EXISTS (SELECT 1 FROM sos_recipients r WHERE r.message_id = m.id AND r.peer_id = m.recipient_id) THEN 'sos' ELSE 'message' END AS kind
      FROM chat_messages m JOIN users u ON u.id = m.sender_id
      WHERE m.recipient_id = ? AND m.id > ? AND m.id > COALESCE((SELECT last_id FROM chat_reads WHERE owner_id = m.recipient_id AND peer_id = m.sender_id), 0)
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.owner_id = m.recipient_id AND b.peer_id = m.sender_id) OR (b.owner_id = m.sender_id AND b.peer_id = m.recipient_id))
      ORDER BY m.id LIMIT 51`).all(request.user.id, Number(after));
    const page = messages.slice(0, 50);
    response.json({ messages: page, cursor: messages.length > 50 ? page.at(-1).id : latest, hasMore: messages.length > 50 });
  }));
  router.get('/status', async (request, response) => response.json({ enabled, devices: (await database.prepare('SELECT COUNT(*) AS n FROM push_devices WHERE owner_id = ?').get(request.user.id)).n }));
  router.post('/devices', database.handle(async (request, response) => {
    const token = request.body?.token;
    if (typeof token !== 'string' || !/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(token)) return response.status(400).json({ message: 'Некорректный токен уведомлений' });
    await database.prepare('INSERT INTO push_devices(token, owner_id, session_hash) VALUES (?, ?, ?) ON CONFLICT(token) DO UPDATE SET owner_id = excluded.owner_id, session_hash = excluded.session_hash').run(token, request.user.id, request.sessionHash);
    response.json({ ok: true, enabled });
  }));
  router.delete('/devices', database.handle(async (request, response) => {
    await database.prepare('DELETE FROM push_devices WHERE owner_id = ? AND session_hash = ?').run(request.user.id, request.sessionHash);
    response.json({ ok: true });
  }));
  let running = false,closed = false;
  const api = async (endpoint, body) => {
    const response = await fetcher(`https://exp.host/--/api/v2/push/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  };
  async function processPending() {
    if (!enabled || running || closed) return;
    running = true;
    try {
      await database.prepare('DELETE FROM push_jobs WHERE created_at < ?').run(now() - 7 * 86400000);
      await database.prepare(`INSERT OR IGNORE INTO push_deliveries(job_id, token)
        SELECT j.id, d.token FROM push_jobs j JOIN push_devices d ON d.owner_id = j.owner_id
        JOIN sessions s ON s.token_hash = d.session_hash
        WHERE j.created_at >= ? AND s.expires_at > ?`).run(now() - 3600000, now());
      const jobs = await database.prepare(`SELECT p.*, j.kind, j.reference, j.created_at FROM push_deliveries p JOIN push_jobs j ON j.id = p.job_id
        JOIN push_devices d ON d.token = p.token AND d.owner_id = j.owner_id JOIN sessions s ON s.token_hash = d.session_hash
        WHERE p.status IN ('pending', 'provider_accepted') AND p.next_at <= ? AND s.expires_at > ? LIMIT 20`).all(now(), now());
      for (const job of jobs) {
        if (closed) break;
        const chatMessage = ['message', 'sos'].includes(job.kind) ? await database.prepare('SELECT sender_id, recipient_id FROM chat_messages WHERE id = ?').get(Number(job.reference)) : null;
        if (job.kind === 'message' && job.status === 'pending' && (!chatMessage || (await database.prepare('SELECT last_id FROM chat_reads WHERE owner_id = ? AND peer_id = ?').get(chatMessage.recipient_id, chatMessage.sender_id))?.last_id >= Number(job.reference) || chatMessage && await database.prepare('SELECT 1 FROM user_blocks WHERE (owner_id = ? AND peer_id = ?) OR (owner_id = ? AND peer_id = ?)').get(chatMessage.sender_id, chatMessage.recipient_id, chatMessage.recipient_id, chatMessage.sender_id))) {
          await database.prepare("UPDATE push_deliveries SET status = 'expired' WHERE job_id = ? AND token = ?").run(job.job_id, job.token);
          continue;
        }
        if (job.kind === 'checkin' && job.status === 'pending' && !(await database.prepare("SELECT id FROM journeys WHERE owner_id = (SELECT owner_id FROM push_jobs WHERE id = ?) AND status = 'active' AND scenario = 1 AND 'journey_' || id || '_' || expected_at = ?").get(job.job_id, job.reference))) {
          await database.prepare("UPDATE push_deliveries SET status = 'expired' WHERE job_id = ? AND token = ?").run(job.job_id, job.token);
          continue;
        }
        if (now() - job.created_at > (job.kind === 'sos' ? 300000 : 3600000) && job.status === 'pending') {
          await database.prepare("UPDATE push_deliveries SET status = 'expired' WHERE job_id = ? AND token = ?").run(job.job_id, job.token);continue;
        }
        try {
          let result;
          if (job.status === 'provider_accepted') {
            result = (await api('getReceipts', { ids: [job.ticket] })).data?.[job.ticket];
            if (closed) break;
            if (!result) {
              await database.prepare("UPDATE push_deliveries SET status = 'unknown', error = 'ReceiptUnavailable' WHERE job_id = ? AND token = ?").run(job.job_id, job.token);continue;
            }
          } else {
            // Do not put chat text, names or coordinates on the lock screen.
            result = (await api('send', { to: job.token, title: 'SafeWalk', body: job.kind === 'checkin' ? 'Ты в порядке? Подтвердите прибытие или добавьте время.' : job.kind === 'sos' ? 'Контакт отправил SOS. Откройте SafeWalk.' : job.kind === 'invitation' ? 'Новое приглашение в контакты' : 'Новое сообщение или событие прогулки', sound: 'default', channelId: 'safewalk', priority: 'high', data: { kind: job.kind, ...(chatMessage ? { peerId: chatMessage.sender_id, messageId: Number(job.reference) } : {}), page: job.kind === 'checkin' ? 'route' : job.kind === 'invitation' ? 'contacts' : 'chats', ownerId: (await database.prepare('SELECT owner_id FROM push_jobs WHERE id = ?').get(job.job_id))?.owner_id } })).data;
            if (closed) break;
          }
          if (result?.status !== 'ok') {
            const error = result?.details?.error || 'ProviderError';
            if (error === 'DeviceNotRegistered') await database.prepare('DELETE FROM push_devices WHERE token = ?').run(job.token);else
            await database.prepare("UPDATE push_deliveries SET status = 'failed', error = ? WHERE job_id = ? AND token = ?").run(error, job.job_id, job.token);
          } else if (job.status === 'provider_accepted') await database.prepare("UPDATE push_deliveries SET status = 'provider_confirmed' WHERE job_id = ? AND token = ?").run(job.job_id, job.token);else
          await database.prepare("UPDATE push_deliveries SET status = 'provider_accepted', ticket = ?, next_at = ? WHERE job_id = ? AND token = ?").run(result.id, now() + 15 * 60000, job.job_id, job.token);
        } catch {
          if (!closed) await database.prepare("UPDATE push_deliveries SET attempts = attempts + 1, next_at = ?, status = CASE WHEN attempts >= 7 THEN 'failed' ELSE status END, error = 'DeliveryError' WHERE job_id = ? AND token = ?").run(now() + Math.min(300000, 2000 * 2 ** job.attempts), job.job_id, job.token);
        }
      }
    } finally {running = false;}
  }
  const timer = setInterval(() => processPending().catch((error) => console.error('Push worker:', error.name)), 5000);
  timer.unref();
  return { router, processPending, close: () => {closed = true;clearInterval(timer);} };
}
module.exports = { createNotificationService };
