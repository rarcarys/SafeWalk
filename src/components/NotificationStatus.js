import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { request } from '../services/api';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';

export default function NotificationStatus({ dialogs, journeyId }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const visible = dialogs.dialog === 'notificationStatus';
  const [messages, setMessages] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let stopped = false, running = false;
    setMessages([]); setLoading(true); setError('');
    const update = async () => {
      if (running) return;
      running = true;
      try {
        const result = await request(`notifications/sent${journeyId ? `?journeyId=${encodeURIComponent(journeyId)}` : ''}`);
        if (!stopped) { setMessages(result.messages); setError(''); }
      } catch (failure) { if (!stopped) setError(failure.message); }
      finally { running = false; if (!stopped) setLoading(false); }
    };
    update(); const timer = setInterval(update, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [visible, journeyId, retry]);
  return <ModalSheet visible={visible} title={t('Статус уведомлений')} onClose={() => dialogs.setDialog(null)}>
    <Text style={s.modalDescription}>{t('Получено приложением — SafeWalk подтвердил получение сообщения. Прочитано — контакт открыл чат.')}</Text>
    {loading && <ActivityIndicator color={colors.blue} />}
    {!loading && !error && !messages.length && <Text style={s.rowSubtitle}>{t('Отправленных уведомлений пока нет')}</Text>}
    {messages.map(item => <View key={item.id} style={s.journeyCard}>
      <View style={s.cardHeading}><Text style={[s.rowTitle, s.flex]}>{item.name}</Text><Text style={s.rowSubtitle}>{new Date(item.sentAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text></View>
      <Text numberOfLines={3} style={s.rowSubtitle}>{item.text}</Text>
      <Text style={s.blueText}>{t(({ read: 'Прочитано', received: 'Получено приложением', saved: 'Сохранено на сервере' })[item.status])}</Text>
      {item.status === 'saved' && <Text style={s.rowSubtitle}>{t(({ provider_confirmed: 'Push принят службой доставки', provider_accepted: 'Push передан провайдеру', pending: 'Push ожидает отправки', failed: 'Доставка push не подтверждена', unavailable: 'Push недоступен. Сообщение сохранено в чате.' })[item.pushStatus])}</Text>}
    </View>)}
    {!!error && <><Text role="alert" style={s.mapError}>{t(error)}</Text><ActionButton title={t('Повторить загрузку')} secondary onPress={() => setRetry(value => value + 1)} /></>}
  </ModalSheet>;
}
