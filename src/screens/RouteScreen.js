import { useSettings } from '../context/SettingsContext';
import { View, Text, Pressable, Linking } from 'react-native';
import ActionButton from '../components/ui/ActionButton';
import Icon from '../components/ui/Icon';
import React, { useState } from 'react';
import { formatDuration } from '../services/duration.cjs';
import { transportLabel } from '../data/transports';
export default function RouteScreen({
  routeState,
  destination,
  arrivalLabel,
  duration,
  extraMinutes,
  transport,
  distance,
  contact,
  onChooseContact,
  onArrive,
  onAddTime,
  onOpenSettings,
  active,
  remainingMinutes,
  trackingStatus,
  trackingError,
  busy,
  onCancel
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const [navigationError, setNavigationError] = useState('');
  return <>
      <View style={s.tripState}>
        <View style={[s.stateDot, routeState === 'arrived' && {
        backgroundColor: colors.success
      }]} />

        <Text style={s.tripStateText}>
          {routeState === 'pending' ? t('Ожидаем сопровождающего') : routeState === 'arrived' ? t("Прибытие подтверждено") : active?.recipients.length ? t("Поездка с сопровождением") : t("Поездка началась")}
        </Text>
      </View>
      <Text style={s.panelTitle} numberOfLines={2}>
        {destination.trim() || t("Место назначения")}
      </Text>
      <View style={s.tripNumbers}>
        <View>
          <Text style={s.tripNumber}>{routeState === 'pending' ? '—' : arrivalLabel}</Text>
          <Text style={s.tripNumberLabel}>{t(routeState === 'pending' ? 'После подтверждения' : 'Прибытие')}</Text>
        </View>
        <View style={s.numberDivider} />
        <View>
          <Text style={s.tripNumber}>
            {formatDuration(duration + extraMinutes, t)}
          </Text>
          <Text style={s.tripNumberLabel}>
            {t(transportLabel(transport))} · {distance}
          </Text>
        </View>
      </View>
      {active && <>
        <Text style={s.rowSubtitle}>{active.status === 'pending' ? t('Прогулка ещё не началась') : remainingMinutes > 0 ? t("До прибытия: {value0}", {
          value0: formatDuration(remainingMinutes, t)
        }) : t("Задержка: {value0}", {
          value0: formatDuration(Math.abs(remainingMinutes || 0), t)
        })}</Text>
        {active.recipients.map(person => <Text key={person.peerId} style={s.rowSubtitle}>{person.name}: {t(({ pending: 'ожидает ответа', accepted: 'сопровождение принято', declined: 'сопровождение отклонено' })[person.consent])}</Text>)}
        {!active.recipients.length && <Text style={s.rowSubtitle}>{t('Без сопровождения')}</Text>}
        <Text style={s.rowSubtitle}>{trackingStatus === 'active' ? active.sharing ? t("Геопозиция обновляется для контактов") : t("Геопозиция обновляется только на устройстве") : trackingStatus === 'pending' ? t("Определяем геопозицию…") : trackingStatus === 'paused' ? t("Геопозиция приостановлена") : t("Геопозиция не обновляется")}</Text>
        {!!trackingError && <Text role="alert" style={s.mapError}>{trackingError}</Text>}
      </>}
      <View style={{
      marginTop: 16
    }} />
      <ActionButton title={routeState === 'arrived' ? t("Готово") : t("Я на месте")} icon={routeState === 'arrived' ? undefined : 'check'} onPress={onArrive} busy={busy} disabled={routeState === 'pending'} />

      {routeState === 'active' && <ActionButton title={t("Добавить 5 минут")} icon="clock" secondary onPress={onAddTime} busy={busy} />}
      {active && <>
        <ActionButton title={t("Открыть навигацию")} icon="external-link" secondary onPress={() => {
        setNavigationError('');
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${active.origin.latitude},${active.origin.longitude}&destination=${active.target.latitude},${active.target.longitude}&travelmode=${active.transport === 'walk' ? 'walking' : active.transport === 'bus' ? 'transit' : 'driving'}`).catch(() => setNavigationError(t("Не удалось открыть карту. Попробуйте ещё раз.")));
      }} />
        {!!navigationError && <Text role="alert" style={s.mapError}>{navigationError}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={t("Отменить поездку")} onPress={onCancel} disabled={busy} style={s.textAction}><Text style={s.dangerText}>{t("Отменить поездку")}</Text></Pressable>
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Сценарий при задержке")} onPress={onOpenSettings} style={s.delayLink}>

        <Text style={s.delayLinkText}>{t("Настройки связи при задержке")}

        </Text>
        <Icon name="chevron-right" size={14} color={colors.muted} />
      </Pressable>
    </>;
}
