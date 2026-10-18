import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { searchAddresses, reverseAddress } from '../services/maps';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import Icon from './ui/Icon';
import IconButton from './ui/IconButton';
import PlaceMapPicker from './PlaceMapPicker';
import { getCurrentLocation } from '../services/location';

export default function PlaceEditor({ slot, place, currentTarget, origin, city: initialCity, onSave, onDelete, onClose }) {
  const { appStyles: s, colors, t } = useSettings();
  const label = t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[slot]);
  const [city, setCity] = useState(initialCity || 'Алматы');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(place || null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mapMode, setMapMode] = useState(false);
  const [mapPoint, setMapPoint] = useState(null);
  const [mapCenter, setMapCenter] = useState(() => place || currentTarget || origin || { latitude: 43.2405, longitude: 76.936 });
  const [focusRequest, setFocusRequest] = useState(0);
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const addressVersion = useRef(0);
  const addressTimer = useRef(null);
  const addressController = useRef(null);
  const version = useRef(0);
  const cancelAddress = () => { addressVersion.current++; clearTimeout(addressTimer.current); addressController.current?.abort(); };
  useEffect(() => () => { version.current++; cancelAddress(); }, []);
  const chooseMapPoint = point => {
    cancelAddress();
    const requestVersion = addressVersion.current;
    const chosen = { latitude: point.latitude, longitude: point.longitude, gps: !!point.gps, name: '' };
    setMapPoint(chosen); setResolving(true); setApproximate(false); setError('');
    addressTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      addressController.current = controller;
      try {
        const result = await reverseAddress(chosen, controller.signal);
        if (requestVersion !== addressVersion.current) return;
        setMapPoint({ ...chosen, name: result.place.name });
        setApproximate(result.approximate);
      } catch (failure) {
        if (requestVersion === addressVersion.current) setError(t('Не удалось определить адрес. Укажите его вручную.'));
      } finally { if (requestVersion === addressVersion.current) setResolving(false); }
    }, 450);
  };
  const leaveMap = () => { version.current++; cancelAddress(); setResolving(false); setMapMode(false); };
  const edit = setter => value => {
    version.current++;
    setter(value); setSelected(null); setResults(null); setBusy(false); setError('');
  };
  const find = async () => {
    Keyboard.dismiss();
    if (query.trim().length < 3) { setError(t('Введите минимум 3 символа')); return; }
    const requestVersion = ++version.current;
    setBusy(true); setError(''); setResults(null);
    try {
      const result = await searchAddresses(query, city);
      if (version.current === requestVersion) setResults(result.places);
    } catch (failure) { if (version.current === requestVersion) setError(failure.message); }
    finally { if (version.current === requestVersion) setBusy(false); }
  };
  const save = async () => {
    const point = mapMode ? mapPoint : selected;
    if (!point?.name?.trim() || saving || resolving) return;
    setSaving(true); setError('');
    try { await onSave(slot, point); }
    catch (failure) { setError(failure.message); setSaving(false); }
  };
  const openMap = () => {
    if (mapMode) return;
    Keyboard.dismiss(); version.current++; setBusy(false); setLocating(false); setError('');
    setMapPoint(selected); setMapCenter(selected || currentTarget || origin || mapCenter); setMapMode(true);
    if (selected) chooseMapPoint(selected);
  };
  const locate = async () => {
    if (locating) return;
    const requestVersion = ++version.current;
    setLocating(true); setError('');
    try {
      const sample = await getCurrentLocation();
      if (requestVersion !== version.current) return;
      const point = { latitude: sample.coords.latitude, longitude: sample.coords.longitude, accuracy: sample.coords.accuracy };
      setMapCenter(point);
      setPosition(point);
      chooseMapPoint({ ...point, gps: true });
      setFocusRequest(value => value + 1);
    } catch (failure) { if (requestVersion === version.current) setError(failure.message); }
    finally { if (requestVersion === version.current) setLocating(false); }
  };
  if (mapMode) return <ModalSheet visible fullScreen onClose={() => { if (!saving) leaveMap(); }}><PlaceMapPicker label={label} center={mapCenter} point={mapPoint} position={position} focusRequest={focusRequest} locating={locating} saving={saving} error={error} resolving={resolving} approximate={approximate}
    onSelect={point => { version.current++; setLocating(false); chooseMapPoint(point); }} onPosition={point => { version.current++; setLocating(false); chooseMapPoint({ ...point, gps: true }); }}
    onAddressChange={name => { cancelAddress(); setResolving(false); setApproximate(false); setError(''); setMapPoint(current => current ? { ...current, name } : current); }}
    onLocate={locate} onSave={save} onBack={leaveMap} /></ModalSheet>;
  return <ModalSheet visible title={t('Адрес места: {place}', { place: label })} onClose={() => { if (!saving) onClose(); }}>
    <View style={s.modeControl}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Поиск адреса')} accessibilityState={{ selected: !mapMode }} disabled={saving} onPress={() => { version.current++; setBusy(false); setMapMode(false); }} style={[s.modeOption, !mapMode && s.modeSelected]}><Icon name="search" size={17} color={colors.ink} /><Text style={s.modeLabel}>{t('Поиск')}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Выбрать точку на карте')} accessibilityState={{ selected: mapMode }} disabled={saving} onPress={openMap} style={[s.modeOption, mapMode && s.modeSelected]}><Icon name="map" size={17} color={colors.ink} /><Text style={s.modeLabel}>{t('На карте')}</Text></Pressable>
    </View>
    <View style={s.dockCity}><Icon name="map-pin" size={12} color={colors.muted} /><TextInput accessibilityLabel={t('Город поиска')} value={city} onChangeText={edit(setCity)} style={s.dockCityInput} editable={!saving} /></View>
    <View style={s.destinationField}><TextInput accessibilityLabel={t('Адрес места')} value={query} onChangeText={edit(setQuery)} style={s.destinationInput} placeholder={t('Улица и номер дома')} placeholderTextColor={colors.muted} editable={!saving} returnKeyType="search" onSubmitEditing={find} /><IconButton icon={busy ? 'clock' : 'search'} label={t('Найти адрес')} disabled={saving || busy} onPress={find} /></View>
    {results?.length === 0 && <Text style={s.mapError}>{t('Адрес не найден. Проверьте город, название улицы и номер дома. Если дома нет в данных карты, выберите точку вручную.')}</Text>}
    {results?.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={t('Выбрать {value0}', { value0: point.name })} disabled={saving} onPress={() => { setSelected(point); setResults(null); Keyboard.dismiss(); }} style={s.searchResult}><Icon name="map-pin" color={colors.blue} /><Text style={[s.rowTitle, s.flex]}>{point.name}</Text></Pressable>)}
    {!!currentTarget && !selected && <Pressable accessibilityRole="button" accessibilityLabel={t('Использовать адрес с карты')} disabled={saving} style={s.menuAction} onPress={() => { version.current++; setBusy(false); setSelected(currentTarget); setResults(null); setError(''); }}><Icon name="map-pin" size={20} color={colors.muted} /><View style={s.flex}><Text style={s.rowTitle}>{t('Использовать адрес с карты')}</Text><Text style={s.rowSubtitle} numberOfLines={1}>{currentTarget.name}</Text></View></Pressable>}
    {selected && <View style={s.placeSelected}><Text style={s.rowSubtitle}>{t('Будет сохранён адрес')}</Text><Text style={s.rowTitle}>{selected.name}</Text></View>}
    {!!error && <Text role="alert" style={s.mapError}>{t(error)}</Text>}
    <View style={s.formActions}>
      <ActionButton title={t('Сохранить: {place}', { place: label })} icon="check" busy={saving} disabled={!(mapMode ? mapPoint : selected) || busy || (mapMode && locating)} onPress={save} />
    </View>
    {place && !mapMode && <Pressable accessibilityRole="button" accessibilityLabel={t('Удалить адрес')} style={s.textAction} disabled={saving || busy} onPress={async () => { setSaving(true); setError(''); try { await onDelete(slot); } catch (failure) { setError(failure.message); setSaving(false); } }}><Text style={s.dangerText}>{t('Удалить адрес')}</Text></Pressable>}
    {!mapMode && <Text style={s.modalFootnote}>{t('Поиск: OpenStreetMap. Введённый адрес передаётся сервису Nominatim.')}</Text>}
  </ModalSheet>;
}
