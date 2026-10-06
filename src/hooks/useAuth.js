import { useState, useEffect } from 'react';
import { restoreSession, signOut } from '../services/auth';
export default function useAuth() {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    let mounted = true;
    restoreSession()
      .then((account) => {
        if (mounted) setUser(account);
      })
      .catch((failure) => {
        if (mounted) setAuthError(failure.message);
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
    onAuthenticated: (account) => {
      setAuthError('');
      setUser(account);
    },
    onSignOut: async () => {
      await signOut();
      setUser(null);
    },
  };
}
