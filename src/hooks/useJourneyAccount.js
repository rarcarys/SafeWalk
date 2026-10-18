import { useSettings } from "../context/SettingsContext";
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as api from '../services/journeys';
import { subscribeLive } from '../services/live';
import { readLocal, writeLocal } from '../services/localStore';
const initial = {
  active: null,
  history: [],
  received: [],
  sentSOS: [],
  receivedSOS: [],
  places: [],
  favoriteRoutes: [],
  unreadCount: 0,
  preferences: {
    sharing: false,
    reminder: true,
    scenario: true,
    retentionDays: 30,
    delayMinutes: 5,
    escalationMinutes: 5
  }
};
export default function useJourneyAccount(ownerId, outbox) {
  const {
    t
  } = useSettings();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(false);
  const loadingRef = useRef(false);
  const mutation = useRef(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!alive.current || loadingRef.current || mutation.current) return;
    loadingRef.current = true;
    const requestVersion = version.current;
    try {
      const result = await api.loadJourneyState();
      if (alive.current && requestVersion === version.current) {
        setData(result);
        setError('');
        writeLocal(`journey.${ownerId}`, { savedAt: Date.now(), data: result }).catch(() => {});
      }
    } catch (failure) {
      if (alive.current && requestVersion === version.current) setError(failure.message);
    } finally {
      loadingRef.current = false;
      if (alive.current) setLoading(false);
    }
  }, [ownerId]);
  useEffect(() => {
    alive.current = true;
    readLocal(`journey.${ownerId}`).then(cache => {
      if (alive.current && loadingRef.current && cache && Date.now() - cache.savedAt < 86400000) setData(cache.data);
    }).catch(() => {});
    refresh();
    const unsubscribe = subscribeLive(refresh);
    const timer = setInterval(() => {
      if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') refresh();
    }, 10000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      alive.current = false;
      unsubscribe();
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);
  const change = async (operation, apply) => {
    if (mutation.current) throw new Error(t("Дождитесь завершения предыдущего действия"));
    if (loading) throw new Error(t("Данные ещё загружаются"));
    mutation.current = true;
    version.current++;
    setBusy(true);
    try {
      const result = await operation();
      if (alive.current && apply && !result.queued) setData(current => apply(current, result));
      return result;
    } finally {
      mutation.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const applyJourney = (current, {
    journey
  }) => ({
    ...current,
    active: ['active', 'pending'].includes(journey.status) ? journey : null,
    history: ['active', 'pending'].includes(journey.status) ? current.history : [journey, ...current.history.filter(item => item.id !== journey.id)].slice(0, 30)
  });
  return {
    ...data,
    outbox,
    loading,
    error,
    busy,
    refresh,
    clearHistory: () => change(api.clearHistory, current => ({ ...current, history: [] })),
    respondJourney: (id, decision) => change(() => api.respondJourney(id, decision)).then(refresh),
    acknowledgeSOS: (ownerId, clientId) => change(() => outbox.run(`journeys/sos/${encodeURIComponent(ownerId)}/${encodeURIComponent(clientId)}/acknowledge`, { clientId: `ack_${clientId}` }, 'Подтверждение SOS')).then(refresh),
    setPreference: (key, value) => change(() => api.savePreferences({
      [key]: value
    }), (current, result) => ({
      ...current,
      preferences: result.preferences,
      active: current.active ? {
        ...current.active,
        ...(key === 'sharing' ? {
          sharing: value,
          position: value ? current.active.position : null
        } : key === 'scenario' ? {
          scenario: value
        } : {})
      } : null
    })),
    resetPreferences: () => change(() => api.savePreferences(initial.preferences), (current, result) => ({
      ...current,
      preferences: result.preferences,
      active: current.active ? {
        ...current.active,
        sharing: false,
        scenario: true,
        position: null
      } : null
    })),
    savePlace: (slot, point) => change(() => api.savePlace(slot, point), (current, result) => ({
      ...current,
      places: [...current.places.filter(place => place.slot !== slot), result.place]
    })),
    saveFavorite: (slot, plan) => change(() => api.saveFavorite(slot, plan), (current, result) => ({ ...current, favoriteRoutes: [...(current.favoriteRoutes || []).filter(item => item.slot !== slot), result.favorite] })),
    deleteFavorite: slot => change(() => api.deleteFavorite(slot), current => ({ ...current, favoriteRoutes: (current.favoriteRoutes || []).filter(item => item.slot !== slot) })),
    warnBattery: (id, level) => change(() => outbox.run(`journeys/${encodeURIComponent(id)}/low-battery`, { level, clientId: `battery_${id}` }, 'Низкий заряд')),
    deletePlace: slot => change(() => api.deletePlace(slot), current => ({
      ...current,
      places: current.places.filter(place => place.slot !== slot)
    })),
    start: body => change(() => api.startJourney(body), applyJourney),
    action: (id, action, clientId) => change(() => outbox.run(`journeys/${encodeURIComponent(id)}/action`, { action, clientId }, ({ arrive: 'Подтверждение прибытия', cancel: 'Отмена прогулки', extend: 'Продление прогулки' })[action]), applyJourney),
    acknowledge: id => change(() => api.acknowledgeJourney(id), current => ({
      ...current,
      received: current.received.map(item => item.id === id ? {
        ...item,
        acknowledgedAt: Date.now()
      } : item)
    })),
    sendSOS: body => change(() => outbox.run('journeys/sos/send', body, 'SOS'))
  };
}
