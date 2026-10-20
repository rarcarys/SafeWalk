import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import Icon from './ui/Icon';

export default function SOSAlert({ alert, count, onAcknowledge, onOpenChat, onDismiss, onOpenDetails }) {
  const { appStyles: s, t, locale } = useSettings();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!alert) return;
    let stopped = false, animation;
    setError('');
    const animate = reduced => {
      animation?.stop(); pulse.setValue(0);
      if (!reduced && !stopped) {
        animation = Animated.loop(Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(pulse, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        ])); animation.start();
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(animate).catch(() => animate(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', animate);
    Vibration.vibrate([0, 300, 180, 300]);
    return () => { stopped = true; animation?.stop(); pulse.stopAnimation(); Vibration.cancel(); subscription.remove(); };
  }, [alert?.senderId, alert?.clientId]);
  if (!alert) return null;
  const acknowledge = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onAcknowledge(alert); } catch (failure) { setError(failure.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (!lock.current) onDismiss(alert); }}>
    <View style={[s.sosUrgentBackdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView style={s.sosUrgentScroll} contentContainerStyle={s.sosUrgentContent}>
        <View style={s.sosUrgentCard} accessibilityViewIsModal>
          <View style={s.sosUrgentTopline}><View style={s.sosUrgentDot} /><Text style={s.sosUrgentEyebrow}>{t('СРОЧНАЯ ТРЕВОГА')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Скрыть тревогу')} disabled={busy} onPress={() => onDismiss(alert)} style={s.sosUrgentClose}><Icon name="x" color="#FFFFFF" size={20} /></Pressable></View>
          <View style={s.sosUrgentSymbol}>
            <Animated.View pointerEvents="none" style={[s.sosUrgentRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }] }]} />
            <View style={s.sosUrgentIcon}><Icon name="alert-triangle" size={36} color="#FFFFFF" /></View>
          </View>
          <Text role="alert" accessibilityLiveRegion="assertive" style={s.sosUrgentTitle}>SOS</Text>
          <Text style={s.sosUrgentName}>{alert.senderName}</Text>
          <Text style={s.sosUrgentDescription}>{t('Просит о помощи. Свяжитесь с человеком прямо сейчас.')}</Text>
          {!!alert.note && <Text style={s.sosUrgentNote}>{alert.note}</Text>}
          <Text style={s.sosUrgentTime}>{t('Сигнал в {time}', { time: new Date(alert.sentAt).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) })}</Text>
          {count > 1 && <Text style={s.sosUrgentQueue}>{t('Ещё тревог: {count}', { count: count - 1 })}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={t('Местоположение')} disabled={busy} onPress={() => onOpenDetails(alert)} style={[s.sosUrgentSecondary, { marginBottom: 10 }]}><Icon name="map-pin" color="#FFFFFF" size={19} /><Text style={[s.sosUrgentSecondaryText, { flexShrink: 1, textAlign: 'center' }]}>{t('Местоположение')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Получил SOS, связываюсь')} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={acknowledge} style={[s.sosUrgentPrimary, busy && { opacity: 0.65 }]}><Icon name="check" color="#A60F23" size={21} /><Text style={s.sosUrgentPrimaryText}>{t(busy ? 'Подтверждаем…' : 'Получил SOS, связываюсь')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Открыть чат')} disabled={busy} onPress={() => onOpenChat(alert)} style={s.sosUrgentSecondary}><Icon name="message-circle" color="#FFFFFF" size={19} /><Text style={s.sosUrgentSecondaryText}>{t('Открыть чат')}</Text></Pressable>
          {!!error && <Text role="alert" style={s.sosUrgentError}>{t(error)}</Text>}
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
