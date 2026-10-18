import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import MapCanvas from './maps/MapCanvas';
import Icon from './ui/Icon';
import IconButton from './ui/IconButton';
import ActionButton from './ui/ActionButton';

export default function PlaceMapPicker({ label, center, point, position, focusRequest, locating, saving, resolving, approximate, error, onSelect, onPosition, onAddressChange, onLocate, onSave, onBack }) {
  const { appStyles: s, colors, t } = useSettings();
  const insets = useSafeAreaInsets();
  return <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.pickerHeader}><IconButton icon="arrow-left" label={t('Назад к адресу')} onPress={onBack} disabled={saving} /><Text accessibilityRole="header" style={s.pickerTitle}>{t('Укажите: {place}', { place: label })}</Text></View>
      <View style={s.pickerCanvas}>
        <MapCanvas origin={{ ...center, chosen: false }} target={point} editable={!saving} autoFrame={false} focusRequest={focusRequest} currentPosition={position} onCurrentPositionPress={onPosition} onSelect={onSelect} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('Моё местоположение')} disabled={locating || saving} onPress={onLocate} style={s.pickerLocate}>
          {locating ? <ActivityIndicator color={colors.blue} /> : <Icon name="crosshair" size={22} color={colors.blue} />}
          <Text style={s.rowTitle}>{t(locating ? 'Определяем геопозицию…' : 'Моё местоположение')}</Text>
        </Pressable>
      </View>
      <View style={s.pickerFooter}>
        <Text accessibilityLiveRegion="polite" style={[s.rowSubtitle, { marginBottom: 8 }]}>{t(resolving ? 'Определяем адрес…' : point ? 'Адрес выбранной точки' : 'Нажмите на карту, чтобы поставить метку.')}</Text>
        {!!point && <TextInput accessibilityLabel={t('Адрес выбранной точки')} value={point.name} onChangeText={onAddressChange} editable={!saving && !resolving && !locating} style={s.pointAddressInput} placeholder={t('Улица и номер дома')} placeholderTextColor={colors.muted} maxLength={500} />}
        {approximate && <Text style={s.rowSubtitle}>{t('Номер дома не найден. Проверьте и уточните адрес.')}</Text>}
        {!!error && <Text role="alert" style={s.mapError}>{t(error)}</Text>}
        <View style={s.formActions}><ActionButton title={t('Сохранить: {place}', { place: label })} icon="check" busy={saving} disabled={!point?.name?.trim() || locating || resolving} onPress={onSave} /></View>
      </View>
    </View>;
}
