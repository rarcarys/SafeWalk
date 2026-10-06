import { useFonts } from 'expo-font';
import { Feather } from '@expo/vector-icons';
import useAuth from './hooks/useAuth';
import { View, Text, ActivityIndicator } from 'react-native';
import s from './styles/appStyles';
import { colors } from './styles/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SafeWalk from './SafeWalk';
import AuthScreen from './screens/AuthScreen';
import React from 'react';
export default function App() {
  const [loaded, error] = useFonts(Feather.font);
  const { user, restoring, authError, onAuthenticated, onSignOut } = useAuth();
  if ((!loaded && !error) || restoring)
    return (
      <View style={s.loading}>
        <Text style={s.headerBrand}>SafeWalk</Text>
        <ActivityIndicator
          style={{
            marginTop: 20,
          }}
          color={colors.muted}
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      {user ? (
        <SafeWalk user={user} onSignOut={onSignOut} />
      ) : (
        <AuthScreen
          initialError={authError}
          onAuthenticated={onAuthenticated}
        />
      )}
    </SafeAreaProvider>
  );
}
