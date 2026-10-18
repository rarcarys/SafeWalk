const express = require('express');

const ONLINE_WINDOW_MS = 75 * 1000;
const BATTERY_WINDOW_MS = 120 * 1000;

async function createPresenceRouter(database, now = Date.now) {
  await database.exec(`CREATE TABLE IF NOT EXISTS user_presence (
    owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at INTEGER NOT NULL,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    battery_charging INTEGER CHECK (battery_charging IN (0, 1)),
    battery_updated_at INTEGER
  )`);
  const router = express.Router();
  router.put('/', database.handle(async (request, response) => {
    const battery = request.body?.battery;
    if (battery !== null && (!battery || typeof battery !== 'object' || Array.isArray(battery) || !Number.isInteger(battery.level) || battery.level < 0 || battery.level > 100 || typeof battery.charging !== 'boolean')) {
      return response.status(400).json({ message: 'Укажите заряд от 0 до 100 и состояние зарядки либо null, если заряд недоступен' });
    }
    const timestamp = now();
    // Identity and timestamps come from the authenticated session and server.
    // A null sample clears a previous device's battery instead of inventing one.
    await database.prepare(`INSERT INTO user_presence (owner_id, last_seen_at, battery_level, battery_charging, battery_updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at, battery_level = excluded.battery_level,
      battery_charging = excluded.battery_charging, battery_updated_at = excluded.battery_updated_at`).run(
      request.user.id, timestamp, battery?.level ?? null, battery === null ? null : Number(battery.charging), battery === null ? null : timestamp,
    );
    response.json({ ok: true });
  }));
  return router;
}

async function contactPresences(database, owner, peers, timestamp = Date.now()) {
  const result = new Map();
  const ids = [...new Set(peers.filter(peer => typeof peer === 'string' && peer !== owner))];
  // Keep parameter counts bounded on SQLite as well as PostgreSQL. Authorization
  // lives in this query so callers cannot accidentally expose a pending peer.
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    const rows = await database.prepare(`SELECT p.owner_id AS peerId, p.last_seen_at AS lastSeenAt,
      p.battery_level AS batteryLevel, p.battery_charging AS batteryCharging, p.battery_updated_at AS batteryUpdatedAt,
      CASE WHEN EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = p.owner_id AND s.expires_at > ?) THEN 1 ELSE 0 END AS liveSession
      FROM user_presence p WHERE p.owner_id IN (${batch.map(() => '?').join(', ')})
      AND EXISTS (SELECT 1 FROM contact_requests r WHERE r.status = 'accepted' AND
        ((r.sender_id = ? AND r.recipient_id = p.owner_id) OR (r.sender_id = p.owner_id AND r.recipient_id = ?)))
      AND EXISTS (SELECT 1 FROM circle_contacts c WHERE
        (c.owner_id = ? AND c.peer_id = p.owner_id) OR (c.owner_id = p.owner_id AND c.peer_id = ?))
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
        (b.owner_id = ? AND b.peer_id = p.owner_id) OR (b.owner_id = p.owner_id AND b.peer_id = ?))`).all(
      timestamp, ...batch, owner, owner, owner, owner, owner, owner,
    );
    for (const row of rows) {
      const age = timestamp - row.lastSeenAt;
      const batteryAge = timestamp - row.batteryUpdatedAt;
      result.set(row.peerId, {
        online: !!row.liveSession && age >= 0 && age <= ONLINE_WINDOW_MS,
        lastSeenAt: row.lastSeenAt,
        battery: row.batteryLevel !== null && row.batteryUpdatedAt !== null && batteryAge >= 0 && batteryAge <= BATTERY_WINDOW_MS ? {
          level: row.batteryLevel, charging: !!row.batteryCharging, updatedAt: row.batteryUpdatedAt,
        } : null,
      });
    }
  }
  return result;
}

module.exports = { createPresenceRouter, contactPresences, ONLINE_WINDOW_MS, BATTERY_WINDOW_MS };
