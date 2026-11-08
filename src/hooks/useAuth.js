import { useState, useEffect } from 'react';
import { restoreSession, signOut, clearSession } from '../services/auth';
import { onSessionExpired } from '../services/authEvents';
import { readLocal, writeLocal, removeLocal } from '../services/localStore';
export default function useAuth() {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [authError, setAuthError] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  useEffect(() => onSessionExpired(() => {
    setUser(null); setAuthError(''); setSessionEnded(true);
    clearSession().catch(() => {});
  }), []);
  useEffect(() => {
    let mounted = true;
    restoreSession()
      .then((account) => {
        if (mounted) { setUser(account); if (account) writeLocal('last-user', account).catch(() => {}); }
      })
      .catch(async (failure) => {
        if (mounted) setAuthError(failure.message);
        if (failure.code === 'NETWORK') {
          const cached = await readLocal('last-user').catch(() => null);
          if (mounted && cached) setUser(cached);
        }
      })
      .finally(() => {
        if (mounted) setRestoring(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  return {
    user,
    restoring,
    authError,
    sessionEnded,
    dismissSessionEnded: () => setSessionEnded(false),
    onUpdateUser: account => { setUser(account); writeLocal('last-user', account).catch(() => {}); },
    onDeleted: () => setUser(null),
    onAuthenticated: (account) => {
      setAuthError('');
      setSessionEnded(false);
      setUser(account);
      writeLocal('last-user', account).catch(() => {});
    },
    onSignOut: async () => {
      await signOut();
      setUser(null);
      await removeLocal('last-user');
    },
  };
}
