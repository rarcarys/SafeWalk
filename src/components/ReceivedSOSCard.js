import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { request } from '../services/api';
import Icon from './ui/Icon';

export default function ReceivedSOSCard({ item, onAcknowledged, onOpenDetails }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const confirmed = !!item.acknowledgedAt;
  const acknowledge = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await request(`journeys/sos/${encodeURIComponent(item.ownerId)}/${encodeURIComponent(item.clientId)}/acknowledge`, { method: 'POST', body: {} });
      await onAcknowledged();
    } catch (failure) { setError(failure.message); }
    finally { lock.current = false; setBusy(false); }
  };
  if (confirmed) return <View style={s.receivedSOSConfirmed}>
    <View style={s.cardHeading}><Icon name="check-circle" size={20} color={colors.success} /><View style={s.flex}><Text style={s.rowTitle}>SOS · {item.name}</Text><Text style={s.rowSubtitle}>{t(item.routeStartedAt ? 'Маршрут построен · направляетесь на помощь' : 'Вы подтвердили получение')}</Text></View></View>
    <Text style={s.presenceText}>{new Date(item.createdAt).toLocaleString(locale)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Местоположение')} onPress={() => onOpenDetails(item)} style={s.textAction}><Text style={s.blueText}>{t('Местоположение')}</Text></Pressable>
  </View>;
  return <View style={s.receivedSOSUrgent}>
    <View style={s.cardHeading}><View style={s.receivedSOSIcon}><Icon name="alert-triangle" size={23} color="#FFFFFF" /></View><Text style={s.receivedSOSEyebrow}>{t('НУЖНА ПОМОЩЬ')}</Text></View>
    <Text style={s.receivedSOSTitle}>SOS</Text>
    <Text style={s.receivedSOSName}>{item.name}</Text>
    <Text style={s.receivedSOSDescription}>{t('Просит о помощи. Свяжитесь с человеком прямо сейчас.')}</Text>
    <Text style={s.receivedSOSTime}>{new Date(item.createdAt).toLocaleString(locale)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Местоположение')} onPress={() => onOpenDetails(item)} style={s.sosUrgentSecondary}><Icon name="map-pin" color="#FFFFFF" size={20} /><Text style={s.sosUrgentSecondaryText}>{t('Местоположение')}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Получил SOS, связываюсь')} accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={acknowledge} style={[s.sosUrgentPrimary, busy && { opacity: 0.65 }]}>
      <Icon name="check" size={21} color="#A60F23" /><Text style={s.sosUrgentPrimaryText}>{t(busy ? 'Подтверждаем…' : 'Получил SOS, связываюсь')}</Text>
    </Pressable>
    {!!error && <Text role="alert" style={s.sosUrgentError}>{t(error)}</Text>}
  </View>;
}
