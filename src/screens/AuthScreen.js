import { colors } from '../styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useRef } from 'react';
import { authenticate } from '../services/auth';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import s from '../styles/authStyles';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import Field from '../components/ui/AuthField';
const { ink, muted } = colors;
const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export default function AuthScreen({ onAuthenticated, initialError }) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const changeScreen = (next) => {
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
      confirmation: setConfirmation,
    })[field](value);
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
    setFormError('');
  };
  const submit = async () => {
    if (submitting.current) return;
    const nextErrors = {};
    const cleanEmail = email.trim().toLowerCase();
    if (!emailValid(cleanEmail)) nextErrors.email = 'Введите корректный email';
    if (!password) nextErrors.password = 'Введите пароль';
    if (screen === 'register') {
      if (!name.trim()) nextErrors.name = 'Укажите имя';
      if (password.length < 15) nextErrors.password = 'Не менее 15 символов';
      if (confirmation !== password)
        nextErrors.confirmation = 'Пароли не совпадают';
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
        ...(screen === 'register'
          ? {
              name: name.trim(),
            }
          : {}),
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
  return (
    <KeyboardAvoidingView
      style={[
        s.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.brand}>SafeWalk</Text>
        <Feather name="lock" size={17} color="#95969b" accessible={false} />
      </View>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.form}>
          {screen === 'register' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад ко входу"
              disabled={busy}
              onPress={() => changeScreen('login')}
              style={s.backButton}
            >
              <Feather
                name="arrow-left"
                size={18}
                color={ink}
                accessible={false}
              />
              <Text style={s.backLabel}>Вход</Text>
            </Pressable>
          )}
          <Text style={s.title}>
            {screen === 'login' ? 'Вход' : 'Создать аккаунт'}
          </Text>
          {screen === 'register' && (
            <Field
              label="Имя"
              value={name}
              onChangeText={(value) => update('name', value)}
              error={errors.name}
              placeholder="Как к вам обращаться"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              maxLength={50}
              editable={!busy}
            />
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={(value) => update('email', value)}
            error={errors.email}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            editable={!busy}
          />
          <Field
            label="Пароль"
            value={password}
            onChangeText={(value) => update('password', value)}
            error={errors.password}
            placeholder={
              screen === 'register' ? 'Не менее 15 символов' : 'Введите пароль'
            }
            secureTextEntry={!visiblePassword}
            autoComplete={
              screen === 'register' ? 'new-password' : 'current-password'
            }
            textContentType={screen === 'register' ? 'newPassword' : 'password'}
            maxLength={128}
            editable={!busy}
            returnKeyType={screen === 'login' ? 'go' : 'next'}
            onSubmitEditing={screen === 'login' ? submit : undefined}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  visiblePassword ? 'Скрыть пароль' : 'Показать пароль'
                }
                disabled={busy}
                onPress={() => setVisiblePassword((value) => !value)}
                style={s.passwordToggle}
              >
                <Feather
                  name={visiblePassword ? 'eye-off' : 'eye'}
                  size={19}
                  color={muted}
                  accessible={false}
                />
              </Pressable>
            }
          />
          {screen === 'register' && (
            <Field
              label="Повторите пароль"
              value={confirmation}
              onChangeText={(value) => update('confirmation', value)}
              error={errors.confirmation}
              placeholder="Ещё раз"
              secureTextEntry={!visiblePassword}
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={128}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
          {!!formError && (
            <Text style={s.formError} accessibilityLiveRegion="polite">
              {formError}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              screen === 'login' ? 'Войти' : 'Зарегистрироваться'
            }
            accessibilityState={{
              disabled: busy,
              busy,
            }}
            disabled={busy}
            onPress={submit}
            style={({ pressed }) => [
              s.button,
              (pressed || busy) && {
                opacity: 0.7,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.buttonLabel}>
                {screen === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Text>
            )}
          </Pressable>
          {screen === 'login' ? (
            <View style={s.accountLink}>
              <Text style={s.secondaryText}>Нет аккаунта?</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Создать аккаунт"
                disabled={busy}
                onPress={() => changeScreen('register')}
                style={s.inlineLink}
              >
                <Text style={s.link}>Создать аккаунт</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.accountLink}>
              <Text style={s.secondaryText}>Уже зарегистрированы?</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Перейти ко входу"
                disabled={busy}
                onPress={() => changeScreen('login')}
                style={s.inlineLink}
              >
                <Text style={s.link}>Войти</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
