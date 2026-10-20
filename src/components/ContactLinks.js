import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useSettings } from '../context/SettingsContext';
import { request } from '../services/api';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import Icon from './ui/Icon';
import IconButton from './ui/IconButton';

const extractToken = value => {
  const text = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) return text;
  return text.match(/[#?&]invite=([A-Za-z0-9_-]{43})(?:[&#]|$)/)?.[1] || '';
};
function invitationURL(token) {
  const base = process.env.EXPO_PUBLIC_APP_URL || (Platform.OS === 'web' ? window.location.origin : `http://${Constants.expoConfig?.hostUri || 'localhost:8081'}`);
  return `${base.replace(/\/$/, '')}/#invite=${token}`;
}

export default function ContactLinks({ dialogs, contacts }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const { dialog, setDialog } = dialogs;
  const [links, setLinks] = useState([]), [created, setCreated] = useState(null);
  const [value, setValue] = useState(''), [preview, setPreview] = useState(null);
  const [receiving, setReceiving] = useState(false), [manage, setManage] = useState(false), [showURL, setShowURL] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const lock = useRef(false), mounted = useRef(true);
  const reload = async () => { const result = await request('circle/links'); if (mounted.current) setLinks(result.links); };
  const run = async operation => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setFeedback('');
    try { await operation(); } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => {
    mounted.current = true;
    const open = url => {
      const token = extractToken(url || '');
      if (token && mounted.current) { setValue(token); setPreview(null); setReceiving(true); setDialog('contactLinks'); }
    };
    if (Platform.OS === 'web') open(window.location.href);
    else Linking.getInitialURL().then(open).catch(() => {});
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => { mounted.current = false; subscription.remove(); };
  }, []);
  useEffect(() => { if (dialog === 'contactLinks') { setError(''); setFeedback(''); reload().catch(failure => setError(failure.message)); } }, [dialog]);
  const close = () => {
    if (lock.current) return;
    if (Platform.OS === 'web' && window.location.hash.startsWith('#invite=')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setDialog(null);
  };
  const token = extractToken(value);
  const activeLink = created && links.some(item => item.id === created.id) ? created : null;
  const revoke = id => run(async () => { await request(`circle/links/${id}`, { method: 'DELETE', body: {} }); await reload(); });
  const share = () => run(async () => {
    if (Platform.OS === 'web' && navigator.share) await navigator.share({ title: 'SafeWalk', url: activeLink.url });
    else if (Platform.OS === 'web' && navigator.clipboard) { await navigator.clipboard.writeText(activeLink.url); setFeedback('Ссылка скопирована'); }
    else if (Platform.OS === 'web') { setShowURL(true); setFeedback('Скопируйте ссылку выше'); }
    else await Share.share({ message: activeLink.url });
  });
  return <ModalSheet visible={dialog === 'contactLinks'} title={t('Приглашение по ссылке')} onClose={close}>
    {!receiving ? <>
    <View style={s.linkInviteIntro}>
      <View style={s.linkInviteHeroIcon}><Icon name="user-plus" size={26} color={colors.blue} /></View>
      <Text style={s.linkInviteTitle}>{t('Пригласите близкого')}</Text>
      <Text style={s.linkInviteDescription}>{t('Отправьте ссылку, чтобы общаться и сопровождать друг друга в поездках.')}</Text>
    </View>
    {activeLink ? <View style={s.linkInviteCard}>
      <View style={s.linkInviteCardHeading}>
        <View style={s.linkInviteSmallIcon}><Icon name="link" size={20} color={colors.blue} /></View>
        <View style={s.flex}><Text style={s.rowTitle}>{t('Приглашение готово')}</Text><Text style={s.linkInviteMeta}>{t('Действует до {time}', { time: new Date(activeLink.expiresAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</Text></View>
        <IconButton icon="x" label={t('Отозвать приглашение')} disabled={busy} onPress={() => revoke(activeLink.id)} />
      </View>
      <ActionButton title={t('Поделиться ссылкой')} icon="share-2" busy={busy} onPress={share} />
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showURL }} disabled={busy} onPress={() => setShowURL(current => !current)} style={s.linkInviteTextAction}><Text style={s.linkInviteActionText}>{t(showURL ? 'Скрыть ссылку' : 'Показать ссылку')}</Text></Pressable>
      {showURL && <Text selectable style={s.linkInviteURL}>{activeLink.url}</Text>}
    </View> : <ActionButton title={t('Создать приглашение')} icon="link" busy={busy} onPress={() => run(async () => {
      const result = await request('circle/links', { method: 'POST', body: {} });
      setCreated({ ...result.link, url: invitationURL(result.link.token) }); setShowURL(false); await reload();
    })} />}
    <View style={s.linkInviteHint}><Icon name="clock" size={14} color={colors.muted} /><Text style={s.linkInviteHintText}>{t('На 24 часа · для одного человека')}</Text></View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setReceiving(true); setPreview(null); setError(''); setFeedback(''); }} style={s.linkInviteReceiveAction}><Icon name="log-in" size={18} color={colors.ink} /><Text style={[s.rowTitle, s.flex]}>{t('У меня есть приглашение')}</Text><Icon name="chevron-right" size={17} color={colors.muted} /></Pressable>
    {!!links.filter(item => item.id !== activeLink?.id).length && <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: manage }} onPress={() => setManage(current => !current)} style={s.linkInviteTextAction}><Text style={s.linkInviteMeta}>{t('Другие приглашения')} · {links.filter(item => item.id !== activeLink?.id).length}</Text><Icon name={manage ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} /></Pressable>
      {manage && links.filter(item => item.id !== activeLink?.id).map(item => <View key={item.id} style={s.linkInviteCardHeading}><Text style={[s.linkInviteMeta, s.flex]}>{new Date(item.expiresAt).toLocaleString(locale)}</Text><IconButton icon="x" label={t('Отозвать приглашение')} disabled={busy} onPress={() => revoke(item.id)} /></View>)}
    </>}
    </> : <>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setReceiving(false); setError(''); setFeedback(''); }} style={s.linkInviteBack}><Icon name="arrow-left" size={16} color={colors.muted} /><Text style={s.linkInviteMeta}>{t('Назад')}</Text></Pressable>
    {!preview ? <>
    <View style={s.linkInviteIntro}><View style={s.linkInviteHeroIcon}><Icon name="link" size={26} color={colors.blue} /></View><Text style={s.linkInviteTitle}>{t('Вам прислали приглашение?')}</Text><Text style={s.linkInviteDescription}>{t('Вставьте ссылку — мы покажем, кто вас приглашает.')}</Text></View>
    <TextInput accessibilityLabel={t('Ссылка приглашения')} placeholder={t('Вставьте ссылку приглашения')} placeholderTextColor={colors.muted} style={s.contactInput} value={value} onChangeText={text => { setValue(text); setPreview(null); setError(''); }} autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={2048} />
    <ActionButton title={t('Проверить приглашение')} disabled={!token || busy} busy={busy} onPress={() => run(async () => { const result = await request('circle/links/preview', { method: 'POST', body: { token } }); setPreview(result.invitation); })} />
    </> : <View style={s.linkInviteIntro}>
      <View style={s.linkInviteHeroIcon}><Text style={s.linkInviteInitial}>{Array.from(preview.name)[0]?.toUpperCase()}</Text></View>
      <Text style={s.linkInviteTitle}>{preview.name}</Text>
      <Text style={s.linkInviteDescription}>{t(preview.self ? 'Это ваше приглашение. Отправьте его близкому.' : 'Добавить этого человека в доверенные контакты? Вы сможете общаться и выбирать друг друга для сопровождения.')}</Text>
      {!preview.self && <ActionButton title={t('Принять и добавить контакт')} icon="user-plus" busy={busy} onPress={() => run(async () => {
        await request('circle/links/accept', { method: 'POST', body: { token } });
        await contacts.reload(); setPreview(null); setValue(''); setReceiving(false); setFeedback('Контакт добавлен');
        if (Platform.OS === 'web' && window.location.hash.startsWith('#invite=')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
      })} />}
    </View>}
    </>}
    {!!error && <Text role="alert" style={s.mapError}>{t(error)}</Text>}
    {!!feedback && <Text accessibilityLiveRegion="polite" style={s.blueText}>{t(feedback)}</Text>}
  </ModalSheet>;
}
