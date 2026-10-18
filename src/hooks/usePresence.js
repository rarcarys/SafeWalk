import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { request } from '../services/api';
import { readBattery } from '../services/readiness';

export default function usePresence(ownerId) {
  useEffect(() => {
    let stopped = false, busy = false;
    const controller = new AbortController();
    const active = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive' && (Platform.OS !== 'web' || document.visibilityState === 'visible');
    const heartbeat = async () => {
      if (stopped || busy || !active()) return;
      busy = true;
      try {
        const value = await readBattery().catch(() => null);
        if (stopped || !active()) return;
        const battery = value && Number.isInteger(value.level) && value.level >= 0 && value.level <= 100 ? { level: value.level, charging: !!value.charging } : null;
        await request('presence', { method: 'PUT', body: { battery }, expectedOwner: ownerId, signal: controller.signal });
      } catch { /* A missing heartbeat naturally expires; never report stale data as live. */ }
      finally { busy = false; }
    };
    void heartbeat();
    const timer = setInterval(heartbeat, 25000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void heartbeat(); });
    const visibility = () => { if (active()) void heartbeat(); };
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', visibility); window.addEventListener('online', visibility); }
    return () => {
      stopped = true; controller.abort(); clearInterval(timer); subscription.remove();
      if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('online', visibility); }
    };
  }, [ownerId]);
}
