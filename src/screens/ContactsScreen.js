import { View, Text, Pressable } from 'react-native';
import s from '../styles/appStyles';
import IconButton from '../components/ui/IconButton';
import { people } from '../data/contacts';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import { colors } from '../styles/theme';
import React from 'react';
export default function ContactsScreen({
  contact,
  onAddContact,
  onSelectContact,
}) {
  return (
    <View style={s.listPage}>
      <View style={s.listHeading}>
        <Text style={s.pageTitle}>Близкие</Text>
        <IconButton
          icon="user-plus"
          label="Добавить близкого"
          onPress={onAddContact}
        />
      </View>
      <Text style={s.pageDescription}>Контакты для сопровождения и SOS</Text>
      <View style={s.peopleList}>
        {['dana', 'mom'].map((id) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`Контакт ${people[id].name}`}
            onPress={() => onSelectContact(id)}
            style={s.personRow}
          >
            <Avatar person={id} />
            <View style={s.flex}>
              <Text style={s.personName}>{people[id].name}</Text>
              <Text style={s.rowSubtitle}>{people[id].relation}</Text>
            </View>
            {contact === id && (
              <Text style={s.primaryContactLabel}>Основной</Text>
            )}
            <Icon name="chevron-right" size={18} color="#b5b5ba" />
          </Pressable>
        ))}
      </View>
      <Text style={s.listFootnote}>
        Основной контакт получает сообщение первым.{'\n'}Остальные — если ответа
        нет ещё 5 минут.
      </Text>
      <Text
        style={[
          s.groupLabel,
          {
            marginTop: 35,
          },
        ]}
      >
        ДОСТУП К ГЕОПОЗИЦИИ
      </Text>
      <View style={s.simpleRow}>
        <Icon name="map-pin" size={18} color={colors.muted} />
        <Text style={[s.rowTitle, s.flex]}>Только во время маршрута</Text>
        <Icon name="check" size={18} />
      </View>
    </View>
  );
}
