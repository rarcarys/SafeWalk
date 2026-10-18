import React from 'react';
import { View, Text } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import AvatarEditor from '../components/AvatarEditor';
import PreferenceRow from '../components/ui/PreferenceRow';
import ActionButton from '../components/ui/ActionButton';
import AccountControls from '../components/AccountControls';

export default function ProfileScreen({ user, onUpdateUser, onDeleted, onChoosePlaces, onRetry, error, onOpenSettings, onRequestSignOut }) {
  const { appStyles: s, t } = useSettings();
  return <View style={s.listPage}>
    <Text style={s.pageTitle}>{t('Профиль')}</Text>
    <View style={[s.profileRow, { paddingBottom: 8 }]}>
      <AvatarEditor user={user} onUpdateUser={onUpdateUser} />
      <View style={s.flex}><Text style={s.profileName}>{user.name}</Text><Text style={s.rowSubtitle}>{user.email}</Text></View>
    </View>
    {!!error && <><Text role="alert" style={s.mapError}>{t(error)}</Text><ActionButton title={t('Повторить загрузку')} secondary onPress={onRetry} /></>}
    <AccountControls user={user} onUpdateUser={onUpdateUser} onDeleted={onDeleted} />
    <Text style={s.preferenceGroupLabel}>{t('Приложение')}</Text>
    <View style={s.preferenceGroup}>
      <PreferenceRow compact title={t('Мои места')} icon="bookmark" onPress={onChoosePlaces} />
      <PreferenceRow compact title={t('Настройки')} accessibilityLabel={t('Открыть настройки')} icon="settings" onPress={onOpenSettings} />
      <PreferenceRow compact title={t('Выйти из аккаунта')} icon="log-out" danger last onPress={onRequestSignOut} />
    </View>
    <Text style={s.settingsVersion}>SafeWalk 1.0</Text>
  </View>;
}
