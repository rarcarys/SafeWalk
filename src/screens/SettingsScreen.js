import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import AppearanceSettings from '../components/AppearanceSettings';
import SettingRow from '../components/ui/SettingRow';
import PreferenceRow from '../components/ui/PreferenceRow';
import ModalSheet from '../components/ui/ModalSheet';
import Icon from '../components/ui/Icon';
import ActionButton from '../components/ui/ActionButton';
import DeviceControls from '../components/DeviceControls';

export default function SettingsScreen({
  user, contact, people, backupIds, onChooseContacts, onRetry, onOpenSafety,
  saving, loading, error, sharing, setSharing, reminder, setReminder,
  scenario, setScenario, onOpenProfile, resetPreferences, active,
  retentionDays, setRetentionDays, clearHistory,
  delayMinutes = 5, setDelayMinutes, escalationMinutes = 5, setEscalationMinutes,
}) {
  const { appStyles: s, colors, resetSettings, t } = useSettings();
  const [panel, setPanel] = useState(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const disabled = saving || loading || working;
  const selectedPerson = people[contact];
  const backupNames = backupIds.map(id => people[id]?.name).filter(Boolean).join(', ');
  const minutes = count => t('{count} мин', { count });
  const open = next => { setFeedback(''); setFailure(''); setPanel(next); };
  const choices = {
    delayMinutes: { title: 'Задержка перед тревогой', value: delayMinutes, options: [1, 3, 5, 10, 15], change: setDelayMinutes, parent: 'delay' },
    escalationMinutes: { title: 'Повторная тревога', value: escalationMinutes, options: [1, 3, 5, 10, 15], change: setEscalationMinutes, parent: 'delay' },
    retentionDays: { title: 'Хранить историю', value: retentionDays, options: [1, 7, 30, 90], change: setRetentionDays, parent: 'privacy' },
  };
  const choice = choices[panel];
  const titles = { delay: 'Если я задержусь', delayHelp: 'Как это работает', permissions: 'Разрешения телефона', privacy: 'Данные и приватность', clear: 'Очистить историю?', reset: 'Сбросить настройки?' };
  const close = () => {
    if (disabled) return;
    setPanel(choice?.parent || (['clear', 'reset'].includes(panel) ? 'privacy' : panel === 'delayHelp' ? 'delay' : null));
    setFailure('');
  };
  const confirm = async kind => {
    if (disabled) return;
    setWorking(true); setFailure('');
    try {
      if (kind === 'reset') { await resetPreferences(); resetSettings(); }
      else await clearHistory();
      setFeedback(t(kind === 'reset' ? 'Настройки сброшены.' : 'История очищена'));
      setPanel('privacy');
    } catch (problem) { setFailure(problem.message); }
    finally { setWorking(false); }
  };
  return <View style={s.quietSettingsPage}>
    <Text accessibilityRole="header" style={s.pageTitle}>{t('Настройки')}</Text>
    <View style={[s.preferenceGroup, { marginTop: 22 }]}><PreferenceRow title={user.name} value={user.email} icon="user" accessibilityLabel={t('Профиль и аккаунт')} last onPress={onOpenProfile} /></View>
    {!!error && <View style={{ marginTop: 16 }}><Text role="alert" style={s.mapError}>{t(error)}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Повторить загрузку')} style={s.textAction} onPress={onRetry}><Text style={s.blueText}>{t('Повторить загрузку')}</Text></Pressable></View>}
    <Text style={s.preferenceGroupLabel}>{t('Поездка')}</Text>
    <View style={s.preferenceGroup}>
      <SettingRow compact title={t('Делиться геопозицией')} disabled={disabled} value={sharing} onValueChange={setSharing} />
      <SettingRow compact title={t('Напоминать о прибытии')} disabled={disabled} value={reminder} onValueChange={setReminder} />
      <PreferenceRow title={t('Если я задержусь')} value={t(scenario ? 'Основной контакт через {count} мин' : 'Сообщения выключены', { count: delayMinutes })} icon="clock" disabled={disabled} last onPress={() => open('delay')} />
    </View>
    <Text style={s.preferenceGroupLabel}>{t('Приложение')}</Text>
    <View style={s.preferenceGroup}>
      <AppearanceSettings compact />
      <PreferenceRow title={t('Дополнительные возможности')} value={t('Тренировка SOS, таймер и сценарии')} icon="shield" onPress={onOpenSafety} />
      <View style={s.preferenceDivider} />
      <PreferenceRow title={t('Разрешения телефона')} value={t('Геопозиция и уведомления')} icon="smartphone" onPress={() => open('permissions')} />
      <PreferenceRow title={t('Данные и приватность')} value={t('История поездок')} icon="lock" last disabled={disabled} onPress={() => open('privacy')} />
    </View>
    <Text style={s.settingsVersion}>SafeWalk 1.0</Text>

    <ModalSheet visible={!!panel} title={t(choice?.title || titles[panel] || '')} onClose={close}>
      {choice && <View>{choice.options.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={panel === 'retentionDays' ? t('{count} дн.', { count: value }) : minutes(value)} accessibilityState={{ selected: value === choice.value, disabled }} disabled={disabled} style={s.menuAction} onPress={() => { choice.change(value); setPanel(choice.parent); }}><Text style={[s.rowTitle, s.flex]}>{panel === 'retentionDays' ? t('{count} дн.', { count: value }) : minutes(value)}</Text>{value === choice.value && <Icon name="check" size={20} color={colors.blue} />}</Pressable>)}</View>}
      {panel === 'delay' && <>
        <SettingRow compact title={t('Сообщать близким о задержке')} value={scenario} disabled={disabled} onValueChange={setScenario} />
        <PreferenceRow title={t('Задержка перед тревогой')} value={minutes(delayMinutes)} disabled={disabled || !scenario} onPress={() => open('delayMinutes')} />
        <PreferenceRow title={t('Повторная тревога')} value={minutes(escalationMinutes)} disabled={disabled} onPress={() => open('escalationMinutes')} />
        <PreferenceRow title={t('Контакты сопровождения')} accessibilityLabel={t('Выбрать контакты')} value={selectedPerson?.name || t('Не выбран')} disabled={disabled} onPress={() => { setPanel(null); onChooseContacts(); }} />
        <PreferenceRow title={t('Как это работает')} last onPress={() => open('delayHelp')} />
      </>}
      {panel === 'delayHelp' && <View style={{ gap: 16 }}>
        <Text style={s.modalDescription}>{t('В запланированное время появится напоминание о прибытии.')}</Text>
        <Text style={s.rowSubtitle}>{scenario ? t('Если вы не ответите, через {delay} мин сообщение получит основной контакт. Ещё через {reserve} мин — резервные, если основной не подтвердил связь.', { delay: delayMinutes, reserve: escalationMinutes }) : t('Сообщения при задержке выключены.')}</Text>
        {!!backupNames && <Text style={s.rowSubtitle}>{t('Резервные контакты · {value0}', { value0: backupNames })}</Text>}
        <Text style={s.rowSubtitle}>{t('SOS сразу получают все выбранные контакты. Без подтверждения основного резервные получат повторную тревогу.')}</Text>
      </View>}
      {panel === 'permissions' && <DeviceControls compact user={user} active={active} reminder={reminder} />}
      {panel === 'privacy' && <>
        <PreferenceRow title={t('Хранить историю')} value={t('{count} дн.', { count: retentionDays })} disabled={disabled} onPress={() => open('retentionDays')} />
        <PreferenceRow title={t('Очистить историю прогулок')} disabled={disabled} onPress={() => open('clear')} />
        <PreferenceRow title={t('Сбросить настройки')} disabled={disabled || !!error} last onPress={() => open('reset')} />
        {!!feedback && <Text accessibilityLiveRegion="polite" style={[s.rowSubtitle, { marginTop: 16 }]}>{feedback}</Text>}
      </>}
      {panel === 'clear' && <><Text style={s.modalDescription}>{t('Будут удалены завершённые поездки. Активная поездка и сохранённые места останутся.')}</Text><View style={{ marginTop: 24 }}><ActionButton title={t('Подтвердить удаление истории')} danger busy={working} disabled={saving || loading} onPress={() => confirm('clear')} /></View></>}
      {panel === 'reset' && <><Text style={s.modalDescription}>{t('Оформление и настройки поездок вернутся к стандартным значениям.')}</Text><View style={{ marginTop: 24 }}><ActionButton title={t('Сбросить настройки')} danger busy={working} disabled={saving || loading || !!error} onPress={() => confirm('reset')} /></View></>}
      {!!failure && <Text role="alert" style={s.mapError}>{t(failure)}</Text>}
    </ModalSheet>
  </View>;
}
