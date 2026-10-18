import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import Icon from './ui/Icon';

export default function PlaceShortcuts({ planning, onManage }) {
  const { appStyles: s, colors, t } = useSettings();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.placeChips}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Быстрый маршрут домой')} disabled={!planning.ready || planning.mapBusy || planning.locationBusy} onPress={() => planning.places.some(item => item.slot === 'home') ? planning.quickHome() : planning.editPlace('home')} style={s.placeChip}><Icon name="navigation" size={19} color={colors.blue} /><Text style={s.placeChipTitle}>{t('Домой')}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Мои места')} onPress={onManage} style={s.placeChip}><Icon name="bookmark" size={19} color={colors.ink} /><Text style={s.placeChipTitle}>{t('Мои места')}</Text></Pressable>
    {['home', 'work', 'study'].filter(slot => planning.places.some(item => item.slot === slot)).map(slot => {
      const place = planning.places.find(item => item.slot === slot);
      const label = t(({ home: 'Дом', work: 'Работа', study: 'Учёба' })[slot]);
      return <Pressable key={slot} accessibilityRole="button" accessibilityLabel={t(place ? 'Выбрать: {place}' : 'Добавить адрес: {place}', { place: label })} onPress={() => place ? planning.selectTarget(place, planning.collapsed) : planning.editPlace(slot)} style={s.placeChip}>
        <Icon name={slot === 'home' ? 'home' : slot === 'work' ? 'briefcase' : 'book-open'} size={20} color={colors.ink} />
        <Text style={s.placeChipTitle}>{label}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}
