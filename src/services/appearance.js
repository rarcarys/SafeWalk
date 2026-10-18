import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'safewalk.appearance';

export async function loadAppearance() {
  const stored = Platform.OS === 'web'
    ? window.localStorage.getItem(STORAGE_KEY)
    : await SecureStore.getItemAsync(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export async function saveAppearance(settings) {
  const stored = JSON.stringify(settings);
  if (Platform.OS === 'web') window.localStorage.setItem(STORAGE_KEY, stored);
  else await SecureStore.setItemAsync(STORAGE_KEY, stored);
}
