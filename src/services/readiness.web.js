export async function checkDeviceState() {
  let location = 'unknown';
  try { location = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch {}
  return { location, notifications: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission };
}
export async function readBattery() {
  if (!navigator.getBattery) return null;
  const battery = await navigator.getBattery();
  return { level: Math.round(battery.level * 100), charging: battery.charging };
}
