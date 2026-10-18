import React, { useEffect, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import Icon from './ui/Icon';
import { useSettings } from '../context/SettingsContext';
import { checkDeviceState, readBattery } from '../services/readiness';
import { loadJourneyState } from '../services/journeys';
import ActionButton from './ui/ActionButton';

export default function JourneyReadiness({ accompanied, selected, compact = false }) {
  const { appStyles: s, t, colors } = useSettings();
  const [expanded, setExpanded] = useState(!compact);
  const [state, setState] = useState(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    const [device, network, battery] = await Promise.allSettled([checkDeviceState(), loadJourneyState(), readBattery()]);
    setState({ ...(device.status === 'fulfilled' ? device.value : {}), online: network.status === 'fulfilled', battery: battery.status === 'fulfilled' ? battery.value : null });
    setChecking(false);
  };
  useEffect(() => { check(); }, []);
  const permission = value => t(['granted'].includes(value) ? 'разрешено' : ['denied'].includes(value) ? 'запрещено' : value === 'unsupported' ? 'недоступно на устройстве' : 'ещё не разрешено');
  return <View style={{ marginVertical: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Готовность к поездке')} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <Icon name={state?.online ? 'check-circle' : 'info'} size={16} color={state?.online ? colors.success : colors.muted} />
      <Text style={[s.rowSubtitle, s.flex]}>{t('Готовность к поездке')}</Text><Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
    </Pressable>
    {!expanded && state && (!state.online || state.location === 'denied') && <Text style={s.mapError}>{t(!state.online ? 'Нет связи с сервером' : 'Геолокация запрещена. Проверьте разрешения.')}</Text>}
    {expanded && state && <>
      <Text style={s.rowSubtitle}>{t('Связь с сервером')}: {t(state.online ? 'доступна' : 'нет связи')}</Text>
      <Text style={s.rowSubtitle}>{t('Геолокация')}: {permission(state.location)}</Text>
      <Text style={s.rowSubtitle}>{t('Уведомления')}: {permission(state.notifications)}</Text>
      <Text style={s.rowSubtitle}>{t('Заряд')}: {state.battery ? `${state.battery.level}%` : t('недоступно на устройстве')}</Text>
      <Text style={s.rowSubtitle}>{t('Контакты')}: {accompanied ? selected.map(person => `${person.name} — ${t(person.connectionStatus === 'accepted' ? 'связь подтверждена' : 'ожидает ответа')}`).join(', ') : t('Без сопровождения')}</Text>
      {accompanied && <Text style={s.rowSubtitle}>{t('Согласие на эту поездку будет запрошено после нажатия «Начать».')}</Text>}
      {(!state.online || state.location !== 'granted' || state.notifications !== 'granted') && <Text style={s.mapError}>{t('Проверьте связь и разрешения. Без них передача координат и уведомления могут быть недоступны.')}</Text>}
    </>}
    {expanded && <ActionButton title={t('Проверить готовность')} secondary busy={checking} onPress={check} />}
  </View>;
}
