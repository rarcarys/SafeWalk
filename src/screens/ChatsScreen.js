import { useSettings } from '../context/SettingsContext';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadChats } from '../services/circle';
import useConversation from '../hooks/useConversation';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import ActionButton from '../components/ui/ActionButton';
import ModalSheet from '../components/ui/ModalSheet';
import { subscribeLive } from '../services/live';
import ContactPresence from '../components/ContactPresence';
function Conversation({
  peer,
  user,
  outbox,
  onBack
}) {
  const {
    appStyles: s,
    colors,
    t,
    locale
  } = useSettings();
  const chat = useConversation(peer.id, outbox);
  const [draft, setDraft] = useState('');
  const [quickMessages, setQuickMessages] = useState(false);
  const [reactionMessage, setReactionMessage] = useState(null);
  const reactingMessage = chat.messages.find(message => message.id === reactionMessage);
  const messageViews = useRef(new Map());
  const [reactionAnchor, setReactionAnchor] = useState(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reactionInsets = useSafeAreaInsets();
  const pickerWidth = Math.min(windowWidth - 24, 330);
  const openReactions = id => {
    messageViews.current.get(id)?.measureInWindow((x, y, width, height) => {
      setReactionAnchor({ x, y, width, height });
      setReactionMessage(id);
    });
  };
  const lastReactionTap = useRef(null);
  const suppressReactionTapUntil = useRef(0);
  const tapMessage = item => {
    const now = Date.now();
    if (now < suppressReactionTapUntil.current || chat.reacting) return;
    const previous = lastReactionTap.current;
    lastReactionTap.current = { id: item.id, at: now };
    if (previous?.id === item.id && now - previous.at < 350) {
      lastReactionTap.current = null;
      if (!item.reactions?.some(reaction => reaction.ownerId === user.id && reaction.emoji === '❤️')) void chat.react(item.id, '❤️');
    }
  };
  const holdMessage = id => {
    lastReactionTap.current = null;
    suppressReactionTapUntil.current = Date.now() + 1000;
    openReactions(id);
  };
  const list = useRef(null);
  const nearBottom = useRef(true);
  const lastId = useRef(null);
  const newest = chat.messages.at(-1);
  useEffect(() => {
    if (newest && newest.id !== lastId.current) {
      if (nearBottom.current || newest.senderId === user.id) list.current?.scrollToOffset({
        offset: 0,
        animated: true
      });
      lastId.current = newest.id;
    }
  }, [newest?.id, user.id]);
  const submit = async () => {
    const text = draft.trim();
    if (!text || chat.sending || chat.loading) return;
    if (await chat.send(text)) setDraft(current => current.trim() === text ? '' : current);
  };
  return <View style={s.chatPage}>
      <View style={s.chatHeader}>
        <IconButton icon="arrow-left" label={t("Все чаты")} onPress={onBack} />
        <Avatar person={peer} small />
        <View style={s.flex}>
          <Text style={s.personName}>{peer.name}</Text>
          {chat.presence ? <ContactPresence presence={chat.presence} /> : <Text style={s.rowSubtitle}>{t("Личная переписка")}</Text>}
        </View>
      </View>
      {!!chat.error && <View style={s.chatError}>
          <Text accessibilityRole="alert" style={[s.mapError, s.flex, {
        marginTop: 0
      }]}>{t(chat.error)}</Text>
          <IconButton icon="refresh-cw" label={t("Повторить загрузку сообщений")} onPress={chat.reconnect} />
        </View>}
      {chat.loading ? <ActivityIndicator style={s.flex} color={colors.blue} /> : <FlatList ref={list} style={s.flex} contentContainerStyle={s.messagesContent} data={[...chat.messages].reverse()} inverted keyExtractor={item => String(item.id)} keyboardShouldPersistTaps="handled" onScroll={event => {
      nearBottom.current = event.nativeEvent.contentOffset.y < 80;
    }} scrollEventThrottle={100} ListEmptyComponent={<Text style={s.chatEmpty}>{t("Напишите первое сообщение")}</Text>} ListFooterComponent={chat.hasOlder ? <ActionButton title={t("Ранние сообщения")} secondary busy={chat.loadingOlder} onPress={chat.loadOlder} /> : null} renderItem={({
      item
    }) => {
      const own = item.senderId === user.id;
      return <Pressable ref={node => { if (node) messageViews.current.set(item.id, node); else messageViews.current.delete(item.id); }} accessibilityRole="button" accessibilityLabel={t('Реакция на сообщение: {text}', { text: item.text })} accessibilityHint={t('Дважды нажмите для сердечка, удерживайте для выбора реакции')} accessibilityActions={[{ name: 'activate', label: t('Реакция на сообщение') }]} onAccessibilityAction={() => openReactions(item.id)} onAccessibilityTap={() => openReactions(item.id)} delayLongPress={450} onLongPress={() => holdMessage(item.id)} onPress={() => tapMessage(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReactions(item.id); } }} style={[s.messageBubble, own ? s.messageOwn : s.messageIncoming, !!item.reactions?.length && { marginBottom: 28 }]}>
                <Text selectable={false} style={[s.messageText, own && s.messageOwnText]}>{item.text}</Text>
                {!!item.reactions?.length && <View style={[s.messageReactionRow, own ? { right: 5 } : { left: 5 }]}>{[...new Set(item.reactions.map(reaction => reaction.emoji))].map(emoji => {
                  const mine = item.reactions.some(reaction => reaction.emoji === emoji && reaction.ownerId === user.id);
                  return <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={t('Реакция {emoji}', { emoji })} accessibilityState={{ selected: mine, disabled: chat.reacting }} disabled={chat.reacting} onPress={event => { event.stopPropagation(); chat.react(item.id, mine ? null : emoji); }} style={[s.messageReaction, mine && s.messageReactionSelected]}><Text style={s.messageReactionText}>{emoji} {item.reactions.filter(reaction => reaction.emoji === emoji).length}</Text></Pressable>;
                })}</View>}
                <View style={s.messageMeta}>
                <Text style={[s.messageTime, own && s.messageOwnTime]}>
                  {new Date(item.sentAt).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short'
          })} ·{' '}
                  {new Date(item.sentAt).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
          })}
                </Text>
                {own && <View accessible accessibilityRole="image" accessibilityLabel={t(item.read ? 'Прочитано' : 'Отправлено')} style={[s.messageChecks, { width: item.read ? 22 : 15 }]}>
                  <Icon name="check" size={15} color="#ffffffc9" />
                  {item.read && <View style={{ position: 'absolute', left: 7, top: 0 }}><Icon name="check" size={15} color="#ffffffc9" /></View>}
                </View>}
                </View>
              </Pressable>;
    }} />}
      <View style={s.chatComposer}>
        <IconButton icon="zap" label={t('Быстрые сообщения')} disabled={chat.sending || chat.loading} onPress={() => setQuickMessages(true)} />
        {outbox?.items.some(item => item.endpoint === `circle/chats/${peer.id}/messages`) && <Text style={s.rowSubtitle}>{t('Сообщения ожидают отправки. Проверьте очередь во вкладке «Маршруты».')}</Text>}
        <TextInput style={s.chatInput} accessibilityLabel={t("Сообщение")} placeholder={t("Сообщение…")} placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} multiline maxLength={2000} editable={!chat.sending} />

        <Pressable accessibilityRole="button" accessibilityLabel={t("Отправить сообщение")} aria-disabled={!draft.trim() || chat.sending || chat.loading} aria-busy={chat.sending} accessibilityState={{
        disabled: !draft.trim() || chat.sending || chat.loading,
        busy: chat.sending
      }} disabled={!draft.trim() || chat.sending || chat.loading} onPress={submit} style={[s.chatSend, (!draft.trim() || chat.sending || chat.loading) && s.pressed]}>

          {chat.sending ? <ActivityIndicator color={colors.white} size="small" /> : <Icon name="send" size={19} color={colors.white} />}
        </Pressable>
      </View>
      <Modal visible={!!reactingMessage && !!reactionAnchor} transparent animationType="fade" onRequestClose={() => { if (!chat.reacting) setReactionMessage(null); }}>
        <View style={{ flex: 1, backgroundColor: '#00000030' }} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Закрыть реакции')} onPress={() => { if (!chat.reacting) setReactionMessage(null); }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <View style={[s.reactionPopover, { width: pickerWidth, left: Math.max(12, Math.min((reactionAnchor?.x || 0) + (reactingMessage?.senderId === user.id ? (reactionAnchor?.width || 0) - pickerWidth : 0), windowWidth - pickerWidth - 12)), top: Math.max(reactionInsets.top + 12, Math.min((reactionAnchor?.y || 0) - 70 > reactionInsets.top ? reactionAnchor.y - 70 : (reactionAnchor?.y || 0) + (reactionAnchor?.height || 0) + 8, windowHeight - reactionInsets.bottom - 110)) }]}>
        <View style={s.reactionPicker}>{['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => {
          const mine = reactingMessage?.reactions?.some(reaction => reaction.ownerId === user.id && reaction.emoji === emoji);
          return <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={t('Реакция {emoji}', { emoji })} accessibilityState={{ selected: !!mine, disabled: chat.reacting }} disabled={chat.reacting} style={[s.reactionChoice, mine && s.messageReactionSelected]} onPress={async () => { if (await chat.react(reactionMessage, mine ? null : emoji)) setReactionMessage(null); }}><Text style={{ fontSize: 26 }}>{emoji}</Text></Pressable>;
        })}</View>
        {!!chat.error && <Text accessibilityRole="alert" style={s.mapError}>{t(chat.error)}</Text>}
        </View></View>
      </Modal>
      <ModalSheet visible={quickMessages} title={t('Быстрые сообщения')} onClose={() => { if (!chat.sending) setQuickMessages(false); }}>
        {['Позвони мне, пожалуйста.', 'Я задерживаюсь. Скоро напишу.', 'Встреть меня, пожалуйста.'].map(text => <Pressable key={text} accessibilityRole="button" accessibilityLabel={t(text)} disabled={chat.sending || chat.loading} onPress={async () => { if (await chat.send(t(text))) setQuickMessages(false); }} style={s.menuAction}><Icon name="send" size={18} color={colors.blue} /><Text style={[s.rowTitle, s.flex]}>{t(text)}</Text></Pressable>)}
        {!!chat.error && <Text role="alert" style={s.mapError}>{t(chat.error)}</Text>}
      </ModalSheet>
    </View>;
}
export default function ChatsScreen({
  user,
  outbox,
  contacts,
  selectedChat,
  onSelectChat,
  onAddContact,
  onLinkContact
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || !active || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      pending = true;
      try {
        const result = await loadChats();
        if (active) {
          setChats(result.chats);
          setError('');
        }
      } catch (failure) {
        if (active) setError(failure.message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    refresh();
    const unsubscribe = subscribeLive(refresh);
    const timer = setInterval(refresh, 5000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
      unsubscribe();
    };
  }, [contacts.people, selectedChat?.id, retry]);
  if (selectedChat) return <Conversation key={selectedChat.id} peer={{ ...selectedChat, avatar: Object.values(contacts.people).find(person => person.peerId === selectedChat.id)?.avatar ?? chats.find(person => person.id === selectedChat.id)?.avatar ?? selectedChat.avatar }} user={user} outbox={outbox} onBack={() => onSelectChat(null)} />;
  return <ScrollView style={s.flex} contentContainerStyle={s.listScrollContent}>
      <View style={s.listPage}>
        <View style={s.listHeading}>
          <Text style={s.pageTitle}>{t("Чаты")}</Text>
          <IconButton icon="edit" label={t("Начать переписку")} onPress={onAddContact} />
        </View>
        <Text style={s.pageDescription}>{t("Оставайтесь на связи с теми, кому доверяете")}</Text>
        {!!error && <><Text accessibilityRole="alert" style={s.mapError}>{t(error)}</Text><ActionButton title={t("Повторить")} secondary onPress={() => setRetry(value => value + 1)} /></>}
        {loading && <ActivityIndicator color={colors.blue} />}
        <View style={s.peopleList}>
          {chats.map(peer => {
          const person = Object.values(contacts.people).find(item => item.peerId === peer.id);
          const display = {
            ...peer,
            name: person?.name || peer.name,
            background: person?.background,
            foreground: person?.foreground
          };
          return <Pressable key={peer.id} accessibilityRole="button" accessibilityLabel={t("Чат: {value0}", {
            value0: display.name
          })} onPress={() => onSelectChat(display)} style={s.personRow}>
                <Avatar person={display} />
                <View style={s.flex}>
                  <Text style={s.personName}>{display.name}</Text>
                  <ContactPresence presence={peer.presence} />
                  <Text numberOfLines={1} style={s.rowSubtitle}>{peer.lastMessage ? `${peer.lastMessage.senderId === user.id ? t("Вы: ") : ''}${peer.lastMessage.text}` : t("Начать переписку")}</Text>
                </View>
                {peer.unreadCount > 0 && <Text style={s.unreadBadge}>{peer.unreadCount > 99 ? '99+' : peer.unreadCount}</Text>}
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>;
        })}
        </View>
        {!loading && !error && !chats.length && <Text style={s.listFootnote}>{t("Добавьте контакт по email аккаунта SafeWalk или укажите email в карточке существующего контакта.")}</Text>}
        {Object.entries(contacts.people).filter(([, person]) => !person.peerId).map(([id, person]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={t("Указать email: {value0}", {
        value0: person.name
      })} onPress={() => onLinkContact(id)} style={s.personRow}>
            <Avatar person={person} />
            <View style={s.flex}><Text style={s.personName}>{person.name}</Text><Text style={s.rowSubtitle}>{t("Указать email для переписки")}</Text></View>
            <Icon name="plus" size={18} color={colors.muted} />
          </Pressable>)}
      </View>
    </ScrollView>;
}
