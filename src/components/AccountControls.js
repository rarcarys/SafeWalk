import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import PreferenceRow from './ui/PreferenceRow';
import * as auth from '../services/auth';

export default function AccountControls({ user, onUpdateUser, onDeleted }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [sessions, setSessions] = useState([]);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    setPassword(''); setNext(''); setConfirmation(''); setMessage(''); setCode(''); setName(user.name);
    if (mode === 'sessions') auth.loadSessions().then(result => setSessions(result.sessions)).catch(error => setMessage(error.message));
  }, [mode]);
  async function submit() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try {
      if (mode === 'name') { const result = await auth.updateProfile(name); onUpdateUser(result.user); setMode(null); }
      if (mode === 'password') {
        if (next !== confirmation) throw new Error('Пароли не совпадают');
        await auth.changePassword(password, next); setPassword(''); setNext(''); setConfirmation('');
        setMessage('Пароль изменён. Остальные сессии завершены. Создайте новый код восстановления.');
      }
      if (mode === 'sessions') { await auth.revokeOtherSessions(password); setPassword(''); setSessions((await auth.loadSessions()).sessions); setMessage('Остальные сессии завершены'); }
      if (mode === 'recovery') { const result = await auth.generateRecoveryCode(password); setCode(result.code); setPassword(''); }
      if (mode === 'delete') { await auth.deleteAccount(password, confirmation, user.id); onDeleted(); }
    } catch (error) { setMessage(error.message); }
    finally { locked.current = false; setBusy(false); }
  }
  const titles = { name: 'Редактировать имя', password: 'Сменить пароль', sessions: 'Устройства и сессии', recovery: 'Код восстановления', delete: 'Удалить аккаунт' };
  const input = (label, value, setter, secret = false) => <TextInput accessibilityLabel={t(label)} placeholder={t(label)} placeholderTextColor={colors.muted} value={value} onChangeText={setter} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} maxLength={secret ? 128 : 50} editable={!busy} style={s.contactInput} />;
  const icons = { name: 'edit-2', password: 'lock', sessions: 'smartphone', recovery: 'key', delete: 'trash-2' };
  return <View>
    <Text style={[s.preferenceGroupLabel, { marginTop: 12 }]}>{t('Аккаунт и безопасность')}</Text>
    <View style={s.preferenceGroup}>
      {Object.entries(titles).map(([id, title]) => <PreferenceRow key={id} compact title={t(title)} icon={icons[id]} last={id === 'delete'} danger={id === 'delete'} onPress={() => setMode(id)} />)}
    </View>
    <ModalSheet visible={!!mode} title={t(titles[mode] || '')} onClose={() => { if (!busy) setMode(null); }}>
      {mode === 'name' ? input('Имя', name, setName) : <>
        {mode === 'sessions' && sessions.map(item => <Text key={item.id} style={s.rowSubtitle}>{item.current ? t('Текущая сессия') : t('Другая сессия')} · {item.createdAt ? new Date(item.createdAt).toLocaleString(locale) : t('Дата неизвестна')}</Text>)}
        {mode === 'recovery' && <Text style={s.modalDescription}>{t('Сохраните код вне приложения. Он показывается один раз и позволяет сбросить пароль. Новый код отменяет предыдущий.')}</Text>}
        {mode === 'delete' && <Text style={s.modalDescription}>{t('Аккаунт, прогулки и сообщения будут удалены без возможности восстановления. Введите пароль и DELETE для подтверждения.')}</Text>}
        {!code && input('Текущий пароль', password, setPassword, true)}
        {mode === 'password' && <>{input('Новый пароль', next, setNext, true)}{input('Повторите пароль', confirmation, setConfirmation, true)}</>}
        {mode === 'delete' && input('Введите DELETE', confirmation, setConfirmation)}
      </>}
      {!!code && <Text selectable style={s.rowTitle}>{code}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={s.modalDescription}>{t(message)}</Text>}
      {!code && <View style={s.formActions}><ActionButton title={t(mode === 'sessions' ? 'Завершить остальные сессии' : mode === 'delete' ? 'Удалить навсегда' : 'Сохранить')} busy={busy} onPress={submit} /></View>}
    </ModalSheet>
  </View>;
}
