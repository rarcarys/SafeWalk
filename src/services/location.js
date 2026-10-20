import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
const locationError = (message, code) => Object.assign(new Error(message), { code });
export async function openLocationSettings(reason) {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && reason === 'LOCATION_DISABLED') {
    await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  } else await Linking.openSettings();
  return true;
}
export async function getCurrentLocation() {
  let timer;
  try {
    if (Platform.OS !== 'web' && !await Location.hasServicesEnabledAsync()) throw locationError('Геопозиция выключена на устройстве.', 'LOCATION_DISABLED');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted')
      throw locationError(
        'Доступ к геопозиции отключён. Разрешите его в настройках устройства.',
        'LOCATION_PERMISSION_DENIED',
      );
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Не удалось определить геопозицию. Попробуйте ещё раз.',
              ),
            ),
          12000,
        );
      }),
    ]);
    return position;
  } finally {
    clearTimeout(timer);
  }
}
export async function watchLocation(onPosition, onError) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Доступ к геопозиции отключён. Маршрут сохранён, но положение не обновляется.');
  return Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 15 }, onPosition, onError);
}
