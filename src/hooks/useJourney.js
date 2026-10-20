import { useSettings } from "../context/SettingsContext";
import { useState, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { searchAddresses, fetchRoute } from '../services/maps';
import { getCurrentLocation, watchLocation } from '../services/location';
import { actionKey, updatePosition } from '../services/journeys';
import useCircle from './useCircle';
import useJourneyAccount from './useJourneyAccount';
import useOutbox from './useOutbox';
import { syncBackground, syncReminder } from '../services/device';
import { readBattery } from '../services/readiness';
import { formatDuration } from '../services/duration.cjs';
const mapCenter = {
  latitude: 43.2405,
  longitude: 76.936,
  name: 'Укажите точку отправления',
  gps: false,
  chosen: false
};
const simplifyRoute = route => {
  if (route.coordinates.length <= 1000) return route;
  const stride = Math.ceil(route.coordinates.length / 998);
  return {
    ...route,
    coordinates: [...route.coordinates.filter((_, index) => index % stride === 0), route.coordinates.at(-1)]
  };
};
export default function useJourney(ownerId) {
  const {
    t,
    locale
  } = useSettings();
  const contacts = useCircle();
  const outbox = useOutbox(ownerId);
  const account = useJourneyAccount(ownerId, outbox);
  const [page, setPage] = useState('home');
  const [destination, setDestination] = useState('');
  const [searchCity, setSearchCity] = useState('Алматы');
  const [origin, setOrigin] = useState(mapCenter);
  const [target, setTarget] = useState(null);
  const [route, setRoute] = useState(null);
  const [transport, setTransport] = useState('walk');
  const [mapBusy, setMapBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [mapError, setMapError] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [minutes, setMinutes] = useState(1);
  const [accompanied, setAccompanied] = useState(false);
  const [finished, setFinished] = useState(null);
  const [position, setPosition] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingStatus, setTrackingStatus] = useState('idle');
  const [lastPositionSentAt, setLastPositionSentAt] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState('');
  const [battery, setBattery] = useState(null);
  const batteryPrompted = useRef(null);
  const deviceWork = useRef(Promise.resolve());
  const [appState, setAppState] = useState(AppState.currentState);
  const [clock, setClock] = useState(Date.now());
  const [dialog, setDialog] = useState(null);
  const [placeSlot, setPlaceSlot] = useState('home');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const destinationInput = useRef(null);
  const scroll = useRef(null);
  const routeVersion = useRef(0);
  const searchVersion = useRef(0);
  const mounted = useRef(true);
  const startRequest = useRef(null);
  const scenarioMinutes = useRef(null);
  const actionRequest = useRef(null);
  const hydratedTrip = useRef(null);
  const reminded = useRef(null);
  const activeId = useRef(null);
  const latestPlan = useRef(null);
  latestPlan.current = {
    target,
    transport,
    origin
  };
  activeId.current = account.active?.id;
  const active = account.active;
  useEffect(() => {
    let stopped = false;
    const sample = async () => {
      try { const value = await readBattery(); if (!stopped) setBattery(value); } catch { if (!stopped) setBattery(null); }
    };
    sample();
    const timer = setInterval(sample, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, [appState]);
  useEffect(() => {
    if (active?.status === 'active' && battery && battery.level <= 20 && !battery.charging && !dialog && batteryPrompted.current !== active.id) {
      batteryPrompted.current = active.id;
      setDialog('lowBattery');
    }
  }, [active?.id, active?.status, battery, dialog]);
  useEffect(() => {
    if (account.loading || account.error) return;
    let stopped = false;
    deviceWork.current = deviceWork.current.catch(() => {}).then(async () => {
      if (stopped) return;
      try {
        const status = await syncBackground(active, ownerId);
        await syncReminder(active, account.preferences.reminder || active?.scenario);
        if (!stopped) setDeviceStatus(status);
      } catch (failure) { if (!stopped) setDeviceStatus(failure.message); }
    });
    return () => { stopped = true; };
  }, [ownerId, active?.id, active?.status, active?.sharing, active?.scenario, active?.expectedAt, account.preferences.reminder, account.loading, account.error, appState]);
  const currentTrip = active || finished;
  const routeState = active ? active.status : finished?.status === 'arrived' ? 'arrived' : 'planned';
  const duration = route ? Math.max(1, Math.ceil(route.duration / 60)) : 0;
  const distance = route ? t("{value0} км", {
    value0: (route.distance / 1000).toLocaleString(locale, {
      maximumFractionDigits: 1
    })
  }) : '';
  const selected = [contacts.contact, ...contacts.backupIds].map(id => contacts.people[id]).filter(Boolean);
  const canAccompany = selected.length > 0 && selected.every(person => person.peerId && person.connectionStatus === 'accepted');
  const notify = message => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  };
  const go = next => {
    setPage(next);
    setCollapsed(false);
    scroll.current?.scrollTo({
      y: 0,
      animated: false
    });
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      setAppState(state);
      setClock(Date.now());
    });
    const timer = setInterval(() => {
      if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') setClock(Date.now());
    }, 15000);
    return () => {
      mounted.current = false;
      routeVersion.current++;
      searchVersion.current++;
      clearTimeout(toastTimer.current);
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!active || hydratedTrip.current === active.id) return;
    hydratedTrip.current = active.id;
    routeVersion.current++;
    setMapBusy(false);
    setMapError('');
    setOrigin({
      ...active.origin,
      chosen: true
    });
    setTarget(active.target);
    setDestination(active.target.name);
    setTransport(active.transport);
    setRoute(active.route);
    setFinished(null);
    setPosition(active.position);
    setPickingOrigin(false);
  }, [active?.id]);
  useEffect(() => {
    if (!active || active.status !== 'active' || (!account.preferences.reminder && !active.scenario) || clock < active.expectedAt || reminded.current === active.expectedAt || dialog) return;
    reminded.current = active.expectedAt;
    setDialog('checkin');
  }, [active?.id, active?.expectedAt, account.preferences.reminder, clock, dialog]);
  useEffect(() => {
    if (!active || active.status !== 'active' || appState === 'background' || appState === 'inactive') {
      setTrackingStatus(active ? 'paused' : 'idle');
      return;
    }
    let stopped = false;
    let subscription;
    let uploading = false;
    let lastUpload = 0;
    setTrackingStatus('pending');
    setLastPositionSentAt(null);
    setTrackingError('');
    watchLocation(async sample => {
      if (stopped) return;
      const point = {
        latitude: sample.coords.latitude,
        longitude: sample.coords.longitude,
        accuracy: sample.coords.accuracy,
        updatedAt: sample.timestamp ?? Date.now()
      };
      setPosition(point);
      if (!active.sharing) setTrackingStatus('active');
      if (!active.sharing || uploading || Date.now() - lastUpload < 10000) return;
      uploading = true;
      try {
        await updatePosition(active.id, point);
        if (!stopped) {
          setTrackingError('');
          setTrackingStatus('active');
          setLastPositionSentAt(Date.now());
          lastUpload = Date.now();
        }
      } catch (failure) {
        if (!stopped && activeId.current === active.id) {
          setTrackingStatus('offline');
          setTrackingError(failure.message);
        }
      } finally {
        uploading = false;
      }
    }, message => {
      if (!stopped) {
        setTrackingStatus('error');
        setTrackingError(message || t("Не удалось обновить геопозицию"));
      }
    }).then(result => {
      if (stopped) result.remove();else subscription = result;
    }).catch(failure => {
      if (!stopped) {
        setTrackingStatus('error');
        setTrackingError(failure.message);
      }
    });
    return () => {
      stopped = true;
      subscription?.remove();
    };
  }, [active?.id, active?.status, active?.sharing, appState]);
  const resetRoute = () => {
    routeVersion.current++;
    setRoute(null);
    setMapBusy(false);
    setMapError('');
  };
  const selectTarget = (point, keepExpanded = false) => {
    if (active) return notify(t("Сначала завершите текущую поездку"));
    searchVersion.current++;
    setSearchBusy(false);
    resetRoute();
    setTarget(point);
    setDestination(point.name);
    setSearchResults(null);
    setDialog(null);
    setCollapsed(keepExpanded);
    setPickingOrigin(false);
    setFinished(null);
  };
  const selectPoint = point => {
    if (pickingOrigin && !active) {
      resetRoute();
      setOrigin({
        ...point,
        name: t("Точка отправления на карте"),
        chosen: true,
        gps: false
      });
      setPickingOrigin(false);
      setFocusRequest(value => value + 1);
    } else selectTarget(point);
  };
  const searchPlaces = async () => {
    if (destination.trim().length < 3) return notify(t("Введите минимум 3 символа"));
    const version = ++searchVersion.current;
    setSearchBusy(true);
    setSearchResults(null);
    setMapError('');
    setDialog('search');
    try {
      const result = await searchAddresses(destination, searchCity);
      if (mounted.current && version === searchVersion.current) setSearchResults(result.places);
    } catch (failure) {
      if (mounted.current && version === searchVersion.current) setMapError(failure.message);
    } finally {
      if (mounted.current && version === searchVersion.current) setSearchBusy(false);
    }
  };
  const locate = async () => {
    if (locationBusy) return null;
    if (active) {
      setFocusRequest(value => value + 1);
      return position;
    }
    setLocationBusy(true);
    const version = routeVersion.current;
    try {
      const sample = await getCurrentLocation();
      if (!mounted.current || activeId.current || version !== routeVersion.current) return null;
      const point = {
        latitude: sample.coords.latitude,
        longitude: sample.coords.longitude,
        name: t("Моё местоположение"),
        gps: true,
        chosen: true
      };
      resetRoute();
      setOrigin(point);
      setPickingOrigin(false);
      setFocusRequest(value => value + 1);
      return point;
    } catch (failure) {
      if (mounted.current) notify(failure.message);
      return null;
    } finally {
      if (mounted.current) setLocationBusy(false);
    }
  };
  const buildRoute = async () => {
    if (!target || active || mapBusy || locationBusy) return;
    const requestedTarget = target;
    const requestedTransport = transport;
    setDialog(null);
    setMapError('');
    const startPoint = origin.chosen ? origin : await locate();
    if (!mounted.current || activeId.current || latestPlan.current.target !== requestedTarget || latestPlan.current.transport !== requestedTransport) return;
    if (!startPoint) {
      if (latestPlan.current.origin.chosen) return;
      setPickingOrigin(true);
      setMapError(t("Разрешите геопозицию или укажите точку отправления на карте."));
      return;
    }
    setMapBusy(true);
    const version = ++routeVersion.current;
    try {
      const result = await fetchRoute(startPoint, requestedTarget, requestedTransport);
      if (mounted.current && version === routeVersion.current) setRoute(simplifyRoute(result));
    } catch (failure) {
      if (mounted.current && version === routeVersion.current) setMapError(failure.message);
    } finally {
      if (mounted.current && version === routeVersion.current) setMapBusy(false);
    }
  };
  const start = () => {
    if (account.loading || account.error) return notify(account.error || t("Данные ещё загружаются"));
    if (active) return go('home');
    if (!target) return searchPlaces();
    if (!route) return setDialog('routeConsent');
    setMinutes(Math.max(duration, scenarioMinutes.current || 0));
    setAccompanied(canAccompany);
    setDialog('startJourney');
  };
  const confirmStart = async () => {
    if (mapBusy || !route || activeId.current) return;
    const body = {
      origin,
      target,
      route,
      transport,
      minutes,
      accompanied
    };
    const signature = JSON.stringify(body);
    if (startRequest.current?.signature !== signature) startRequest.current = {
      signature,
      key: actionKey()
    };
    try {
      await account.start({
        ...body,
        clientId: startRequest.current.key
      });
      startRequest.current = null;
      hydratedTrip.current = null;
      setDialog(null);
      setFinished(null);
      setClock(Date.now());
      go('home');
    } catch (failure) {
      notify(failure.message);
      account.refresh();
    }
  };
  const act = async action => {
    if (!active) return;
    if (actionRequest.current?.trip !== active.id || actionRequest.current?.action !== action) actionRequest.current = {
      trip: active.id,
      action,
      key: actionKey()
    };
    try {
      const result = await account.action(active.id, action, actionRequest.current.key);
      if (result.queued) { setDialog(null); notify(t('Действие сохранено на устройстве и ожидает отправки. Сервер ещё не подтвердил его.')); return; }
      actionRequest.current = null;
      setDialog(null);
      if (result.journey.status === 'arrived') {
        setFinished(result.journey);
        notify(result.journey.recipients.length ? t("Прибытие подтверждено. Сообщения добавлены в чаты контактов.") : t("Прибытие подтверждено"));
      } else if (result.journey.status === 'cancelled') {
        setFinished(null);
        resetRoute();
        setTarget(null);
        setDestination('');
        go('route');
        notify(t("Поездка отменена"));
      } else notify(t("Время прибытия увеличено на 5 минут"));
      setClock(Date.now());
    } catch (failure) {
      notify(failure.message);
      account.refresh();
    }
  };
  const onArrive = () => {
    if (finished?.status === 'arrived') {
      setFinished(null);
      resetRoute();
      setTarget(null);
      setDestination('');
      go('home');
    } else if (active && !account.busy) setDialog('confirmArrival');
  };
  const setPreference = (key, value) => account.setPreference(key, value).catch(failure => notify(failure.message));
  const savePlace = async slot => {
    if (!target) return notify(t("Сначала найдите адрес или выберите точку на карте"));
    try {
      await account.savePlace(slot, target);
      notify(t('Место сохранено'));
    } catch (failure) {
      notify(failure.message);
    }
  };
  const recent = [...new Map(account.history.map(item => [item.target.name, item.target])).values()].slice(0, 3);
  return {
    planning: {
      destination,
      searchCity,
      changeSearchCity: value => {
        setSearchCity(value);
        searchVersion.current++;
        setSearchResults(null);
        setSearchBusy(false);
      },
      setDestination,
      origin,
      target,
      setTarget,
      route,
      transport,
      setTransport,
      mapBusy,
      locationBusy,
      focusRequest,
      searchResults,
      searchBusy,
      setSearchBusy,
      mapError,
      recent,
      collapsed,
      setCollapsed,
      destinationInput,
      duration,
      distance,
      resetRoute,
      selectTarget,
      selectPoint,
      searchPlaces,
      locate,
      buildRoute,
      quickHome: async (approved = false) => {
        if (active || mapBusy || locationBusy) return;
        const home = account.places.find(item => item.slot === 'home');
        if (!home) { setPlaceSlot('home'); setDialog('editPlace'); return; }
        if (!approved) { setDialog('quickHomeConsent'); return; }
        setDialog(null);
        selectTarget(home, true);
        go('home');
        setMapBusy(true);
        const version = ++routeVersion.current;
        try {
          const sample = await getCurrentLocation();
          const point = { latitude: sample.coords.latitude, longitude: sample.coords.longitude, name: t('Моё местоположение'), chosen: true, gps: true };
          const result = await fetchRoute(point, home, 'walk');
          if (!mounted.current || activeId.current || version !== routeVersion.current) return;
          setOrigin(point); setTransport('walk'); setRoute(simplifyRoute(result));
          setMinutes(Math.max(1, Math.ceil(result.duration / 60)));
          setAccompanied(canAccompany);
          setDialog('startJourney');
        } catch (failure) {
          if (mounted.current && version === routeVersion.current) setMapError(failure.message);
        } finally {
          if (mounted.current && version === routeVersion.current) setMapBusy(false);
        }
      },
      start,
      pickingOrigin,
      setPickingOrigin,
      places: account.places,
      placeSlot,
      editPlace: slot => { setPlaceSlot(slot); setDialog('editPlace'); },
      savePlace,
      favoriteRoutes: account.favoriteRoutes || [],
      saveFavorite: async slot => {
        if (!route || !target || !origin.chosen || active) return;
        try { await account.saveFavorite(slot, { origin, target, transport }); notify(t('Маршрут сохранён')); } catch (failure) { notify(failure.message); }
      },
      repeatFavorite: plan => {
        if (active) return;
        resetRoute();
        searchVersion.current++;
        setSearchResults(null);
        setSearchBusy(false);
        setOrigin({ ...plan.origin, chosen: true });
        setTarget(plan.target);
        setDestination(plan.target.name);
        setTransport(plan.transport);
        setFinished(null);
        setDialog('routeConsent');
      },
      ready: !account.loading && !account.error
    },
    trip: {
      applySafetyPreset: preset => {
        scenarioMinutes.current = preset.minutes;
        setMinutes(preset.minutes);
        setTransport(preset.slot === 'taxi' ? 'car' : 'walk');
      },
      onOpenSafety: () => setDialog('safetyTools'),
      routeState,
      extraMinutes: currentTrip?.extraMinutes || 0,
      arrivalLabel: currentTrip ? new Date(currentTrip.expectedAt).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      }) : formatDuration(duration, t),
      remainingMinutes: active ? Math.ceil((active.expectedAt - clock) / 60000) : null,
      onArrive,
      onConfirmArrival: () => act('arrive'),
      onAddTime: () => act('extend'),
      onCancel: () => act('cancel'),
      active,
      position,
      trackingStatus,
      lastPositionSentAt,
      clock,
      deviceStatus,
      trackingError,
      busy: account.busy,
      duration: currentTrip?.minutes || duration,
      minutes,
      setMinutes,
      accompanied,
      setAccompanied,
      canAccompany,
      selected,
      confirmStart,
      changeTransport: async mode => {
        if (mapBusy || account.busy || active || !target || mode === transport) return;
        const previous = transport;
        const version = ++routeVersion.current;
        setMapBusy(true); setMapError('');
        try {
          const result = await fetchRoute(origin, target, mode);
          if (!mounted.current || activeId.current || version !== routeVersion.current) return;
          setTransport(mode); setRoute(simplifyRoute(result));
          setMinutes(Math.max(1, Math.ceil(result.duration / 60)));
        } catch (failure) {
          if (mounted.current && version === routeVersion.current) { setTransport(previous); setMapError(failure.message); }
        } finally {
          if (mounted.current && version === routeVersion.current) setMapBusy(false);
        }
      },
      battery,
      warnBattery: async () => {
        try { const result = await account.warnBattery(active.id, battery.level); setDialog(null); notify(t(result.queued ? 'Предупреждение ожидает отправки' : 'Контакты предупреждены о низком заряде')); } catch (failure) { notify(failure.message); }
      }
    },
    contacts,
    account,
    preferences: {
      onOpenSafety: () => setDialog('safetyTools'),
      resetPreferences: account.resetPreferences,
      ...account.preferences,
      setSharing: value => setPreference('sharing', value),
      setReminder: value => setPreference('reminder', value),
      setScenario: value => setPreference('scenario', value),
      setRetentionDays: value => setPreference('retentionDays', value),
      setDelayMinutes: value => setPreference('delayMinutes', value),
      setEscalationMinutes: value => setPreference('escalationMinutes', value),
      clearHistory: account.clearHistory,
      saving: account.busy,
      loading: account.loading,
      error: account.error
    },
    navigation: {
      page,
      go,
      scroll
    },
    dialogs: {
      dialog,
      setDialog,
      searchVersion
    },
    notifications: {
      toast,
      notify
    }
  };
}
