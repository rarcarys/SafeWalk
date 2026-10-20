import React from 'react';
import { Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import ContactBattery from './ContactBattery';

export default function TripConnectionStatus({ trip, connected, contacts }) {
  const { appStyles: s, t } = useSettings();
  if (trip.active?.status !== 'active') return null;
  const sent = trip.lastPositionSentAt;
  const stale = sent && trip.clock - sent > 60000;
  const label = !connected ? 'Нет связи с сервером' : trip.active.sharing && trip.trackingStatus === 'offline' ? 'Не удалось передать геопозицию' : trip.active.sharing && stale ? 'Геопозиция может быть устаревшей' : null;
  const people = Object.values(contacts?.people || {});
  if (!label && !trip.trackingError && !trip.active.recipients.length) return null;
  return <View style={s.tripContactStatus}>
      {!!label && <Text accessibilityLiveRegion="polite" style={s.mapError}>{t(label)}</Text>}
      <View style={s.tripContactChips}>{trip.active.recipients.map(recipient => {
        const person = people.find(item => item.peerId === recipient.peerId);
        return <View key={recipient.peerId} style={s.tripContactChip}>
          <Text numberOfLines={1} style={s.tripContactName}>{recipient.name}</Text>
          <ContactBattery battery={person?.presence?.battery} now={trip.clock} showUnavailable />
        </View>;
      })}</View>
      {!!trip.trackingError && <Text style={s.mapError}>{trip.trackingError}</Text>}
  </View>;
}
