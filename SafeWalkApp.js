import { useWindowDimensions, Pressable, Text, View, TextInput, Platform, Linking, ScrollView, Switch, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useState, useRef, useEffect } from 'react';
import { people } from './src/data/contacts';
import { request } from './src/services/api';
import * as Location from 'expo-location';
import s from './src/styles/appStyles';
import Avatar from './src/components/ui/Avatar';
import Icon from './src/components/ui/Icon';
import { colors } from './src/styles/theme';
import IconButton from './src/components/ui/IconButton';
import ActionButton from './src/components/ui/ActionButton';
import MapCanvas from './src/components/maps/MapCanvas';
import { StatusBar } from 'expo-status-bar';
import { tabs } from './src/navigation/tabs';
import ModalSheet from './src/components/ui/ModalSheet';
import { useFonts } from 'expo-font';
import { Feather } from '@expo/vector-icons';
import { restoreSession, signOut } from './src/services/auth';
import AuthScreen from './src/screens/AuthScreen';
function SafeWalk({
  user,
  onSignOut
}) {
  const {
    width
  } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 960;
  const [page, setPage] = useState('home');
  const [destination, setDestination] = useState('');
  const [origin, setOrigin] = useState({
    latitude: 43.2405,
    longitude: 76.936,
    name: 'Алматы, точка А',
    gps: false
  });
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
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      routeVersion.current++;
    };
  }, []);
  const duration = route ? Math.max(1, Math.ceil(route.duration / 60)) : 0;
  const distance = route ? `${(route.distance / 1000).toLocaleString('ru-RU', {
    maximumFractionDigits: 1
  })} км` : '';
  const selectedPerson = people[contact];
  const notify = message => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };
  const go = next => {
    setPage(next);
    setCollapsed(false);
    scroll.current?.scrollTo({
      y: 0,
      animated: false
    });
  };
  const arrivalLabel = arrival ? new Date(arrival + extraMinutes * 60000).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }) : `${duration} мин`;
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
      const result = await request('maps/search', {
        method: 'POST',
        body: {
          query: destination
        }
      });
      if (mounted.current && version === searchVersion.current) setSearchResults(result.places);
    } catch (error) {
      if (mounted.current && version === searchVersion.current) setMapError(error.message);
    } finally {
      if (mounted.current && version === searchVersion.current) setSearchBusy(false);
    }
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
      const position = await Promise.race([Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Не удалось определить геопозицию. Попробуйте ещё раз.')), 12000);
      })]);
      if (!mounted.current || version !== routeVersion.current) return;
      resetRoute();
      setOrigin({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: 'Моё местоположение',
        gps: true
      });
      setFocusRequest(value => value + 1);
    } catch (error) {
      if (mounted.current) notify(error.message);
    } finally {
      clearTimeout(timer);
      if (mounted.current) setLocationBusy(false);
    }
  };
  const buildRoute = async () => {
    setDialog(null);
    setMapError('');
    setMapBusy(true);
    const version = ++routeVersion.current;
    try {
      const result = await request('maps/route', {
        method: 'POST',
        body: {
          origin,
          target,
          mode: transport
        }
      });
      if (mounted.current && version === routeVersion.current) setRoute(result);
    } catch (error) {
      if (mounted.current && version === routeVersion.current) setMapError(error.message);
    } finally {
      if (mounted.current && version === routeVersion.current) setMapBusy(false);
    }
  };
  const start = () => {
    if (!target) return searchPlaces();
    if (!route) return setDialog('routeConsent');
    setArrival(Date.now() + duration * 60000);
    setExtraMinutes(0);
    setRouteState('active');
    go('route');
  };
  const contactSelector = () => <Pressable accessibilityRole="button" accessibilityLabel="Выбрать контакт сопровождения" onPress={() => setDialog('contact')} style={s.contactSelector}>
      <Avatar person={contact} small />
      <Text style={s.contactSelectorLabel}>На связи: <Text style={s.medium}>{selectedPerson.name}</Text></Text>
      <Icon name="chevron-right" size={17} color={colors.muted} />
    </Pressable>;
  const renderPlanner = () => <>
      <Text style={s.panelTitle}>Куда идём?</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Изменить точку отправления" onPress={locate} style={s.originRow}>
        <View style={s.originDot} /><Text style={s.originText}>{origin.name}</Text><Icon name="crosshair" size={15} color={colors.blue} />
      </Pressable>
      <View style={s.destinationField}>
        <Icon name="map-pin" size={18} />
        <TextInput ref={destinationInput} accessibilityLabel="Место назначения" style={s.destinationInput} value={destination} onChangeText={value => {
        setDestination(value);
        setTarget(null);
        resetRoute();
      }} placeholder="Адрес или место" placeholderTextColor={colors.muted} returnKeyType="search" onSubmitEditing={searchPlaces} />
        {!!destination && <IconButton icon="x" label="Очистить адрес" onPress={() => {
        setDestination('');
        setTarget(null);
        resetRoute();
        destinationInput.current?.focus();
      }} style={s.clearAddress} />}
        <IconButton icon="search" label="Найти адрес" onPress={searchPlaces} style={s.clearAddress} />
      </View>
      <View style={s.modeControl}>
        {[['walk', 'Пешком', 'user'], ['car', 'На машине', 'truck']].map(([id, label, icon]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{
        selected: transport === id
      }} onPress={() => {
        if (id !== transport) {
          setTransport(id);
          resetRoute();
        }
      }} style={[s.modeOption, transport === id && s.modeSelected]}>
            <Icon name={icon} size={16} color={transport === id ? colors.ink : colors.muted} />
            <Text style={[s.modeLabel, transport !== id && {
          color: colors.muted
        }]}>{label}</Text>
          </Pressable>)}
      </View>
      {route && <View style={s.routeSummary}><Icon name="navigation" size={16} color={colors.blue} /><Text style={s.routeSummaryText}>{duration} мин</Text><Text style={s.rowSubtitle}>{distance}</Text><Text style={s.routeEstimate}>≈ {new Date(Date.now() + duration * 60000).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })}</Text></View>}
      {!!mapError && dialog !== 'search' && <Text accessibilityRole="alert" style={s.mapError}>{mapError}</Text>}
      {contactSelector()}
      <ActionButton title={route ? 'Начать сопровождение' : target ? 'Построить маршрут' : 'Найти место'} onPress={start} busy={mapBusy} icon={route ? 'arrow-right' : 'navigation'} />
      <View style={s.sharingStatus}><Icon name={sharing ? 'map-pin' : 'lock'} size={12} color={colors.muted} /><Text style={s.sharingStatusText}>{sharing ? 'Настройка передачи геопозиции включена' : 'Геопозиция не передаётся'}</Text></View>
    </>;
  const renderTrip = () => <>
      <View style={s.tripState}><View style={[s.stateDot, routeState === 'arrived' && {
        backgroundColor: '#32835d'
      }]} /><Text style={s.tripStateText}>{routeState === 'arrived' ? 'Вы в безопасности' : 'Сопровождение активно'}</Text></View>
      <Text style={s.panelTitle} numberOfLines={2}>{destination.trim() || 'Место назначения'}</Text>
      <View style={s.tripNumbers}><View><Text style={s.tripNumber}>{arrivalLabel}</Text><Text style={s.tripNumberLabel}>Прибытие</Text></View><View style={s.numberDivider} /><View><Text style={s.tripNumber}>{duration + extraMinutes}<Text style={s.minutesUnit}> мин</Text></Text><Text style={s.tripNumberLabel}>{transport === 'walk' ? 'Пешком' : 'На машине'} · {distance}</Text></View></View>
      {contactSelector()}
      <ActionButton title={routeState === 'arrived' ? 'Готово' : 'Я на месте'} icon={routeState === 'arrived' ? undefined : 'check'} onPress={() => {
      if (routeState === 'arrived') {
        setRouteState('planned');
        go('home');
      } else setRouteState('arrived');
    }} />
      {routeState !== 'arrived' && <ActionButton title="Добавить 5 минут" icon="clock" secondary onPress={() => {
      if (extraMinutes >= 30) return notify('Добавлено максимум 30 минут');
      setExtraMinutes(value => value + 5);
    }} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Сценарий при задержке" onPress={() => go('settings')} style={s.delayLink}><Text style={s.delayLinkText}>Нет ответа 5 минут → сообщение близкому</Text><Icon name="chevron-right" size={14} color={colors.muted} /></Pressable>
    </>;
  const renderMapPage = () => <View style={[s.workspace, desktop && s.desktopWorkspace]}>
      <View style={s.mapCanvas}>
        <MapCanvas origin={origin} target={target} route={route} focusRequest={focusRequest} onSelect={selectTarget} editable={routeState === 'planned'} />
        <View pointerEvents="none" style={s.mapStreet}><View style={s.blueDot} /><Text style={s.mapStreetText}>{routeState === 'active' ? 'В пути' : origin.gps ? 'Моя геопозиция' : 'Алматы'}</Text></View>
        <IconButton icon={locationBusy ? 'clock' : 'crosshair'} label="Моё местоположение" onPress={locate} style={s.locateButton} />
        {Platform.OS !== 'web' && route && <Pressable accessibilityRole="link" accessibilityLabel="Данные маршрута OpenStreetMap и FOSSGIS" onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')} style={s.nativeAttribution}><Text style={s.nativeAttributionText}>Маршрут © OpenStreetMap · FOSSGIS</Text></Pressable>}
      </View>
      <ScrollView style={[s.tripPanel, desktop && s.desktopTripPanel, !desktop && collapsed && {
      maxHeight: 65
    }]} contentContainerStyle={[s.tripPanelContent, desktop && s.desktopPanelContent]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!desktop && <Pressable accessibilityRole="button" accessibilityLabel={collapsed ? 'Развернуть маршрут' : 'Свернуть маршрут'} onPress={() => setCollapsed(value => !value)} style={s.sheetToggle}><View style={s.sheetHandle} />{collapsed && <Text style={s.collapsedTitle}>{target?.name || 'Куда идём?'}</Text>}</Pressable>}
        {(desktop || !collapsed) && <>{routeState !== 'planned' ? renderTrip() : renderPlanner()}
        {desktop && routeState === 'planned' && <View style={s.desktopTripExtra}><Text style={s.groupLabel}>НЕДАВНИЕ МЕСТА</Text>{recent.length ? recent.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Открыть ${point.name}`} onPress={() => selectTarget(point)} style={s.historyRow}><Icon name="clock" size={17} color={colors.muted} /><Text style={[s.rowTitle, s.flex]} numberOfLines={2}>{point.name}</Text><Icon name="arrow-up-left" size={16} color={colors.muted} /></Pressable>) : <Text style={s.rowSubtitle}>Пока нет выбранных мест</Text>}</View>}</>}
      </ScrollView>
    </View>;
  const renderContacts = () => <View style={s.listPage}>
      <View style={s.listHeading}><Text style={s.pageTitle}>Близкие</Text><IconButton icon="user-plus" label="Добавить близкого" onPress={() => setDialog('contact')} /></View>
      <Text style={s.pageDescription}>Контакты для сопровождения и SOS</Text>
      <View style={s.peopleList}>
        {['dana', 'mom'].map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Контакт ${people[id].name}`} onPress={() => {
        setInspectedContact(id);
        setDialog('person');
      }} style={s.personRow}>
          <Avatar person={id} /><View style={s.flex}><Text style={s.personName}>{people[id].name}</Text><Text style={s.rowSubtitle}>{people[id].relation}</Text></View>
          {contact === id && <Text style={s.primaryContactLabel}>Основной</Text>}<Icon name="chevron-right" size={18} color="#b5b5ba" />
        </Pressable>)}
      </View>
      <Text style={s.listFootnote}>Основной контакт получает сообщение первым.{'\n'}Остальные — если ответа нет ещё 5 минут.</Text>
      <Text style={[s.groupLabel, {
      marginTop: 35
    }]}>ДОСТУП К ГЕОПОЗИЦИИ</Text>
      <View style={s.simpleRow}><Icon name="map-pin" size={18} color={colors.muted} /><Text style={[s.rowTitle, s.flex]}>Только во время маршрута</Text><Icon name="check" size={18} /></View>
    </View>;
  const setting = (title, description, value, onValueChange) => <View style={s.settingRow}><View style={s.flex}><Text style={s.rowTitle}>{title}</Text>{description && <Text style={s.rowSubtitle}>{description}</Text>}</View><Switch accessibilityLabel={title} value={value} onValueChange={onValueChange} trackColor={{
      false: '#d7d8dc',
      true: colors.blue
    }} thumbColor="#fff" activeThumbColor="#fff" /></View>;
  const renderSettings = () => <View style={s.listPage}>
      <Text style={s.pageTitle}>Профиль</Text>
      <View style={s.profileRow}><Avatar person="renata" large initial={Array.from(user.name)[0]?.toUpperCase()} /><View style={s.flex}><Text style={s.profileName}>{user.name}</Text><Text style={s.rowSubtitle}>{user.email}</Text></View></View>
      <Text style={s.groupLabel}>ГЕОПОЗИЦИЯ И УВЕДОМЛЕНИЯ</Text>
      {setting('Делиться геопозицией', 'С выбранным контактом на время пути', sharing, setSharing)}
      {setting('Напоминать о прибытии', null, reminder, setReminder)}
      <Text style={[s.groupLabel, {
      marginTop: 32
    }]}>ЕСЛИ ПРИБЫТИЕ НЕ ПОДТВЕРЖДЕНО</Text>
      <View style={s.scenarioRow}><Text style={s.scenarioTime}>Сразу</Text><View style={s.flex}><Text style={s.rowTitle}>Напоминание мне</Text><Text style={s.rowSubtitle}>В запланированное время прибытия</Text></View></View>
      <View style={s.scenarioRow}><Text style={s.scenarioTime}>5 мин</Text><View style={s.flex}><Text style={s.rowTitle}>Сообщение близкому</Text><Text style={s.rowSubtitle}>Основной контакт: {selectedPerson.name}</Text></View></View>
      <View style={s.scenarioRow}><Text style={s.scenarioTime}>10 мин</Text><View style={s.flex}><Text style={s.rowTitle}>Резервный контакт</Text><Text style={s.rowSubtitle}>{contact === 'dana' ? 'Мама' : 'Дана'}</Text></View></View>
      {setting('Сценарий связи', null, scenario, setScenario)}
      <Pressable accessibilityRole="button" accessibilityLabel="Выйти из аккаунта" onPress={() => setDialog('logout')} style={s.logoutButton}><Icon name="log-out" size={18} color={colors.red} /><Text style={s.logoutLabel}>Выйти из аккаунта</Text></Pressable>
      <Text style={s.version}>SafeWalk 1.0</Text>
    </View>;
  return <KeyboardAvoidingView style={[s.root, {
    paddingTop: insets.top
  }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        {desktop && <View style={s.sidebar}>
          <Text style={s.sidebarBrand}>SafeWalk</Text>
          <View style={s.sideNav}>{tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{
            selected: page === tab.id
          }} onPress={() => go(tab.id)} style={[s.sideNavButton, page === tab.id && s.sideNavSelected]}>
            <Icon name={tab.icon} size={20} color={page === tab.id ? colors.ink : colors.muted} /><Text style={[s.sideNavText, page === tab.id && s.medium]}>{tab.label}</Text>
          </Pressable>)}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Открыть профиль" onPress={() => go('settings')} style={s.sidebarProfile}><Avatar person="renata" small initial={Array.from(user.name)[0]?.toUpperCase()} /><Text style={s.profileShortcut} numberOfLines={1}>{user.name}</Text><Icon name="chevron-right" size={16} color={colors.muted} /></Pressable>
        </View>}
        <View style={s.main}>
          <View style={s.header}>
            {desktop ? <View style={s.desktopHeaderLabel}><Icon name="map-pin" size={16} color={colors.muted} /><Text style={s.headerLocation}>{origin.gps ? 'Моя геопозиция' : 'Алматы'}</Text></View> : <Text style={s.headerBrand}>SafeWalk</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Открыть SOS" onPress={() => setDialog('sos')} style={({
            pressed
          }) => [s.sosHeaderButton, pressed && s.pressed]}><Icon name="alert-circle" size={16} color={colors.red} /><Text style={s.sosHeaderText}>SOS</Text></Pressable>
          </View>
          {page === 'home' || page === 'route' ? renderMapPage() : <ScrollView ref={scroll} style={s.flex} contentContainerStyle={s.listScrollContent} showsVerticalScrollIndicator={false}>{page === 'contacts' ? renderContacts() : renderSettings()}</ScrollView>}
        </View>
      </View>
      {!desktop && <View style={[s.bottomNav, {
      paddingBottom: Math.max(insets.bottom, 8)
    }]}>
        {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{
        selected: page === tab.id
      }} onPress={() => go(tab.id)} style={s.bottomNavButton}>
          <Icon name={tab.icon} size={21} color={page === tab.id ? colors.ink : '#95969b'} /><Text style={[s.bottomNavText, page === tab.id && s.bottomNavActive]}>{tab.label}</Text>
        </Pressable>)}
      </View>}
      {!!toast && <View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.toast, {
      bottom: desktop ? 24 : 80 + insets.bottom
    }]}><Text style={s.toastText}>{toast}</Text></View>}
      <ModalSheet visible={dialog === 'search'} title="Найденные места" onClose={() => {
      searchVersion.current++;
      setSearchBusy(false);
      setDialog(null);
    }}>
        {searchBusy ? <ActivityIndicator color={colors.blue} style={{
        marginVertical: 24
      }} /> : <ScrollView style={{
        maxHeight: 310
      }} keyboardShouldPersistTaps="handled">
          {!!mapError && <Text accessibilityRole="alert" style={s.mapError}>{mapError}</Text>}
          {searchResults?.length === 0 && <Text style={s.modalDescription}>Ничего не найдено. Уточните адрес и город.</Text>}
          {searchResults?.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Выбрать ${point.name}`} onPress={() => selectTarget(point)} style={s.searchResult}><Icon name="map-pin" size={18} color={colors.blue} /><Text style={[s.rowTitle, s.flex]}>{point.name}</Text><Icon name="chevron-right" size={16} /></Pressable>)}
        </ScrollView>}
        <Text style={s.modalFootnote}>Поиск: OpenStreetMap. Введённый адрес передаётся сервису Nominatim.</Text>
      </ModalSheet>
      <ModalSheet visible={dialog === 'routeConsent'} title="Построить маршрут?" onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>Координаты точек А и Б будут переданы сервису маршрутов FOSSGIS. Близким ваша геопозиция не отправляется.</Text>
        <View style={{
        marginTop: 22
      }}><ActionButton title="Разрешить и построить" icon="navigation" onPress={buildRoute} /></View>
        <ActionButton title="Отмена" secondary onPress={() => setDialog(null)} />
      </ModalSheet>
      <ModalSheet visible={dialog === 'logout'} title="Выйти из аккаунта?" onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>{routeState === 'active' ? 'Текущее сопровождение будет завершено.' : 'Вы сможете войти снова в любое время.'}</Text>
        <View style={{
        marginTop: 22
      }}><ActionButton title="Выйти" busy={logoutBusy} onPress={async () => {
          setLogoutBusy(true);
          try {
            await onSignOut();
          } catch (error) {
            setDialog(null);
            notify(error.message);
          } finally {
            setLogoutBusy(false);
          }
        }} /></View>
        <ActionButton title="Отмена" secondary onPress={() => setDialog(null)} />
      </ModalSheet>
      <ModalSheet visible={dialog === 'sos'} title="Отправить SOS?" onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>Попросите Дану и маму связаться с вами.</Text>
        <View style={s.sosRecipients}><Avatar person="dana" small /><Avatar person="mom" small /><Text style={s.rowSubtitle}>2 контакта</Text></View>
        <ActionButton title="Отправить SOS" danger onPress={() => {
        setDialog(null);
        notify('Не удалось отправить сообщения. Свяжитесь с близкими напрямую.');
      }} />
        <ActionButton title="Отмена" secondary onPress={() => setDialog(null)} />
      </ModalSheet>
      <ModalSheet visible={dialog === 'contact'} title="Кто будет на связи" onClose={() => setDialog(null)}>
        {['dana', 'mom'].map(id => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={people[id].name} accessibilityState={{
        checked: contact === id
      }} onPress={() => {
        setContact(id);
        setDialog(null);
      }} style={s.personRow}><Avatar person={id} /><View style={s.flex}><Text style={s.personName}>{people[id].name}</Text><Text style={s.rowSubtitle}>{people[id].relation}</Text></View><View style={[s.radio, contact === id && s.radioSelected]}>{contact === id && <View style={s.radioDot} />}</View></Pressable>)}
      </ModalSheet>
      <ModalSheet visible={dialog === 'person'} title={people[inspectedContact].name} onClose={() => setDialog(null)}>
        <Text style={s.modalDescription}>{people[inspectedContact].relation} · {inspectedContact === contact ? 'основной' : 'резервный'} контакт сопровождения</Text>
        <View style={{
        marginTop: 20
      }}><ActionButton title={inspectedContact === contact ? 'Выбрать другой контакт' : 'Сделать основным'} secondary onPress={() => {
          if (inspectedContact === contact) setDialog('contact');else {
            setContact(inspectedContact);
            setDialog(null);
          }
        }} /></View>
      </ModalSheet>
    </KeyboardAvoidingView>;
}
export default function App() {
  const [loaded, error] = useFonts(Feather.font);
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    let mounted = true;
    restoreSession().then(account => {
      if (mounted) setUser(account);
    }).catch(failure => {
      if (mounted) setAuthError(failure.message);
    }).finally(() => {
      if (mounted) setRestoring(false);
    });
    return () => {
      mounted = false;
    };
  }, []);
  if (!loaded && !error || restoring) return <View style={s.loading}><Text style={s.headerBrand}>SafeWalk</Text><ActivityIndicator style={{
      marginTop: 20
    }} color={colors.muted} /></View>;
  return <SafeAreaProvider>{user ? <SafeWalk user={user} onSignOut={async () => {
      await signOut();
      setUser(null);
    }} /> : <AuthScreen initialError={authError} onAuthenticated={account => {
      setAuthError('');
      setUser(account);
    }} />}</SafeAreaProvider>;
}
