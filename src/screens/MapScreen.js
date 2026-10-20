import { useSettings } from '../context/SettingsContext';
import { View, Text, TextInput, Platform, Pressable, Linking, ScrollView, Keyboard } from 'react-native';
import MapCanvas from '../components/maps/MapCanvas';
import IconButton from '../components/ui/IconButton';
import RouteScreen from './RouteScreen';
import RoutePlanner from '../components/maps/RoutePlanner';
import Icon from '../components/ui/Icon';
import PlaceShortcuts from '../components/PlaceShortcuts';
import ActionButton from '../components/ui/ActionButton';
import React from 'react';
import { formatDuration } from '../services/duration.cjs';
export default function MapScreen({
  planning,
  trip,
  contact,
  sharing,
  dialogs,
  navigation,
  desktop
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const {
    origin,
    target,
    route,
    focusRequest,
    selectTarget,
    locationBusy,
    locate,
    collapsed,
    setCollapsed,
    recent
  } = planning;
  const {
    routeState
  } = trip;
  const {
    setDialog
  } = dialogs;
  const toggleMap = () => {
    Keyboard.dismiss();
    setCollapsed(value => !value);
  };
  const mapSearch = !desktop && collapsed && routeState === 'planned';
  const search = () => { Keyboard.dismiss(); planning.searchPlaces(); };
  return <View style={[s.workspace, desktop && s.desktopWorkspace]}>
      <View style={s.mapCanvas}>
        <MapCanvas origin={origin} target={target} route={route} focusRequest={focusRequest} onSelect={planning.selectPoint} editable={routeState === 'planned'} currentPosition={trip.active ? trip.position : null} />

        {(trip.active || planning.pickingOrigin) && <View pointerEvents="none" style={s.mapStreet}>
          <View style={s.blueDot} />
          <Text style={s.mapStreetText}>
            {routeState === 'pending' ? t('Ожидаем сопровождающего') : routeState === 'active' ? t("В пути") : origin.gps ? t("Моя геопозиция") : planning.pickingOrigin ? t("Нажмите на точку отправления") : origin.chosen ? t("Отправление выбрано") : t("Выберите точку отправления")}
          </Text>
        </View>}
        <IconButton icon={locationBusy ? 'clock' : 'crosshair'} label={t("Моё местоположение")} onPress={locate} style={s.locateButton} />
        {!desktop && !mapSearch && <Pressable accessibilityRole="button" accessibilityLabel={t(collapsed ? 'Показать маршрут' : 'Увеличить карту')} accessibilityState={{ expanded: collapsed }} onPress={toggleMap} style={({ pressed }) => [s.mapSizeButton, pressed && s.pressed]}>
          <Icon name={collapsed ? 'minimize-2' : 'maximize-2'} size={18} color={colors.ink} />
          <Text style={s.mapSizeLabel}>{t(collapsed ? 'Показать маршрут' : 'Увеличить карту')}</Text>
        </Pressable>}

        {Platform.OS !== 'web' && route && <Pressable accessibilityRole="link" accessibilityLabel={t("Данные маршрута OpenStreetMap и FOSSGIS")} onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')} style={s.nativeAttribution}>

            <Text style={s.nativeAttributionText}>{t("Маршрут © OpenStreetMap · FOSSGIS")}

          </Text>
          </Pressable>}
      </View>
      {mapSearch && <View style={s.mapSearchDock}>
        <View style={s.dockHandleTouch}><View style={s.sheetHandle} /></View>
        <View style={s.dockSearchRow}>
          <View style={s.dockSearchField}>
            <Icon name="search" size={21} color={colors.muted} />
            <TextInput ref={planning.destinationInput} accessibilityLabel={t('Место назначения')} value={planning.destination} onChangeText={value => { planning.setDestination(value); planning.setTarget(null); planning.resetRoute(); }} style={s.dockSearchInput} placeholder={t('Куда идём?')} placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={search} />
            {!!planning.destination && <IconButton icon="x" label={t('Очистить адрес')} onPress={() => { planning.setDestination(''); planning.setTarget(null); planning.resetRoute(); }} />}
            <IconButton icon={planning.searchBusy ? 'clock' : 'arrow-right'} label={t('Найти адрес')} disabled={planning.searchBusy} onPress={search} />
          </View>
        </View>
        {!target && <View style={s.dockCity}><Icon name="map-pin" size={12} color={colors.muted} /><TextInput accessibilityLabel={t('Город поиска')} value={planning.searchCity} onChangeText={planning.changeSearchCity} style={s.dockCityInput} placeholder={t('Например, Алматы')} placeholderTextColor={colors.muted} /></View>}
        <PlaceShortcuts planning={planning} onManage={() => setDialog('places')} />
        {!!planning.mapError && dialogs.dialog !== 'search' && <Text accessibilityRole="alert" style={s.mapError}>{planning.mapError}</Text>}
        {target && <View style={s.dockDestination}>
          {route && <Text style={[s.rowSubtitle, { paddingVertical: 8 }]}>{formatDuration(planning.duration, t)} · {planning.distance}</Text>}
          <View style={s.primaryActionRow}><View style={s.flex}><ActionButton title={t(route ? 'Начать поездку' : 'Построить маршрут')} busy={planning.mapBusy || planning.locationBusy} disabled={!planning.ready} onPress={() => { Keyboard.dismiss(); planning.start(); }} icon="navigation" /></View><IconButton icon="more-horizontal" label={t('Ещё')} onPress={() => setDialog('placeActions')} style={s.secondaryActionIcon} /></View>
        </View>}
      </View>}
      {!desktop && collapsed && !mapSearch && <View style={s.compactTripBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Показать маршрут')} onPress={toggleMap} style={s.compactTripOpen}>
          <Icon name="chevron-up" size={20} color={colors.blue} />
          <View style={s.flex}>
            <Text style={s.rowTitle} numberOfLines={1}>{target?.name || t('Куда идём?')}</Text>
            <Text style={s.rowSubtitle}>{t('Показать маршрут')}</Text>
          </View>
        </Pressable>
        {trip.active?.status === 'active' && <Pressable accessibilityRole="button" accessibilityLabel={t('Я на месте')} disabled={trip.busy} onPress={trip.onArrive} style={s.compactArrive}><Icon name="check" size={18} color={colors.white} /><Text style={s.compactArriveText}>{t('Я на месте')}</Text></Pressable>}
        {routeState === 'planned' && target && <Pressable accessibilityRole="button" accessibilityLabel={t(route ? 'Начать поездку' : 'Построить маршрут')} disabled={planning.mapBusy || planning.locationBusy || !planning.ready} onPress={() => { Keyboard.dismiss(); planning.start(); }} style={s.compactArrive}><Icon name="navigation" size={18} color={colors.white} /><Text style={s.compactArriveText}>{t(route ? 'Начать поездку' : 'Построить маршрут')}</Text></Pressable>}
      </View>}
      {(desktop || !collapsed) && <ScrollView style={[s.tripPanel, desktop ? s.desktopTripPanel : s.mobileTripPanel]} contentContainerStyle={[s.tripPanelContent, desktop && s.desktopPanelContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {!desktop && <Pressable accessibilityRole="button" accessibilityLabel={t('Увеличить карту')} onPress={toggleMap} style={s.sheetToggle}>

            <View style={s.sheetHandle} />
            <View style={s.panelSizeHint}><Icon name="chevron-down" size={16} color={colors.muted} /><Text style={s.rowSubtitle}>{t('Свернуть панель и увеличить карту')}</Text></View>
            {collapsed && <Text style={s.collapsedTitle}>
                {target?.name || t("Куда идём?")}
              </Text>}
          </Pressable>}
        {(desktop || !collapsed) && <>
            {routeState !== 'planned' ? <RouteScreen routeState={routeState} destination={planning.destination} arrivalLabel={trip.arrivalLabel} duration={trip.duration} extraMinutes={trip.extraMinutes} transport={planning.transport} distance={planning.distance} contact={contact} onChooseContact={() => setDialog('contact')} onArrive={trip.onArrive} onShareJourney={trip.onShareJourney} onNotificationStatus={trip.onNotificationStatus} onAddTime={trip.onAddTime} onOpenSettings={() => navigation.go('settings')} active={trip.active} remainingMinutes={trip.remainingMinutes} trackingStatus={trip.trackingStatus} trackingError={t(trip.trackingError)} busy={trip.busy} onCancel={() => setDialog('cancelJourney')} /> : <RoutePlanner planning={planning} contact={contact} sharing={sharing} dialog={dialogs.dialog} onChooseContact={() => setDialog('contact')} onChoosePlaces={() => setDialog('places')} onMore={() => setDialog('placeActions')} />}
            {desktop && routeState === 'planned' && <View style={s.desktopTripExtra}>
                <Text style={s.groupLabel}>{t("НЕДАВНИЕ МЕСТА")}</Text>
                {recent.length ? recent.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={t("Открыть {value0}", {
            value0: point.name
          })} onPress={() => selectTarget(point)} style={s.historyRow}>

                      <Icon name="clock" size={17} color={colors.muted} />
                      <Text style={[s.rowTitle, s.flex]} numberOfLines={2}>
                        {point.name}
                      </Text>
                      <Icon name="arrow-up-left" size={16} color={colors.muted} />

                    </Pressable>) : <Text style={s.rowSubtitle}>{t("Пока нет выбранных мест")}</Text>}
              </View>}
          </>}
      </ScrollView>}
    </View>;
}
