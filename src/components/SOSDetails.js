import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { request } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import MapCanvas from './maps/MapCanvas';
import { getCurrentLocation } from '../services/location';
import { fetchRoute } from '../services/maps';
import { formatDuration } from '../services/duration.cjs';

export default function SOSDetails({ selected, onClose, onHandled }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const [data, setData] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [origin, setOrigin] = useState(null), [route, setRoute] = useState(null), [mode, setMode] = useState('walk');
  const routeLock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!selected) return;
    let stopped = false; generation.current++; routeLock.current = false; setNavigating(false); setOrigin(null); setRoute(null); setMode('walk'); setData(null); setError('');
    request(`journeys/sos/${encodeURIComponent(selected.ownerId || selected.senderId)}/${encodeURIComponent(selected.clientId)}`)
      .then(result => { if (!stopped) setData(result.sos); }).catch(failure => { if (!stopped) setError(failure.message); });
    return () => { stopped = true; generation.current++; };
  }, [selected?.ownerId, selected?.senderId, selected?.clientId, retry]);
  const point = data?.position ? { ...data.position, name: data.name, chosen: true } : null;
  return <ModalSheet visible={!!selected} title={t('Местоположение')} onClose={onClose}>
    {!data && !error && <ActivityIndicator color={colors.blue} />}
    {data && <>
      <Text style={s.cardTitle}>{data.name}</Text>
      <Text style={s.rowSubtitle}>{new Date(data.createdAt).toLocaleString(locale)}</Text>
      {point ? <>
        <View style={[s.sharedMap, { height: route ? 300 : 230, marginTop: 16 }]}><MapCanvas origin={origin || point} target={point} route={route} currentPosition={origin} editable={false} focusRequest={0} /></View>
        <Text style={s.rowSubtitle}>{t('Место на момент SOS: {time}', { time: new Date(point.capturedAt).toLocaleString(locale) })}</Text>
        <View style={[s.modeControl, { marginVertical: 14 }]}>{[['walk', 'Пешком'], ['car', 'На машине']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={t(label)} accessibilityState={{ selected: mode === value, disabled: navigating }} disabled={navigating} onPress={() => { if (mode !== value) { setMode(value); setRoute(null); } }} style={[s.modeOption, mode === value && s.modeSelected]}><Text style={s.modeLabel}>{t(label)}</Text></Pressable>)}</View>
        {route && <View style={s.sosRouteSummary}><Text style={s.cardTitle}>{formatDuration(Math.max(1, Math.ceil(route.duration / 60)), t)}</Text><Text style={s.rowSubtitle}>{(route.distance / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} {t('км')} · {t(mode === 'walk' ? 'Пешком' : 'На машине')}</Text></View>}
        {!!data.routeStartedAt && <Text style={s.blueText}>{t('SOS обработан. Отправитель знает, что вы направляетесь к нему.')}</Text>}
        <ActionButton title={t('Построить маршрут')} icon="navigation" busy={navigating} onPress={async () => {
          if (routeLock.current) return;
          routeLock.current = true; setNavigating(true); setError('');
          const version = generation.current;
          try {
            const location = await getCurrentLocation();
            if (generation.current !== version) return;
            const start = { latitude: location.coords.latitude, longitude: location.coords.longitude, name: t('Моя геопозиция'), chosen: true, gps: true };
            const path = await fetchRoute(start, point, mode);
            if (generation.current !== version) return;
            setOrigin(start); setRoute(path);
            const result = await request(`journeys/sos/${encodeURIComponent(selected.ownerId || selected.senderId)}/${encodeURIComponent(selected.clientId)}/navigate`, { method: 'POST', body: {} });
            if (generation.current !== version) return;
            setData(current => ({ ...current, routeStartedAt: result.routeStartedAt }));
            await onHandled?.();
          } catch (failure) { if (generation.current === version) setError(failure.message); }
          finally { if (generation.current === version) { routeLock.current = false; setNavigating(false); } }
        }} />
      </> : <Text style={s.rowSubtitle}>{t('Отправитель не добавил геопозицию к SOS')}</Text>}
    </>}
    {!!error && <><Text role="alert" style={s.mapError}>{t(error)}</Text><ActionButton title={t('Повторить загрузку')} secondary onPress={() => setRetry(value => value + 1)} /></>}
  </ModalSheet>;
}
