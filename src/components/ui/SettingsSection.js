import React from 'react';
import { Text, View } from 'react-native';
import { useSettings } from '../../context/SettingsContext';
import Icon from './Icon';

export default function SettingsSection({ title, description, icon, children }) {
  const { appStyles: s, colors } = useSettings();
  return (
    <View style={s.settingsCard}>
      <View style={s.settingsCardHeading}>
        <View style={s.settingsSectionIcon}>
          <Icon name={icon} size={19} color={colors.selectedText} />
        </View>
        <View style={s.flex}>
          <Text accessibilityRole="header" style={s.settingsSectionTitle}>{title}</Text>
          {!!description && <Text style={s.settingsSectionDescription}>{description}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}
