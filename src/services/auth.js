import { Platform } from 'react-native';
import { setSessionToken } from './session';
import * as SecureStore from 'expo-secure-store';
import { request } from './api';
const STORAGE_KEY = 'safewalk.auth.session';
export async function restoreSession() {
  if (Platform.OS !== 'web') setSessionToken(await SecureStore.getItemAsync(STORAGE_KEY));
  try {
    return (await request('me')).user;
  } catch (error) {
    if (error.status !== 401) throw error;
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(STORAGE_KEY);
    setSessionToken(null);
    return null;
  }
}
export async function authenticate(mode, credentials) {
  const result = await request(mode === 'register' ? 'register' : 'login', {
    method: 'POST',
    body: credentials
  });
  if (Platform.OS !== 'web') {
    if (!result.token) throw new Error('Сервер не вернул сессию');
    await SecureStore.setItemAsync(STORAGE_KEY, result.token);
    setSessionToken(result.token);
  }
  return result.user;
}
export async function signOut() {
  await request('logout', {
    method: 'POST',
    body: {}
  });
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(STORAGE_KEY);
  setSessionToken(null);
}
