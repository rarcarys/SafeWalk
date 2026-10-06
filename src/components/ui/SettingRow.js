import { View, Text, Switch } from 'react-native';
import s from '../../styles/appStyles';
import { colors } from '../../styles/theme';
import React from 'react';
export default function SettingRow({
  title,
  description,
  value,
  onValueChange,
}) {
  return (
    <View style={s.settingRow}>
      <View style={s.flex}>
        <Text style={s.rowTitle}>{title}</Text>
        {description && <Text style={s.rowSubtitle}>{description}</Text>}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: '#d7d8dc',
          true: colors.blue,
        }}
        thumbColor="#fff"
        activeThumbColor="#fff"
      />
    </View>
  );
}
