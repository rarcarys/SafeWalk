import { Platform } from 'react-native';
import { setSessionToken } from './session';
import * as SecureStore from 'expo-secure-store';
import { request } from './api';
import { stopDeviceServices } from './device';
import { removeLocal } from './localStore';
const STORAGE_KEY = 'safewalk.auth.session';
export async function restoreSession() {
  if (Platform.OS !== 'web')
    setSessionToken(await SecureStore.getItemAsync(STORAGE_KEY));
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
    body: credentials,
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
    body: {},
  });
  await clearSession();
}
export async function clearSession() {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(STORAGE_KEY);
  setSessionToken(null);
  await stopDeviceServices().catch(() => {});
  await removeLocal('last-user').catch(() => {});
}
export const updateProfile = name => request('account/profile', { method: 'PATCH', body: { name } });
export const updateAvatar = avatar => request('account/avatar', { method: 'PUT', body: { avatar } });
export const loadSessions = () => request('account/sessions');
export const changePassword = (password, newPassword) => request('account/password', { method: 'POST', body: { password, newPassword } });
export const revokeOtherSessions = password => request('account/sessions/revoke-others', { method: 'POST', body: { password } });
export const generateRecoveryCode = password => request('account/recovery-code', { method: 'POST', body: { password } });
export const recoverAccount = body => request('account/recover', { method: 'POST', body });
export async function deleteAccount(password, confirmation, ownerId) {
  await request('account/delete', { method: 'POST', body: { password, confirmation } });
  await clearSession();
  await Promise.all([removeLocal(`journey.${ownerId}`), removeLocal(`outbox.${ownerId}`)]);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(`safewalk.background.${ownerId}`);
}
