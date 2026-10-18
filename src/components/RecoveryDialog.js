import React, { useState, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import { recoverAccount } from '../services/auth';

export default function RecoveryDialog({ visible, onClose }) {
  const { appStyles: s, colors, t } = useSettings();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const close = () => { if (busy) return; setCode(''); setPassword(''); setConfirmation(''); setMessage(''); setDone(false); onClose(); };
  async function submit() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try {
      if (password !== confirmation) throw new Error('Пароли не совпадают');
      await recoverAccount({ email, code, newPassword: password });
      setDone(true); setCode(''); setPassword(''); setConfirmation('');
      setMessage('Пароль восстановлен. Войдите с новым паролем и создайте новый код восстановления в профиле.');
    } catch (error) { setMessage(error.message); }
    finally { locked.current = false; setBusy(false); }
  }
  const field = (label, value, setter, secret = false) => <TextInput accessibilityLabel={t(label)} placeholder={t(label)} placeholderTextColor={colors.muted} value={value} onChangeText={setter} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} maxLength={secret ? 128 : 254} editable={!busy} style={s.contactInput} />;
  return <ModalSheet visible={visible} title={t('Восстановить доступ')} onClose={close}>
    {!done && <>
      <Text style={s.modalDescription}>{t('Введите одноразовый код, сохранённый в профиле. Если кода нет, восстановление без подключённой почты недоступно.')}</Text>
      {field('Email', email, setEmail)}{field('Код восстановления', code, setCode)}
      {field('Новый пароль', password, setPassword, true)}{field('Повторите пароль', confirmation, setConfirmation, true)}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.modalDescription}>{t(message)}</Text>}
    <View style={s.formActions}><ActionButton title={t(done ? 'Вернуться ко входу' : 'Восстановить доступ')} busy={busy} onPress={done ? close : submit} /></View>
  </ModalSheet>;
}
