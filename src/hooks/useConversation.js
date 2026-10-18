import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadMessages, sendMessage, markChatRead, reactToMessage } from '../services/circle';
import { subscribeLive } from '../services/live';

const merge = (current, incoming) => [...new Map([...current, ...incoming].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id);

export default function useConversation(peerId, outbox) {
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const sendLock = useRef(false);
  const olderLock = useRef(false);
  const pending = useRef(null);
  const oldest = useRef(null);
  const reactionLock = useRef(false);
  const [reacting, setReacting] = useState(false);
  useEffect(() => {
    const version = ++generation.current;
    let cancelled = false;
    let polling = false;
    let initialized = false;
    let cursor = 0;
    setMessages([]);
    setPresence(null);
    oldest.current = null;
    setLoading(true);
    setHasOlder(false);
    setError('');
    if (!peerId) { setLoading(false); return; }
    const update = async () => {
      if (polling || cancelled || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      polling = true;
      try {
        let more;
        do {
          const result = await loadMessages(peerId, initialized ? `?after=${cursor}${oldest.current ? `&reactionFrom=${oldest.current}` : ''}` : '');
          if (cancelled) return;
          setPresence(result.presence || null);
          if (!oldest.current && result.messages.length) oldest.current = result.messages[0].id;
          setMessages(current => merge(current, result.messages).map(message => ({ ...message, read: message.id <= (result.peerReadId || 0), reactions: (result.reactions || []).filter(reaction => reaction.messageId === message.id) })));
          cursor = result.messages.at(-1)?.id || cursor;
          if (cursor) await markChatRead(peerId, cursor);
          if (cancelled) return;
          more = initialized && result.hasMore;
          if (!initialized) setHasOlder(result.hasMore);
          initialized = true;
        } while (more && !cancelled);
        setError('');
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      } finally {
        polling = false;
        if (!cancelled && generation.current === version) setLoading(false);
      }
    };
    update();
    const unsubscribe = subscribeLive(update);
    const timer = setInterval(update, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { cancelled = true; generation.current++; clearInterval(timer); subscription.remove(); unsubscribe(); };
  }, [peerId, retry]);
  const send = async (text) => {
    if (sendLock.current || loading || !peerId) return false;
    const version = generation.current;
    sendLock.current = true;
    setSending(true);
    // Keep the same key on retry if the server saved a message but its response was lost.
    if (pending.current?.peerId !== peerId || pending.current?.text !== text)
      pending.current = { peerId, text, id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}` };
    try {
      const result = outbox ? await outbox.run(`circle/chats/${encodeURIComponent(peerId)}/messages`, { text, clientId: pending.current.id }, 'Сообщение') : await sendMessage(peerId, text, pending.current.id);
      if (result.queued) { pending.current = null; return true; }
      if (generation.current === version) {
        setMessages(current => merge(current, [result.message]));
        setError('');
      }
      pending.current = null;
      return true;
    } catch (failure) {
      if (generation.current === version) setError(failure.message);
      return false;
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };
  const loadOlder = async () => {
    if (!hasOlder || olderLock.current || !messages.length) return;
    const version = generation.current;
    olderLock.current = true;
    setLoadingOlder(true);
    try {
      const result = await loadMessages(peerId, `?before=${messages[0].id}`);
      if (generation.current === version) {
        if (result.messages.length) oldest.current = result.messages[0].id;
        setMessages(current => merge(current, result.messages.map(message => ({ ...message, reactions: (result.reactions || []).filter(reaction => reaction.messageId === message.id) }))));
        setHasOlder(result.hasMore);
        setError('');
      }
    } catch (failure) {
      if (generation.current === version) setError(failure.message);
    } finally {
      olderLock.current = false;
      setLoadingOlder(false);
    }
  };
  const react = async (id, emoji) => {
    if (reactionLock.current) return false;
    const version = generation.current;
    reactionLock.current = true; setReacting(true);
    try {
      const result = await reactToMessage(peerId, id, emoji);
      if (generation.current === version) { setMessages(current => current.map(message => message.id === id ? { ...message, reactions: result.reactions } : message)); setError(''); }
      return true;
    } catch (failure) { if (generation.current === version) setError(failure.message); return false; }
    finally { reactionLock.current = false; setReacting(false); }
  };
  return { messages, presence, loading, sending, loadingOlder, hasOlder, error, send, loadOlder, react, reacting, reconnect: useCallback(() => setRetry(value => value + 1), []) };
}
