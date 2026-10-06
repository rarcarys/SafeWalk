import { people } from '../data/contacts';
import { View, Text, Pressable } from 'react-native';
import s from '../styles/appStyles';
import Avatar from '../components/ui/Avatar';
import SettingRow from '../components/ui/SettingRow';
import Icon from '../components/ui/Icon';
import { colors } from '../styles/theme';
import React from 'react';
export default function ProfileScreen({
  user,
  contact,
  sharing,
  setSharing,
  reminder,
  setReminder,
  scenario,
  setScenario,
  onRequestSignOut,
}) {
  const selectedPerson = people[contact];
  return (
    <View style={s.listPage}>
      <Text style={s.pageTitle}>Профиль</Text>
      <View style={s.profileRow}>
        <Avatar
          person="renata"
          large
          initial={Array.from(user.name)[0]?.toUpperCase()}
        />
        <View style={s.flex}>
          <Text style={s.profileName}>{user.name}</Text>
          <Text style={s.rowSubtitle}>{user.email}</Text>
        </View>
      </View>
      <Text style={s.groupLabel}>ГЕОПОЗИЦИЯ И УВЕДОМЛЕНИЯ</Text>
      <SettingRow
        title="Делиться геопозицией"
        description="С выбранным контактом на время пути"
        value={sharing}
        onValueChange={setSharing}
      />
      <SettingRow
        title="Напоминать о прибытии"
        value={reminder}
        onValueChange={setReminder}
      />
      <Text
        style={[
          s.groupLabel,
          {
            marginTop: 32,
          },
        ]}
      >
        ЕСЛИ ПРИБЫТИЕ НЕ ПОДТВЕРЖДЕНО
      </Text>
      <View style={s.scenarioRow}>
        <Text style={s.scenarioTime}>Сразу</Text>
        <View style={s.flex}>
          <Text style={s.rowTitle}>Напоминание мне</Text>
          <Text style={s.rowSubtitle}>В запланированное время прибытия</Text>
        </View>
      </View>
      <View style={s.scenarioRow}>
        <Text style={s.scenarioTime}>5 мин</Text>
        <View style={s.flex}>
          <Text style={s.rowTitle}>Сообщение близкому</Text>
          <Text style={s.rowSubtitle}>
            Основной контакт: {selectedPerson.name}
          </Text>
        </View>
      </View>
      <View style={s.scenarioRow}>
        <Text style={s.scenarioTime}>10 мин</Text>
        <View style={s.flex}>
          <Text style={s.rowTitle}>Резервный контакт</Text>
          <Text style={s.rowSubtitle}>
            {contact === 'dana' ? 'Мама' : 'Дана'}
          </Text>
        </View>
      </View>
      <SettingRow
        title="Сценарий связи"
        value={scenario}
        onValueChange={setScenario}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Выйти из аккаунта"
        onPress={onRequestSignOut}
        style={s.logoutButton}
      >
        <Icon name="log-out" size={18} color={colors.red} />
        <Text style={s.logoutLabel}>Выйти из аккаунта</Text>
      </Pressable>
      <Text style={s.version}>SafeWalk 1.0</Text>
    </View>
  );
}
