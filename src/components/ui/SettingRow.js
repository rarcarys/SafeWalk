import { useSettings } from '../../context/SettingsContext';
import { View, Text, Switch } from 'react-native';
import React from 'react';
export default function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
  compact = false,
  last
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  return <View style={[s.settingsToggleRow, compact && s.compactToggleRow, last && s.settingsLastRow]}>
      <View style={s.flex}>
        <Text style={s.settingsRowTitle}>{title}</Text>
        {description && <Text style={s.settingsOptionDescription}>{description}</Text>}
      </View>
      <View style={s.settingsSwitchControl}>
      <Switch accessibilityLabel={title} accessibilityHint={description} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{
      false: colors.switchTrack,
      true: colors.blue
    }} thumbColor="#fff" activeThumbColor="#fff" />
      {!compact && <Text style={[s.settingsSwitchState, value && s.settingsSwitchStateOn]}>{t(value ? 'Включено' : 'Выключено')}</Text>}
      </View>
    </View>;
}
