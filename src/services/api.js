import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSessionToken } from './session';
function apiBase() {
  if (process.env.EXPO_PUBLIC_AUTH_API_URL)
    return process.env.EXPO_PUBLIC_AUTH_API_URL.replace(/\/$/, '');
  const host =
    Platform.OS === 'web'
      ? window.location.hostname
      : new URL(`http://${Constants.expoConfig?.hostUri || 'localhost:8081'}`)
          .hostname;
  return `http://${host}:3001`;
}
export async function request(endpoint, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`${apiBase()}/api/auth/${endpoint}`, {
      method,
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-SafeWalk-Client': Platform.OS === 'web' ? 'web' : 'native',
        ...(getSessionToken() && Platform.OS !== 'web'
          ? {
              Authorization: `Bearer ${getSessionToken()}`,
            }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new Error('Не удалось подключиться к серверу. Попробуйте ещё раз.');
  } finally {
    clearTimeout(timer);
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || 'Не удалось выполнить запрос');
    error.status = response.status;
    error.fields = result.fields;
    throw error;
  }
  return result;
}
