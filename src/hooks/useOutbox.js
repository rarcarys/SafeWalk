import { useEffect, useRef, useState, useCallback } from 'react';
import { request } from '../services/api';
import { readLocal, writeLocal } from '../services/localStore';
import { publishLive, subscribeLive } from '../services/live';

export default function useOutbox(ownerId) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const entries = useRef([]), alive = useRef(false), sending = useRef(false), ready = useRef(false);
  const writes = useRef(Promise.resolve());
  const key = `outbox.${ownerId}`;
  const commit = useCallback(update => {
    // Serialize both state changes and storage writes, including concurrent sends.
    const write = writes.current.catch(() => {}).then(async () => {
      const next = update(entries.current);
      await writeLocal(key, next);
      entries.current = next;
      if (alive.current) setItems(next);
    });
    writes.current = write;
    return write;
  }, [key]);
  const flush = useCallback(async () => {
    if (!alive.current || !ready.current || sending.current) return;
    sending.current = true;
    try {
      for (const item of [...entries.current]) {
        if (!alive.current) break;
        if (item.status !== 'pending') continue;
        let updated;
        if (Date.now() > item.expiresAt) updated = { ...item, status: 'expired', error: 'Срок отправки истёк. Действие не отправлено.' };
        else {
          try {
            await request(item.endpoint, { method: item.method, body: item.body, expectedOwner: ownerId });
            if (!alive.current) break;
            await commit(current => current.filter(entry => entry.id !== item.id));
            publishLive(); continue;
          } catch (failure) {
            if (failure.code === 'NETWORK' || failure.status >= 500 || failure.status === 429) break;
            updated = { ...item, status: 'failed', error: failure.message };
          }
        }
        await commit(current => current.map(entry => entry.id === item.id ? updated : entry));
      }
    } catch { if (alive.current) setError('Не удалось сохранить очередь действий на устройстве'); }
    finally { sending.current = false; }
  }, [ownerId, commit]);
  useEffect(() => {
    alive.current = true;
    readLocal(key, []).then(result => {
      if (!alive.current) return;
      entries.current = result; ready.current = true; setItems(result); flush();
    }).catch(() => setError('Не удалось прочитать очередь действий на устройстве'));
    const timer = setInterval(flush, 5000);
    const unsubscribe = subscribeLive(flush);
    return () => { alive.current = false; clearInterval(timer); unsubscribe(); };
  }, [key, flush]);
  const enqueue = async (endpoint, body, label, method = 'POST') => {
    if (!ready.current) throw new Error('Очередь действий ещё загружается');
    const id = body.clientId;
    const item = { id, endpoint, body, method, label, createdAt: Date.now(), expiresAt: Date.now() + (endpoint === 'journeys/sos/send' || endpoint.endsWith('/low-battery') ? 5 * 60000 : 24 * 60 * 60000), status: 'pending' };
    await commit(current => {
      if (current.some(entry => entry.id === id)) return current;
      if (current.length >= 100) throw new Error('Очередь заполнена. Проверьте неотправленные действия.');
      return [...current, item];
    });
    return { queued: true };
  };
  const run = async (endpoint, body, label) => {
    try {
      const result = await request(endpoint, { method: 'POST', body, expectedOwner: ownerId });
      if (entries.current.some(item => item.id === body.clientId)) await commit(current => current.filter(item => item.id !== body.clientId));
      return result;
    }
    catch (failure) { if (failure.code !== 'NETWORK') throw failure; return enqueue(endpoint, body, label); }
  };
  const discard = async id => {
    if (sending.current) throw new Error('Дождитесь окончания отправки');
    await commit(current => current.filter(item => item.id !== id));
  };
  return { items, error, run, flush, discard };
}
