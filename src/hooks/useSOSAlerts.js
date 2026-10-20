import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { request } from '../services/api';
import { subscribeLive } from '../services/live';
import { showMessageNotification } from '../services/device';

const key = alert => `${alert.senderId}:${alert.clientId}`;
export default function useSOSAlerts(ownerId) {
  const [alerts, setAlerts] = useState([]);
  const dismissed = useRef(new Set());
  useEffect(() => {
    let stopped = false, busy = false;
    const notified = new Set();
    dismissed.current = new Set(); setAlerts([]);
    const update = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const result = await request('notifications/sos', { expectedOwner: ownerId });
        if (stopped) return;
        const incoming = result.alerts.filter(alert => !dismissed.current.has(key(alert)));
        setAlerts(incoming);
        const fresh = incoming.filter(alert => !notified.has(key(alert)));
        for (const alert of fresh) notified.add(key(alert));
        if (fresh.length) showMessageNotification(fresh.at(-1), () => { if (!stopped) update(); });
        if (incoming.length) await request('notifications/received', { method: 'POST', body: { ids: incoming.map(alert => alert.id) }, expectedOwner: ownerId });
      } catch { /* Retry on reconnect without clearing an unacknowledged alert. */ }
      finally { busy = false; }
    };
    update();
    const unsubscribe = subscribeLive(update);
    const timer = setInterval(update, 4000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { stopped = true; clearInterval(timer); unsubscribe(); subscription.remove(); };
  }, [ownerId]);
  return { alert: alerts[0], count: alerts.length, dismiss: alert => {
    dismissed.current.add(key(alert)); setAlerts(current => current.filter(item => key(item) !== key(alert)));
  } };
}
