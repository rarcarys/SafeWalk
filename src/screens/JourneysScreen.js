import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { request } from '../services/api';
import ActionButton from '../components/ui/ActionButton';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import ModalSheet from '../components/ui/ModalSheet';
import ReceivedSOSCard from '../components/ReceivedSOSCard';

export default function JourneysScreen({ account, trip, onOpenMap, onCancel, onRepeat, onSelectReceived, onOpenSOSDetails }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const [historyOpen, setHistoryOpen] = useState(false), [actions, setActions] = useState(false);
  const [removing, setRemoving] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const stamp = value => new Date(value).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const clock = value => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const active = account.active;
  const activePeers = account.received.filter(item => ['active', 'pending'].includes(item.status));
  const sentGroups = [...new Map((account.sentSOS || []).map(item => [item.clientId, { ...item, peers: [] }])).values()];
  for (const group of sentGroups) group.peers = account.sentSOS.filter(item => item.clientId === group.clientId);
  const history = [
    ...account.history.map(item => ({ key: item.id, kind: 'journey', id: item.id, title: item.target.name, time: item.endedAt || item.startedAt, subtitle: t(item.status === 'arrived' ? 'Прибытие подтверждено' : 'Поездка отменена'), onOpen: () => onRepeat(item.target) })),
    ...account.received.filter(item => !['active', 'pending'].includes(item.status)).map(item => ({ key: item.id, kind: 'journey', id: item.id, title: item.ownerName, time: item.endedAt || item.startedAt, subtitle: item.target.name, onOpen: () => onSelectReceived(item.id) })),
    ...(account.receivedSOS || []).filter(item => item.acknowledgedAt).map(item => ({ key: `${item.ownerId}:${item.clientId}`, kind: 'sos', id: item.clientId, ownerId: item.ownerId, title: `SOS · ${item.name}`, time: item.createdAt, subtitle: t(item.routeStartedAt ? 'Маршрут построен · направляетесь на помощь' : 'Вы подтвердили получение'), onOpen: () => onOpenSOSDetails(item) })),
    ...sentGroups.filter(group => group.peers.every(item => item.acknowledgedAt)).map(group => ({ key: `sent:${group.clientId}`, kind: 'sos', id: group.clientId, ownerId: group.peers[0]?.ownerId, title: t('Ваш SOS'), time: group.createdAt, subtitle: group.peers.map(item => item.name).join(', ') })),
  ].sort((a, b) => b.time - a.time);
  const remove = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await request(removing.all ? 'journeys/entries/history' : 'journeys/entries', { method: 'DELETE', body: removing.all ? {} : { kind: removing.kind, id: removing.id, ...(removing.ownerId ? { ownerId: removing.ownerId } : {}) } }); await account.refresh(); if (removing.all) setHistoryOpen(true); setRemoving(null); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const menuAction = (icon, label, action) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={t(label)} onPress={() => { setActions(false); action(); }} style={s.menuAction}><Icon name={icon} size={20} color={colors.ink} /><Text style={s.rowTitle}>{t(label)}</Text></Pressable>;
  return <View style={[s.listPage, s.routesPage]}>
    <View style={s.cardHeading}><View style={s.flex}><Text style={s.pageTitle}>{t('Маршруты')}</Text><Text style={s.routesPageCaption}>{t('Поездки и сопровождение')}</Text></View><IconButton icon="more-horizontal" label={t('Ещё: безопасность')} onPress={trip.onOpenSafety} /></View>
    {!!(account.receivedSOS || []).filter(item => !item.acknowledgedAt).length && <View>{(account.receivedSOS || []).filter(item => !item.acknowledgedAt).map(item => <ReceivedSOSCard key={`${item.ownerId}:${item.clientId}`} item={item} onAcknowledged={account.refresh} onOpenDetails={onOpenSOSDetails} />)}</View>}
    {account.loading && <ActivityIndicator color={colors.blue} />}
    {!!account.error && <><Text role="alert" style={s.mapError}>{t(account.error)}</Text><ActionButton title={t('Повторить загрузку')} secondary onPress={account.refresh} /></>}
    <View style={s.routesSection}>
    <Text style={s.routesSectionTitle}>{t('Моя поездка')}</Text>
    {active ? <View style={s.routesMainCard}>
      <View style={s.cardHeading}><View style={s.routesStatePill}><View style={s.routesStateDot} /><Text style={s.routesStateText}>{t('В пути')}</Text></View><View style={s.flex} /><IconButton icon="more-horizontal" label={t('Ещё')} onPress={() => setActions(true)} /></View>
      <Text style={s.routesDestination}>{active.target.name}</Text>
      <View style={s.routesArrival}><Icon name="clock" size={20} color={colors.blue} /><View><Text style={s.routesArrivalLabel}>{t('Прибытие')}</Text><Text style={s.routesArrivalTime}>{clock(active.expectedAt)}</Text></View></View>
      <ActionButton title={t('Я на месте')} icon="check" busy={trip.busy} onPress={trip.onArrive} />
    </View> : !account.loading && <View style={s.routesMainCard}><View style={s.cardHeading}><View style={s.routesIconTile}><Icon name="navigation" size={24} color={colors.blue} /></View><View style={s.flex}><Text style={s.routesEmptyTitle}>{t('Куда отправимся?')}</Text><Text style={s.routesPageCaption}>{t('Выберите место и начните поездку')}</Text></View></View><ActionButton title={t('Новый маршрут')} icon="plus" disabled={!!account.error} onPress={onOpenMap} /></View>}
    </View>
    {activePeers.length > 0 && <View style={s.routesSection}><View style={s.cardHeading}><Text style={[s.routesSectionTitle, s.flex]}>{t('Близкие в пути')}</Text><Text style={s.routesCount}>{activePeers.length}</Text></View>{activePeers.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t('Поездка: {value0}', { value0: item.ownerName })} onPress={() => onSelectReceived(item.id)} style={s.routesPeerCard}><View style={s.routesIconTile}><Icon name="navigation" size={20} color={colors.blue} /></View><View style={s.flex}><Text style={s.rowTitle}>{item.ownerName}</Text><Text numberOfLines={1} style={s.routesPageCaption}>{item.target.name}</Text></View><View style={s.routesPeerTime}><Text style={s.routesPeerClock}>{clock(item.expectedAt)}</Text><Icon name="chevron-right" size={16} color={colors.muted} /></View></Pressable>)}</View>}
    {!!account.outbox.items.length && <View style={s.journeyCard}><Text style={s.rowTitle}>{t('Ожидают отправки')}: {account.outbox.items.length}</Text>{account.outbox.items.map(item => <View style={s.cardHeading} key={item.id}><Text style={[s.rowSubtitle, s.flex]}>{t(item.label)}</Text><IconButton icon="x" label={t('Убрать из очереди')} onPress={() => account.outbox.discard(item.id).catch(failure => setError(failure.message))} /></View>)}</View>}
    <View style={s.routesHistoryCard}>
    <View style={s.routesHistoryHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('История')} accessibilityState={{ expanded: historyOpen }} onPress={() => setHistoryOpen(value => !value)} style={[s.cardHeading, s.flex, { minHeight: 48 }]}><Icon name="clock" size={19} color={colors.muted} /><Text style={s.routesSectionTitle}>{t('История')}</Text><Text style={s.routesCount}>{history.length}</Text><View style={s.flex} /><Icon name={historyOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} /></Pressable>
      {!!history.length && <Pressable accessibilityRole="button" accessibilityLabel={t('Очистить историю')} disabled={busy} onPress={() => { setError(''); setRemoving({ all: true }); }} style={s.routesClearAction}><Text style={s.routesClearText}>{t('Очистить')}</Text></Pressable>}
    </View>
    {historyOpen && <>{!history.length && <View style={s.routesEmptyHistory}><Text style={s.rowSubtitle}>{t('История пуста')}</Text></View>}{history.map(item => <View key={item.key} style={s.routesHistoryRow}><View style={[s.routesHistoryIcon, item.kind === 'sos' && { backgroundColor: colors.canvas }]}><Icon name={item.kind === 'sos' ? 'shield' : 'map-pin'} size={19} color={colors.muted} /></View><Pressable accessibilityRole="button" accessibilityLabel={item.title} disabled={!item.onOpen} onPress={item.onOpen} style={s.flex}><Text numberOfLines={1} style={s.rowTitle}>{item.title}</Text><Text numberOfLines={1} style={s.routesPageCaption}>{item.subtitle}</Text><Text style={s.routesHistoryDate}>{stamp(item.time)}</Text></Pressable><IconButton icon="trash-2" label={t('Удалить запись: {name}', { name: item.title })} onPress={() => { setError(''); setRemoving(item); }} /></View>)}</>}
    </View>
    {!!error && !removing && <Text role="alert" style={s.mapError}>{t(error)}</Text>}
    <ModalSheet visible={actions} title={t('Действия с поездкой')} onClose={() => setActions(false)}>
      {menuAction('map', 'Открыть мой маршрут', onOpenMap)}
      {menuAction('share-2', 'Ссылка на поездку', trip.onShareJourney)}
      {menuAction('bell', 'Статус уведомлений', trip.onNotificationStatus)}
      {menuAction('x-circle', 'Отменить поездку', onCancel)}
    </ModalSheet>
    <ModalSheet visible={!!removing} title={t(removing?.all ? 'Очистить всю историю?' : 'Удалить запись?')} onClose={() => { if (!busy) setRemoving(null); }}>
      {!!removing?.title && <Text style={s.rowTitle}>{removing.title}</Text>}<Text style={s.modalDescription}>{t(removing?.all ? 'Завершённые поездки и обработанные SOS исчезнут из вашего списка.' : 'Запись исчезнет из вашего списка. У других участников она останется.')}</Text>
      {!!error && <Text role="alert" style={s.mapError}>{t(error)}</Text>}
      <ActionButton title={t(removing?.all ? 'Очистить историю' : 'Удалить запись')} icon="trash-2" danger busy={busy} onPress={remove} />
      <ActionButton title={t('Оставить')} secondary disabled={busy} onPress={() => setRemoving(null)} />
    </ModalSheet>
  </View>;
}
