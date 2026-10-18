import React from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useSettings } from '../../context/SettingsContext';
import Icon from '../ui/Icon';
import IconButton from '../ui/IconButton';
import ActionButton from '../ui/ActionButton';
import PlaceShortcuts from '../PlaceShortcuts';
import { formatDuration } from '../../services/duration.cjs';
import { transports } from '../../data/transports';

export default function RoutePlanner({ planning, dialog, onChoosePlaces, onMore }) {
  const { appStyles: s, colors, t } = useSettings();
  const { route, origin, destinationInput, destination, setDestination, setTarget, resetRoute, searchPlaces, transport, setTransport, duration, distance, mapError, target, start, mapBusy } = planning;
  const search = () => { Keyboard.dismiss(); searchPlaces(); };
  return <>
    <View style={s.plannerHeading}><Text style={s.panelTitle}>{t('Маршрут')}</Text><TextInput accessibilityLabel={t('Город поиска')} style={s.plannerCity} value={planning.searchCity} onChangeText={planning.changeSearchCity} placeholder={t('Например, Алматы')} placeholderTextColor={colors.muted} /></View>
    <View style={s.plannerAddressCard}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Указать точку отправления на карте')} onPress={() => planning.setPickingOrigin(value => !value)} style={[s.originRow, s.flex, { minHeight: 48, marginBottom: 0, paddingHorizontal: 8 }]}>
      <View style={s.originDot} /><Text style={s.originText} numberOfLines={1}>{planning.pickingOrigin ? t('Нажмите на карту для выбора отправления') : origin.name}</Text><Icon name="edit-2" size={15} color={colors.muted} />
    </Pressable>
    <IconButton icon={planning.locationBusy ? 'clock' : 'crosshair'} label={t('Моё местоположение')} disabled={planning.locationBusy || mapBusy} onPress={planning.locate} />
    </View>
    <View style={[s.destinationField, { borderWidth: 0, borderTopWidth: 1, borderColor: colors.line, borderRadius: 0, marginTop: 0, backgroundColor: colors.canvas, paddingLeft: 4, height: 52 }]}>
      <Icon name="map-pin" size={18} />
      <TextInput ref={destinationInput} accessibilityLabel={t('Место назначения')} style={s.destinationInput} value={destination} onChangeText={value => { setDestination(value); setTarget(null); resetRoute(); }} placeholder={t('Адрес или место')} placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={search} />
      {!!destination && <IconButton icon="x" label={t('Очистить адрес')} onPress={() => { setDestination(''); setTarget(null); resetRoute(); destinationInput.current?.focus(); }} />}
      <IconButton icon="search" label={t('Найти адрес')} onPress={search} disabled={planning.searchBusy} />
    </View>
    </View>
    <PlaceShortcuts planning={planning} onManage={onChoosePlaces} />
    {target && <>
      <Text style={s.plannerSectionTitle}>{t('Как добираемся')}</Text>
      <View style={s.startTransportOptions}>{transports.map(({ id, label, icon }) => <Pressable key={id} accessibilityRole="radio" aria-checked={transport === id} accessibilityLabel={t(label)} accessibilityState={{ checked: transport === id, disabled: mapBusy }} disabled={mapBusy} onPress={() => { if (id !== transport) { setTransport(id); resetRoute(); } }} style={[s.startTransportOption, transport === id && s.startTransportSelected]}><Icon name={icon} size={18} color={transport === id ? colors.selectedText : colors.muted} /><Text style={[s.startTransportText, transport === id && { color: colors.selectedText }]}>{t(label)}</Text></Pressable>)}</View>
      {transport === 'bus' && <Text style={s.rowSubtitle}>{t('Ориентир по дорогам, без автобусных линий и расписания. Уточните время поездки.')}</Text>}
      {route && <View style={s.routeSummary}><Icon name="navigation" size={16} color={colors.blue} /><Text style={s.routeSummaryText}>{formatDuration(duration, t)}</Text><Text style={s.rowSubtitle}>{distance}</Text></View>}
      <View style={s.primaryActionRow}><View style={s.flex}><ActionButton title={t(route ? 'Начать поездку' : 'Построить маршрут')} onPress={start} busy={mapBusy || planning.locationBusy} disabled={!planning.ready} icon="navigation" /></View><IconButton icon="more-horizontal" label={t('Ещё')} onPress={onMore} style={s.secondaryActionIcon} /></View>
    </>}
    {!!mapError && dialog !== 'search' && <Text accessibilityRole="alert" style={s.mapError}>{mapError}</Text>}
  </>;
}
