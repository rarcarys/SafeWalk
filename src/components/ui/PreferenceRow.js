import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSettings } from '../../context/SettingsContext';
import Icon from './Icon';

export default function PreferenceRow({ title, value, icon, onPress, disabled, last, danger, accessibilityLabel, compact = false }) {
  const { appStyles: s, colors } = useSettings();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityHint={value} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.preferenceRow, compact && s.compactPreferenceRow, last && s.settingsLastRow, pressed && s.pressed, disabled && s.pressed]}>
    {!!icon && <View style={s.preferenceIcon}><Icon name={icon} size={19} color={danger ? colors.red : colors.ink} /></View>}
    <View style={s.flex}><Text style={[s.preferenceTitle, danger && { color: colors.red }]}>{title}</Text>{!!value && <Text style={s.preferenceValue} numberOfLines={2}>{value}</Text>}</View>
    <View style={s.preferenceChevron}><Icon name="chevron-right" size={17} color={colors.muted} /></View>
  </Pressable>;
}
