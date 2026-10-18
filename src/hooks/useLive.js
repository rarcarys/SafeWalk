import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { request } from '../services/api';
import { publishLive } from '../services/live';

export default function useLive() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let stopped = false, cursor, controller, timer;
    async function poll() {
      if (stopped) return;
      if (AppState.currentState === 'background' || AppState.currentState === 'inactive') { timer = setTimeout(poll, 2000); return; }
      controller = new AbortController();
      try {
        const result = await request(`sync${cursor === undefined ? '' : `?since=${cursor}`}`, { timeout: 25000, signal: controller.signal });
        if (stopped) return;
        setConnected(true);
        if (result.revision !== cursor) { cursor = result.revision; publishLive(); }
        timer = setTimeout(poll, 250);
      } catch {
        if (!stopped) { setConnected(false); timer = setTimeout(poll, 3000); }
      }
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, []);
  return connected;
}
