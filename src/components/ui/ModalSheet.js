import { useSettings } from '../../context/SettingsContext';
import { Modal, View, Text, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IconButton from './IconButton';
import React from 'react';
export default function ModalSheet({
  visible,
  title,
  onClose,
  fullScreen = false,
  children
}) {
  const {
    appStyles: s,
    t
  } = useSettings();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobile = width < 960;
  if (!visible) return null;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>

      <KeyboardAvoidingView style={[s.modalBackdrop, mobile && s.mobileModalBackdrop, fullScreen && { padding: 0 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalSheet, mobile && s.mobileModalSheet, mobile && { paddingBottom: 20 + insets.bottom }, fullScreen && s.fullScreenSheet]} accessibilityViewIsModal>
          {!fullScreen && mobile && <View style={[s.sheetHandle, { marginBottom: 20 }]} />}
          {!fullScreen && <View style={s.modalHeading}>
            <Text style={s.modalTitle}>{title}</Text>
            <IconButton icon="x" label={t("Закрыть")} onPress={onClose} />
          </View>}
          {fullScreen ? children : <ScrollView style={{
          flexShrink: 1
        }} contentContainerStyle={{ paddingRight: 16, paddingBottom: 4 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {children}
          </ScrollView>}
        </View>
      </KeyboardAvoidingView>
    </Modal>;
}
