import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { apiBase, request } from './api';

const TASK = 'safewalk-active-journey-location';
const CONFIG = 'safewalk.tracking';
const REMINDER = 'safewalk.arrival-reminder';
let notificationsPromise;
let visibleConversation = null;
export const setVisibleConversation = peerId => { visibleConversation = peerId; };
export const showMessageNotification = () => {};
const installNotificationHandler = n => n.setNotificationHandler({ handleNotification: async notification => {
  const data = notification.request.content.data;
  const suppress = data.kind === 'message' && AppState.currentState === 'active';
  const activeChat = data.kind === 'message' && data.peerId === visibleConversation && AppState.currentState === 'active';
  return { shouldShowBanner: !suppress, shouldShowList: !activeChat, shouldPlaySound: !suppress, shouldSetBadge: false };
} });
const notifications = () => notificationsPromise ||= import('expo-notifications');

async function taskConfiguration() {
  const stored = await SecureStore.getItemAsync(CONFIG);
  return stored ? JSON.parse(stored) : null;
}
async function stopTask() {
  if (await TaskManager.isAvailableAsync() && await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
}
async function stopIfCurrent(config) {
  const current = await taskConfiguration();
  if (current?.id === config.id && current?.ownerId === config.ownerId) await stopDeviceServices();
}
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error) return;
  const config = await taskConfiguration();
  if (!config) { await stopTask(); return; }
  const sample = data?.locations?.at(-1);
  if (!sample || Date.now() - sample.timestamp > 120000) return;
  const token = await SecureStore.getItemAsync('safewalk.auth.session');
  if (!token) { await stopIfCurrent(config); return; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${config.base}/api/auth/journeys/${encodeURIComponent(config.id)}/position`, {
      method: 'PUT', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-SafeWalk-Client': 'native', 'X-SafeWalk-Owner': config.ownerId, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ latitude: sample.coords.latitude, longitude: sample.coords.longitude, accuracy: sample.coords.accuracy, capturedAt: sample.timestamp }),
    });
    if ([401, 403, 404, 409].includes(response.status)) await stopIfCurrent(config);
  } catch { /* Keep the task alive; the next fresh sample retries without replaying stale positions. */ }
  finally { clearTimeout(timer); }
});

export async function enableBackground(ownerId) {
  if (Constants.appOwnership === 'expo' || !await TaskManager.isAvailableAsync()) throw new Error('Для фоновой геолокации установите отдельную мобильную сборку SafeWalk');
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Разрешите доступ к геопозиции');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') throw new Error('Разрешите геолокацию «Всегда» в настройках устройства');
  await SecureStore.setItemAsync(`safewalk.background.${ownerId}`, 'true');
}
export async function stopBackground() {
  await SecureStore.deleteItemAsync(CONFIG);
  await stopTask();
}
export async function disableBackground(ownerId) {
  await SecureStore.deleteItemAsync(`safewalk.background.${ownerId}`);
  await stopBackground();
}
export async function syncBackground(active, ownerId) {
  if (!active || active.status !== 'active' || !active.sharing) { await stopBackground(); return 'Фоновая передача выключена'; }
  if (Constants.appOwnership === 'expo' || !await TaskManager.isAvailableAsync()) return 'Фоновая геолокация требует отдельной мобильной сборки';
  if (await SecureStore.getItemAsync(`safewalk.background.${ownerId}`) !== 'true') return 'Фоновая геолокация не включена';
  if ((await Location.getBackgroundPermissionsAsync()).status !== 'granted') { await stopBackground(); return 'Нет разрешения на фоновую геолокацию'; }
  await SecureStore.setItemAsync(CONFIG, JSON.stringify({ id: active.id, ownerId, base: apiBase() }));
  if (!await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20,
    pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: 'SafeWalk', notificationBody: 'Передаём геопозицию во время активной прогулки', killServiceOnDestroy: true },
  });
  return 'Фоновая геолокация включена';
}
export async function enableNotifications() {
  if (Constants.appOwnership === 'expo') throw new Error('Для системных уведомлений установите отдельную мобильную сборку SafeWalk');
  const n = await notifications();
  if (Platform.OS === 'android') await n.setNotificationChannelAsync('safewalk', { name: 'Сообщения, прогулки и SOS', importance: n.AndroidImportance.HIGH });
  const permission = await n.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Разрешите уведомления в настройках устройства');
  installNotificationHandler(n);
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return 'Напоминания разрешены. Push-уведомления пока недоступны.';
  const token = (await n.getExpoPushTokenAsync({ projectId })).data;
  const result = await request('notifications/devices', { method: 'POST', body: { token } });
  return result.enabled ? 'Уведомления о событиях подключены' : 'Напоминания разрешены. Push-уведомления пока недоступны.';
}
let reminderSignature;
let safetyReminderWork = Promise.resolve();
export function syncSafetyReminder(timer, ownerId) {
  if (Constants.appOwnership === 'expo') return Promise.resolve();
  safetyReminderWork = safetyReminderWork.catch(() => {}).then(async () => {
    const n = await notifications();
    const identifier = 'safewalk-safety-timer';
    await n.cancelScheduledNotificationAsync(identifier);
    if (timer?.status !== 'active' || timer.expectedAt <= Date.now() || (await n.getPermissionsAsync()).status !== 'granted') return;
    await n.scheduleNotificationAsync({ identifier,
      content: { title: 'SafeWalk', body: 'Ты в порядке? Подтверди проверку безопасности.', sound: 'default', data: { page: 'route', safetyTimer: true, ownerId } },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(timer.expectedAt), channelId: 'safewalk' },
    });
  });
  return safetyReminderWork;
}
export async function syncReminder(active, enabled) {
  if (Constants.appOwnership === 'expo') return;
  const n = await notifications();
  const signature = active?.status === 'active' && enabled ? `${active.id}:${active.expectedAt}` : null;
  if (signature === reminderSignature) return;
  await n.cancelScheduledNotificationAsync(REMINDER);
  reminderSignature = null;
  if (!signature || active.expectedAt <= Date.now() || (await n.getPermissionsAsync()).status !== 'granted') return;
  await n.scheduleNotificationAsync({ identifier: REMINDER,
    content: { title: 'SafeWalk', body: 'Время подтвердить прибытие или продлить прогулку', sound: 'default', data: { page: 'route', ownerId: active.ownerId } },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(active.expectedAt), channelId: 'safewalk' },
  });
  reminderSignature = signature;
}
export function listenNotification(callback) {
  let subscription, stopped = false;
  if (Constants.appOwnership !== 'expo') notifications().then(async n => {
    if (stopped) return;
    installNotificationHandler(n);
    subscription = n.addNotificationResponseReceivedListener(response => callback(response.notification.request.content.data));
    const last = await n.getLastNotificationResponseAsync();
    if (!stopped && last) { callback(last.notification.request.content.data); await n.clearLastNotificationResponseAsync(); }
  }).catch(() => {});
  return () => { stopped = true; subscription?.remove(); };
}
export async function stopDeviceServices() {
  await stopBackground();
  if (Constants.appOwnership !== 'expo') {
    const n = await notifications(); await n.cancelScheduledNotificationAsync(REMINDER); reminderSignature = null;
  }
}
