import { useSettings } from '../../context/SettingsContext';
import { Pressable, ActivityIndicator, Text } from 'react-native';
import Icon from './Icon';
import React from 'react';
export default function ActionButton({
  title,
  onPress,
  secondary,
  danger,
  icon,
  busy,
  disabled
}) {
  const {
    appStyles: s,
    colors
  } = useSettings();
  const color = secondary && !danger ? colors.ink : colors.white;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} aria-disabled={!!(busy || disabled)} aria-busy={!!busy} onPress={onPress} disabled={busy || disabled} accessibilityState={{
    busy: !!busy,
    disabled: !!(busy || disabled)
  }} style={({
    pressed
  }) => [s.actionButton, secondary && s.secondaryButton, danger && s.dangerButton, disabled && s.pressed, pressed && s.pressed]}>
      {busy ? <ActivityIndicator color={color} size="small" /> : <>
          {icon && <Icon name={icon} size={18} color={color} />}
          <Text style={[s.actionText, {
        color
      }]}>
            {title}
          </Text>
        </>}
    </Pressable>;
}
