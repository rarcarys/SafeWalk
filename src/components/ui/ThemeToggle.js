import React from 'react';
import { Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSettings } from '../../context/SettingsContext';
export default function ThemeToggle({
  compact = false
}) {
  const {
    authStyles: s,
    authColors,
    isDark,
    setTheme,
    t
  } = useSettings();
  const label = isDark ? t("Включить светлую тему") : t("Включить тёмную тему");
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setTheme(isDark ? 'light' : 'dark')} style={({
    pressed
  }) => [s.themeToggle, compact && s.themeToggleCompact, pressed && s.buttonPressed]}>

      <Feather name={isDark ? 'sun' : 'moon'} size={18} color={authColors.ink} accessible={false} />
      {!compact && <Text style={s.themeToggleText}>{isDark ? t("Светлая тема") : t("Тёмная тема")}</Text>}
    </Pressable>;
}
