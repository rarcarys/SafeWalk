import { useSettings, SettingsProvider } from './context/SettingsContext';
import { useFonts } from 'expo-font';
import { Feather } from '@expo/vector-icons';
import useAuth from './hooks/useAuth';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SafeWalk from './SafeWalk';
import AuthScreen from './screens/AuthScreen';
import Splash from './components/Splash';
import React, { useEffect } from 'react';
import { actionSOS } from './services/actionSOS';
if (Platform.OS !== 'web') SplashScreen.preventAutoHideAsync().catch(() => {});
function AppContent() {
  const {
    ready
  } = useSettings();
  const [loaded, error] = useFonts(Feather.font);
  const {
    user,
    restoring,
    authError,
    onUpdateUser,
    onDeleted,
    onAuthenticated,
    onSignOut
  } = useAuth();
  const appReady = (loaded || !!error) && !restoring && ready;
  useEffect(() => {
    if (!restoring && !user) actionSOS?.setOwner(null);
  }, [restoring, user?.id]);
  useEffect(() => {
    if (appReady && Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);
  if (!appReady) return <Splash />;
  return <SafeAreaProvider>
      {user ? <SafeWalk key={user.id} user={user} onUpdateUser={onUpdateUser} onDeleted={onDeleted} onSignOut={onSignOut} /> : <AuthScreen initialError={authError} onAuthenticated={onAuthenticated} />}
    </SafeAreaProvider>;
}
export default function App() {
  return <SettingsProvider><AppContent /></SettingsProvider>;
}
