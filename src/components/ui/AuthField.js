import { View, Text, TextInput } from 'react-native';
import s from '../../styles/authStyles';
import React from 'react';
export default function Field({
  label,
  error,
  trailing,
  ...props
}) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <View style={[s.inputWrapper, error && s.invalidInput]}>
      <TextInput accessibilityLabel={label} placeholderTextColor="#999ba0" style={s.input} autoCapitalize="none" autoCorrect={false} {...props} />
      {trailing}
    </View>
    {!!error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
  </View>;
}
