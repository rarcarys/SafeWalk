import { useState, useRef, useEffect } from 'react';
import { searchAddresses, fetchRoute } from '../services/maps';
import { getCurrentLocation } from '../services/location';
export default function useJourney() {
  const [page, setPage] = useState('home');
  const [destination, setDestination] = useState('');
  const [origin, setOrigin] = useState({
    latitude: 43.2405,
    longitude: 76.936,
    name: 'Алматы, точка А',
    gps: false,
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
  const distance = route
    ? `${(route.distance / 1000).toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
      })} км`
    : '';
  const notify = (message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };
  const go = (next) => {
    setPage(next);
    setCollapsed(false);
    scroll.current?.scrollTo({
      y: 0,
      animated: false,
    });
  };
  const arrivalLabel = arrival
    ? new Date(arrival + extraMinutes * 60000).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : `${duration} мин`;
  const resetRoute = () => {
    routeVersion.current++;
    setRoute(null);
    setMapBusy(false);
    setMapError('');
  };
  const selectTarget = (point) => {
    searchVersion.current++;
    setSearchBusy(false);
    resetRoute();
    setTarget(point);
    setDestination(point.name);
    setSearchResults(null);
    setDialog(null);
    setCollapsed(false);
    setRecent((items) =>
      [
        point,
        ...items.filter(
          (item) =>
            item.latitude !== point.latitude ||
            item.longitude !== point.longitude,
        ),
      ].slice(0, 3),
    );
  };
  const searchPlaces = async () => {
    if (destination.trim().length < 3)
      return notify('Введите минимум 3 символа');
    const version = ++searchVersion.current;
    setSearchBusy(true);
    setSearchResults(null);
    setMapError('');
    setDialog('search');
    try {
      const result = await searchAddresses(destination);
      if (mounted.current && version === searchVersion.current)
        setSearchResults(result.places);
    } catch (error) {
      if (mounted.current && version === searchVersion.current)
        setMapError(error.message);
    } finally {
      if (mounted.current && version === searchVersion.current)
        setSearchBusy(false);
    }
  };
  const locate = async () => {
    if (locationBusy) return;
    if (routeState !== 'planned')
      return notify(
        'Точка отправления зафиксирована. Завершите маршрут, чтобы изменить её.',
      );
    setLocationBusy(true);
    const version = routeVersion.current;
    try {
      const position = await getCurrentLocation();
      if (!mounted.current || version !== routeVersion.current) return;
      resetRoute();
      setOrigin({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: 'Моё местоположение',
        gps: true,
      });
      setFocusRequest((value) => value + 1);
    } catch (error) {
      if (mounted.current) notify(error.message);
    } finally {
      if (mounted.current) setLocationBusy(false);
    }
  };
  const buildRoute = async () => {
    setDialog(null);
    setMapError('');
    setMapBusy(true);
    const version = ++routeVersion.current;
    try {
      const result = await fetchRoute(origin, target, transport);
      if (mounted.current && version === routeVersion.current) setRoute(result);
    } catch (error) {
      if (mounted.current && version === routeVersion.current)
        setMapError(error.message);
    } finally {
      if (mounted.current && version === routeVersion.current)
        setMapBusy(false);
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
  const onArrive = () => {
    if (routeState === 'arrived') {
      setRouteState('planned');
      go('home');
    } else setRouteState('arrived');
  };
  const onAddTime = () => {
    if (extraMinutes >= 30) return notify('Добавлено максимум 30 минут');
    setExtraMinutes((value) => value + 5);
  };
  return {
    planning: {
      destination,
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
      searchPlaces,
      locate,
      buildRoute,
      start,
    },
    trip: {
      routeState,
      extraMinutes,
      arrivalLabel,
      onArrive,
      onAddTime,
    },
    contacts: {
      contact,
      setContact,
      inspectedContact,
      setInspectedContact,
    },
    preferences: {
      sharing,
      setSharing,
      reminder,
      setReminder,
      scenario,
      setScenario,
    },
    navigation: {
      page,
      go,
      scroll,
    },
    dialogs: {
      dialog,
      setDialog,
      searchVersion,
    },
    notifications: {
      toast,
      notify,
    },
  };
}
