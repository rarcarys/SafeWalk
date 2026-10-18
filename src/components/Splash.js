import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSettings } from '../context/SettingsContext';
export default function Splash() {
  const {
    appStyles: s,
    colors,
    isDark,
    t
  } = useSettings();
  return <View testID="settings-splash" style={s.loading} accessibilityLiveRegion="polite" role="status">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={s.splashBrand}>SafeWalk</Text>
      <Text style={s.splashCaption}>{t("Загружаем настройки…")}</Text>
      <ActivityIndicator style={{
      marginTop: 24
    }} color={colors.blue} />
    </View>;
}
