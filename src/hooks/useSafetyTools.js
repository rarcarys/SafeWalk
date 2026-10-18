import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadSafetyTools } from '../services/safetyTools';
import { syncSafetyReminder } from '../services/device';

export default function useSafetyTools(ownerId) {
  const [data, setData] = useState({ timer: null, presets: [], links: [], appliedPreset: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(false), busy = useRef(false), version = useRef(0);
  const refresh = useCallback(async () => {
    if (!alive.current || busy.current) return;
    busy.current = true;
    const revision = version.current;
    try {
      const result = await loadSafetyTools();
      if (alive.current && revision === version.current) { setData(result); setError(''); }
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { busy.current = false; if (alive.current) setLoading(false); }
  }, [ownerId]);
  useEffect(() => {
    syncSafetyReminder(data.timer, ownerId).catch(() => {});
    return () => { syncSafetyReminder(null, ownerId).catch(() => {}); };
  }, [ownerId, data.timer?.id, data.timer?.expectedAt, data.timer?.status]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const interval = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive.current = false; version.current++; clearInterval(interval); subscription.remove(); };
  }, [refresh]);
  const updateTimer = timer => {
    version.current++;
    setData(current => ({ ...current, timer: ['active', 'alerted'].includes(timer?.status) ? timer : null }));
  };
  return { ...data, loading, error, refresh, updateTimer };
}
