import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import Icon from './ui/Icon';

export default function ContactPresence({ presence, detailed = false }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  if (!presence) return null;
  const online = presence.online && presence.lastSeenAt && now - presence.lastSeenAt < 75000;
  const battery = presence.battery && now - presence.battery.updatedAt < 120000 ? presence.battery : null;
  const seen = presence.lastSeenAt ? new Date(presence.lastSeenAt) : null;
  const today = seen && seen.toDateString() === new Date(now).toDateString();
  const status = online ? t('В сети') : seen ? t('Был(а) в сети: {time}', { time: today ? seen.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : seen.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : t('Не в сети');
  return <View style={s.contactPresence}>
    <View style={s.contactPresenceLine}>
      <View style={[s.presenceDot, { backgroundColor: online ? colors.success : colors.muted }]} />
      <Text style={[s.presenceText, online && { color: colors.success }]}>{status}</Text>
      {!!battery && <View style={s.presenceBattery} accessible accessibilityLabel={t(battery.charging ? 'Заряд: {count}%, заряжается' : 'Заряд: {count}%', { count: battery.level })}>
        <Icon name={battery.charging ? 'battery-charging' : 'battery'} size={14} color={battery.level <= 20 && !battery.charging ? colors.red : colors.muted} />
        <Text style={[s.presenceText, battery.level <= 20 && !battery.charging && { color: colors.red }]}>{battery.level}%</Text>
      </View>}
    </View>
    {detailed && <Text style={s.presenceText}>{battery ? t('Заряд обновлён в {time}', { time: new Date(battery.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }) : t('Заряд недоступен или давно не обновлялся')}</Text>}
  </View>;
}
