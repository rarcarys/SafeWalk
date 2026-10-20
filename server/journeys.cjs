const { mapAsync, filterAsync, someAsync, everyAsync } = require('./database.cjs');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { accepted } = require('./relationships.cjs');

async function createJourneyService(database, now = Date.now) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      sharing INTEGER NOT NULL DEFAULT 0, reminder INTEGER NOT NULL DEFAULT 1, scenario INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS saved_places (
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot TEXT NOT NULL, point TEXT NOT NULL, PRIMARY KEY(owner_id, slot)
    );
    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      details TEXT NOT NULL, started_at INTEGER NOT NULL, expected_at INTEGER NOT NULL,
      ended_at INTEGER, extra_minutes INTEGER NOT NULL DEFAULT 0,
      sharing INTEGER NOT NULL, scenario INTEGER NOT NULL, position TEXT,
      UNIQUE(owner_id, client_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS journey_active ON journeys(owner_id) WHERE status = 'active';
    CREATE TABLE IF NOT EXISTS journey_recipients (
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL, notified INTEGER NOT NULL DEFAULT 0, acknowledged_at INTEGER,
      PRIMARY KEY(journey_id, peer_id)
    );
    CREATE TABLE IF NOT EXISTS journey_actions (
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL, action TEXT NOT NULL, PRIMARY KEY(journey_id, client_id)
    );
    CREATE TABLE IF NOT EXISTS sos_events (
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY(owner_id, client_id)
    );
    CREATE TABLE IF NOT EXISTS sos_recipients (
      owner_id TEXT NOT NULL, client_id TEXT NOT NULL,
      peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
      acknowledged_at INTEGER,
      PRIMARY KEY(owner_id, client_id, peer_id),
      FOREIGN KEY(owner_id, client_id) REFERENCES sos_events(owner_id, client_id) ON DELETE CASCADE
    );
  `);
  if (!(await database.prepare('PRAGMA table_info(journey_recipients)').all()).some((column) => column.name === 'consent')) {
    await database.exec("ALTER TABLE journey_recipients ADD COLUMN consent TEXT NOT NULL DEFAULT 'pending'");
  }
  if (!(await database.prepare('PRAGMA table_info(preferences)').all()).some((column) => column.name === 'retention_days')) await database.exec('ALTER TABLE preferences ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 30');
  if (!(await database.prepare('PRAGMA table_info(sos_recipients)').all()).some(column => column.name === 'route_started_at')) await database.exec('ALTER TABLE sos_recipients ADD COLUMN route_started_at INTEGER');
  if (!(await database.prepare('PRAGMA table_info(sos_recipients)').all()).some((column) => column.name === 'role')) {
    await database.exec("ALTER TABLE sos_recipients ADD COLUMN role TEXT NOT NULL DEFAULT 'primary'");
    await database.exec("UPDATE sos_recipients SET role = 'backup' WHERE EXISTS (SELECT 1 FROM circle_contacts c WHERE c.owner_id = sos_recipients.owner_id AND c.peer_id = sos_recipients.peer_id AND c.backup = 1)");
  }
  for (const [column, value] of [['delay_minutes', 5], ['escalation_minutes', 5]]) {
    if (!(await database.prepare('PRAGMA table_info(preferences)').all()).some((item) => item.name === column)) await database.exec(`ALTER TABLE preferences ADD COLUMN ${column} INTEGER NOT NULL DEFAULT ${value}`);
  }
  await database.exec(`CREATE TABLE IF NOT EXISTS safety_events (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY(owner_id, reference, kind)
  );
  CREATE TABLE IF NOT EXISTS favorite_routes (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot TEXT NOT NULL, plan TEXT NOT NULL, PRIMARY KEY(owner_id, slot)
  )`);
  await database.exec("DROP INDEX IF EXISTS journey_active; CREATE UNIQUE INDEX journey_active ON journeys(owner_id) WHERE status IN ('active', 'pending')");
  for (const row of await database.prepare("SELECT id, details FROM journeys WHERE status = 'pending'").all()) {
    await database.prepare("UPDATE journeys SET status = 'active', started_at = ?, expected_at = ? WHERE id = ?").run(now(), now() + JSON.parse(row.details).minutes * 60000, row.id);
  }
  const router = express.Router();
  await database.exec(`CREATE TABLE IF NOT EXISTS hidden_journey_entries (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, reference TEXT NOT NULL, PRIMARY KEY(owner_id, kind, reference)
  )`);
  router.delete('/entries', database.handle(async (request, response) => {
    const { kind, id, ownerId } = request.body || {};
    const owner = request.user.id;
    if (kind === 'journey' && typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)) {
      const row = await database.prepare(`SELECT j.status FROM journeys j WHERE j.id = ? AND (j.owner_id = ? OR EXISTS (SELECT 1 FROM journey_recipients r WHERE r.journey_id = j.id AND r.peer_id = ?))`).get(id, owner, owner);
      if (!row) return response.status(404).json({ message: 'Запись не найдена' });
      if (['active', 'pending'].includes(row.status)) return response.status(409).json({ message: 'Сначала завершите поездку' });
      await database.prepare('INSERT OR IGNORE INTO hidden_journey_entries(owner_id, kind, reference) VALUES (?, ?, ?)').run(owner, kind, id);
    } else if (kind === 'sos' && keyValid(id) && typeof ownerId === 'string') {
      const event = await database.prepare('SELECT 1 FROM sos_events WHERE owner_id = ? AND client_id = ?').get(ownerId, id);
      const recipient = await database.prepare('SELECT acknowledged_at FROM sos_recipients WHERE owner_id = ? AND client_id = ? AND peer_id = ?').get(ownerId, id, owner);
      if (!event || ownerId !== owner && !recipient) return response.status(404).json({ message: 'Запись не найдена' });
      const pending = ownerId === owner ? await database.prepare('SELECT 1 FROM sos_recipients WHERE owner_id = ? AND client_id = ? AND acknowledged_at IS NULL').get(ownerId, id) : !recipient.acknowledged_at;
      if (pending) return response.status(409).json({ message: 'Сначала обработайте SOS' });
      await database.prepare('INSERT OR IGNORE INTO hidden_journey_entries(owner_id, kind, reference) VALUES (?, ?, ?)').run(owner, kind, `${ownerId}:${id}`);
    } else return response.status(400).json({ message: 'Некорректная запись' });
    response.json({ ok: true });
  }));
  router.delete('/entries/history', database.handle(async (request, response) => {
    const owner = request.user.id;
    await database.transaction(async () => {
      await database.prepare(`INSERT OR IGNORE INTO hidden_journey_entries(owner_id, kind, reference)
        SELECT ?, 'journey', j.id FROM journeys j WHERE j.status NOT IN ('active', 'pending') AND
        (j.owner_id = ? OR EXISTS (SELECT 1 FROM journey_recipients r WHERE r.journey_id = j.id AND r.peer_id = ?))`).run(owner, owner, owner);
      await database.prepare(`INSERT OR IGNORE INTO hidden_journey_entries(owner_id, kind, reference)
        SELECT ?, 'sos', r.owner_id || ':' || r.client_id FROM sos_recipients r WHERE r.peer_id = ? AND r.acknowledged_at IS NOT NULL`).run(owner, owner);
      await database.prepare(`INSERT OR IGNORE INTO hidden_journey_entries(owner_id, kind, reference)
        SELECT ?, 'sos', e.owner_id || ':' || e.client_id FROM sos_events e WHERE e.owner_id = ? AND
        NOT EXISTS (SELECT 1 FROM sos_recipients r WHERE r.owner_id = e.owner_id AND r.client_id = e.client_id AND r.acknowledged_at IS NULL)`).run(owner, owner);
    });
    response.json({ ok: true });
  }));
  const transaction = async (operation) => await database.transaction(operation);
  const keyValid = (key) => typeof key === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(key);
  const pointValid = (point) => point && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
  const placeValid = (point) => pointValid(point) && typeof point.name === 'string' && point.name.trim().length > 0 && point.name.length <= 500;
  const cleanPoint = (point) => ({ latitude: point.latitude, longitude: point.longitude, name: point.name.trim(), gps: !!point.gps });
  const positionValid = (point) => pointValid(point) && (point.accuracy === undefined || point.accuracy === null || Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 100000);
  async function preferences(owner) {
    await database.prepare('INSERT OR IGNORE INTO preferences (owner_id) VALUES (?)').run(owner);
    const row = await database.prepare('SELECT * FROM preferences WHERE owner_id = ?').get(owner);
    return { sharing: !!row.sharing, reminder: !!row.reminder, scenario: !!row.scenario, retentionDays: row.retention_days, delayMinutes: row.delay_minutes, escalationMinutes: row.escalation_minutes };
  }
  async function message(owner, peer, key, text) {
    await database.prepare('INSERT OR IGNORE INTO chat_messages (sender_id, recipient_id, client_id, text, sent_at) VALUES (?, ?, ?, ?, ?)').run(owner, peer, key, text, now());
  }
  async function recipients(id) {
    return await database.prepare('SELECT r.peer_id AS peerId, u.name, r.role, r.consent, r.acknowledged_at AS acknowledgedAt, r.notified FROM journey_recipients r JOIN users u ON u.id = r.peer_id WHERE r.journey_id = ? ORDER BY r.role DESC, u.name').all(id);
  }
  async function serialize(row, shared = false) {
    if (!row) return null;
    const details = JSON.parse(row.details);
    const shareCoordinates = !shared || !!row.sharing;
    return {
      id: row.id, ownerId: row.owner_id, ownerName: row.owner_name,
      status: row.status, startedAt: row.started_at, expectedAt: row.expected_at,
      endedAt: row.ended_at, extraMinutes: row.extra_minutes,
      sharing: shared ? shareCoordinates : !!row.sharing, scenario: !!row.scenario,
      consent: shared ? row.consent : undefined,
      ...details,
      origin: shareCoordinates ? details.origin : { name: 'Точка отправления' },
      target: shareCoordinates ? details.target : { name: details.target.name },
      route: shareCoordinates ? details.route : { distance: details.route.distance, duration: details.route.duration },
      position: row.status === 'active' && shareCoordinates && row.position ? JSON.parse(row.position) : null,
      recipients: shared ? undefined : await recipients(row.id),
      acknowledgedAt: shared ? row.acknowledged_at : undefined
    };
  }
  async function notifyAll(row, event, text) {
    for (const recipient of await recipients(row.id)) await message(row.owner_id, recipient.peerId, `journey_${row.id}_${event}_${recipient.peerId}`, text);
  }
  async function processDue() {
    await transaction(async () => {
      await database.prepare("DELETE FROM journeys WHERE status NOT IN ('active', 'pending') AND ended_at < ? - COALESCE((SELECT retention_days FROM preferences WHERE owner_id = journeys.owner_id), 30) * 86400000").run(now());
      for (const row of await database.prepare("SELECT j.*, u.name AS owner_name FROM journeys j JOIN users u ON u.id = j.owner_id WHERE status = 'active' AND scenario = 1 AND expected_at <= ?").all(now())) {
        const prefs = await preferences(row.owner_id);
        await database.prepare("INSERT OR IGNORE INTO push_jobs(owner_id, kind, reference, created_at) VALUES (?, 'checkin', ?, ?)").run(row.owner_id, `journey_${row.id}_${row.expected_at}`, now());
        const primaryAnswered = (await recipients(row.id)).some((person) => person.role === 'primary' && person.acknowledgedAt !== null);
        for (const recipient of await recipients(row.id)) {
          const due = row.expected_at + (prefs.delayMinutes + (recipient.role === 'backup' ? prefs.escalationMinutes : 0)) * 60000;
          if (recipient.notified || recipient.acknowledgedAt !== null || now() < due || recipient.role === 'backup' && primaryAnswered) continue;
          await message(row.owner_id, recipient.peerId, `journey_${row.id}_delay_${recipient.peerId}`, `${row.owner_name} ещё не подтвердил(а) прибытие в «${JSON.parse(row.details).target.name}». Пожалуйста, свяжитесь со мной. Поездка доступна во вкладке «Маршруты».`);
          await database.prepare('UPDATE journey_recipients SET notified = 1 WHERE journey_id = ? AND peer_id = ?').run(row.id, recipient.peerId);
        }
      }
      for (const event of await database.prepare('SELECT e.*, u.name FROM sos_events e JOIN users u ON u.id = e.owner_id WHERE e.created_at >= ?').all(now() - 86400000)) {
        const prefs = await preferences(event.owner_id);
        if (now() < event.created_at + prefs.escalationMinutes * 60000) continue;
        const primary = await database.prepare("SELECT acknowledged_at FROM sos_recipients WHERE owner_id = ? AND client_id = ? AND role = 'primary'").get(event.owner_id, event.client_id);
        if (primary?.acknowledged_at != null) continue;
        for (const peer of await database.prepare("SELECT peer_id, acknowledged_at FROM sos_recipients WHERE owner_id = ? AND client_id = ? AND role = 'backup'").all(event.owner_id, event.client_id)) {
          if (peer.acknowledged_at != null || !(await accepted(database, event.owner_id, peer.peer_id))) continue;
          const inserted = await database.prepare('INSERT OR IGNORE INTO safety_events VALUES (?, ?, ?)').run(event.owner_id, event.client_id, `sos_escalation_${peer.peer_id}`);
          if (inserted.changes) await message(event.owner_id, peer.peer_id, `sos_repeat_${event.client_id}_${peer.peer_id}`, `SOS — повторная тревога от ${event.name}: основной контакт ещё не подтвердил получение. Пожалуйста, свяжитесь с отправителем.`);
        }
      }
    });
  }
  router.get('/state', async (request, response) => {
    await processDue();
    const owner = request.user.id;
    const active = await database.prepare("SELECT * FROM journeys WHERE owner_id = ? AND status IN ('active', 'pending')").get(owner);
    const history = await mapAsync(await database.prepare("SELECT * FROM journeys WHERE owner_id = ? AND status NOT IN ('active', 'pending') ORDER BY started_at DESC LIMIT 30").all(owner), async (row) => {
      const result = await serialize(row);
      result.route = { distance: result.route.distance, duration: result.route.duration };
      return result;
    });
    const received = await mapAsync(await database.prepare(`SELECT j.*, u.name AS owner_name, r.acknowledged_at, r.consent FROM journeys j
      JOIN journey_recipients r ON r.journey_id = j.id JOIN users u ON u.id = j.owner_id
      WHERE r.peer_id = ? ORDER BY CASE WHEN j.status = 'active' THEN 0 ELSE 1 END, j.started_at DESC LIMIT 20`).all(owner), async (row) => await serialize(row, true));
    const unreadCount = (await database.prepare(`SELECT COUNT(*) AS count FROM chat_messages m WHERE recipient_id = ? AND id > COALESCE((SELECT last_id FROM chat_reads WHERE owner_id = ? AND peer_id = m.sender_id), 0) AND NOT EXISTS (SELECT 1 FROM hidden_chat_messages h WHERE h.owner_id = m.recipient_id AND h.message_id = m.id)`).get(owner, owner)).count;
    const sentSOS = await database.prepare(`SELECT e.owner_id AS ownerId, e.client_id AS clientId, e.created_at AS createdAt, r.peer_id AS peerId, u.name, r.acknowledged_at AS acknowledgedAt, r.route_started_at AS routeStartedAt,
      CASE WHEN COALESCE(cr.last_id, 0) >= r.message_id THEN 1 ELSE 0 END AS wasRead
      FROM sos_events e JOIN sos_recipients r ON r.owner_id = e.owner_id AND r.client_id = e.client_id
      JOIN users u ON u.id = r.peer_id LEFT JOIN chat_reads cr ON cr.owner_id = r.peer_id AND cr.peer_id = e.owner_id
      WHERE e.owner_id = ? ORDER BY e.created_at DESC LIMIT 30`).all(owner);
    const receivedSOS = await database.prepare(`SELECT e.owner_id AS ownerId, e.client_id AS clientId, e.created_at AS createdAt, u.name, r.acknowledged_at AS acknowledgedAt, r.route_started_at AS routeStartedAt
      FROM sos_recipients r JOIN sos_events e ON e.owner_id = r.owner_id AND e.client_id = r.client_id JOIN users u ON u.id = e.owner_id
      WHERE r.peer_id = ? ORDER BY e.created_at DESC LIMIT 20`).all(owner);
    const hidden = new Set((await database.prepare('SELECT kind, reference FROM hidden_journey_entries WHERE owner_id = ?').all(owner)).map(row => `${row.kind}:${row.reference}`));
    response.json({ active: await serialize(active), history: history.filter(item => !hidden.has(`journey:${item.id}`)), received: received.filter(item => !hidden.has(`journey:${item.id}`)), sentSOS: sentSOS.filter(item => !hidden.has(`sos:${owner}:${item.clientId}`)), receivedSOS: receivedSOS.filter(item => !hidden.has(`sos:${item.ownerId}:${item.clientId}`)), preferences: await preferences(owner), favoriteRoutes: (await database.prepare('SELECT slot, plan FROM favorite_routes WHERE owner_id = ?').all(owner)).map((row) => ({ slot: row.slot, ...JSON.parse(row.plan) })), places: (await database.prepare('SELECT slot, point FROM saved_places WHERE owner_id = ? ORDER BY slot').all(owner)).map((row) => ({ slot: row.slot, ...JSON.parse(row.point) })), unreadCount });
  });
  router.put('/preferences', database.handle(async (request, response) => {
    const current = await preferences(request.user.id);
    const allowed = ['sharing', 'reminder', 'scenario', 'retentionDays', 'delayMinutes', 'escalationMinutes'];
    const choices = { retentionDays: [1, 7, 30, 90], delayMinutes: [1, 3, 5, 10, 15], escalationMinutes: [1, 3, 5, 10, 15] };
    if (!request.body || !Object.keys(request.body).length || Object.keys(request.body).some((key) => !allowed.includes(key) || (choices[key] ? !choices[key].includes(request.body[key]) : typeof request.body[key] !== 'boolean'))) return response.status(400).json({ message: 'Некорректные настройки' });
    const next = { ...current, ...request.body };
    await transaction(async () => {
      await database.prepare('UPDATE preferences SET sharing = ?, reminder = ?, scenario = ? WHERE owner_id = ?').run(+next.sharing, +next.reminder, +next.scenario, request.user.id);
      await database.prepare('UPDATE preferences SET retention_days = ? WHERE owner_id = ?').run(next.retentionDays, request.user.id);
      await database.prepare('UPDATE preferences SET delay_minutes = ?, escalation_minutes = ? WHERE owner_id = ?').run(next.delayMinutes, next.escalationMinutes, request.user.id);
      // Turning sharing off revokes coordinates immediately for an existing trip.
      if ('sharing' in request.body) await database.prepare("UPDATE journeys SET sharing = ?, position = CASE WHEN ? = 0 THEN NULL ELSE position END WHERE owner_id = ? AND status = 'active'").run(+next.sharing, +next.sharing, request.user.id);
      if ('scenario' in request.body) await database.prepare("UPDATE journeys SET scenario = ? WHERE owner_id = ? AND status = 'active'").run(+next.scenario, request.user.id);
    });
    response.json({ preferences: next });
  }));
  router.delete('/history', database.handle(async (request, response) => {
    await database.prepare("DELETE FROM journeys WHERE owner_id = ? AND status NOT IN ('active', 'pending')").run(request.user.id);
    response.json({ ok: true });
  }));
  router.put('/places/:slot', database.handle(async (request, response) => {
    if (!['home', 'work', 'study'].includes(request.params.slot) || !placeValid(request.body)) return response.status(400).json({ message: 'Выберите точку на карте или найдите адрес' });
    const point = cleanPoint(request.body);
    await database.prepare('INSERT INTO saved_places (owner_id, slot, point) VALUES (?, ?, ?) ON CONFLICT(owner_id, slot) DO UPDATE SET point = excluded.point').run(request.user.id, request.params.slot, JSON.stringify(point));
    response.json({ place: { slot: request.params.slot, ...point } });
  }));
  router.delete('/places/:slot', database.handle(async (request, response) => {
    if (!['home', 'work', 'study'].includes(request.params.slot)) return response.status(400).json({ message: 'Место не найдено' });
    await database.prepare('DELETE FROM saved_places WHERE owner_id = ? AND slot = ?').run(request.user.id, request.params.slot);
    response.json({ ok: true });
  }));
  router.put('/favorites/:slot', database.handle(async (request, response) => {
    const body = request.body || {};
    if (!['home', 'work', 'study'].includes(request.params.slot) || !placeValid(body.origin) || !placeValid(body.target) || !['walk', 'car', 'taxi', 'bus'].includes(body.transport)) return response.status(400).json({ message: 'Проверьте точки маршрута' });
    const plan = { origin: cleanPoint(body.origin), target: cleanPoint(body.target), transport: body.transport };
    await database.prepare('INSERT INTO favorite_routes VALUES (?, ?, ?) ON CONFLICT(owner_id, slot) DO UPDATE SET plan = excluded.plan').run(request.user.id, request.params.slot, JSON.stringify(plan));
    response.json({ favorite: { slot: request.params.slot, ...plan } });
  }));
  router.delete('/favorites/:slot', database.handle(async (request, response) => {
    await database.prepare('DELETE FROM favorite_routes WHERE owner_id = ? AND slot = ?').run(request.user.id, request.params.slot);
    response.json({ ok: true });
  }));
  router.post('/:id/low-battery', database.handle(async (request, response) => {
    const row = await database.prepare("SELECT * FROM journeys WHERE id = ? AND owner_id = ? AND status = 'active'").get(request.params.id, request.user.id);
    if (!row) return response.status(404).json({ message: 'Активная поездка не найдена' });
    const level = request.body?.level;
    if (!Number.isInteger(level) || level < 0 || level > 20) return response.status(400).json({ message: 'Некорректный заряд батареи' });
    await transaction(async () => {
      const inserted = await database.prepare('INSERT OR IGNORE INTO safety_events VALUES (?, ?, ?)').run(request.user.id, row.id, 'low_battery');
      if (inserted.changes) for (const person of await recipients(row.id)) {
        if (await accepted(database, row.owner_id, person.peerId)) await message(row.owner_id, person.peerId, `journey_${row.id}_battery_${person.peerId}`, `${request.user.name}: заряд телефона ${level}%. Во время поездки телефон может отключиться.`);
      }
    });
    response.json({ ok: true });
  }));
  router.post('/', database.handle(async (request, response) => {
    const body = request.body || {};
    if (!keyValid(body.clientId)) return response.status(400).json({ message: 'Некорректный идентификатор поездки' });
    const existing = await database.prepare('SELECT * FROM journeys WHERE owner_id = ? AND client_id = ?').get(request.user.id, body.clientId);
    if (existing) return response.json({ journey: await serialize(existing) });
    if (await database.prepare("SELECT id FROM journeys WHERE owner_id = ? AND status IN ('active', 'pending')").get(request.user.id)) return response.status(409).json({ message: 'У вас уже есть активная поездка. Завершите или отмените её.' });
    if (!placeValid(body.origin) || !placeValid(body.target) || !['walk', 'car', 'taxi', 'bus'].includes(body.transport) || !Number.isInteger(body.minutes) || body.minutes < 1 || body.minutes > 1440 || !body.route || !Number.isFinite(body.route.distance) || body.route.distance < 0 || body.route.distance > 10000000 || !Number.isFinite(body.route.duration) || body.route.duration <= 0 || body.route.duration > 86400 || !Array.isArray(body.route.coordinates) || body.route.coordinates.length < 2 || body.route.coordinates.length > 1000 || body.route.coordinates.some((point) => !pointValid(point)) || typeof body.accompanied !== 'boolean') return response.status(400).json({ message: 'Проверьте маршрут и время прибытия' });
    const selection = await database.prepare('SELECT primary_id FROM circle_settings WHERE owner_id = ?').get(request.user.id);
    const selected = body.accompanied ? await database.prepare('SELECT peer_id, id FROM circle_contacts WHERE owner_id = ? AND (id = ? OR backup = 1)').all(request.user.id, selection?.primary_id || '') : [];
    if (body.accompanied && (!selected.length || selected.some((person) => !person.peer_id))) return response.status(400).json({ message: 'Для сопровождения подключите аккаунты всех выбранных контактов или начните поездку без сопровождения.' });
    if (await someAsync(selected, async (person) => !(await accepted(database, request.user.id, person.peer_id)))) return response.status(403).json({ message: 'Дождитесь принятия приглашений всеми выбранными контактами' });
    const prefs = await preferences(request.user.id);
    const id = randomUUID();
    const details = { origin: cleanPoint(body.origin), target: cleanPoint(body.target), transport: body.transport, minutes: body.minutes, route: { distance: body.route.distance, duration: body.route.duration, coordinates: body.route.coordinates.map((point) => ({ latitude: point.latitude, longitude: point.longitude })) } };
    await transaction(async () => {
      await database.prepare('INSERT INTO journeys (id, owner_id, client_id, details, started_at, expected_at, sharing, scenario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, request.user.id, body.clientId, JSON.stringify(details), now(), now() + body.minutes * 60000, +(body.accompanied && prefs.sharing), +(body.accompanied && prefs.scenario));
      for (const person of selected) await database.prepare('INSERT INTO journey_recipients (journey_id, peer_id, role) VALUES (?, ?, ?)').run(id, person.peer_id, person.id === selection.primary_id ? 'primary' : 'backup');
      await notifyAll(await database.prepare('SELECT * FROM journeys WHERE id = ?').get(id), 'start', `${request.user.name} начал(а) поездку в «${details.target.name}». Время в пути: ${body.minutes} мин. Маршрут доступен во вкладке «Маршруты». Нажмите «Слежу за поездкой», если вы на связи.`);
    });
    response.status(201).json({ journey: await serialize(await database.prepare('SELECT * FROM journeys WHERE id = ?').get(id)) });
  }));
  const owned = async (request, response) => {
    const row = await database.prepare('SELECT * FROM journeys WHERE id = ? AND owner_id = ?').get(request.params.id, request.user.id);
    if (!row) response.status(404).json({ message: 'Поездка не найдена' });
    return row;
  };
  router.post('/:id/action', database.handle(async (request, response) => {
    const row = await owned(request, response);
    if (!row) return;
    const { action, clientId } = request.body || {};
    if (!['arrive', 'cancel', 'extend'].includes(action) || !keyValid(clientId)) return response.status(400).json({ message: 'Неизвестное действие' });
    const previous = await database.prepare('SELECT action FROM journey_actions WHERE journey_id = ? AND client_id = ?').get(row.id, clientId);
    if (previous) {
      if (previous.action !== action) return response.status(409).json({ message: 'Идентификатор действия уже использован' });
      return response.json({ journey: await serialize(row) });
    }
    if (row.status !== 'active' && !(row.status === 'pending' && action === 'cancel')) return response.status(409).json({ message: row.status === 'pending' ? 'Дождитесь подтверждения основного сопровождающего' : 'Поездка уже завершена' });
    if (action === 'extend' && row.extra_minutes >= 120) return response.status(400).json({ message: 'Можно добавить максимум 120 минут' });
    await transaction(async () => {
      await database.prepare('INSERT INTO journey_actions (journey_id, client_id, action) VALUES (?, ?, ?)').run(row.id, clientId, action);
      if (action === 'extend') {
        await database.prepare('UPDATE journeys SET expected_at = expected_at + 300000, extra_minutes = extra_minutes + 5 WHERE id = ?').run(row.id);
        await notifyAll(row, `extend_${clientId}`, `${request.user.name} добавил(а) 5 минут к маршруту в «${JSON.parse(row.details).target.name}».`);
      } else {
        await database.prepare('UPDATE journeys SET status = ?, ended_at = ?, position = NULL WHERE id = ?').run(action === 'arrive' ? 'arrived' : 'cancelled', now(), row.id);
        await notifyAll(row, action, action === 'arrive' ? `${request.user.name} подтвердил(а) прибытие в «${JSON.parse(row.details).target.name}».` : `${request.user.name} отменил(а) поездку в «${JSON.parse(row.details).target.name}».`);
      }
    });
    response.json({ journey: await serialize(await database.prepare('SELECT * FROM journeys WHERE id = ?').get(row.id)) });
  }));
  router.put('/:id/position', database.handle(async (request, response) => {
    const row = await owned(request, response);
    if (!row) return;
    if (row.status !== 'active' || !row.sharing) return response.status(409).json({ message: 'Передача геопозиции выключена или поездка завершена' });
    if (!positionValid(request.body)) return response.status(400).json({ message: 'Некорректная геопозиция' });
    const capturedAt = request.body.capturedAt ?? now();
    if (!Number.isFinite(capturedAt) || capturedAt < now() - 120000 || capturedAt > now() + 30000) return response.status(400).json({ message: 'Геопозиция устарела. Отправьте новое положение.' });
    const previous = row.position ? JSON.parse(row.position) : null;
    if (previous && previous.updatedAt > capturedAt) return response.json({ position: previous });
    const position = { latitude: request.body.latitude, longitude: request.body.longitude, accuracy: request.body.accuracy ?? null, updatedAt: capturedAt, receivedAt: now() };
    await database.prepare('UPDATE journeys SET position = ? WHERE id = ?').run(JSON.stringify(position), row.id);
    response.json({ position });
  }));
  router.post('/:id/acknowledge', database.handle(async (request, response) => {
    const recipient = await database.prepare("SELECT r.* FROM journey_recipients r JOIN journeys j ON j.id = r.journey_id WHERE r.journey_id = ? AND r.peer_id = ? AND j.status = 'active'").get(request.params.id, request.user.id);
    if (!recipient) return response.status(404).json({ message: 'Поездка не найдена или сопровождение не принято' });
    await transaction(async () => {
      const row = await database.prepare('SELECT * FROM journeys WHERE id = ?').get(request.params.id);
      await database.prepare('UPDATE journey_recipients SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE journey_id = ? AND peer_id = ?').run(now(), row.id, request.user.id);
      await message(request.user.id, row.owner_id, `journey_${row.id}_ack_${request.user.id}`, `${request.user.name} на связи и следит за вашей поездкой.`);
    });
    response.json({ ok: true });
  }));
  router.post('/:id/respond', database.handle(async (request, response) => {
    const decision = request.body?.decision;
    if (!['accepted', 'declined'].includes(decision)) return response.status(400).json({ message: 'Выберите принять или отклонить' });
    const row = await database.prepare("SELECT j.*, r.role, r.consent FROM journeys j JOIN journey_recipients r ON r.journey_id = j.id WHERE j.id = ? AND r.peer_id = ? AND j.status IN ('pending', 'active')").get(request.params.id, request.user.id);
    if (!row) return response.status(404).json({ message: 'Приглашение не найдено' });
    if (!(await accepted(database, row.owner_id, request.user.id))) return response.status(403).json({ message: 'Доступ закрыт' });
    if (row.consent === decision) return response.json({ ok: true });
    await transaction(async () => {
      await database.prepare('UPDATE journey_recipients SET consent = ? WHERE journey_id = ? AND peer_id = ?').run(decision, row.id, request.user.id);

      await message(request.user.id, row.owner_id, `journey_${row.id}_consent_${request.user.id}_${decision}`, `${request.user.name}: ${decision === 'accepted' ? 'слежу за поездкой' : 'сейчас не могу следить за поездкой'}.`);
    });
    response.json({ ok: true });
  }));
  router.post('/sos/send', database.handle(async (request, response) => {
    const body = request.body || {};
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 280)) return response.status(400).json({ message: 'Послание SOS — не более 280 символов' });
    const note = (body.note || '').trim();
    if (!keyValid(body.clientId) || typeof body.includeLocation !== 'boolean' || body.includeLocation && !positionValid(body.position)) return response.status(400).json({ message: 'Проверьте получателей и геопозицию SOS' });
    const previous = await database.prepare('SELECT payload FROM sos_events WHERE owner_id = ? AND client_id = ?').get(request.user.id, body.clientId);
    if (previous) return response.json(JSON.parse(previous.payload));
    const selected = await database.prepare(`SELECT peer_id, name, CASE WHEN id = (SELECT primary_id FROM circle_settings WHERE owner_id = circle_contacts.owner_id) THEN 'primary' ELSE 'backup' END AS role FROM circle_contacts WHERE owner_id = ? AND (backup = 1 OR id = (SELECT primary_id FROM circle_settings WHERE owner_id = ?))`).all(request.user.id, request.user.id);
    const peers = await filterAsync(selected, async (contact) => contact.peer_id && (await accepted(database, request.user.id, contact.peer_id)));
    if (!peers.length) return response.status(400).json({ message: 'Добавьте хотя бы один контакт с аккаунтом SafeWalk. Для телефонных контактов используйте звонок.' });
    let text = `SOS от ${request.user.name}. Пожалуйста, свяжитесь со мной — мне нужна помощь.`;
    if (note) text += ` Послание: ${note}`;
    if (body.includeLocation) {
      const capturedAt = body.position.capturedAt ?? now();
      if (!Number.isFinite(capturedAt) || capturedAt < now() - 10 * 60000 || capturedAt > now() + 30000) return response.status(400).json({ message: 'Геопозиция SOS устарела. Получите новое положение или отправьте SOS без координат.' });
      text += ` Геопозиция на ${new Date(capturedAt).toISOString()}: https://www.openstreetmap.org/?mlat=${body.position.latitude}&mlon=${body.position.longitude}#map=17/${body.position.latitude}/${body.position.longitude}`;
    }
    const result = { sentCount: peers.length, skippedNames: selected.filter((contact) => !peers.includes(contact)).map((contact) => contact.name), includedLocation: body.includeLocation, note,
      position: body.includeLocation ? { latitude: body.position.latitude, longitude: body.position.longitude, accuracy: body.position.accuracy ?? null, capturedAt: body.position.capturedAt ?? now() } : null };
    await transaction(async () => {
      await database.prepare('INSERT INTO sos_events (owner_id, client_id, payload, created_at) VALUES (?, ?, ?, ?)').run(request.user.id, body.clientId, JSON.stringify(result), now());
      for (const peer of peers) {
        const key = `sos_${body.clientId}_${peer.peer_id}`;
        await message(request.user.id, peer.peer_id, key, text);
        const msg = await database.prepare('SELECT id FROM chat_messages WHERE sender_id = ? AND client_id = ?').get(request.user.id, key);
        await database.prepare('INSERT INTO sos_recipients(owner_id, client_id, peer_id, message_id, role) VALUES (?, ?, ?, ?, ?)').run(request.user.id, body.clientId, peer.peer_id, msg.id, peer.role);
      }
    });
    response.status(201).json(result);
  }));
  router.get('/sos/:owner/:client', database.handle(async (request, response) => {
    const { owner, client } = request.params;
    if (!(await accepted(database, owner, request.user.id))) return response.status(403).json({ message: 'Доступ закрыт' });
    const row = await database.prepare(`SELECT e.payload, e.created_at, u.name, r.route_started_at FROM sos_events e JOIN users u ON u.id = e.owner_id
      JOIN sos_recipients r ON r.owner_id = e.owner_id AND r.client_id = e.client_id
      WHERE e.owner_id = ? AND e.client_id = ? AND r.peer_id = ?`).get(owner, client, request.user.id);
    if (!row) return response.status(404).json({ message: 'Тревога не найдена' });
    const payload = JSON.parse(row.payload);
    response.json({ sos: { name: row.name, createdAt: row.created_at, note: payload.note || '', position: payload.position || null, routeStartedAt: row.route_started_at } });
  }));
  router.post('/sos/:owner/:client/navigate', database.handle(async (request, response) => {
    const { owner, client } = request.params;
    if (!(await accepted(database, owner, request.user.id))) return response.status(403).json({ message: 'Доступ закрыт' });
    const row = await database.prepare(`SELECT e.payload FROM sos_events e JOIN sos_recipients r ON r.owner_id = e.owner_id AND r.client_id = e.client_id WHERE e.owner_id = ? AND e.client_id = ? AND r.peer_id = ?`).get(owner, client, request.user.id);
    if (!row) return response.status(404).json({ message: 'Тревога не найдена' });
    if (!JSON.parse(row.payload).position) return response.status(409).json({ message: 'В SOS нет геопозиции для маршрута' });
    await transaction(async () => {
      await database.prepare('UPDATE sos_recipients SET acknowledged_at = COALESCE(acknowledged_at, ?), route_started_at = COALESCE(route_started_at, ?) WHERE owner_id = ? AND client_id = ? AND peer_id = ?').run(now(), now(), owner, client, request.user.id);
      await message(request.user.id, owner, `sos_route_${client}_${request.user.id}`, `${request.user.name} построил(а) маршрут к вам и направляется на помощь.`);
    });
    const state = await database.prepare('SELECT route_started_at AS routeStartedAt FROM sos_recipients WHERE owner_id = ? AND client_id = ? AND peer_id = ?').get(owner, client, request.user.id);
    response.json({ ok: true, ...state });
  }));
  router.post('/sos/:owner/:client/acknowledge', database.handle(async (request, response) => {
    const owner = request.params.owner,client = request.params.client;
    if (!(await accepted(database, owner, request.user.id))) return response.status(403).json({ message: 'Доступ закрыт' });
    const result = await database.prepare('UPDATE sos_recipients SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE owner_id = ? AND client_id = ? AND peer_id = ?').run(now(), owner, client, request.user.id);
    if (!result.changes) return response.status(404).json({ message: 'Тревога не найдена' });
    await message(request.user.id, owner, `sos_ack_${client}_${request.user.id}`, `${request.user.name} получил(а) SOS и связывается с вами.`);
    response.json({ ok: true });
  }));
  const timer = setInterval(async () => {try {await processDue();} catch (error) {console.error('Journey scheduler:', error.code || error.name);}}, 15000);
  timer.unref();
  return { router, processDue, close: () => clearInterval(timer) };
}

module.exports = { createJourneyService };
