import { colors } from '../../styles/theme';
import { Pressable, ActivityIndicator, Text } from 'react-native';
import s from '../../styles/appStyles';
import Icon from './Icon';
import React from 'react';
export default function ActionButton({
  title,
  onPress,
  secondary,
  danger,
  icon,
  busy,
}) {
  const color = secondary ? colors.ink : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={busy}
      accessibilityState={{
        busy: !!busy,
        disabled: !!busy,
      }}
      style={({ pressed }) => [
        s.actionButton,
        secondary && s.secondaryButton,
        danger && s.dangerButton,
        pressed && s.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={color} />}
          <Text
            style={[
              s.actionText,
              {
                color,
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
