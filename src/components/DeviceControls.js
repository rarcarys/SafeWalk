import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { enableBackground, disableBackground, enableNotifications, syncBackground, syncReminder } from '../services/device';
import ActionButton from './ui/ActionButton';
import PreferenceRow from './ui/PreferenceRow';
import ActionSOSSettings from './ActionSOSSettings';

export default function DeviceControls({ user, active, reminder, compact = false }) {
  const { appStyles: s, t } = useSettings();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function enable(kind) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (kind === 'location') {
        await enableBackground(user.id);
        const status = await syncBackground(active, user.id);
        setMessage(active?.status === 'active' && active.sharing ? status : 'Разрешение сохранено. Фоновая передача включится во время прогулки с геопозицией.');
      }
      else { setMessage(await enableNotifications()); await syncReminder(active, reminder); }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const disable = async () => {
    setBusy(true);
    try { await disableBackground(user.id); setMessage('Фоновая передача выключена'); }
    catch (failure) { setMessage(failure.message); }
    finally { setBusy(false); }
  };
  if (compact) return <View>
    <PreferenceRow title={t('Фоновая геолокация')} icon="map-pin" accessibilityLabel={t('Включить фоновую геолокацию')} value={t('Доступ к геопозиции при закрытом экране')} disabled={busy} onPress={() => enable('location')} />
    <PreferenceRow title={t('Уведомления')} icon="bell" accessibilityLabel={t('Включить уведомления')} value={t('Сообщения, напоминания и события поездки')} disabled={busy} onPress={() => enable('notifications')} />
    <PreferenceRow title={t('Выключить фоновую геолокацию')} accessibilityLabel={t('Выключить фоновую геолокацию')} disabled={busy} onPress={disable} last />
    <ActionSOSSettings />
    {!!message && <Text accessibilityLiveRegion="polite" style={[s.rowSubtitle, { marginTop: 16 }]}>{t(message)}</Text>}
  </View>;
  return <View style={{ gap: 12, marginBottom: 24 }}>
    <Text style={s.groupLabel}>{t('РАЗРЕШЕНИЯ ТЕЛЕФОНА')}</Text>
    <Text style={s.rowSubtitle}>{t('Фоновая геолокация работает только во время активной прогулки с передачей координат. Принудительное закрытие приложения может остановить отслеживание.')}</Text>
    <ActionButton title={t('Включить фоновую геолокацию')} secondary busy={busy} onPress={() => enable('location')} />
    <ActionButton title={t('Выключить фоновую геолокацию')} secondary disabled={busy} onPress={async () => {
      setBusy(true);
      try { await disableBackground(user.id); setMessage('Фоновая передача выключена'); }
      catch (failure) { setMessage(failure.message); }
      finally { setBusy(false); }
    }} />
    <ActionButton title={t('Включить уведомления')} secondary disabled={busy} onPress={() => enable('notifications')} />
    <ActionSOSSettings />
    {!!message && <Text accessibilityLiveRegion="polite" style={s.modalDescription}>{t(message)}</Text>}
  </View>;
}
