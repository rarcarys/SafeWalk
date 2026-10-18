const listeners = new Set();
export const subscribeLive = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const publishLive = () => { for (const listener of listeners) listener(); };
