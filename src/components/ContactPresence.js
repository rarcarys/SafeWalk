import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import ContactBattery from './ContactBattery';

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
      <ContactBattery battery={battery} now={now} />
    </View>
    {detailed && <Text style={s.presenceText}>{battery ? t('Заряд обновлён в {time}', { time: new Date(battery.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }) : t('Заряд недоступен или давно не обновлялся')}</Text>}
  </View>;
}
