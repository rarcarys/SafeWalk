import * as Location from 'expo-location';
export async function getCurrentLocation() {
  let timer;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted')
      throw new Error(
        'Доступ к геопозиции отключён. Разрешите его в настройках устройства.',
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
