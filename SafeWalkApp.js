import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import AuthScreen from './AuthScreen';
import { request, restoreSession, signOut } from './auth-client';
import * as Location from 'expo-location';
import MapCanvas from './components/MapCanvas';

const colors = {
  ink: '#202124', muted: '#75787d', line: '#e8e8eb', canvas: '#f4f4f6',
  blue: '#3169e8', red: '#d43839', white: '#ffffff',
};
const tabs = [
  { id: 'home', label: 'Карта', icon: 'map' },
  { id: 'route', label: 'Маршрут', icon: 'navigation' },
  { id: 'contacts', label: 'Близкие', icon: 'users' },
  { id: 'settings', label: 'Профиль', icon: 'user' },
];
const people = {
  dana: { name: 'Дана', letter: 'Д', relation: 'Подруга', background: '#ebe4f1', foreground: '#725a85' },
  mom: { name: 'Мама', letter: 'М', relation: 'Семья', background: '#f3e4da', foreground: '#946b50' },
  renata: { name: 'Рената', letter: 'Р', background: '#e1e9ec', foreground: '#4c707e' },
};

function Icon({ name, size = 20, color = colors.ink }) {
  return <Feather name={name} size={size} color={color} accessible={false} />;
}

function Avatar({ person, small, large, initial }) {
  const data = people[person];
  return (
    <View style={[s.avatar, small && s.smallAvatar, large && s.largeAvatar, { backgroundColor: data.background }]}>
      <Text style={[s.avatarLetter, large && { fontSize: 27 }, { color: data.foreground }]}>{initial || data.letter}</Text>
    </View>
  );
}

function IconButton({ icon, label, onPress, style, color }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [s.iconButton, style, pressed && s.pressed]}>
      <Icon name={icon} color={color} />
      {hovered && <View pointerEvents="none" style={s.tooltip}><Text style={s.tooltipText}>{label}</Text></View>}
    </Pressable>
  );
}

function ActionButton({ title, onPress, secondary, danger, icon, busy }) {
  const color = secondary ? colors.ink : colors.white;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={busy} accessibilityState={{ busy: !!busy, disabled: !!busy }}
      style={({ pressed }) => [s.actionButton, secondary && s.secondaryButton, danger && s.dangerButton, pressed && s.pressed]}>
      {busy ? <ActivityIndicator color={color} size="small" /> : <>{icon && <Icon name={icon} size={18} color={color} />}<Text style={[s.actionText, { color }]}>{title}</Text></>}
    </Pressable>
  );
}

function ModalSheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.modalSheet} accessibilityViewIsModal>
          <View style={s.modalHeading}><Text style={s.modalTitle}>{title}</Text><IconButton icon="x" label="Закрыть" onPress={onClose} /></View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function SafeWalk({ user, onSignOut }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 960;
  const [page, setPage] = useState('home');
  const [destination, setDestination] = useState('');
  const [origin, setOrigin] = useState({ latitude: 43.2405, longitude: 76.936, name: 'Алматы, точка А', gps: false });
  const [target, setTarget] = useState(null);
  const [route, setRoute] = useState(null);
  const [mapBusy, setMapBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [mapError, setMapError] = useState('');
  const [recent, setRecent] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [transport, setTransport] = useState('walk');
  const [routeState, setRouteState] = useState('planned');
  const [extraMinutes, setExtraMinutes] = useState(0);
  const [arrival, setArrival] = useState(null);
  const [contact, setContact] = useState('dana');
  const [inspectedContact, setInspectedContact] = useState('dana');
  const [sharing, setSharing] = useState(false);
  const [reminder, setReminder] = useState(true);
  const [scenario, setScenario] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const toastTimer = useRef(null);
  const destinationInput = useRef(null);
  const scroll = useRef(null);
  const routeVersion = useRef(0);
  const searchVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; routeVersion.current++; }; }, []);

  const duration = route ? Math.max(1, Math.ceil(route.duration / 60)) : 0;
  const distance = route ? `${(route.distance / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км` : '';
  const selectedPerson = people[contact];
  const notify = message => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };
  const go = next => {
    setPage(next);
    setCollapsed(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const arrivalLabel = arrival
    ? new Date(arrival + extraMinutes * 60000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : `${duration} мин`;
  const resetRoute = () => {
    routeVersion.current++;
    setRoute(null);
    setMapBusy(false);
    setMapError('');
  };
  const selectTarget = point => {
    searchVersion.current++;
    setSearchBusy(false);
    resetRoute();
    setTarget(point);
    setDestination(point.name);
    setSearchResults(null);
    setDialog(null);
    setCollapsed(false);
    setRecent(items => [point, ...items.filter(item => item.latitude !== point.latitude || item.longitude !== point.longitude)].slice(0, 3));
  };
  const searchPlaces = async () => {
    if (destination.trim().length < 3) return notify('Введите минимум 3 символа');
    const version = ++searchVersion.current;
    setSearchBusy(true);
    setSearchResults(null);
    setMapError('');
    setDialog('search');
    try {
      const result = await request('maps/search', { method: 'POST', body: { query: destination } });
      if (mounted.current && version === searchVersion.current) setSearchResults(result.places);
    } catch (error) { if (mounted.current && version === searchVersion.current) setMapError(error.message); }
    finally { if (mounted.current && version === searchVersion.current) setSearchBusy(false); }
  };
  const locate = async () => {
    if (locationBusy) return;
    if (routeState !== 'planned') return notify('Точка отправления зафиксирована. Завершите маршрут, чтобы изменить её.');
    setLocationBusy(true);
    const version = routeVersion.current;
    let timer;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Доступ к геопозиции отключён. Разрешите его в настройках устройства.');
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Не удалось определить геопозицию. Попробуйте ещё раз.')), 12000); }),
      ]);
      if (!mounted.current || version !== routeVersion.current) return;
      resetRoute();
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude, name: 'Моё местоположение', gps: true });
      setFocusRequest(value => value + 1);
    } catch (error) { if (mounted.current) notify(error.message); }
    finally { clearTimeout(timer); if (mounted.current) setLocationBusy(false); }
  };
  const buildRoute = async () => {
    setDialog(null);
    setMapError('');
    setMapBusy(true);
    const version = ++routeVersion.current;
    try {
      const result = await request('maps/route', { method: 'POST', body: { origin, target, mode: transport } });
      if (mounted.current && version === routeVersion.current) setRoute(result);
    } catch (error) { if (mounted.current && version === routeVersion.current) setMapError(error.message); }
    finally { if (mounted.current && version === routeVersion.current) setMapBusy(false); }
  };
  const start = () => {
    if (!target) return searchPlaces();
    if (!route) return setDialog('routeConsent');
    setArrival(Date.now() + duration * 60000);
    setExtraMinutes(0);
    setRouteState('active');
    go('route');
  };

  const contactSelector = () => (
    <Pressable accessibilityRole="button" accessibilityLabel="Выбрать контакт сопровождения" onPress={() => setDialog('contact')} style={s.contactSelector}>
      <Avatar person={contact} small />
      <Text style={s.contactSelectorLabel}>На связи: <Text style={s.medium}>{selectedPerson.name}</Text></Text>
      <Icon name="chevron-right" size={17} color={colors.muted} />
    </Pressable>
  );

  const renderPlanner = () => (
    <>
      <Text style={s.panelTitle}>Куда идём?</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Изменить точку отправления" onPress={locate} style={s.originRow}>
        <View style={s.originDot} /><Text style={s.originText}>{origin.name}</Text><Icon name="crosshair" size={15} color={colors.blue} />
      </Pressable>
      <View style={s.destinationField}>
        <Icon name="map-pin" size={18} />
        <TextInput ref={destinationInput} accessibilityLabel="Место назначения" style={s.destinationInput}
          value={destination} onChangeText={value => { setDestination(value); setTarget(null); resetRoute(); }} placeholder="Адрес или место" placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={searchPlaces} />
        {!!destination && <IconButton icon="x" label="Очистить адрес" onPress={() => { setDestination(''); setTarget(null); resetRoute(); destinationInput.current?.focus(); }} style={s.clearAddress} />}
        <IconButton icon="search" label="Найти адрес" onPress={searchPlaces} style={s.clearAddress} />
      </View>
      <View style={s.modeControl}>
        {[['walk', 'Пешком', 'user'], ['car', 'На машине', 'truck']].map(([id, label, icon]) => (
          <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: transport === id }}
            onPress={() => { if (id !== transport) { setTransport(id); resetRoute(); } }} style={[s.modeOption, transport === id && s.modeSelected]}>
            <Icon name={icon} size={16} color={transport === id ? colors.ink : colors.muted} />
            <Text style={[s.modeLabel, transport !== id && { color: colors.muted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {route && <View style={s.routeSummary}><Icon name="navigation" size={16} color={colors.blue} /><Text style={s.routeSummaryText}>{duration} мин</Text><Text style={s.rowSubtitle}>{distance}</Text><Text style={s.routeEstimate}>≈ {new Date(Date.now() + duration * 60000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text></View>}
      {!!mapError && dialog !== 'search' && <Text accessibilityRole="alert" style={s.mapError}>{mapError}</Text>}
      {contactSelector()}
      <ActionButton title={route ? 'Начать сопровождение' : target ? 'Построить маршрут' : 'Найти место'} onPress={start} busy={mapBusy} icon={route ? 'arrow-right' : 'navigation'} />
      <View style={s.sharingStatus}><Icon name={sharing ? 'map-pin' : 'lock'} size={12} color={colors.muted} /><Text style={s.sharingStatusText}>{sharing ? 'Настройка передачи геопозиции включена' : 'Геопозиция не передаётся'}</Text></View>
    </>
  );

  const renderTrip = () => (
    <>
      <View style={s.tripState}><View style={[s.stateDot, routeState === 'arrived' && { backgroundColor: '#32835d' }]} /><Text style={s.tripStateText}>{routeState === 'arrived' ? 'Вы в безопасности' : 'Сопровождение активно'}</Text></View>
      <Text style={s.panelTitle} numberOfLines={2}>{destination.trim() || 'Место назначения'}</Text>
      <View style={s.tripNumbers}><View><Text style={s.tripNumber}>{arrivalLabel}</Text><Text style={s.tripNumberLabel}>Прибытие</Text></View><View style={s.numberDivider} /><View><Text style={s.tripNumber}>{duration + extraMinutes}<Text style={s.minutesUnit}> мин</Text></Text><Text style={s.tripNumberLabel}>{transport === 'walk' ? 'Пешком' : 'На машине'} · {distance}</Text></View></View>
      {contactSelector()}
      <ActionButton title={routeState === 'arrived' ? 'Готово' : 'Я на месте'} icon={routeState === 'arrived' ? undefined : 'check'} onPress={() => {
        if (routeState === 'arrived') { setRouteState('planned'); go('home'); }
        else setRouteState('arrived');
      }} />
      {routeState !== 'arrived' && <ActionButton title="Добавить 5 минут" icon="clock" secondary onPress={() => {
        if (extraMinutes >= 30) return notify('Добавлено максимум 30 минут');
        setExtraMinutes(value => value + 5);
      }} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Сценарий при задержке" onPress={() => go('settings')} style={s.delayLink}><Text style={s.delayLinkText}>Нет ответа 5 минут → сообщение близкому</Text><Icon name="chevron-right" size={14} color={colors.muted} /></Pressable>
    </>
  );

  const renderMapPage = () => (
    <View style={[s.workspace, desktop && s.desktopWorkspace]}>
      <View style={s.mapCanvas}>
        <MapCanvas origin={origin} target={target} route={route} focusRequest={focusRequest} onSelect={selectTarget} editable={routeState === 'planned'} />
        <View pointerEvents="none" style={s.mapStreet}><View style={s.blueDot} /><Text style={s.mapStreetText}>{routeState === 'active' ? 'В пути' : origin.gps ? 'Моя геопозиция' : 'Алматы'}</Text></View>
        <IconButton icon={locationBusy ? 'clock' : 'crosshair'} label="Моё местоположение" onPress={locate} style={s.locateButton} />
        {Platform.OS !== 'web' && route && <Pressable accessibilityRole="link" accessibilityLabel="Данные маршрута OpenStreetMap и FOSSGIS" onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')} style={s.nativeAttribution}><Text style={s.nativeAttributionText}>Маршрут © OpenStreetMap · FOSSGIS</Text></Pressable>}
      </View>
      <ScrollView style={[s.tripPanel, desktop && s.desktopTripPanel, !desktop && collapsed && { maxHeight: 65 }]} contentContainerStyle={[s.tripPanelContent, desktop && s.desktopPanelContent]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!desktop && <Pressable accessibilityRole="button" accessibilityLabel={collapsed ? 'Развернуть маршрут' : 'Свернуть маршрут'} onPress={() => setCollapsed(value => !value)} style={s.sheetToggle}><View style={s.sheetHandle} />{collapsed && <Text style={s.collapsedTitle}>{target?.name || 'Куда идём?'}</Text>}</Pressable>}
        {(desktop || !collapsed) && <>{routeState !== 'planned' ? renderTrip() : renderPlanner()}
        {desktop && routeState === 'planned' && <View style={s.desktopTripExtra}><Text style={s.groupLabel}>НЕДАВНИЕ МЕСТА</Text>{recent.length ? recent.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Открыть ${point.name}`} onPress={() => selectTarget(point)} style={s.historyRow}><Icon name="clock" size={17} color={colors.muted} /><Text style={[s.rowTitle, s.flex]} numberOfLines={2}>{point.name}</Text><Icon name="arrow-up-left" size={16} color={colors.muted} /></Pressable>) : <Text style={s.rowSubtitle}>Пока нет выбранных мест</Text>}</View>}</>}
      </ScrollView>
    </View>
  );

  const renderContacts = () => (
    <View style={s.listPage}>
      <View style={s.listHeading}><Text style={s.pageTitle}>Близкие</Text><IconButton icon="user-plus" label="Добавить близкого" onPress={() => setDialog('contact')} /></View>
      <Text style={s.pageDescription}>Контакты для сопровождения и SOS</Text>
      <View style={s.peopleList}>
        {['dana', 'mom'].map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Контакт ${people[id].name}`} onPress={() => { setInspectedContact(id); setDialog('person'); }} style={s.personRow}>
          <Avatar person={id} /><View style={s.flex}><Text style={s.personName}>{people[id].name}</Text><Text style={s.rowSubtitle}>{people[id].relation}</Text></View>
          {contact === id && <Text style={s.primaryContactLabel}>Основной</Text>}<Icon name="chevron-right" size={18} color="#b5b5ba" />
        </Pressable>)}
      </View>
      <Text style={s.listFootnote}>Основной контакт получает сообщение первым.{ '\n' }Остальные — если ответа нет ещё 5 минут.</Text>
      <Text style={[s.groupLabel, { marginTop: 35 }]}>ДОСТУП К ГЕОПОЗИЦИИ</Text>
      <View style={s.simpleRow}><Icon name="map-pin" size={18} color={colors.muted} /><Text style={[s.rowTitle, s.flex]}>Только во время маршрута</Text><Icon name="check" size={18} /></View>
    </View>
  );

  const setting = (title, description, value, onValueChange) => (
    <View style={s.settingRow}><View style={s.flex}><Text style={s.rowTitle}>{title}</Text>{description && <Text style={s.rowSubtitle}>{description}</Text>}</View><Switch accessibilityLabel={title} value={value} onValueChange={onValueChange} trackColor={{ false: '#d7d8dc', true: colors.blue }} thumbColor="#fff" activeThumbColor="#fff" /></View>
  );

  const renderSettings = () => (
    <View style={s.listPage}>
      <Text style={s.pageTitle}>Профиль</Text>
      <View style={s.profileRow}><Avatar person="renata" large initial={Array.from(user.name)[0]?.toUpperCase()} /><View style={s.flex}><Text style={s.profileName}>{user.name}</Text><Text style={s.rowSubtitle}>{user.email}</Text></View></View>
      <Text style={s.groupLabel}>ГЕОПОЗИЦИЯ И УВЕДОМЛЕНИЯ</Text>
      {setting('Делиться геопозицией', 'С выбранным контактом на время пути', sharing, setSharing)}
      {setting('Напоминать о прибытии', null, reminder, setReminder)}
      <Text style={[s.groupLabel, { marginTop: 32 }]}>ЕСЛИ ПРИБЫТИЕ НЕ ПОДТВЕРЖДЕНО</Text>
      <View style={s.scenarioRow}><Text style={s.scenarioTime}>Сразу</Text><View style={s.flex}><Text style={s.rowTitle}>Напоминание мне</Text><Text style={s.rowSubtitle}>В запланированное время прибытия</Text></View></View>
      <View style={s.scenarioRow}><Text style={s.scenarioTime}>5 мин</Text><View style={s.flex}><Text style={s.rowTitle}>Сообщение близкому</Text><Text style={s.rowSubtitle}>Основной контакт: {selectedPerson.name}</Text></View></View>
      <View style={s.scenarioRow}><Text style={s.scenarioTime}>10 мин</Text><View style={s.flex}><Text style={s.rowTitle}>Резервный контакт</Text><Text style={s.rowSubtitle}>{contact === 'dana' ? 'Мама' : 'Дана'}</Text></View></View>
      {setting('Сценарий связи', null, scenario, setScenario)}
      <Pressable accessibilityRole="button" accessibilityLabel="Выйти из аккаунта" onPress={() => setDialog('logout')} style={s.logoutButton}><Icon name="log-out" size={18} color={colors.red} /><Text style={s.logoutLabel}>Выйти из аккаунта</Text></Pressable>
      <Text style={s.version}>SafeWalk 1.0</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        {desktop && <View style={s.sidebar}>
          <Text style={s.sidebarBrand}>SafeWalk</Text>
          <View style={s.sideNav}>{tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label}
            accessibilityState={{ selected: page === tab.id }} onPress={() => go(tab.id)} style={[s.sideNavButton, page === tab.id && s.sideNavSelected]}>
            <Icon name={tab.icon} size={20} color={page === tab.id ? colors.ink : colors.muted} /><Text style={[s.sideNavText, page === tab.id && s.medium]}>{tab.label}</Text>
          </Pressable>)}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть профиль" onPress={() => go('settings')} style={s.sidebarProfile}><Avatar person="renata" small initial={Array.from(user.name)[0]?.toUpperCase()} /><Text style={s.profileShortcut} numberOfLines={1}>{user.name}</Text><Icon name="chevron-right" size={16} color={colors.muted} /></Pressable>
        </View>}
        <View style={s.main}>
          <View style={s.header}>
            {desktop ? <View style={s.desktopHeaderLabel}><Icon name="map-pin" size={16} color={colors.muted} /><Text style={s.headerLocation}>{origin.gps ? 'Моя геопозиция' : 'Алматы'}</Text></View> : <Text style={s.headerBrand}>SafeWalk</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Открыть SOS" onPress={() => setDialog('sos')} style={({ pressed }) => [s.sosHeaderButton, pressed && s.pressed]}><Icon name="alert-circle" size={16} color={colors.red} /><Text style={s.sosHeaderText}>SOS</Text></Pressable>
          </View>
          {page === 'home' || page === 'route' ? renderMapPage() : <ScrollView ref={scroll} style={s.flex} contentContainerStyle={s.listScrollContent} showsVerticalScrollIndicator={false}>{page === 'contacts' ? renderContacts() : renderSettings()}</ScrollView>}
        </View>
      </View>
      {!desktop && <View style={[s.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: page === tab.id }} onPress={() => go(tab.id)} style={s.bottomNavButton}>
          <Icon name={tab.icon} size={21} color={page === tab.id ? colors.ink : '#95969b'} /><Text style={[s.bottomNavText, page === tab.id && s.bottomNavActive]}>{tab.label}</Text>
        </Pressable>)}
      </View>}
      {!!toast && <View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.toast, { bottom: desktop ? 24 : 80 + insets.bottom }]}><Text style={s.toastText}>{toast}</Text></View>}
      <ModalSheet visible={dialog === 'search'} title="Найденные места" onClose={() => { searchVersion.current++; setSearchBusy(false); setDialog(null); }}>
        {searchBusy ? <ActivityIndicator color={colors.blue} style={{ marginVertical: 24 }} /> : <ScrollView style={{ maxHeight: 310 }} keyboardShouldPersistTaps="handled">
          {!!mapError && <Text accessibilityRole="alert" style={s.mapError}>{mapError}</Text>}
          {searchResults?.length === 0 && <Text style={s.modalDescription}>Ничего не найдено. Уточните адрес и город.</Text>}
          {searchResults?.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Выбрать ${point.name}`} onPress={() => selectTarget(point)} style={s.searchResult}><Icon name="map-pin" size={18} color={colors.blue} /><Text style={[s.rowTitle, s.flex]}>{point.name}</Text><Icon name="chevron-right" size={16} /></Pressable>)}
        </ScrollView>}
        <Text style={s.modalFootnote}>Поиск: OpenStreetMap. Введённый адрес передаётся сервису Nominatim.</Text>
      </ModalSheet>
      <ModalSheet visible={dialog === 'routeConsent'} title="Построить маршрут?" onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>Координаты точек А и Б будут переданы сервису маршрутов FOSSGIS. Близким ваша геопозиция не отправляется.</Text>
        <View style={{ marginTop: 22 }}><ActionButton title="Разрешить и построить" icon="navigation" onPress={buildRoute} /></View>
        <ActionButton title="Отмена" secondary onPress={() => setDialog(null)} />
      </ModalSheet>
      <ModalSheet visible={dialog === 'logout'} title="Выйти из аккаунта?" onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>{routeState === 'active' ? 'Текущее сопровождение будет завершено.' : 'Вы сможете войти снова в любое время.'}</Text>
        <View style={{ marginTop: 22 }}><ActionButton title="Выйти" busy={logoutBusy} onPress={async () => {
          setLogoutBusy(true);
          try { await onSignOut(); }
          catch (error) { setDialog(null); notify(error.message); }
          finally { setLogoutBusy(false); }
        }} /></View>
        <ActionButton title="Отмена" secondary onPress={() => setDialog(null)} />
      </ModalSheet>
      <ModalSheet visible={dialog === 'sos'} title="Отправить SOS?" onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>Попросите Дану и маму связаться с вами.</Text>
        <View style={s.sosRecipients}><Avatar person="dana" small /><Avatar person="mom" small /><Text style={s.rowSubtitle}>2 контакта</Text></View>
        <ActionButton title="Отправить SOS" danger onPress={() => { setDialog(null); notify('Не удалось отправить сообщения. Свяжитесь с близкими напрямую.'); }} />
        <ActionButton title="Отмена" secondary onPress={() => setDialog(null)} />
      </ModalSheet>
      <ModalSheet visible={dialog === 'contact'} title="Кто будет на связи" onClose={() => setDialog(null)}>
        {['dana', 'mom'].map(id => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={people[id].name} accessibilityState={{ checked: contact === id }}
          onPress={() => { setContact(id); setDialog(null); }} style={s.personRow}><Avatar person={id} /><View style={s.flex}><Text style={s.personName}>{people[id].name}</Text><Text style={s.rowSubtitle}>{people[id].relation}</Text></View><View style={[s.radio, contact === id && s.radioSelected]}>{contact === id && <View style={s.radioDot} />}</View></Pressable>)}
      </ModalSheet>
      <ModalSheet visible={dialog === 'person'} title={people[inspectedContact].name} onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>{people[inspectedContact].relation} · {inspectedContact === contact ? 'основной' : 'резервный'} контакт сопровождения</Text>
        <View style={{ marginTop: 20 }}><ActionButton title={inspectedContact === contact ? 'Выбрать другой контакт' : 'Сделать основным'} secondary onPress={() => {
          if (inspectedContact === contact) setDialog('contact');
          else { setContact(inspectedContact); setDialog(null); }
        }} /></View>
      </ModalSheet>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [loaded, error] = useFonts(Feather.font);
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    let mounted = true;
    restoreSession().then(account => { if (mounted) setUser(account); })
      .catch(failure => { if (mounted) setAuthError(failure.message); })
      .finally(() => { if (mounted) setRestoring(false); });
    return () => { mounted = false; };
  }, []);
  if ((!loaded && !error) || restoring) return <View style={s.loading}><Text style={s.headerBrand}>SafeWalk</Text><ActivityIndicator style={{ marginTop: 20 }} color={colors.muted} /></View>;
  return <SafeAreaProvider>{user
    ? <SafeWalk user={user} onSignOut={async () => { await signOut(); setUser(null); }} />
    : <AuthScreen initialError={authError} onAuthenticated={account => { setAuthError(''); setUser(account); }} />}</SafeAreaProvider>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  flex: { flex: 1, minWidth: 0 },
  medium: { fontWeight: '600', color: colors.ink },
  pressed: { opacity: 0.7 },
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  sidebar: { width: 210, backgroundColor: '#fafafa', borderRightWidth: 1, borderColor: colors.line, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 22 },
  sidebarBrand: { fontSize: 24, fontWeight: '700', color: colors.ink, paddingLeft: 12 },
  sideNav: { marginTop: 36, gap: 5 },
  sideNavButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, borderRadius: 6 },
  sideNavSelected: { backgroundColor: '#eaf0fc' },
  sideNavText: { fontSize: 14, color: colors.muted },
  sidebarProfile: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 'auto', borderTopWidth: 1, borderColor: colors.line, paddingTop: 20, paddingHorizontal: 8 },
  profileShortcut: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.ink },
  header: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.line },
  headerBrand: { fontSize: 22, fontWeight: '700', color: colors.ink },
  desktopHeaderLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerLocation: { fontSize: 14, color: colors.ink },
  sosHeaderButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 6, borderWidth: 1, borderColor: '#efc8c8', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  sosHeaderText: { fontSize: 12, fontWeight: '700', color: colors.red },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  tooltip: { position: 'absolute', bottom: '100%', right: 0, width: 160, padding: 8, backgroundColor: colors.ink, borderRadius: 4, zIndex: 10 },
  tooltipText: { color: colors.white, fontSize: 11, textAlign: 'center' },
  workspace: { flex: 1, minHeight: 0 },
  desktopWorkspace: { flexDirection: 'row' },
  mapCanvas: { flex: 1, minHeight: 150, overflow: 'hidden', backgroundColor: '#e7ece8' },
  mapTiles: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap' },
  mapStreet: { position: 'absolute', zIndex: 1001, left: 14, top: 14, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#dfe1e5' },
  mapStreetText: { fontSize: 12, fontWeight: '500', color: colors.ink },
  homeMarker: { position: 'absolute', left: '63%', top: '24%', alignItems: 'center', gap: 4 },
  homeMarkerIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  markerLabel: { fontSize: 11, fontWeight: '600', color: colors.ink },
  locationMarker: { position: 'absolute', left: '47%', top: '54%', alignItems: 'center' },
  locationHalo: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#3169e822', alignItems: 'center', justifyContent: 'center' },
  locationDot: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.blue, borderWidth: 3, borderColor: '#fff' },
  selfLabel: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.white },
  locateButton: { position: 'absolute', zIndex: 1001, right: 11, bottom: 26, width: 38, height: 38, backgroundColor: colors.white, borderRadius: 6, borderWidth: 1, borderColor: '#dadce0' },
  mapAttribution: { position: 'absolute', right: 0, bottom: 0, fontSize: 8, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: '#ffffffdb', color: '#62666a' },
  nativeAttribution: { position: 'absolute', left: 6, bottom: 6, backgroundColor: '#ffffffee', padding: 4, borderRadius: 3 },
  nativeAttributionText: { fontSize: 8, color: '#62666a' },
  mapRouteStatus: { position: 'absolute', top: 15, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9, backgroundColor: colors.white, borderRadius: 6 },
  mapRouteText: { color: colors.ink, fontSize: 11, fontWeight: '500' },
  blueDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.blue },
  tripPanel: { flexGrow: 0, flexShrink: 1, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line },
  desktopTripPanel: { width: 360, borderTopWidth: 0, borderLeftWidth: 1, flexShrink: 0 },
  tripPanelContent: { paddingHorizontal: 20, paddingBottom: 10 },
  desktopPanelContent: { paddingTop: 25, paddingHorizontal: 24 },
  sheetHandle: { width: 30, height: 4, borderRadius: 2, backgroundColor: '#c6c8ce', alignSelf: 'center' },
  sheetToggle: { minHeight: 24, justifyContent: 'center' },
  collapsedTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, paddingVertical: 10 },
  panelTitle: { fontSize: 20, fontWeight: '600', color: colors.ink, marginBottom: 14, lineHeight: 27 },
  destinationField: { flexDirection: 'row', alignItems: 'center', gap: 11, height: 46, backgroundColor: '#f2f2f4', paddingLeft: 13, paddingRight: 4, borderRadius: 6 },
  destinationInput: { flex: 1, minWidth: 0, fontSize: 14, color: colors.ink, paddingVertical: 8 },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, marginBottom: 9, minHeight: 25 },
  originDot: { width: 9, height: 9, backgroundColor: colors.blue, borderRadius: 5 },
  originText: { flex: 1, fontSize: 12, color: colors.muted },
  routeSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  routeSummaryText: { fontSize: 19, fontWeight: '600', color: colors.ink },
  routeEstimate: { marginLeft: 'auto', fontSize: 12, color: colors.muted },
  mapError: { color: colors.red, fontSize: 12, lineHeight: 18, marginTop: 12 },
  searchResult: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
  clearAddress: { width: 32, height: 32 },
  savedPlaces: { flexDirection: 'row', gap: 22, paddingVertical: 13 },
  savedPlace: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 25 },
  savedPlaceLabel: { fontSize: 12, color: colors.ink },
  modeControl: { flexDirection: 'row', borderRadius: 6, backgroundColor: '#f2f2f4', padding: 3, gap: 3, marginTop: 12 },
  modeOption: { flex: 1, minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 5, borderRadius: 4 },
  modeSelected: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#e7e7e9' },
  modeLabel: { fontSize: 11, color: colors.ink, fontWeight: '500', flexShrink: 1 },
  modeTime: { fontSize: 10, color: colors.muted },
  contactSelector: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, minHeight: 53 },
  contactSelectorLabel: { flex: 1, color: colors.muted, fontSize: 12 },
  actionButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.blue, borderRadius: 6 },
  actionText: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  secondaryButton: { backgroundColor: '#f1f1f3', marginTop: 8 },
  dangerButton: { backgroundColor: colors.red },
  sharingStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 9 },
  sharingStatusText: { fontSize: 10, color: colors.muted },
  desktopTripExtra: { borderTopWidth: 1, borderColor: colors.line, marginTop: 28, paddingTop: 22 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 15 },
  tripState: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  stateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue },
  tripStateText: { fontSize: 11, color: colors.muted },
  tripNumbers: { flexDirection: 'row', alignItems: 'center', gap: 23, marginBottom: 10 },
  tripNumber: { fontSize: 29, fontWeight: '600', color: colors.ink },
  minutesUnit: { fontSize: 16, fontWeight: '400', color: colors.muted },
  tripNumberLabel: { fontSize: 11, color: colors.muted, marginTop: 5 },
  numberDivider: { width: 1, height: 39, backgroundColor: colors.line },
  delayLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 12, paddingBottom: 3 },
  delayLinkText: { fontSize: 10, color: colors.muted, flexShrink: 1 },
  bottomNav: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingTop: 6 },
  bottomNavButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 5 },
  bottomNavText: { fontSize: 10, color: '#95969b' },
  bottomNavActive: { color: colors.ink, fontWeight: '600' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  smallAvatar: { width: 28, height: 28, borderRadius: 14 },
  largeAvatar: { width: 68, height: 68, borderRadius: 34 },
  avatarLetter: { fontSize: 16, fontWeight: '600' },
  listScrollContent: { paddingVertical: 25, paddingHorizontal: 22, flexGrow: 1 },
  listPage: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 27, fontWeight: '600', color: colors.ink },
  pageDescription: { fontSize: 13, color: colors.muted, marginTop: 9, marginBottom: 25, lineHeight: 20 },
  peopleList: { borderTopWidth: 1, borderColor: colors.line },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, borderBottomWidth: 1, borderColor: colors.line },
  personName: { fontSize: 15, fontWeight: '500', color: colors.ink },
  rowTitle: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  primaryContactLabel: { fontSize: 11, color: colors.muted },
  listFootnote: { fontSize: 12, lineHeight: 20, color: colors.muted, marginTop: 17 },
  groupLabel: { fontSize: 10, fontWeight: '500', color: colors.muted, lineHeight: 16 },
  simpleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20, borderBottomWidth: 1, borderColor: colors.line },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 17, paddingTop: 25, paddingBottom: 32 },
  profileName: { fontSize: 22, fontWeight: '500', color: colors.ink },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 65, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
  scenarioRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 17, borderBottomWidth: 1, borderColor: colors.line },
  scenarioTime: { width: 46, color: colors.muted, fontSize: 12 },
  version: { fontSize: 11, color: '#aaaab0', paddingTop: 30, paddingBottom: 15 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, marginTop: 23 },
  logoutLabel: { fontSize: 14, color: colors.red },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', borderRadius: 6, backgroundColor: colors.ink, paddingVertical: 12, paddingHorizontal: 17 },
  toastText: { fontSize: 12, color: colors.white, lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalSheet: { width: '100%', maxWidth: 380, borderRadius: 8, backgroundColor: colors.white, padding: 23 },
  modalHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 16 },
  modalTitle: { fontSize: 21, color: colors.ink, fontWeight: '600', flex: 1 },
  modalDescription: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  sosRecipients: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 20 },
  modalFootnote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingTop: 17 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: '#b7b8be', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.blue },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.blue },
});
