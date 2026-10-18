import { useSettings } from '../../context/SettingsContext';
import { people } from '../../data/contacts';
import { Pressable, Text } from 'react-native';
import Avatar from './Avatar';
import Icon from './Icon';
import React from 'react';
export default function ContactSelector({
  contact,
  onPress
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const selectedPerson = typeof contact === 'object' ? contact : people[contact];
  return <Pressable accessibilityRole="button" accessibilityLabel={t("Выбрать контакт сопровождения")} onPress={onPress} style={s.contactSelector}>

      {selectedPerson?.name ? <Avatar person={contact} small /> : <Icon name="user-plus" size={21} color={colors.blue} />}
      <Text style={s.contactSelectorLabel}>
        {selectedPerson?.name ? <>{t('Контакт сопровождения') + ': '}<Text style={s.medium}>{selectedPerson.name}</Text></> : t("Добавить контакт сопровождения")}
        {selectedPerson?.backupCount > 0 && t(" · резерв: {value0}", {
        value0: selectedPerson.backupCount
      })}
      </Text>
      <Icon name="chevron-right" size={17} color={colors.muted} />
    </Pressable>;
}
