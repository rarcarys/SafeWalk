import { useSettings } from '../context/SettingsContext';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import IconButton from '../components/ui/IconButton';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import ActionButton from '../components/ui/ActionButton';
import React, { useState } from 'react';
import ContactPresence from '../components/ContactPresence';
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
      <Text style={s.pageDescription}>{t("Контакты для сопровождения и SOS")}</Text>
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
        <Text style={s.cardTitle}>{t("Соберите свой круг")}</Text>
        <Text style={s.rowSubtitle}>{t("Добавьте человека по email SafeWalk для чата и сопровождения или сохраните телефон для быстрого звонка.")}</Text>
        <ActionButton title={t("Добавить контакт")} icon="user-plus" onPress={onAddContact} />
      </View>}
      <View style={s.peopleList}>
        {Object.keys(people).map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={t("Контакт {value0}", {
        value0: people[id].name
      })} onPress={() => onSelectContact(id)} style={s.personRow}>

            <Avatar person={people[id]} />
            <View style={s.flex}>
              <Text style={s.personName}>{people[id].name}</Text>
              <ContactPresence presence={people[id].presence} />
              <Text style={s.rowSubtitle}>{[people[id].relation, people[id].peerId ? t(({ accepted: 'В SafeWalk', pending: 'Ожидает принятия', declined: 'Приглашение отклонено', blocked: 'Заблокирован' })[people[id].connectionStatus] || 'Ожидает принятия') : people[id].phone].filter(Boolean).join(' · ')}</Text>
            </View>
            {contact === id && <Text style={s.primaryContactLabel}>{t("Основной")}</Text>}
            {backupIds.includes(id) && <Text style={s.backupContactLabel}>{t("Резервный")}</Text>}
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>)}
      </View>
      {!!Object.keys(people).length && <ActionButton title={t("Резервные контакты · {value0}", {
      value0: backupIds.length
    })} icon="users" secondary onPress={onChooseContacts} />}
      <Text style={s.listFootnote}>{t("Сообщения при задержке приходят в чаты SafeWalk. Телефонные контакты доступны для звонка вручную.")}

      </Text>
      <Text style={[s.groupLabel, {
      marginTop: 35
    }]}>{t("ДОСТУП К ГЕОПОЗИЦИИ")}


      </Text>
      <View style={s.simpleRow}>
        <Icon name="map-pin" size={18} color={colors.muted} />
        <Text style={[s.rowTitle, s.flex]}>{t("Только во время маршрута")}</Text>
        <Icon name="check" size={18} />
      </View>
    </View>;
}
