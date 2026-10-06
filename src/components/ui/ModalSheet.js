import { Modal, View, Text } from 'react-native';
import s from '../../styles/appStyles';
import IconButton from './IconButton';
import React from 'react';
export default function ModalSheet({ visible, title, onClose, children }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.modalBackdrop}>
        <View style={s.modalSheet} accessibilityViewIsModal>
          <View style={s.modalHeading}>
            <Text style={s.modalTitle}>{title}</Text>
            <IconButton icon="x" label="Закрыть" onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
