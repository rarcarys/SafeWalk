import React, { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { actionSOS } from '../services/actionSOS';
import PreferenceRow from './ui/PreferenceRow';

export default function ActionSOSSettings() {
  const { appStyles: s, t } = useSettings();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      // Open the destination only; never run a shortcut or send SOS from setup.
      await Linking.openURL('App-prefs:root=ACTION_BUTTON');
    } catch {
      setError('iPhone не открыл раздел автоматически. Откройте «Настройки» → «Кнопка действия».');
    } finally {
      setOpening(false);
    }
  };
  if (Platform.OS !== 'ios') return null;
  return <View>
    <PreferenceRow title={t('SOS кнопкой Action')} icon="alert-circle" last
      value={t(actionSOS ? 'Открыть настройки кнопки iPhone' : 'Доступно в отдельной iOS-сборке')}
      disabled={opening} onPress={open} />
    {!!error && <Text role="alert" style={[s.mapError, { margin: 16 }]}>{t(error)}</Text>}
  </View>;
}
