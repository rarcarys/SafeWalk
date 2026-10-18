import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSessionToken } from './session';
import { sessionExpired } from './authEvents';
export function apiBase() {
  if (process.env.EXPO_PUBLIC_AUTH_API_URL)
    return process.env.EXPO_PUBLIC_AUTH_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && window.location.protocol === 'https:') return window.location.origin;
  const host =
    Platform.OS === 'web'
      ? window.location.hostname
      : new URL(`http://${Constants.expoConfig?.hostUri || 'localhost:8081'}`)
          .hostname;
  return `http://${host}:3001`;
}
export async function request(endpoint, { method = 'GET', body, timeout = 10000, signal, expectedOwner } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  let response;
  let result;
  try {
    response = await fetch(`${apiBase()}/api/auth/${endpoint}`, {
      method,
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-SafeWalk-Client': Platform.OS === 'web' ? 'web' : 'native',
        ...(expectedOwner ? { 'X-SafeWalk-Owner': expectedOwner } : {}),
        ...(getSessionToken() && Platform.OS !== 'web'
          ? {
              Authorization: `Bearer ${getSessionToken()}`,
            }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    result = await response.json();
  } catch {
    const error = new Error('Не удалось подключиться к серверу. Проверьте подключение и повторите попытку.');
    error.code = 'NETWORK';
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  if (!response.ok) {
    if (response.status === 401 && !['login', 'register'].includes(endpoint)) sessionExpired();
    const error = new Error(result.message || 'Не удалось выполнить запрос');
    error.status = response.status;
    error.fields = result.fields;
    throw error;
  }
  return result;
}
