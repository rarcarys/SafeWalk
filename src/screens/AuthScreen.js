import { useSettings } from '../context/SettingsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useRef } from 'react';
import { authenticate } from '../services/auth';
import { KeyboardAvoidingView, Platform, View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import Field from '../components/ui/AuthField';
import ThemeToggle from '../components/ui/ThemeToggle';
import RecoveryDialog from '../components/RecoveryDialog';
const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function Brand({
  light = false
}) {
  const {
    authStyles: s,
    authColors,
    isDark
  } = useSettings();
  const {
    ink,
    muted,
    accent
  } = authColors;
  return <View style={s.brandRow}>
      <View style={[s.brandMark, light && s.brandMarkLight]}>
        <Feather name="navigation" size={20} color={light ? '#17221e' : accent} accessible={false} />
      </View>
      <Text style={[s.brand, light && s.brandLight]}>SafeWalk</Text>
    </View>;
}
function WelcomePanel({
  narrow
}) {
  const {
    authStyles: s,
    authColors,
    isDark,
    t
  } = useSettings();
  const {
    ink,
    muted,
    accent
  } = authColors;
  return <View style={[s.hero, narrow && s.narrowHero]}>
      <View pointerEvents="none" accessible={false} style={s.orbit} />
      <View pointerEvents="none" accessible={false} style={s.innerOrbit} />
      <View pointerEvents="none" accessible={false} style={s.orbitDot} />
      <Brand light />
      <View style={s.heroMain}>
        <Text style={s.heroEyebrow}>{t("ВАШ ПУТЬ. ВАШ КРУГ.")}</Text>
        <Text style={[s.heroTitle, narrow && s.narrowHeroTitle]}>
          {t("Спокойнее,\nкогда\n")}<Text style={s.heroAccent}>{t("на связи.")}</Text>
        </Text>
        <Text style={s.heroDescription}>{t("Планируйте маршруты и общайтесь с теми, кому доверяете. Всё в одном месте.")}

        </Text>
      </View>
      <View>
        <View style={s.heroFeatures}>
          {[['map', t("Маршруты на каждый день")], ['users', t("Ваш круг контактов")], ['message-circle', t("Личные чаты")]].map(([icon, label]) => <View key={icon} style={s.featureRow}>
              <View style={s.featureIcon}><Feather name={icon} size={16} color={accent} accessible={false} /></View>
              <Text style={s.featureText}>{label}</Text>
            </View>)}
        </View>
        <View style={s.heroFooter}>
          <Text style={s.heroFooterText}>{t("МАЛЕНЬКИЙ ШАГ К СПОКОЙСТВИЮ")}</Text>
          <Feather name="arrow-up-right" size={22} color={accent} accessible={false} />
        </View>
      </View>
    </View>;
}
export default function AuthScreen({
  onAuthenticated,
  initialError
}) {
  const {
    authStyles: s,
    authColors,
    isDark,
    t
  } = useSettings();
  const {
    ink,
    muted,
    accent
  } = authColors;
  const insets = useSafeAreaInsets();
  const {
    width
  } = useWindowDimensions();
  const desktop = width >= 960;
  const compact = width < 360;
  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  const confirmationInput = useRef(null);
  const [screen, setScreen] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const submitting = useRef(false);
  const changeScreen = next => {
    if (submitting.current) return;
    setScreen(next);
    setPassword('');
    setConfirmation('');
    setVisiblePassword(false);
    setErrors({});
    setFormError('');
  };
  const update = (field, value) => {
    ({
      name: setName,
      email: setEmail,
      password: setPassword,
      confirmation: setConfirmation
    })[field](value);
    setErrors(previous => ({
      ...previous,
      [field]: undefined
    }));
    setFormError('');
  };
  const submit = async () => {
    if (submitting.current) return;
    const nextErrors = {};
    const cleanEmail = email.trim().toLowerCase();
    if (!emailValid(cleanEmail)) nextErrors.email = t("Введите корректный email");
    if (!password) nextErrors.password = t("Введите пароль");
    if (screen === 'register') {
      if (!name.trim()) nextErrors.name = t("Укажите имя");
      if (password.length < 8) nextErrors.password = t("Не менее 8 символов");
      if (confirmation !== password) nextErrors.confirmation = t("Пароли не совпадают");
    }
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;
    submitting.current = true;
    setBusy(true);
    try {
      const user = await authenticate(screen, {
        email: cleanEmail,
        password,
        ...(screen === 'register' ? {
          name: name.trim()
        } : {})
      });
      setPassword('');
      setConfirmation('');
      onAuthenticated(user);
    } catch (error) {
      setFormError(error.message);
      if (error.fields) setErrors(error.fields);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const register = screen === 'register';
  const switchMode = () => changeScreen(register ? 'login' : 'register');
  return <KeyboardAvoidingView style={[s.root, {
    paddingTop: insets.top,
    paddingBottom: insets.bottom
  }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, desktop && s.desktopScroll]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={[s.shell, desktop && s.desktopShell]}>
          {desktop ? <WelcomePanel narrow={width < 1200} /> : <>
              <View style={[s.mobileHeader, compact && s.compactHeader]}>
                <Brand />
                <ThemeToggle compact />
              </View>
              <View style={[s.mobileIntro, compact && s.compactIntro]}>
                <Text style={s.eyebrow}>{t("ВАШ ПУТЬ. ВАШ КРУГ.")}</Text>
                <Text style={[s.mobileTitle, compact && s.compactTitle]}>{t("Спокойнее,\nкогда на связи.")}</Text>
                {!compact && <Text style={s.introDescription}>{t("Маршруты и люди, которым вы доверяете.")}</Text>}
              </View>
            </>}
          <View style={[s.formColumn, desktop && s.desktopFormColumn]}>
            {desktop && <View style={s.authTools}><ThemeToggle /></View>}
            <View style={[s.form, desktop && s.desktopForm, compact && s.compactForm]}>
              <View style={s.modeControl} role="tablist" accessibilityLabel={t("Вход и регистрация")}>
                {[['login', t("Вход")], ['register', t("Регистрация")]].map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{
                selected: screen === id,
                disabled: busy
              }} aria-selected={screen === id} aria-disabled={busy} disabled={busy} onPress={() => {
                if (screen !== id) changeScreen(id);
              }} style={[s.modeButton, screen === id && s.modeSelected]}>

                    <Text style={[s.modeText, screen === id && s.modeTextSelected]}>{label}</Text>
                  </Pressable>)}
              </View>
              <Text style={[s.title, desktop && s.desktopTitle, compact && s.compactFormTitle]}>
                {register ? t("Давайте знакомиться") : t("С возвращением")}
              </Text>
              <Text style={s.subtitle}>
                {register ? t("Создайте аккаунт и соберите свой круг.") : t("Войдите, чтобы продолжить свой путь.")}
              </Text>
              {register && <Field label={t("Имя")} icon="user" value={name} onChangeText={value => update('name', value)} error={errors.name} placeholder={t("Как к вам обращаться")} autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={50} editable={!busy} returnKeyType="next" onSubmitEditing={() => emailInput.current?.focus()} />}
              <Field label="Email" icon="mail" inputRef={emailInput} value={email} onChangeText={value => update('email', value)} error={errors.email} placeholder="name@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} editable={!busy} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />

              <Field label={t("Пароль")} icon="lock" inputRef={passwordInput} value={password} onChangeText={value => update('password', value)} error={errors.password} hint={register ? t("Минимум 8 символов.") : undefined} placeholder={register ? t("Придумайте пароль") : t("Введите пароль")} secureTextEntry={!visiblePassword} autoComplete={register ? 'new-password' : 'current-password'} textContentType={register ? 'newPassword' : 'password'} maxLength={128} editable={!busy} returnKeyType={register ? 'next' : 'go'} onSubmitEditing={register ? () => confirmationInput.current?.focus() : submit} trailing={<Pressable accessibilityRole="button" accessibilityLabel={visiblePassword ? t("Скрыть пароль") : t("Показать пароль")} aria-pressed={visiblePassword} disabled={busy} onPress={() => setVisiblePassword(value => !value)} style={s.passwordToggle}>

                    <Feather name={visiblePassword ? 'eye-off' : 'eye'} size={18} color={muted} accessible={false} />
                  </Pressable>} />

              {register && <Field label={t("Повторите пароль")} icon="check-circle" inputRef={confirmationInput} value={confirmation} onChangeText={value => update('confirmation', value)} error={errors.confirmation} placeholder={t("Повторите новый пароль")} secureTextEntry={!visiblePassword} autoComplete="new-password" textContentType="newPassword" maxLength={128} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />}
              {!!formError && <View style={s.formError} role="alert" accessibilityLiveRegion="polite">
                  <Feather name="alert-circle" size={17} color={t(authColors.error)} accessible={false} />
                  <Text style={s.formErrorText}>{t(formError)}</Text>
                </View>}
              <Pressable accessibilityRole="button" accessibilityLabel={register ? t("Зарегистрироваться") : t("Войти")} accessibilityState={{
              disabled: busy,
              busy
            }} aria-disabled={busy} aria-busy={busy} disabled={busy} onPress={submit} style={({
              pressed
            }) => [s.button, (pressed || busy) && s.buttonPressed]}>

                {busy ? <ActivityIndicator color={authColors.onButton} size="small" /> : <>
                    <Text style={s.buttonLabel}>{register ? t("Создать аккаунт") : t("Войти")}</Text>
                    <Feather name="arrow-right" size={18} color={isDark ? authColors.onButton : accent} accessible={false} />
                  </>}
              </Pressable>
              {!register && <Pressable accessibilityRole="button" onPress={() => setRecovering(true)} disabled={busy} style={s.inlineLink}><Text style={s.link}>{t('Забыли пароль?')}</Text></Pressable>}
              <View style={s.accountLink}>
                <Text style={s.secondaryText}>{register ? t("Уже с нами?") : t("Впервые здесь?")}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={register ? t("Перейти ко входу") : t("Создать аккаунт")} disabled={busy} onPress={switchMode} style={s.inlineLink}>

                  <Text style={s.link}>{register ? t("Войти") : t("Создать аккаунт")}</Text>
                </Pressable>
              </View>
            </View>
            <View style={s.privacyNote}>
              <Feather name="lock" size={12} color={muted} accessible={false} />
              <Text style={s.privacyText}>{t("Вы сами решаете, когда делиться геопозицией.")}</Text>
            </View>
            <Text style={s.footer}>{t("SAFEWALK · НА СВЯЗИ В ПУТИ")}</Text>
          </View>
        </View>
      </ScrollView>
      <RecoveryDialog visible={recovering} onClose={() => setRecovering(false)} />
    </KeyboardAvoidingView>;
}
