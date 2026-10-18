import React, { useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import Avatar from './ui/Avatar';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import Icon from './ui/Icon';
import presets from '../data/avatars.json';
import { pickAvatar } from '../services/avatarImage';
import { updateAvatar } from '../services/auth';
const names = { sun: 'Солнце', moon: 'Луна', star: 'Звезда', heart: 'Сердце', coffee: 'Кофе', feather: 'Перо', music: 'Музыка', smile: 'Улыбка' };

export default function AvatarEditor({ user, onUpdateUser }) {
  const { appStyles: s, colors, t } = useSettings();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  const begin = () => { setDraft(user.avatar || null); setError(''); setOpen(true); };
  const upload = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const photo = await pickAvatar(); if (photo) setDraft(photo); }
    catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  };
  const save = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const result = await updateAvatar(draft); onUpdateUser(result.user); setOpen(false); }
    catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  };
  return <>
    <View style={s.avatarEditButton}>
      <Avatar person={user} large />
      <Pressable accessibilityRole="button" accessibilityLabel={t('Изменить аватар')} onPress={begin} style={{ position: 'absolute', right: -9, bottom: -9, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><View style={[s.avatarEditBadge, { position: 'relative' }]}><Icon name="camera" size={14} color={colors.white} /></View></Pressable>
    </View>
    <ModalSheet visible={open} title={t('Аватар профиля')} onClose={() => { if (!busy) setOpen(false); }}>
      <View style={s.avatarPreview}>
        <View style={{ position: 'relative', paddingHorizontal: 18 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Загрузить фото')} disabled={busy} accessibilityState={{ disabled: busy }} onPress={upload} style={[s.avatarEditButton, busy && { opacity: 0.5 }]}>
            <Avatar person={{ ...user, avatar: draft }} large zoomable={false} />
            <View style={s.avatarEditBadge}><Icon name="camera" size={14} color={colors.white} /></View>
          </Pressable>
          {draft !== null && <Pressable accessibilityRole="button" accessibilityLabel={t('Убрать аватар')} disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => setDraft(null)} style={{ position: 'absolute', right: -12, top: -12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}><View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}><Icon name="x" size={13} color={colors.muted} /></View></Pressable>}
        </View>
        <Text style={s.rowSubtitle}>{t('Нажмите на фото, чтобы заменить')}</Text>
      </View>
      <View style={s.avatarOptions}>{presets.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t('Аватар: {name}', { name: t(names[item.id]) })} accessibilityState={{ selected: draft === `preset:${item.id}`, disabled: busy }} disabled={busy} onPress={() => setDraft(`preset:${item.id}`)} style={[s.avatarOption, draft === `preset:${item.id}` && { borderColor: colors.blue, backgroundColor: colors.selected }]}><Avatar person={{ avatar: `preset:${item.id}` }} zoomable={false} />{draft === `preset:${item.id}` && <View style={s.avatarSelected}><Icon name="check" size={12} color={colors.white} /></View>}</Pressable>)}</View>
      {!!error && <Text accessibilityRole="alert" style={s.mapError}>{t(error)}</Text>}
      <ActionButton title={t('Сохранить аватар')} busy={busy} onPress={save} />
    </ModalSheet>
  </>;
}
