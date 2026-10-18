async function initializeRelationships(database) {
  await database.exec(`CREATE TABLE IF NOT EXISTS contact_requests (
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
    PRIMARY KEY(sender_id, recipient_id)
  );
  CREATE TABLE IF NOT EXISTS user_blocks (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(owner_id, peer_id)
  );`);
}
async function blocked(db, owner, peer) {
  return !!(await db.prepare('SELECT 1 FROM user_blocks WHERE (owner_id = ? AND peer_id = ?) OR (owner_id = ? AND peer_id = ?)').get(owner, peer, peer, owner));
}
async function accepted(db, owner, peer) {
  return !(await blocked(db, owner, peer)) && !!(await db.prepare("SELECT 1 FROM contact_requests WHERE status = 'accepted' AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))").get(owner, peer, peer, owner));
}
module.exports = { initializeRelationships, blocked, accepted };
