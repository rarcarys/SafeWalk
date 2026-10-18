import { useSettings } from '../context/SettingsContext';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import ActionButton from '../components/ui/ActionButton';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import { formatDuration } from '../services/duration.cjs';
import { transportLabel } from '../data/transports';
const time = (value, locale) => new Date(value).toLocaleTimeString(locale, {
  hour: '2-digit',
  minute: '2-digit'
});
const date = (value, locale) => new Date(value).toLocaleDateString(locale, {
  day: 'numeric',
  month: 'long'
});
export default function JourneysScreen({
  account,
  trip,
  onOpenMap,
  onCancel,
  onRepeat,
  onSelectReceived
}) {
  const {
    appStyles: s,
    colors,
    t,
    locale
  } = useSettings();
  const [queueError, setQueueError] = useState('');
  return <View style={s.listPage}>
    <View style={s.cardHeading}><Text style={[s.pageTitle, s.flex]}>{t("Маршруты")}</Text><IconButton icon="more-horizontal" label={t('Ещё: безопасность')} onPress={trip.onOpenSafety} /></View>
    <Text style={s.pageDescription}>{t("Текущая поездка, ваш круг и история")}</Text>
    {!!(queueError || account.outbox.error) && <Text role="alert" style={s.mapError}>{t(queueError || account.outbox.error)}</Text>}
    {account.outbox.items.map(item => <View style={s.journeyCard} key={item.id}>
      <Text style={s.rowTitle}>{t(item.label)}</Text>
      <Text style={s.rowSubtitle}>{t(item.status === 'pending' ? 'Ожидает отправки. Сервер ещё не подтвердил действие.' : item.error)}</Text>
      <ActionButton title={t('Убрать из очереди')} secondary onPress={() => account.outbox.discard(item.id).catch(error => setQueueError(error.message))} />
    </View>)}
    {(account.receivedSOS || []).map(item => <View key={`${item.ownerId}:${item.clientId}`} style={s.journeyCard}>
      <Text style={s.rowTitle}>SOS · {item.name}</Text><Text style={s.rowSubtitle}>{new Date(item.createdAt).toLocaleString(locale)}</Text>
      <ActionButton title={t(item.acknowledgedAt ? 'Вы подтвердили получение' : 'Получил SOS, связываюсь')} disabled={!!item.acknowledgedAt || account.busy} onPress={() => account.acknowledgeSOS(item.ownerId, item.clientId).catch(error => setQueueError(error.message))} />
    </View>)}
    {(account.sentSOS || []).map(item => <View key={`${item.clientId}:${item.peerId}`} style={s.personRow}>
      <View style={s.flex}><Text style={s.rowTitle}>SOS · {item.name}</Text><Text style={s.rowSubtitle}>{t(item.acknowledgedAt ? 'Контакт подтвердил получение и связывается с вами' : item.wasRead ? 'Сообщение прочитано' : 'Сервер принял тревогу. Подтверждения контакта пока нет.')}</Text></View>
    </View>)}
    {account.loading && <ActivityIndicator color={colors.blue} />}
    {!!account.error && <><Text role="alert" style={s.mapError}>{t(account.error)}</Text><ActionButton title={t("Повторить загрузку")} secondary onPress={account.refresh} /></>}
    {account.active ? <View style={s.journeyCard}>
      <View style={s.cardHeading}><Icon name="navigation" size={18} color={colors.blue} /><Text style={s.groupLabel}>{t("МОЯ ПОЕЗДКА")}</Text></View>
      <Text style={s.cardTitle}>{account.active.target.name}</Text>
      {!!trip.deviceStatus && <Text style={s.rowSubtitle}>{t(trip.deviceStatus)}</Text>}
      {account.active.status === 'pending' && <Text style={s.mapError}>{t('Ожидаем основного сопровождающего. Прогулка ещё не началась.')}</Text>}
      {account.active.recipients.map(person => <Text key={person.peerId} style={s.rowSubtitle}>{person.name}: {t(({ pending: 'ожидает ответа', accepted: 'сопровождение принято', declined: 'сопровождение отклонено' })[person.consent])}</Text>)}
      {account.active.status === 'active' && <Text style={s.rowSubtitle}>{"" + t("Прибытие в") + " "}{time(account.active.expectedAt, locale)} · {trip.remainingMinutes > 0 ? t("{value0} осталось", {
          value0: formatDuration(trip.remainingMinutes, t)
        }) : t("Подтвердите прибытие")}</Text>}
      {!account.active.recipients.length && <Text style={s.rowSubtitle}>{t('Без сопровождения')}</Text>}
      <ActionButton title={t("Открыть мой маршрут")} icon="map" onPress={onOpenMap} />
      <ActionButton title={t("Я на месте")} icon="check" secondary busy={trip.busy} disabled={account.active.status === 'pending'} onPress={trip.onArrive} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("Отменить поездку")} onPress={onCancel} style={s.textAction} disabled={trip.busy}><Text style={s.dangerText}>{t("Отменить поездку")}</Text></Pressable>
    </View> : !account.loading && <View style={s.emptyCard}>
      <Icon name="map" size={30} color={colors.blue} />
      <Text style={s.cardTitle}>{t("Куда отправимся?")}</Text>
      <Text style={s.rowSubtitle}>{t("Постройте маршрут, укажите время прибытия и выберите сопровождение.")}</Text>
      <ActionButton title={t("Новый маршрут")} icon="plus" disabled={!!account.error} onPress={onOpenMap} />
    </View>}
    {!!account.received.length && <>
      <Text style={[s.groupLabel, {
        marginTop: 28
      }]}>{t("ПОЕЗДКИ МОЕГО КРУГА")}</Text>
      {account.received.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t("Поездка: {value0}", {
        value0: item.ownerName
      })} onPress={() => onSelectReceived(item.id)} style={s.journeyCard}>
        <View style={s.cardHeading}><Icon name={item.status === 'active' ? 'navigation' : item.status === 'arrived' ? 'check-circle' : 'x-circle'} size={18} color={item.status === 'arrived' ? colors.success : colors.blue} /><Text style={s.personName}>{item.ownerName}</Text></View>
        <Text style={s.rowTitle}>{item.target.name}</Text>
        {item.consent === 'pending' && <Text style={s.blueText}>{t('Приглашение сопровождать')}</Text>}
        {item.consent === 'declined' && <Text style={s.rowSubtitle}>{t('Сопровождение отклонено')}</Text>}
        <Text style={s.rowSubtitle}>{item.status === 'pending' ? t('Ожидаем сопровождающего') : item.status === 'active' ? t("В пути · прибытие в {value0}", {
            value0: time(item.expectedAt, locale)
          }) : item.status === 'arrived' ? t("Прибытие подтверждено") : t("Поездка отменена")}</Text>
        {item.status === 'active' && <Text style={s.rowSubtitle}>{item.sharing ? item.position ? t("Геопозиция обновлена в {value0}", {
            value0: time(item.position.updatedAt, locale)
          }) : t("Ожидаем геопозицию") : t("Геопозиция не передаётся")}</Text>}
        <View style={s.cardHeading}><Text style={s.blueText}>{t("Открыть поездку")}</Text><Icon name="arrow-right" size={15} color={colors.blue} /></View>
      </Pressable>)}
    </>}
    <Text style={[s.groupLabel, {
      marginTop: 28
    }]}>{t("ИСТОРИЯ")}</Text>
    {!account.history.length && <Text style={s.listFootnote}>{t("Завершённые поездки появятся здесь.")}</Text>}
    {account.history.map(item => <View key={item.id} style={s.personRow}>
      <Icon name={item.status === 'arrived' ? 'check-circle' : 'x-circle'} size={22} color={item.status === 'arrived' ? colors.success : colors.muted} />
      <View style={s.flex}>
        <Text style={s.personName}>{item.target.name}</Text>
        <Text style={s.rowSubtitle}>{date(item.startedAt, locale)} · {time(item.startedAt, locale)} · {item.status === 'arrived' ? t("Прибытие подтверждено") : t("Отменено")}</Text>
        <Text style={s.rowSubtitle}>{(item.route.distance / 1000).toLocaleString(locale, {
            maximumFractionDigits: 1
          })}{" " + t("км ·") + " "}{t(transportLabel(item.transport))}</Text>
      </View>
      {!account.active && <Pressable accessibilityRole="button" accessibilityLabel={t("Повторить маршрут: {value0}", {
        value0: item.target.name
      })} onPress={() => onRepeat(item.target)} style={s.iconButton}><Icon name="rotate-ccw" size={18} color={colors.blue} /></Pressable>}
    </View>)}
    <Text style={s.listFootnote}>{t("Поездки и настройки сохраняются в вашем аккаунте.")}</Text>
  </View>;
}
