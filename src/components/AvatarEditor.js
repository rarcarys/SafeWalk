import React, { useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photoInfo, setPhotoInfo] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const locked = useRef(false);

  const begin = () => {
    setDraft(user.avatar || null);
    setError('');
    setPhotoInfo(null);
    setShowSettings(false);
    setOpen(true);
  };

  const upload = async (source) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setShowSettings(false);
    try {
      const photo = await pickAvatar(source);
      if (photo) {
        setDraft(photo.uri);
        setPhotoInfo(photo);
      }
    } catch (failure) {
      setError(failure.message);
      setShowSettings(Boolean(failure.canOpenSettings));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const save = async (avatar = draft) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await updateAvatar(avatar);
      onUpdateUser(result.user);
      setOpen(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const removeAvatar = () => {
    if (locked.current) return;
    if (user.avatar) {
      void save(null);
    } else {
      setDraft(null);
      setPhotoInfo(null);
    }
  };
  const confirmRemove = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('Удалить аватар профиля? Исходное фото в галерее останется.'))) removeAvatar();
      return;
    }
    Alert.alert(t('Удалить аватар профиля?'), t('Исходное фото в галерее останется.'), [
      { text: t('Отмена'), style: 'cancel' },
      { text: t('Удалить'), style: 'destructive', onPress: removeAvatar },
    ]);
  };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Изменить аватар')} onPress={begin} style={s.avatarEditButton}>
      <Avatar person={user} large zoomable={false} />
      <View style={s.avatarEditBadge}><Icon name="camera" size={14} color={colors.white} /></View>
    </Pressable>
    <ModalSheet visible={open} title={t('Аватар профиля')} onClose={() => { if (!busy) setOpen(false); }}>
      <View style={s.avatarPreview}>
        <Avatar person={{ ...user, avatar: draft }} large zoomable={false} />
        {photoInfo && <Text style={s.rowSubtitle}>{photoInfo.width} × {photoInfo.height}{typeof photoInfo.fileSize === 'number' ? ` · ${(photoInfo.fileSize / 1024 / 1024).toFixed(2)} МБ` : ` · ${t('Размер файла неизвестен')}`}</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 20 }}>
        {[['gallery', 'image', 'Галерея'], ['camera', 'camera', 'Камера']].map(([source, icon, label]) => <Pressable key={source} accessibilityRole="button" accessibilityLabel={t(label)} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => upload(source)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 14, backgroundColor: colors.control, opacity: busy || pressed ? 0.5 : 1 })}>
          <Icon name={icon} size={20} color={colors.blue} /><Text style={{ color: colors.blue }}>{t(label)}</Text>
        </Pressable>)}
      </View>
      <Text style={s.rowSubtitle}>{t('Или выберите аватар')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 14 }}>{presets.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t('Аватар: {name}', { name: t(names[item.id]) })} accessibilityState={{ selected: draft === `preset:${item.id}`, disabled: busy }} disabled={busy} onPress={() => { setDraft(`preset:${item.id}`); setPhotoInfo(null); }} style={[s.avatarOption, { flexBasis: '21%', flexGrow: 1, alignItems: 'center', paddingVertical: 10, gap: 6 }, draft === `preset:${item.id}` && { borderColor: colors.blue, backgroundColor: colors.selected }]}>
        <Avatar person={{ avatar: `preset:${item.id}` }} zoomable={false} />
        <Text numberOfLines={1} style={[s.rowSubtitle, { fontSize: 11 }]}>{t(names[item.id])}</Text>
        {draft === `preset:${item.id}` && <View style={s.avatarSelected}><Icon name="check" size={12} color={colors.white} /></View>}
      </Pressable>)}</View>
      {!!error && <Text accessibilityRole="alert" style={s.mapError}>{t(error)}</Text>}
      {showSettings && <ActionButton title={t('Открыть настройки')} secondary onPress={() => Linking.openSettings()} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {(draft !== null || user.avatar) && <Pressable accessibilityRole="button" accessibilityLabel={t('Удалить аватар')} disabled={busy} accessibilityState={{ disabled: busy }} onPress={confirmRemove} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.control, opacity: busy || pressed ? 0.5 : 1 })}>
          <Icon name="trash-2" size={18} color={colors.ink} /><Text style={{ color: colors.ink }}>{t('Удалить')}</Text>
        </Pressable>}
        <View style={{ flex: 1 }}><ActionButton title={t('Сохранить аватар')} busy={busy} disabled={draft === (user.avatar || null)} onPress={() => save()} /></View>
      </View>
    </ModalSheet>
  </>;
}
