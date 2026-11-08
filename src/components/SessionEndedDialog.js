import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';

export default function SessionEndedDialog({ visible, onClose }) {
  const { authColors: c, fontScale, t } = useSettings();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={[styles.backdrop, { paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(24, insets.bottom) }]}>
      <View accessibilityLabel={t('Сессия завершена')} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Закрыть')} onPress={onClose} style={({ pressed }) => [styles.close, { backgroundColor: c.control, opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="x" size={18} color={c.muted} />
        </Pressable>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.iconHalo, { backgroundColor: c.control }]}>
            <View style={[styles.icon, { backgroundColor: c.dark }]}>
              <Feather name="lock" size={27} color={c.accent} />
            </View>
          </View>
          <Text style={[styles.eyebrow, { color: c.muted, fontSize: 10 * fontScale }]}>SAFEWALK</Text>
          <Text role="heading" style={[styles.title, { color: c.ink, fontSize: 25 * fontScale, lineHeight: 31 * fontScale }]}>{t('Сессия завершена')}</Text>
          <Text style={[styles.description, { color: c.muted, fontSize: 14 * fontScale, lineHeight: 22 * fontScale }]}>{t('Войдите снова, чтобы продолжить пользоваться SafeWalk.')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Войти')} onPress={onClose} style={({ pressed }) => [styles.button, { backgroundColor: c.button, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={{ color: c.onButton, fontSize: 15 * fontScale, fontWeight: '700' }}>{t('Войти')}</Text>
            <Feather name="arrow-right" size={19} color={c.onButton} />
          </Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13, 28, 21, 0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 380, maxHeight: '100%', borderRadius: 28, borderWidth: 1, overflow: 'hidden', shadowColor: '#071a10', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.18, shadowRadius: 40, elevation: 12 },
  close: { position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  content: { padding: 28, paddingTop: 38, alignItems: 'center' },
  iconHalo: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  icon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  title: { fontWeight: '800', letterSpacing: -0.7, textAlign: 'center' },
  description: { textAlign: 'center', marginTop: 12, marginBottom: 26 },
  button: { width: '100%', minHeight: 52, paddingVertical: 15, paddingHorizontal: 22, borderRadius: 17, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
});
