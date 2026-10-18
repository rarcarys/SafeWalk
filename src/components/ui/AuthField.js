import { useSettings } from '../../context/SettingsContext';
import { View, Text, TextInput } from 'react-native';
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
export default function Field({
  label,
  error,
  hint,
  icon = 'mail',
  trailing,
  inputRef,
  onFocus,
  onBlur,
  ...props
}) {
  const {
    authStyles: s,
    authColors,
    t
  } = useSettings();
  const [focused, setFocused] = useState(false);
  return <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrapper, focused && s.focusedInput, error && s.invalidInput]}>
        <Feather name={icon} size={17} color={error ? authColors.error : focused ? authColors.ink : authColors.muted} accessible={false} />
        <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={authColors.placeholder} style={s.input} autoCapitalize="none" autoCorrect={false} aria-invalid={!!error} onFocus={event => {
        setFocused(true);
        onFocus?.(event);
      }} onBlur={event => {
        setFocused(false);
        onBlur?.(event);
      }} {...props} />

        {trailing}
      </View>
      {!!error && <Text style={t(s.error)} accessibilityLiveRegion="polite" role="alert">
          {t(error)}
        </Text>}
      {!!hint && !error && <Text style={s.hint}>{hint}</Text>}
    </View>;
}
