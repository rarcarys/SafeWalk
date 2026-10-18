import React from 'react';
import { Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';

export default function TripConnectionStatus({ trip, connected }) {
  const { appStyles: s, t, locale } = useSettings();
  if (trip.active?.status !== 'active') return null;
  const sent = trip.lastPositionSentAt;
  const stale = sent && trip.clock - sent > 60000;
  const sharing = trip.active.sharing && trip.active.recipients.some(person => person.consent === 'accepted');
  const label = !connected ? 'Нет связи с сервером' : !sharing ? 'Геопозиция не передаётся контактам' : trip.trackingStatus === 'offline' ? 'Не удалось передать геопозицию' : stale ? 'Геопозиция может быть устаревшей' : sent ? 'Геопозиция передаётся' : 'Ожидаем передачу геопозиции';
  return <View style={s.accountNotice}>
    <View style={s.flex}>
      <Text accessibilityLiveRegion="polite" style={s.accountNoticeText}>{t(label)}</Text>
      {sharing && <Text style={s.rowSubtitle}>{sent ? t('Сервер подтвердил обновление в {time}', { time: new Date(sent).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }) : t('Передача координат ещё не подтверждена сервером')}</Text>}
      {trip.battery && <Text style={s.rowSubtitle}>{t('Заряд: {count}%', { count: trip.battery.level })}{trip.battery.charging ? ` · ${t('Заряжается')}` : ''}</Text>}
      {!!trip.trackingError && <Text style={s.mapError}>{trip.trackingError}</Text>}
    </View>
  </View>;
}
