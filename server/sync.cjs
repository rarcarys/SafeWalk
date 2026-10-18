const express = require('express');

async function createSyncRouter(database) {
  await database.exec(`CREATE TABLE IF NOT EXISTS sync_revisions (
    owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL DEFAULT 0
  )`);
  const bump = (expression) => `INSERT INTO sync_revisions(owner_id, revision) SELECT ${expression}, 1 WHERE EXISTS (SELECT 1 FROM users WHERE id = ${expression}) ON CONFLICT(owner_id) DO UPDATE SET revision = revision + 1;`;
  const trigger = async (table, action, statements) => await database.exec(`CREATE TRIGGER IF NOT EXISTS sync_${table}_${action.toLowerCase()} AFTER ${action} ON ${table} BEGIN ${statements} END`);
  await trigger('chat_messages', 'INSERT', bump('NEW.sender_id') + bump('NEW.recipient_id'));
  for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
    const row = action === 'DELETE' ? 'OLD' : 'NEW';
    await trigger('message_reactions', action, bump(`(SELECT sender_id FROM chat_messages WHERE id = ${row}.message_id)`) + bump(`(SELECT recipient_id FROM chat_messages WHERE id = ${row}.message_id)`));
  }
  await trigger('users', 'UPDATE', bump('NEW.id') + `INSERT INTO sync_revisions(owner_id, revision) SELECT DISTINCT owner_id, 1 FROM circle_contacts WHERE peer_id = NEW.id ON CONFLICT(owner_id) DO UPDATE SET revision = revision + 1;` + `INSERT INTO sync_revisions(owner_id, revision) SELECT DISTINCT recipient_id, 1 FROM contact_requests WHERE sender_id = NEW.id ON CONFLICT(owner_id) DO UPDATE SET revision = revision + 1;`);
  await trigger('chat_reads', 'INSERT', bump('NEW.peer_id'));
  for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
    const row = action === 'DELETE' ? 'OLD' : 'NEW';
    await trigger('sos_recipients', action, bump(`${row}.owner_id`) + bump(`${row}.peer_id`));
  }
  // Repeating the same read cursor must not cause an endless refresh loop.
  await database.exec(`CREATE TRIGGER IF NOT EXISTS sync_chat_reads_update AFTER UPDATE ON chat_reads WHEN NEW.last_id != OLD.last_id BEGIN ${bump('NEW.peer_id')} END`);
  for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
    const row = action === 'DELETE' ? 'OLD' : 'NEW';
    for (const [table, owner, peer] of [['contact_requests', 'sender_id', 'recipient_id'], ['user_blocks', 'owner_id', 'peer_id']]) {
      await trigger(table, action, bump(`${row}.${owner}`) + bump(`${row}.${peer}`));
    }
    for (const table of ['circle_contacts', 'circle_settings', 'preferences', 'saved_places']) await trigger(table, action, bump(`${row}.owner_id`));
    await trigger('journey_recipients', action, bump(`${row}.peer_id`) + bump(`(SELECT owner_id FROM journeys WHERE id = ${row}.journey_id)`));
    await trigger('journeys', action, bump(`${row}.owner_id`) + `INSERT INTO sync_revisions(owner_id, revision) SELECT peer_id, 1 FROM journey_recipients WHERE journey_id = ${row}.id AND EXISTS(SELECT 1 FROM users WHERE id = peer_id) ON CONFLICT(owner_id) DO UPDATE SET revision = revision + 1;`);
  }
  const router = express.Router();
  const active = new Set();
  router.get('/', async (request, response) => {
    const since = request.query.since;
    if (since !== undefined && !/^\d{1,15}$/.test(since)) return response.status(400).json({ message: 'Некорректный курсор обновлений' });
    if (active.size >= 100) return response.status(503).json({ message: 'Сервер занят. Повторите подключение.' });
    const started = Date.now();
    let timer;
    const cleanup = () => {clearInterval(timer);active.delete(cleanup);};
    response.once('close', cleanup);
    let polling = false;
    const poll = async () => {
      if (polling || response.destroyed || response.writableEnded) return true;
      polling = true;
      try {
      const revision = (await database.prepare('SELECT revision FROM sync_revisions WHERE owner_id = ?').get(request.user.id))?.revision || 0;
      if (since === undefined || revision !== Number(since) || Date.now() - started >= 20000) {
        cleanup();if (!response.destroyed) response.json({ revision });return true;
      }
      } finally { polling = false; }
    };
    if (!(await poll())) {timer = setInterval(() => poll().catch(error => { cleanup(); if (!response.destroyed) response.destroy(); console.error('Sync poll:', error.code || error.name); }), 500);timer.unref();active.add(cleanup);}
  });
  return { router, close: () => {for (const cleanup of active) cleanup();} };
}
module.exports = { createSyncRouter };
