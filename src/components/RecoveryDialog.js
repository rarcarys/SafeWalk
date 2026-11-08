import React, { useEffect, useState, useRef } from 'react';
import { Modal, Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import Field from './ui/AuthField';
import AuthMascot from './AuthMascot';
import { recoverAccount } from '../services/auth';
import useKeyboardScroll from '../hooks/useKeyboardScroll';

export default function RecoveryDialog({ visible, onClose }) {
  const { authStyles: s, authColors: colors, t } = useSettings();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(''), [code, setCode] = useState('');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState(''), [errors, setErrors] = useState({});
  const [step, setStep] = useState(1), [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false), [focused, setFocused] = useState(null);
  const [mascotError, setMascotError] = useState(0);
  const errorSequence = useRef(0);
  const showRecoveryError = () => setMascotError(++errorSequence.current);
  const locked = useRef(false), codeInput = useRef(null), confirmationInput = useRef(null);
  const emailInput = useRef(null), passwordInput = useRef(null), scrollRef = useRef(null);
  const actionRef = useRef(null);
  const viewport = useKeyboardScroll({ enabled: visible, scrollRef, actionRef, inputRefs: { email: emailInput, code: codeInput, password: passwordInput, confirmation: confirmationInput }, focused, layoutKey: `${step}:${Object.keys(errors).filter(key => errors[key]).join(',')}:${!!message}` });
  useEffect(() => {
    if (visible) showRecoveryError();
    else setMascotError(0);
  }, [visible]);
  const close = () => {
    if (locked.current) return;
    setCode(''); setPassword(''); setConfirmation(''); setMessage(''); setErrors({}); setStep(1); setDone(false); setFocused(null); setMascotError(0); onClose();
  };
  const update = (field, setter) => value => { setter(value); setErrors(previous => ({ ...previous, [field]: undefined })); setMessage(''); setMascotError(0); };
  const focus = field => ({ onFocus: () => setFocused(field), onBlur: () => setFocused(current => current === field ? null : current) });
  async function submit() {
    if (locked.current) return;
    const next = {};
    if (step === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('Введите корректный email');
      if (!code.trim()) next.code = t('Введите код восстановления');
    } else {
      if (password.length < 8) next.password = t('Не менее 8 символов');
      if (password !== confirmation) next.confirmation = t('Пароли не совпадают');
    }
    setErrors(next); setMessage('');
    if (Object.keys(next).length) { showRecoveryError(); return; }
    if (step === 1) { setStep(2); setFocused(null); return; }
    locked.current = true; setBusy(true);
    try {
      await recoverAccount({ email: email.trim().toLowerCase(), code: code.trim(), newPassword: password });
      setDone(true); setCode(''); setPassword(''); setConfirmation(''); setFocused(null);
    } catch (error) { setMessage(error.message); showRecoveryError(); }
    finally { locked.current = false; setBusy(false); }
  }
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView style={[s.recoveryBackdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }, Platform.OS === 'web' && viewport && { position: 'absolute', top: viewport.top, left: 0, right: 0, height: viewport.height }]} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <View style={s.recoveryCard} accessibilityViewIsModal role="dialog" accessibilityLabel={t('Восстановить доступ')}>
        <ScrollView ref={scrollRef} style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" contentContainerStyle={s.recoveryContent}>
          <View style={s.recoveryNavigation}>
            {!done && step === 2 ? <Pressable accessibilityRole="button" accessibilityLabel={t('Назад')} disabled={busy} onPress={() => { setStep(1); setErrors({}); setMessage(''); setMascotError(0); }} style={s.stepBack}><Feather name="arrow-left" size={22} color={colors.ink} /></Pressable> : <View style={s.recoveryMark}><Feather name={done ? 'check' : 'key'} size={20} color={colors.ink} /></View>}
            <Pressable accessibilityRole="button" accessibilityLabel={t('Закрыть')} disabled={busy} onPress={close} style={s.stepBack}><Feather name="x" size={20} color={colors.ink} /></Pressable>
          </View>
          <View style={[s.mascotHeading, s.recoveryHeading]} pointerEvents="none">
            <Text style={[s.title, s.mascotHeadingTitle, s.recoveryTitle]}>{t(done ? 'Доступ восстановлен' : step === 2 ? 'Новый пароль' : 'Восстановить доступ')}</Text>
            <View style={s.headingMascot}><AuthMascot embedded size={200} errorSignal={mascotError} lookingAway={focused === 'password' || focused === 'confirmation'} watching={focused === 'email' || focused === 'code'} progress={Math.min((focused === 'email' ? email.length : code.length) / 28, 1)} /></View>
            <View style={s.headingLedge} />
          </View>
          {done ? <Text style={s.recoveryDescription}>{t('Пароль восстановлен. Войдите с новым паролем и создайте новый код восстановления в профиле.')}</Text> : step === 1 ? <>
            <Text style={s.recoveryDescription}>{t('Используйте код восстановления из профиля. Если код не сохранён, восстановить доступ без подключённой почты не получится.')}</Text>
            <Field {...focus('email')} inputRef={emailInput} label="Email" icon="mail" value={email} onChangeText={update('email', setEmail)} error={errors.email} placeholder="name@example.com" keyboardType="email-address" autoComplete="email" maxLength={254} editable={!busy} returnKeyType="next" onSubmitEditing={() => codeInput.current?.focus()} />
            <Field {...focus('code')} inputRef={codeInput} label={t('Код восстановления')} icon="key" value={code} onChangeText={update('code', setCode)} error={errors.code} placeholder={t('Код восстановления')} maxLength={254} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
          </> : <>
            <Field {...focus('password')} inputRef={passwordInput} label={t('Новый пароль')} icon="lock" value={password} onChangeText={update('password', setPassword)} error={errors.password} hint={t('Минимум 8 символов.')} placeholder={t('Придумайте пароль')} secureTextEntry autoComplete="new-password" maxLength={128} editable={!busy} returnKeyType="next" onSubmitEditing={() => confirmationInput.current?.focus()} />
            <Field {...focus('confirmation')} inputRef={confirmationInput} label={t('Повторите пароль')} icon="lock" value={confirmation} onChangeText={update('confirmation', setConfirmation)} error={errors.confirmation} placeholder={t('Повторите пароль')} secureTextEntry autoComplete="new-password" maxLength={128} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
          </>}
          {!!message && <View style={s.formError} role="alert" accessibilityLiveRegion="polite"><Feather name="alert-circle" size={17} color={colors.error} /><Text style={s.formErrorText}>{t(message)}</Text></View>}
          <Pressable ref={actionRef} accessibilityRole="button" accessibilityLabel={t(done ? 'Вернуться ко входу' : step === 1 ? 'Продолжить' : 'Восстановить доступ')} disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={done ? close : submit} style={({ pressed }) => [s.button, (pressed || busy) && s.buttonPressed]}>
            {busy ? <ActivityIndicator color={colors.onButton} /> : <><Text style={s.buttonLabel}>{t(done ? 'Вернуться ко входу' : step === 1 ? 'Продолжить' : 'Восстановить доступ')}</Text><Feather name="arrow-right" size={18} color={colors.onButton} /></>}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
