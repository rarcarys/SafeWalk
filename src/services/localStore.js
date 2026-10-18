import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readLocal(key, fallback = null) {
  const value = await AsyncStorage.getItem(`safewalk.${key}`);
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
export const writeLocal = (key, value) => AsyncStorage.setItem(`safewalk.${key}`, JSON.stringify(value));
export const removeLocal = key => AsyncStorage.removeItem(`safewalk.${key}`);
