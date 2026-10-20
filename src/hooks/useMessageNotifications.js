import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { request } from '../services/api';
import { subscribeLive } from '../services/live';
import { showMessageNotification } from '../services/device';

export default function useMessageNotifications({ ownerId, visiblePeerId, onOpen }) {
  const [message, setMessage] = useState(null);
  const latest = useRef(); latest.current = { visiblePeerId, onOpen };
  useEffect(() => {
    let stopped = false, busy = false, cursor = null, dismissTimer;
    setMessage(null);
    const poll = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        let more;
        do {
          const result = await request(`notifications/messages${cursor === null ? '' : `?after=${cursor}`}`);
          if (stopped) return;
          cursor = result.cursor; more = result.hasMore;
          const fresh = result.messages.filter(item => item.kind !== 'sos' && !(AppState.currentState === 'active' && item.senderId === latest.current.visiblePeerId));
          const incoming = fresh.at(-1);
          if (incoming) {
            setMessage(incoming);
            clearTimeout(dismissTimer); dismissTimer = setTimeout(() => { if (!stopped) setMessage(null); }, 8000);
            showMessageNotification(incoming, () => { if (!stopped) { setMessage(null); latest.current.onOpen(incoming); } });
          }
        } while (more && !stopped);
      } catch { /* Live and periodic checks retry after reconnection. */ }
      finally { busy = false; }
    };
    void poll();
    const unsubscribe = subscribeLive(poll);
    const timer = setInterval(poll, 4000);
    const subscription = AppState.addEventListener('change', () => void poll());
    return () => { stopped = true; clearInterval(timer); clearTimeout(dismissTimer); unsubscribe(); subscription.remove(); };
  }, [ownerId]);
  useEffect(() => { if (message?.senderId === visiblePeerId) setMessage(null); }, [visiblePeerId, message?.id]);
  return { message, dismiss: () => setMessage(null), open: () => { if (message) { latest.current.onOpen(message); setMessage(null); } } };
}
