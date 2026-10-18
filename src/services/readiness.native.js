import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
export async function checkDeviceState() {
  const location = (await Location.getForegroundPermissionsAsync()).status;
  let notifications = 'unsupported';
  if (Constants.appOwnership !== 'expo') {
    const n = await import('expo-notifications');
    notifications = (await n.getPermissionsAsync()).status;
  }
  return { location, notifications };
}
export async function readBattery() {
  const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
  return level < 0 ? null : { level: Math.round(level * 100), charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL };
}
