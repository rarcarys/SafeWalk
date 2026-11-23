import { useSettings } from '../context/SettingsContext';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import IconButton from '../components/ui/IconButton';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import ActionButton from '../components/ui/ActionButton';
import React, { useState } from 'react';
export default function ContactsScreen({
  contacts,
  onAddContact,
  onSelectContact,
  onChooseContacts
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const {
    people,
    contact,
    backupIds,
    loading,
    error,
    reload
  } = contacts;
  const [actionError, setActionError] = useState('');
  const act = operation => { setActionError(''); operation().catch(failure => setActionError(failure.message)); };
  return <View style={s.listPage}>
      <View style={s.listHeading}>
        <Text style={s.pageTitle}>{t("Контакты")}</Text>
        <IconButton icon="user-plus" label={t("Добавить контакт")} onPress={onAddContact} />

      </View>
      {!!actionError && <Text role="alert" style={s.mapError}>{t(actionError)}</Text>}
      {!!contacts.invitations.length && <View style={s.invitationHeading}><Text style={s.groupLabel}>{t('Приглашает в контакты')}</Text><View style={s.invitationCount}><Text style={s.invitationCountText}>{contacts.invitations.length}</Text></View></View>}
      {contacts.invitations.map(item => <View key={item.peerId} style={s.invitationCard}>
        <View style={s.invitationIdentity}>
          <Avatar person={item} />
          <View style={s.flex}><Text style={s.invitationName}>{item.name}</Text><Text style={s.invitationEmail} numberOfLines={2}>{item.email}</Text></View>
          <View style={s.invitationIcon}><Icon name="user-plus" size={17} color={colors.selectedText} /></View>
        </View>
        <View style={s.invitationActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Отклонить')} accessibilityState={{ disabled: contacts.busy }} disabled={contacts.busy} onPress={() => act(() => contacts.respondInvitation(item.peerId, 'declined'))} style={({ pressed }) => [s.invitationDecline, pressed && s.pressed, contacts.busy && { opacity: 0.5 }]}><Text style={s.invitationDeclineText}>{t('Отклонить')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Принять')} accessibilityState={{ disabled: contacts.busy }} disabled={contacts.busy} onPress={() => act(() => contacts.respondInvitation(item.peerId, 'accepted'))} style={({ pressed }) => [s.invitationAccept, pressed && s.pressed, contacts.busy && { opacity: 0.5 }]}><Icon name="check" size={17} color={colors.white} /><Text style={s.invitationAcceptText}>{t('Принять')}</Text></Pressable>
        </View>
      </View>)}
      {contacts.blockedPeople.map(item => <View key={item.peerId} style={s.journeyCard}><Text style={s.rowTitle}>{item.name} · {t('Заблокирован')}</Text><ActionButton title={t('Разблокировать')} secondary disabled={contacts.busy} onPress={() => act(() => contacts.unblockPerson(item.peerId))} /></View>)}
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!error && <><Text accessibilityRole="alert" style={s.mapError}>{t(error)}</Text><ActionButton title={t("Повторить загрузку")} secondary onPress={reload} /></>}
      {!loading && !error && !Object.keys(people).length && <View style={s.emptyCard}>
        <Icon name="users" size={32} color={colors.blue} />
        <Text style={s.cardTitle}>{t("Пока никого нет")}</Text>
        <ActionButton title={t("Добавить контакт")} icon="user-plus" onPress={onAddContact} />
      </View>}
      <View style={s.peopleList}>
        {Object.keys(people).map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={t("Контакт {value0}", {
        value0: people[id].name
      })} onPress={() => onSelectContact(id)} style={s.personRow}>

            <Avatar person={people[id]} />
            <View style={s.flex}>
              <Text style={s.personName}>{people[id].name}</Text>
              <Text style={s.rowSubtitle}>{contact === id ? t('Основной для SOS') : backupIds.includes(id) ? t('Получает SOS') : people[id].peerId ? t(({ accepted: 'В SafeWalk', pending: 'Ожидает принятия', declined: 'Приглашение отклонено', blocked: 'Заблокирован' })[people[id].connectionStatus] || 'Ожидает принятия') : t('Только звонок')}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>)}
      </View>
      {!!Object.keys(people).length && <ActionButton title={t('Настроить SOS')} icon="users" secondary onPress={onChooseContacts} />}
    </View>;
}
