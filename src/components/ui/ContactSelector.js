import { people } from '../../data/contacts';
import { Pressable, Text } from 'react-native';
import s from '../../styles/appStyles';
import Avatar from './Avatar';
import Icon from './Icon';
import { colors } from '../../styles/theme';
import React from 'react';
export default function ContactSelector({ contact, onPress }) {
  const selectedPerson = people[contact];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Выбрать контакт сопровождения"
      onPress={onPress}
      style={s.contactSelector}
    >
      <Avatar person={contact} small />
      <Text style={s.contactSelectorLabel}>
        На связи: <Text style={s.medium}>{selectedPerson.name}</Text>
      </Text>
      <Icon name="chevron-right" size={17} color={colors.muted} />
    </Pressable>
  );
}
