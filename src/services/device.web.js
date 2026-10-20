export const enableBackground = async () => { throw new Error('Фоновая геолокация доступна в установленной мобильной сборке'); };
export const stopBackground = async () => {};
export const disableBackground = async () => {};
export const syncBackground = async () => 'В браузере координаты обновляются только при открытом приложении';
export const enableNotifications = async () => {
  if (typeof Notification === 'undefined' || !window.isSecureContext) throw new Error('Уведомления браузера требуют HTTPS и поддержки устройства');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Разрешите уведомления в настройках браузера');
  return 'Уведомления включены, пока SafeWalk открыт в браузере';
};
export const showMessageNotification = (message, onOpen) => {
  if (document.visibilityState !== 'hidden' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const urgent = message.kind === 'sos';
    const notification = new Notification(urgent ? 'SOS · SafeWalk' : 'SafeWalk', { body: urgent ? 'Контакт просит о помощи. Откройте SafeWalk прямо сейчас.' : 'Новое сообщение в SafeWalk', tag: `safewalk-message-${message.id}`, requireInteraction: urgent });
    notification.onclick = () => { window.focus(); notification.close(); onOpen(); };
  } catch { /* Mobile browsers may require an installed app for system notifications. */ }
};
export const setVisibleConversation = () => {};
export const syncReminder = async () => {};
export const syncSafetyReminder = async () => {};
export const stopDeviceServices = async () => {};
export const listenNotification = () => () => {};
