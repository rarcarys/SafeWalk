import React from 'react';
import { Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import Icon from './ui/Icon';

export default function ContactBattery({ battery, now = Date.now(), showUnavailable = false }) {
  const { appStyles: s, colors, t } = useSettings();
  const fresh = battery && now >= battery.updatedAt && now - battery.updatedAt < 120000;
  if (!fresh) return showUnavailable ? <Text style={s.presenceText}>{t('Заряд недоступен')}</Text> : null;
  const color = battery.level <= 20 && !battery.charging ? colors.red : battery.charging ? colors.success : colors.ink;
  return <View style={s.contactBatteryBadge} accessible accessibilityLabel={t(battery.charging ? 'Заряд: {count}%, заряжается' : 'Заряд: {count}%', { count: battery.level })}>
    <View style={[s.contactBatteryOutline, { borderColor: color }]}>
      <View style={[s.contactBatteryFill, { width: `${battery.level}%`, backgroundColor: color }]} />
      <View style={[s.contactBatteryTip, { backgroundColor: color }]} />
    </View>
    {battery.charging && <Icon name="zap" size={11} color={color} />}
    <Text style={[s.contactBatteryText, { color }]}>{battery.level}%</Text>
  </View>;
}
