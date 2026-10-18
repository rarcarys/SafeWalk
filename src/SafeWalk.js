import { useSettings } from './context/SettingsContext';
import { useWindowDimensions, KeyboardAvoidingView, Platform, View, ScrollView, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useJourney from './hooks/useJourney';
import { StatusBar } from 'expo-status-bar';
import { Sidebar, AppHeader, BottomNavigation } from './navigation/AppNavigation';
import MapScreen from './screens/MapScreen';
import ContactsScreen from './screens/ContactsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChatsScreen from './screens/ChatsScreen';
import JourneysScreen from './screens/JourneysScreen';
import IconButton from './components/ui/IconButton';
import JourneyDialogs from './components/JourneyDialogs';
import React, { useState } from 'react';
import useLive from './hooks/useLive';
import { listenNotification, setVisibleConversation } from './services/device';
import useMessageNotifications from './hooks/useMessageNotifications';
import Icon from './components/ui/Icon';
import { useEffect } from 'react';
import useActionSOS from './hooks/useActionSOS';
import useSafetyTools from './hooks/useSafetyTools';
import SafetyTools from './components/SafetyTools';
import TripConnectionStatus from './components/TripConnectionStatus';
import usePresence from './hooks/usePresence';
export default function SafeWalk({
  user,
  onUpdateUser,
  onDeleted,
  onSignOut
}) {
  const {
    appStyles: s,
    isDark,
    t
  } = useSettings();
  const {
    width
  } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 960;
  const connected = useLive();
  usePresence(user.id);
  const {
    planning,
    trip,
    contacts,
    preferences,
    navigation,
    dialogs,
    notifications,
    account
  } = useJourney(user.id);
  const safety = useSafetyTools(user.id);
  const {
    page,
    go,
    scroll
  } = navigation;
  const {
    setDialog
  } = dialogs;
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const sharedJourney = account.received.find(item => item.id === selectedJourney);
  useActionSOS({ ownerId: user.id, account, notify: notifications.notify, setDialog, t });
  useEffect(() => listenNotification(data => {
    if (data.ownerId && data.ownerId !== user.id) return;
    if (data.safetyTimer) { safety.refresh(); setDialog('safetyCheckin'); }
    if (['route', 'chats', 'contacts'].includes(data.page)) go(data.page);
    if (data.page === 'chats' && data.peerId) {
      const person = Object.values(contacts.people).find(item => item.peerId === data.peerId);
      setSelectedChat({ ...person, id: data.peerId, name: person?.name || t('Контакт') });
      setDialog(null);
    }
    account.refresh();
  }), [user.id, contacts.people]);
  const openChat = person => {
    setSelectedChat({
      ...person,
      id: person.peerId
    });
    setDialog(null);
    go('chats');
  };
  const visiblePeerId = page === 'chats' && !dialogs.dialog ? selectedChat?.id : null;
  const messageAlerts = useMessageNotifications({ ownerId: user.id, visiblePeerId, onOpen: message => {
    const person = Object.values(contacts.people).find(item => item.peerId === message.senderId);
    openChat({ ...person, peerId: message.senderId, name: person?.name || message.senderName });
  } });
  useEffect(() => { setVisibleConversation(visiblePeerId); return () => setVisibleConversation(null); }, [visiblePeerId]);
  const inspectContact = id => {
    contacts.setInspectedContact(id);
    setDialog('person');
  };
  return <KeyboardAvoidingView style={[s.root, {
    paddingTop: insets.top
  }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafetyTools safety={safety} contacts={contacts} account={account} planning={planning} trip={trip} dialogs={dialogs} notify={notifications.notify} />
      <View style={s.shell}>
        {desktop && <Sidebar page={page} go={go} user={user} unreadCount={account.unreadCount} />}
        <View style={s.main}>
          <AppHeader desktop={desktop} origin={planning.origin} onOpenSOS={() => setDialog('sos')} onOpenProfile={() => go('profile')} />
          <TripConnectionStatus trip={trip} connected={connected} />
          {!connected && <View style={s.accountNotice}><Text accessibilityLiveRegion="polite" style={s.accountNoticeText}>{t('Связь с сервером восстанавливается. Данные могут быть устаревшими.')}</Text></View>}
          {account.active?.status === 'pending' && <View style={s.accountNotice}><Text style={s.accountNoticeText}>{t('Ожидаем согласия основного сопровождающего. Прогулка ещё не началась.')}</Text><IconButton icon="navigation" label={t('Маршруты')} onPress={() => go('route')} /></View>}
          {!!account.outbox.items.length && <View style={s.accountNotice}><Text style={s.accountNoticeText}>{t('Неотправленных действий: {count}', { count: account.outbox.items.length })}</Text><IconButton icon="clock" label={t('Посмотреть очередь')} onPress={() => go('route')} /></View>}

          {(account.loading || !!account.error) && <View style={s.accountNotice}>
            <Text role={account.error ? 'alert' : 'status'} style={s.accountNoticeText}>{account.loading ? t("Загружаем поездки и настройки…") : account.error}</Text>
            {!!account.error && <IconButton icon="refresh-cw" label={t("Обновить данные аккаунта")} onPress={account.refresh} />}
          </View>}
          {page === 'home' ? <MapScreen planning={planning} trip={trip} contact={{
          ...contacts.people[contacts.contact],
          backupCount: contacts.backupIds.length
        }} sharing={preferences.sharing} dialogs={dialogs} navigation={navigation} desktop={desktop} /> : page === 'chats' ? <ChatsScreen user={user} outbox={account.outbox} contacts={contacts} selectedChat={selectedChat} onSelectChat={setSelectedChat} onAddContact={() => setDialog('addContact')} onLinkContact={inspectContact} /> : <ScrollView ref={scroll} style={s.flex} contentContainerStyle={[s.listScrollContent, ['settings', 'profile'].includes(page) && s.settingsScrollContent]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {page === 'route' ? <JourneysScreen account={account} trip={trip} onOpenMap={() => go('home')} onCancel={() => setDialog('cancelJourney')} onRepeat={point => {
            planning.selectTarget(point);
            go('home');
          }} onSelectReceived={id => {
            setSelectedJourney(id);
            setDialog('sharedJourney');
          }} /> : page === 'contacts' ? <ContactsScreen contacts={contacts} onAddContact={() => setDialog('addContact')} onSelectContact={inspectContact} onChooseContacts={() => setDialog('contact')} /> : page === 'settings' ? <SettingsScreen user={user} active={account.active} contact={contacts.contact} people={contacts.people} backupIds={contacts.backupIds} onChooseContacts={() => setDialog('contact')} onRetry={account.refresh} {...preferences} onOpenProfile={() => go('profile')} /> : <ProfileScreen user={user} onUpdateUser={onUpdateUser} onDeleted={onDeleted} onChoosePlaces={() => setDialog('places')} places={account.places} onRetry={account.refresh} error={t(account.error)} onOpenSettings={() => go('settings')} onRequestSignOut={() => setDialog('logout')} />}
            </ScrollView>}
        </View>
      </View>
      {!desktop && <BottomNavigation page={page} go={go} bottomInset={insets.bottom} unreadCount={account.unreadCount} />}
      {!!messageAlerts.message && !dialogs.dialog && <View style={[s.messageAlert, { top: insets.top + 66, maxWidth: Math.min(width - 24, 440) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Открыть сообщение от {name}', { name: messageAlerts.message.senderName })} onPress={messageAlerts.open} style={s.messageAlertOpen}>
          <View style={s.messageAlertIcon}><Icon name="message-circle" size={20} /></View>
          <View style={s.flex}><Text style={s.rowTitle} numberOfLines={1}>{messageAlerts.message.senderName}</Text><Text style={s.rowSubtitle} numberOfLines={2}>{messageAlerts.message.text}</Text></View>
        </Pressable>
        <IconButton icon="x" label={t('Скрыть уведомление')} onPress={messageAlerts.dismiss} />
      </View>}
      {!!notifications.toast && <View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.toast, {
      bottom: desktop ? 24 : 80 + insets.bottom
    }]}>

          <Text style={s.toastText}>{t(notifications.toast)}</Text>
        </View>}
      <JourneyDialogs dialogs={dialogs} planning={planning} trip={trip} contacts={contacts} notifications={notifications} onSignOut={onSignOut} onOpenChat={openChat} account={account} sharedJourney={sharedJourney} onOpenMap={() => {
      setDialog(null);
      go('home');
    }} />

    </KeyboardAvoidingView>;
}
