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
import AuthMascot from '../components/AuthMascot';
import useKeyboardScroll from '../hooks/useKeyboardScroll';
const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function Brand({
  light = false
}) {
  const {
    authStyles: s,
    authColors
  } = useSettings();
  const {
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
  narrow,
  mascotProps
}) {
  const {
    authStyles: s,
    t
  } = useSettings();
  return <View style={[s.hero, narrow && s.narrowHero]}>
      <Brand />
      <View style={s.heroScene} pointerEvents="box-none">
        <View style={s.heroArch} />
        <View style={s.heroAnimatedMascot}>
          <AuthMascot {...mascotProps} size={narrow ? 340 : 420} embedded />
        </View>
        <View style={s.heroLedge} />
      </View>
      <Text style={s.heroCaption}>{t("Рядом в пути.")}</Text>
    </View>;
}
export default function AuthScreen({
  onAuthenticated,
  initialError,
  greeting = true
}) {
  const {
    authStyles: s,
    authColors,
    isDark,
    t
  } = useSettings();
  const {
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
  const nameInput = useRef(null);
  const scrollInput = useRef(null);
  const actionRef = useRef(null);
  const tabsRef = useRef(null);
  const [screen, setScreen] = useState('login');
  const [registrationStep, setRegistrationStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [caretProgress, setCaretProgress] = useState(0);
  const [mascotError, setMascotError] = useState(0);
  const errorSequence = useRef(0);
  const showCredentialError = () => setMascotError(++errorSequence.current);
  const viewport = useKeyboardScroll({ enabled: !desktop && !recovering, scrollRef: scrollInput, actionRef, hideAboveRef: tabsRef, inputRefs: { email: emailInput, password: passwordInput, name: nameInput }, focused: focusedField, layoutKey: `${registrationStep}:${Object.keys(errors).filter(key => errors[key]).join(',')}:${!!formError}` });
  const mascotField = field => ({
    onFocus: () => { setFocusedField(field); if (field === 'name' || field === 'email') setCaretProgress(Math.min((field === 'name' ? name : email).length / 28, 1)); },
    onBlur: () => setFocusedField(current => current === field ? null : current),
    ...((field === 'name' || field === 'email') ? {
      onSelectionChange: event => setCaretProgress(Math.min(event.nativeEvent.selection.end / 28, 1)),
    } : {}),
  });
  const submitting = useRef(false);
  const changeScreen = next => {
    if (submitting.current) return;
    setScreen(next);
    setMascotError(0);
    setRegistrationStep(1);
    setFocusedField(null);
    setCaretProgress(0);
    setPassword('');
    setVisiblePassword(false);
    setErrors({});
    setFormError('');
  };
  const update = (field, value) => {
    setMascotError(0);
    ({
      name: setName,
      email: setEmail,
      password: setPassword
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
      if (registrationStep === 2 && !name.trim()) nextErrors.name = t("Укажите имя");
      if (password.length < 8) nextErrors.password = t("Не менее 8 символов");
    }
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) {
      if (nextErrors.email || nextErrors.password) showCredentialError();
      if (screen === 'register' && (nextErrors.email || nextErrors.password)) setRegistrationStep(1);
      return;
    }
    if (screen === 'register' && registrationStep === 1) {
      setRegistrationStep(2);
      setVisiblePassword(false);
      setFocusedField(null);
      setCaretProgress(0);
      return;
    }
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
      onAuthenticated(user);
    } catch (error) {
      if (error.status === 401 || error.status === 403 || error.status === 409 || error.fields?.email || error.fields?.password) showCredentialError();
      setFormError(error.message);
      if (error.fields) setErrors(error.fields);
      if (screen === 'register' && (error.status === 409 || error.fields?.email || error.fields?.password)) {
        setRegistrationStep(1);
        setFocusedField(null);
        setVisiblePassword(false);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const register = screen === 'register';
  const nameStep = register && registrationStep === 2;
  const goBack = () => {
    if (submitting.current) return;
    setRegistrationStep(1);
    setFocusedField(null);
    setVisiblePassword(false);
    setErrors({});
    setFormError('');
  };
  const mascotProps = {
    greeting,
    errorSignal: mascotError,
    lookingAway: !nameStep && (focusedField === 'password' || (visiblePassword && !!password)),
    watching: focusedField === 'name' || focusedField === 'email',
    progress: caretProgress,
  };
  const actionButton = <Pressable ref={actionRef} accessibilityRole="button" accessibilityLabel={register ? nameStep ? t("Зарегистрироваться") : t("Продолжить") : t("Войти")} accessibilityState={{
              disabled: busy,
              busy
            }} aria-disabled={busy} aria-busy={busy} disabled={busy} onPress={submit} style={({
              pressed
            }) => [s.button, (pressed || busy) && s.buttonPressed]}>

                {busy ? <ActivityIndicator color={authColors.onButton} size="small" /> : <>
                    <Text style={s.buttonLabel}>{register ? nameStep ? t("Создать аккаунт") : t("Продолжить") : t("Войти")}</Text>
                    <Feather name="arrow-right" size={18} color={isDark ? authColors.onButton : accent} accessible={false} />
                  </>}
              </Pressable>;
  return <KeyboardAvoidingView style={[s.root, {
    paddingTop: insets.top,
    paddingBottom: insets.bottom
  }, Platform.OS === 'web' && !desktop && viewport != null && { height: viewport.height, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }]} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>

      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView ref={scrollInput} style={s.scroll} contentContainerStyle={[s.scrollContent, desktop && s.desktopScroll]} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>

        <View style={[s.shell, desktop && s.desktopShell]}>
          {desktop ? <WelcomePanel narrow={width < 1200} mascotProps={mascotProps} /> : <>
              <View style={[s.mobileHeader, compact && s.compactHeader]}>
                <Brand />
                <ThemeToggle compact />
              </View>
            </>}
          <View style={[s.formColumn, desktop && s.desktopFormColumn, !desktop && s.mobileFormColumn]}>
            {desktop && <View style={s.authTools}><ThemeToggle compact /></View>}
            <View style={[s.form, desktop && s.desktopForm, compact && s.compactForm]}>
              {nameStep ? <View style={s.stepNavigation}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("Назад")} disabled={busy} onPress={goBack} style={s.stepBack}>
                  <Feather name="arrow-left" size={22} color={authColors.ink} accessible={false} />
                </Pressable>
                <Text style={s.stepText}>{t("Шаг {step} из 2", { step: 2 })}</Text>
              </View> : <View ref={tabsRef} style={s.modeControl} role="tablist" accessibilityLabel={t("Вход и регистрация")}>
                {[['login', t("Вход")], ['register', t("Регистрация")]].map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{
                selected: screen === id,
                disabled: busy
              }} aria-selected={screen === id} aria-disabled={busy} disabled={busy} onPress={() => {
                if (screen !== id) changeScreen(id);
              }} style={[s.modeButton, screen === id && s.modeSelected]}>

                    <Text style={[s.modeText, screen === id && s.modeTextSelected]}>{label}</Text>
                  </Pressable>)}
              </View>}
              <View style={[s.formHeading, !desktop && s.mascotHeading]} pointerEvents={desktop ? 'auto' : 'box-none'}>
                <Text style={[s.title, desktop && s.desktopTitle, !desktop && s.mascotHeadingTitle, compact && s.compactMascotHeadingTitle]}>
                  {nameStep ? t("Как вас зовут?") : register ? t("Создать аккаунт") : desktop ? t("С возвращением") : t("Рады\nвидеть")}
                </Text>
                {!desktop && <View style={s.headingMascot}>
                  <AuthMascot {...mascotProps} size={compact ? 200 : 220} embedded />
                </View>}
                {!desktop && <View style={s.headingLedge} />}
              </View>
              {nameStep && <Field {...mascotField('name')} label={t("Имя")} icon="user" inputRef={nameInput} value={name} onChangeText={value => update('name', value)} error={errors.name} placeholder={t("Как к вам обращаться")} autoFocus autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={50} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />}
              {!nameStep && <Field {...mascotField('email')} label="Email" icon="mail" inputRef={emailInput} value={email} onChangeText={value => update('email', value)} error={errors.email} placeholder="name@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} editable={!busy} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />}

              {!nameStep && <Field {...mascotField('password')} label={t("Пароль")} icon="lock" inputRef={passwordInput} value={password} onChangeText={value => update('password', value)} error={errors.password} hint={register ? t("Минимум 8 символов.") : undefined} placeholder={register ? t("Придумайте пароль") : t("Введите пароль")} secureTextEntry={!visiblePassword} autoComplete={register ? 'new-password' : 'current-password'} textContentType={register ? 'newPassword' : 'password'} maxLength={128} editable={!busy} returnKeyType="go" onSubmitEditing={submit} trailing={<Pressable accessibilityRole="button" accessibilityLabel={visiblePassword ? t("Скрыть пароль") : t("Показать пароль")} aria-pressed={visiblePassword} disabled={busy} onPress={() => setVisiblePassword(value => !value)} style={s.passwordToggle}>

                    <Feather name={visiblePassword ? 'eye-off' : 'eye'} size={18} color={muted} accessible={false} />
                  </Pressable>} />}

              {!!formError && <View style={s.formError} role="alert" accessibilityLiveRegion="polite">
                  <Feather name="alert-circle" size={17} color={t(authColors.error)} accessible={false} />
                  <Text style={s.formErrorText}>{t(formError)}</Text>
                </View>}
              {!register && <Pressable accessibilityRole="button" onPress={() => setRecovering(true)} disabled={busy} style={s.recoveryLink}><Text style={s.link}>{t('Забыли пароль?')}</Text></Pressable>}
              {actionButton}
            </View>
          </View>
        </View>
      </ScrollView>
      <RecoveryDialog visible={recovering} onClose={() => setRecovering(false)} />
    </KeyboardAvoidingView>;
}
