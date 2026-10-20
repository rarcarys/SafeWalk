import { useSettings } from '../context/SettingsContext';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import IconButton from './ui/IconButton';
import Icon from './ui/Icon';
import MapCanvas from './maps/MapCanvas';
import { getCurrentLocation, openLocationSettings } from '../services/location';
import { actionKey } from '../services/journeys';
import JourneyReadiness from './JourneyReadiness';
import PlaceEditor from './PlaceEditor';
import { transports, transportLabel } from '../data/transports';
import DurationInput from './DurationInput';
export default function TripDialogs({
  dialogs,
  planning,
  trip,
  account,
  contacts,
  notify,
  sharedJourney,
  onOpenChat,
  onOpenMap
}) {
  const {
    appStyles: s,
    colors,
    t,
    locale
  } = useSettings();
  const {
    dialog,
    setDialog
  } = dialogs;
  const [sosBusy, setSosBusy] = useState(false);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [locationPrompt, setLocationPrompt] = useState(null);
  const sosSending = useRef(false);
  const [sosNote, setSosNote] = useState('');
  const [error, setError] = useState('');
  const [editingPlaces, setEditingPlaces] = useState(false);
  const [saveKind, setSaveKind] = useState('place');
  const [placeToDelete, setPlaceToDelete] = useState(null);
  const pendingSOS = useRef(null);
  const recipients = [contacts.contact, ...contacts.backupIds].map(id => contacts.people[id]).filter(Boolean);
  const busy = sosBusy || account.busy;
  useEffect(() => {
    setError('');
    if (dialog === 'places') setEditingPlaces(false);
    if (dialog === 'sos') {
      setLocationUnavailable(false);
      setLocationPrompt(null);
      setSosNote('');
      pendingSOS.current = null;
    }
  }, [dialog]);
  const close = () => {
    if (!busy) setDialog(null);
  };
  const askDeletePlace = (slot, returnTo = 'places') => { setPlaceToDelete({ slot, returnTo }); setDialog('deletePlace'); };
  const saveToSlot = async slot => {
    if (!planning.target || busy || trip.active) return;
    try {
      if (saveKind === 'route') await account.saveFavorite(slot, { origin: planning.origin, target: planning.target, transport: planning.transport });
      else await account.savePlace(slot, planning.target);
      setDialog(null); notify(t(saveKind === 'route' ? 'Маршрут сохранён' : 'Место сохранено'));
    } catch (failure) { setError(failure.message); }
  };
  const send = async (includeLocation = true) => {
    if (sosSending.current) return;
    sosSending.current = true;
    setError('');
    setSosBusy(true);
    try {
      let point;
      if (includeLocation) {
        if (trip.position && Date.now() - trip.position.updatedAt < 60000) point = trip.position;else {
          try {
            const result = await getCurrentLocation();
            point = { ...result.coords, capturedAt: result.timestamp };
          } catch (failure) {
            setLocationUnavailable(true);
            if (['LOCATION_DISABLED', 'LOCATION_PERMISSION_DENIED'].includes(failure.code)) setLocationPrompt(failure.code);
            throw failure;
          }
        }
      }
      if (!pendingSOS.current) pendingSOS.current = actionKey();
      const result = await account.sendSOS({
        clientId: pendingSOS.current,
        includeLocation,
        note: sosNote.trim(),
        position: point ? { ...point, capturedAt: point.capturedAt ?? point.updatedAt ?? Date.now() } : undefined
      });
      if (result.queued) { setDialog(null); notify(t('SOS ожидает отправки. Сервер ещё не получил тревогу. Если нужна помощь, позвоните контакту.')); return; }
      setDialog(null);
      notify(t("SOS добавлен в чаты: {value0}.{value1}", {
        value0: result.sentCount,
        value1: result.skippedNames.length ? t(" По телефону свяжитесь вручную: {value0}.", {
          value0: result.skippedNames.join(', ')
        }) : t(" Получатели увидят его в SafeWalk.")
      }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      sosSending.current = false;
      setSosBusy(false);
    }
  };
  const fail = !!error && <Text role="alert" style={s.mapError}>{t(error)}</Text>;
  return <>
    <ModalSheet visible={dialog === 'quickHomeConsent'} title={t('Быстрый маршрут домой')} onClose={close}>
      <Text style={s.modalDescription}>{t('Определим ваше текущее местоположение и построим пеший маршрут до сохранённого дома. Координаты будут переданы сервису маршрутов FOSSGIS. Перед началом вы сможете проверить время и сопровождающих.')}</Text>
      <ActionButton title={t('Построить маршрут домой')} icon="home" onPress={() => planning.quickHome(true)} />
    </ModalSheet>
    <ModalSheet visible={dialog === 'deletePlace'} title={t('Удалить адрес?')} onClose={() => { if (!busy) setDialog(placeToDelete?.returnTo || 'places'); }}>
      <Text style={s.modalDescription}>{t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[placeToDelete?.slot] || '')}</Text>
      <Text style={s.rowSubtitle}>{account.places.find(item => item.slot === placeToDelete?.slot)?.name}</Text>
      {fail}
      <View style={{ marginTop: 24 }}><ActionButton title={t('Удалить адрес')} icon="trash-2" danger busy={busy} onPress={async () => { if (!placeToDelete || busy) return; try { await account.deletePlace(placeToDelete.slot); setPlaceToDelete(null); setDialog('places'); notify(t('Адрес удалён')); } catch (failure) { setError(failure.message); } }} /></View>
    </ModalSheet>
    <ModalSheet visible={dialog === 'placeActions'} title={t('Ещё')} onClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Возможности безопасности')} style={s.menuAction} onPress={() => setDialog('safetyTools')}><Icon name="shield" size={21} color={colors.ink} /><Text style={[s.rowTitle, s.flex]}>{t('Возможности безопасности')}</Text><Icon name="chevron-right" size={17} color={colors.muted} /></Pressable>
      {[['map-pin', 'Сохранить адрес', () => { setSaveKind('place'); setDialog('saveDestination'); }], ...(planning.route ? [['navigation', 'Сохранить маршрут', () => { setSaveKind('route'); setDialog('saveDestination'); }]] : [])].map(([icon, label, action]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={t(label)} disabled={busy} onPress={action} style={s.menuAction}><Icon name={icon} size={21} color={colors.ink} /><Text style={s.rowTitle}>{t(label)}</Text><View style={s.flex} /><Icon name="chevron-right" size={17} color={colors.muted} /></Pressable>)}
    </ModalSheet>
    <ModalSheet visible={dialog === 'saveDestination'} title={t(saveKind === 'route' ? 'Сохранить маршрут' : 'Сохранить адрес')} onClose={close}>
      <Text style={s.modalDescription}>{planning.target?.name}</Text>
      {['home', 'work', 'study'].map(slot => <Pressable key={slot} accessibilityRole="button" accessibilityLabel={t('Сохранить: {place}', { place: t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[slot]) })} disabled={busy} onPress={() => saveToSlot(slot)} style={s.menuAction}><Icon name={slot === 'home' ? 'home' : slot === 'work' ? 'briefcase' : 'book-open'} size={21} color={colors.ink} /><View style={s.flex}><Text style={s.rowTitle}>{t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[slot])}</Text><Text style={s.rowSubtitle}>{(saveKind === 'route' ? account.favoriteRoutes : account.places)?.some(item => item.slot === slot) ? t('Заменить сохранённое') : t('Добавить')}</Text></View><Icon name="chevron-right" size={17} color={colors.muted} /></Pressable>)}
      {fail}
    </ModalSheet>
    {dialog === 'editPlace' && <PlaceEditor key={planning.placeSlot} slot={planning.placeSlot} place={account.places.find(item => item.slot === planning.placeSlot)} currentTarget={planning.target} origin={planning.origin} city={planning.searchCity} onClose={() => setDialog('places')} onDelete={slot => askDeletePlace(slot, 'editPlace')} onSave={async (slot, point) => { await account.savePlace(slot, point); notify(t('Место сохранено')); setDialog('places'); }} />}
    <ModalSheet visible={dialog === 'startJourney'} title={t("Начать поездку")} onClose={close}>
      <View style={s.startRouteSummary}>
        <View style={s.startRouteIcon}><Icon name={planning.transport === 'car' ? 'truck' : 'navigation'} size={22} color={colors.blue} /></View>
        <View style={s.flex}><Text style={s.startDestination}>{planning.target?.name}</Text><Text style={s.rowSubtitle}>{t(transportLabel(planning.transport))} · {planning.distance}</Text></View>
      </View>
      <View accessibilityRole="radiogroup" style={s.startTransportOptions}>
        {transports.map(mode => <Pressable key={mode.id} accessibilityRole="radio" aria-checked={planning.transport === mode.id} accessibilityLabel={t(mode.label)} accessibilityState={{ checked: planning.transport === mode.id, disabled: busy || planning.mapBusy }} disabled={busy || planning.mapBusy} onPress={() => trip.changeTransport(mode.id)} style={[s.startTransportOption, planning.transport === mode.id && s.startTransportSelected]}><Icon name={mode.icon} size={18} color={planning.transport === mode.id ? colors.selectedText : colors.muted} /><Text style={[s.startTransportText, planning.transport === mode.id && { color: colors.selectedText }]}>{t(mode.label)}</Text></Pressable>)}
      </View>
      {planning.transport === 'bus' && <Text style={[s.rowSubtitle, { marginBottom: 12 }]}>{t('Ориентир по дорогам, без автобусных линий и расписания. Уточните время поездки.')}</Text>}
      {planning.transport === 'taxi' && <Text style={[s.rowSubtitle, { marginBottom: 12 }]}>{t('Время ожидания такси не учтено. Добавьте его при необходимости.')}</Text>}
      {!!planning.mapError && <Text accessibilityRole="alert" style={s.mapError}>{planning.mapError}</Text>}
      <View style={s.startTimeCard}>
      <Text style={s.startSectionLabel}>{t('Время в пути')}</Text>
      <DurationInput value={trip.minutes} onChange={trip.setMinutes} disabled={busy || planning.mapBusy} />
      <Text style={[s.rowSubtitle, { textAlign: 'center', marginTop: 6 }]}>{t('Можно добавить время с запасом')}</Text>
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={t("С сопровождением")} aria-checked={trip.accompanied} aria-disabled={!trip.canAccompany || busy} accessibilityState={{
        checked: trip.accompanied,
        disabled: !trip.canAccompany || busy
      }} disabled={!trip.canAccompany || busy} onPress={() => trip.setAccompanied(value => !value)} style={s.startCompanionRow}>
        <Icon name="shield" size={20} color={colors.blue} />
        <View style={s.flex}><Text style={s.rowTitle}>{t("С сопровождением")}</Text><Text style={s.rowSubtitle}>{trip.canAccompany ? trip.selected.map(person => person.name).join(', ') : t("Подключите аккаунты выбранных контактов")}</Text></View>
        <View style={[s.checkbox, trip.accompanied && s.checkboxSelected]}>{trip.accompanied && <Icon name="check" size={15} color={colors.white} />}</View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Настроить контакты')} disabled={busy} onPress={() => setDialog('contact')} style={s.startContactLink}><Text style={s.blueText}>{t('Настроить контакты')}</Text><Icon name="chevron-right" size={14} color={colors.blue} /></Pressable>
      <Text style={s.rowSubtitle}>{trip.accompanied ? t("Контактам будут доступны место назначения и время прибытия.{value0}{value1}", {
          value0: account.preferences.sharing ? t(" Геопозиция обновляется, пока приложение открыто.") : t(" Координаты не передаются."),
          value1: account.preferences.scenario ? t(" При задержке сервер добавит сообщения в чаты.") : ''
        }) : t("Маршрут сохранится в истории. Контакты не получают сообщения и доступ к поездке.")}</Text>
      {dialog === 'startJourney' && <JourneyReadiness compact accompanied={trip.accompanied} selected={trip.selected} />}
      <View style={{ marginTop: 18 }}><ActionButton title={trip.accompanied ? t("Начать с сопровождением") : t("Начать без сопровождения")} icon="navigation" busy={busy || planning.mapBusy} onPress={trip.confirmStart} /></View>
    </ModalSheet>
    <ModalSheet visible={dialog === 'lowBattery' && !!trip.active} title={t('Низкий заряд телефона')} onClose={close}>
      <Text style={s.modalDescription}>{t('Осталось {count}%. Телефон может отключиться. Предупредить сопровождающих?', { count: trip.battery?.level })}</Text>
      <ActionButton title={t('Предупредить контакты')} busy={busy} disabled={!trip.active?.recipients.length} onPress={trip.warnBattery} />
      <ActionButton title={t('Закрыть')} secondary onPress={close} />
    </ModalSheet>
    <ModalSheet visible={dialog === 'checkin' && !!trip.active} title={t("Ты в порядке?")} onClose={close}>
      <Text style={s.modalDescription}>{t("Плановое время прибытия наступило. Подтвердите прибытие или добавьте время.")}</Text>
      {trip.active?.scenario && <Text style={s.rowSubtitle}>{t('Через {count} мин без подтверждения сервер предупредит основной контакт.', { count: account.preferences.delayMinutes ?? 5 })}</Text>}
      <View style={{
        marginTop: 18
      }}><ActionButton title={t("Я на месте")} icon="check" busy={busy} onPress={trip.onArrive} /></View>
      <ActionButton title={t("Добавить 5 минут")} icon="clock" secondary busy={busy} onPress={trip.onAddTime} />
    </ModalSheet>
    <ModalSheet visible={dialog === 'confirmArrival' && !!trip.active} title={t('Вы точно на месте?')} onClose={close}>
      <Text style={s.modalDescription}>{t('Поездка завершится, а уведомления о задержке остановятся.')}</Text>
      {!!trip.active?.recipients.length && <Text style={s.rowSubtitle}>{t('Контакты получат сообщение о прибытии.')}</Text>}
      <View style={{ marginTop: 18 }}><ActionButton title={t('Да, я на месте')} icon="check" busy={busy} onPress={trip.onConfirmArrival} /></View>
      <ActionButton title={t('Нет, ещё в пути')} secondary disabled={busy} onPress={close} />
    </ModalSheet>
    <ModalSheet visible={dialog === 'cancelJourney'} title={t("Отменить поездку?")} onClose={close}>
      <Text style={s.modalDescription}>{t("Поездка сохранится в истории. Автоматические сообщения при задержке остановятся.")}{trip.active?.recipients.length ? t(" Контакты получат сообщение об отмене.") : ''}</Text>
      <View style={{
        marginTop: 18
      }}><ActionButton title={t("Отменить поездку")} danger busy={busy} onPress={trip.onCancel} /></View>
      <ActionButton title={t("Продолжить поездку")} secondary disabled={busy} onPress={close} />
    </ModalSheet>
    <ModalSheet visible={dialog === 'sos'} title={t(locationPrompt ? 'Геопозиция отключена' : 'Отправить SOS')} onClose={() => { if (!busy) { if (locationPrompt) setLocationPrompt(null); else close(); } }}>
      {locationPrompt ? <>
        <View style={s.linkInviteHeroIcon}><Icon name="map-pin" size={26} color={colors.blue} /></View>
        <Text style={s.modalDescription}>{t(Platform.OS === 'web' ? 'В браузере откройте настройки сайта рядом с адресной строкой и разрешите геопозицию. Если она выключена на устройстве, включите её в системных настройках.' : locationPrompt === 'LOCATION_DISABLED' ? 'Включите геопозицию в настройках устройства, затем вернитесь в SafeWalk.' : 'Разрешите SafeWalk доступ к геопозиции в настройках приложения, затем вернитесь сюда.')}</Text>
        {Platform.OS !== 'web' && <ActionButton title={t('Открыть настройки')} icon="settings" disabled={busy} onPress={async () => { try { await openLocationSettings(locationPrompt); } catch { setError(t('Не удалось открыть настройки. Откройте их вручную.')); } }} />}
        <ActionButton title={t('Проверить и отправить SOS')} icon="map-pin" busy={busy} onPress={() => { setLocationPrompt(null); send(); }} />
        <ActionButton title={t('Отправить без геопозиции')} secondary busy={busy} onPress={() => send(false)} />
        {fail}
      </> : <>
      <Text style={s.modalDescription}>{t('Ваши контакты получат тревогу и местоположение.')}</Text>
      <View style={s.sosDefaultLocation}><Icon name="map-pin" size={17} color={colors.blue} /><Text style={s.rowSubtitle}>{t('Геопозиция добавляется автоматически')}</Text></View>
      <TextInput accessibilityLabel={t('Послание SOS')} placeholder={t('Что случилось? Необязательно')} placeholderTextColor={colors.muted} style={s.contactInput} value={sosNote} onChangeText={setSosNote} maxLength={280} editable={!busy} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>{['Позвони мне', 'Не могу говорить', 'Встреть меня'].map(note => <Pressable key={note} accessibilityRole="button" accessibilityLabel={t(note)} disabled={busy} onPress={() => setSosNote(t(note))} style={s.sosQuickNote}><Text style={s.blueText}>{t(note)}</Text></Pressable>)}</View>
      <Text style={s.rowSubtitle}>{recipients.length ? recipients.map(person => person.name).join(', ') : t('Вы ещё не добавили контакты.')}</Text>
      {fail}
      <View style={{ marginTop: 18 }}><ActionButton title={t('Отправить SOS')} danger icon="alert-circle" busy={busy} disabled={!recipients.some(person => person.peerId)} onPress={() => send()} /></View>
      {locationUnavailable && <ActionButton title={t('Отправить без геопозиции')} secondary busy={busy} onPress={() => send(false)} />}
      {!recipients.length && <ActionButton title={t('Добавить контакт')} secondary onPress={() => setDialog('addContact')} />}
      </>}
    </ModalSheet>
    <ModalSheet visible={dialog === 'places'} title={t("Мои места")} onClose={close}>
      <View style={s.placesHeading}><Text style={s.rowSubtitle}>{t('Сохранённые адреса')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t(editingPlaces ? 'Готово' : 'Редактировать места')} disabled={busy} style={s.textAction} onPress={() => setEditingPlaces(value => !value)}><Text style={s.blueText}>{t(editingPlaces ? 'Готово' : 'Изменить')}</Text></Pressable></View>
      {['home', 'work', 'study'].map(slot => {
        const place = account.places.find(item => item.slot === slot);
        const label = t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[slot]);
        return <View key={slot} style={s.savedPlaceRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(place ? 'Выбрать: {place}' : 'Добавить адрес: {place}', { place: label })} disabled={busy || (place && !!trip.active)} style={s.savedPlacePick} onPress={() => { if (!place) return planning.editPlace(slot); const expanded = planning.collapsed; onOpenMap(); planning.selectTarget(place, expanded); }}>
            <View style={s.savedPlaceIcon}><Icon name={slot === 'home' ? 'home' : slot === 'work' ? 'briefcase' : 'book-open'} size={22} color={colors.ink} /></View>
            <View style={s.flex}><Text style={s.savedPlaceName}>{label}</Text><Text style={s.savedPlaceAddress} numberOfLines={2}>{place?.name || t('Добавить адрес')}</Text></View>
            {!place && <Icon name="plus" size={20} color={colors.muted} />}
          </Pressable>
          {place && editingPlaces && <IconButton icon="edit-2" label={t('Изменить адрес: {place}', { place: label })} disabled={busy} onPress={() => planning.editPlace(slot)} style={s.savedPlaceEdit} />}
          {place && editingPlaces && <IconButton icon="trash-2" label={t('Удалить адрес: {place}', { place: label })} color={colors.red} disabled={busy} onPress={() => askDeletePlace(slot)} style={s.savedPlaceEdit} />}
        </View>;
      })}
      {!!account.favoriteRoutes?.length && <Text style={[s.groupLabel, { marginTop: 24 }]}>{t('Избранные маршруты')}</Text>}
      {(account.favoriteRoutes || []).map(plan => <View key={plan.slot} style={s.savedPlaceRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Повторить маршрут') + ': ' + t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[plan.slot])} disabled={busy || !!trip.active} style={s.savedPlacePick} onPress={() => { onOpenMap(); planning.repeatFavorite(plan); }}>
          <View style={s.savedPlaceIcon}><Icon name="navigation" color={colors.blue} /></View>
        <View style={s.flex}><Text style={s.rowTitle}>{t('Избранный маршрут')}: {t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[plan.slot])}</Text><Text style={s.rowSubtitle}>{plan.origin.name} → {plan.target.name}</Text>
        </View>
        </Pressable>
        {editingPlaces && <IconButton icon="trash-2" label={t('Удалить маршрут')} disabled={busy} onPress={() => account.deleteFavorite(plan.slot).catch(failure => setError(failure.message))} />}
      </View>)}
      {fail}
    </ModalSheet>
    <ModalSheet visible={dialog === 'sharedJourney'} title={sharedJourney ? t("Поездка: {value0}", {
      value0: sharedJourney.ownerName
    }) : t("Поездка недоступна")} onClose={close}>
      {sharedJourney ? <ScrollView style={{
        maxHeight: 430
      }} keyboardShouldPersistTaps="handled">
        <Text style={s.modalDescription}>{sharedJourney.target.name}</Text>
        {sharedJourney.consent !== 'accepted' && sharedJourney.status === 'active' && <>
          <Text style={s.modalDescription}>{t('Поездка уже началась. Сообщите, если вы следите за поездкой.')}</Text>
          <ActionButton title={t('Слежу за поездкой')} busy={busy} onPress={() => account.respondJourney(sharedJourney.id, 'accepted').catch(failure => setError(failure.message))} />
          <ActionButton title={t('Сейчас не могу')} secondary disabled={busy || sharedJourney.consent === 'declined'} onPress={() => account.respondJourney(sharedJourney.id, 'declined').catch(failure => setError(failure.message))} />
        </>}
        <Text style={s.rowSubtitle}>{sharedJourney.status === 'pending' ? t('Ожидаем сопровождающего') : sharedJourney.status === 'active' ? t("Прибытие в {value0}", {
            value0: new Date(sharedJourney.expectedAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit'
            })
          }) : sharedJourney.status === 'arrived' ? t("Прибытие подтверждено") : t("Поездка отменена")}</Text>
        {sharedJourney.sharing ? <>
          <View style={s.sharedMap}><MapCanvas origin={{
              ...sharedJourney.origin,
              chosen: true
            }} target={sharedJourney.target} route={sharedJourney.route} currentPosition={sharedJourney.position} editable={false} focusRequest={0} /></View>
          <Text style={s.rowSubtitle}>{sharedJourney.position ? t("Последнее обновление: {value0}{value1}", {
              value0: new Date(sharedJourney.position.updatedAt).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit'
              }),
              value1: Date.now() - sharedJourney.position.updatedAt > 60000 ? t(" · Геопозиция может быть устаревшей") : ''
            }) : sharedJourney.status === 'active' ? t("Пока доступен только план маршрута. Текущая геопозиция ещё не получена.") : t("Передача геопозиции завершена.")}</Text>
        </> : <Text style={s.listFootnote}>{t("Координаты не передаются.")}</Text>}
        {sharedJourney.status === 'active' && sharedJourney.consent === 'accepted' && <View style={{
          marginTop: 18
        }}><ActionButton title={sharedJourney.acknowledgedAt ? t("Вы на связи") : t("Я на связи")} icon="check" busy={busy} disabled={!!sharedJourney.acknowledgedAt} onPress={() => account.acknowledge(sharedJourney.id).catch(failure => setError(failure.message))} /></View>}
        <ActionButton title={t("Написать")} icon="message-circle" secondary onPress={() => onOpenChat({
          peerId: sharedJourney.ownerId,
          name: sharedJourney.ownerName
        })} />
        {fail}
      </ScrollView> : <Text style={s.modalDescription}>{t("Доступ закрыт или поездка удалена из вашего круга.")}</Text>}
    </ModalSheet>
  </>;
}
