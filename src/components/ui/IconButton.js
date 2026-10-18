import { useSettings } from '../../context/SettingsContext';
import React, { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import Icon from './Icon';
export default function IconButton({
  icon,
  label,
  onPress,
  style,
  color,
  disabled
}) {
  const {
    appStyles: s
  } = useSettings();
  const [hovered, setHovered] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} aria-disabled={!!disabled} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({
    pressed
  }) => [s.iconButton, style, pressed && s.pressed]}>
      <Icon name={icon} color={color} />
      {hovered && <View pointerEvents="none" style={s.tooltip}>
          <Text style={s.tooltipText}>{label}</Text>
        </View>}
    </Pressable>;
}
