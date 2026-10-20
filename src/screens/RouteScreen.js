import { useSettings } from '../context/SettingsContext';
import { View, Text, Pressable, Linking } from 'react-native';
import ActionButton from '../components/ui/ActionButton';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import ModalSheet from '../components/ui/ModalSheet';
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
  onShareJourney,
  onNotificationStatus,
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
  const [more, setMore] = useState(false);
  const watching = active?.recipients.filter(person => person.consent === 'accepted') || [];
  return <>
      <View style={s.cardHeading}><Text style={[s.groupLabel, s.flex]}>{t('МОЯ ПОЕЗДКА')}</Text>{active && <IconButton icon="more-horizontal" label={t('Действия с поездкой')} onPress={() => setMore(true)} />}</View>
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
        {!!active.recipients.length && !active.recipients.some(person => person.consent === 'accepted') && <Text style={s.rowSubtitle}>{t('Контакты уведомлены, пока никто не смотрит')}</Text>}
        {!!watching.length && <Text style={s.rowSubtitle}>{t('Следят за поездкой')}: {watching.map(person => person.name).join(', ')}</Text>}
        {!active.recipients.length && <Text style={s.rowSubtitle}>{t('Без сопровождения')}</Text>}
        {!!trackingError && <Text role="alert" style={s.mapError}>{trackingError}</Text>}
      </>}
      <View style={{
      marginTop: 16
    }} />
      <ActionButton title={routeState === 'arrived' ? t("Готово") : t("Я на месте")} icon={routeState === 'arrived' ? undefined : 'check'} onPress={onArrive} busy={busy} disabled={routeState === 'pending'} />

      <ModalSheet visible={more && !!active} title={t('Действия с поездкой')} onClose={() => { if (!busy) setMore(false); }}>
      <ActionButton title={t('Ссылка на поездку')} icon="share-2" secondary disabled={busy} onPress={() => { setMore(false); onShareJourney(); }} />
      <ActionButton title={t('Статус уведомлений')} icon="bell" secondary disabled={busy} onPress={() => { setMore(false); onNotificationStatus(); }} />
      {routeState === 'active' && <ActionButton title={t("Добавить 5 минут")} icon="clock" secondary onPress={() => { setMore(false); onAddTime(); }} busy={busy} />}
      {active && <>
        <ActionButton title={t("Открыть навигацию")} icon="external-link" secondary onPress={() => {
        setNavigationError('');
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${active.origin.latitude},${active.origin.longitude}&destination=${active.target.latitude},${active.target.longitude}&travelmode=${active.transport === 'walk' ? 'walking' : active.transport === 'bus' ? 'transit' : 'driving'}`).catch(() => setNavigationError(t("Не удалось открыть карту. Попробуйте ещё раз.")));
      }} />
        {!!navigationError && <Text role="alert" style={s.mapError}>{navigationError}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={t("Отменить поездку")} onPress={() => { setMore(false); onCancel(); }} disabled={busy} style={s.textAction}><Text style={s.dangerText}>{t("Отменить поездку")}</Text></Pressable>
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Сценарий при задержке")} onPress={() => { setMore(false); onOpenSettings(); }} style={s.delayLink}>

        <Text style={s.delayLinkText}>{t("Настройки связи при задержке")}

        </Text>
        <Icon name="chevron-right" size={14} color={colors.muted} />
      </Pressable>
      </ModalSheet>
    </>;
}
