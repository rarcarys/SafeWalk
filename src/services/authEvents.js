const listeners = new Set();
export const onSessionExpired = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const sessionExpired = () => { for (const listener of listeners) listener(); };
