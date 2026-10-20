import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { apiBase } from '../services/api';
import * as api from '../services/safetyTools';
import { actionKey } from '../services/journeys';
import ModalSheet from './ui/ModalSheet';
import ActionButton from './ui/ActionButton';
import PreferenceRow from './ui/PreferenceRow';
import SettingRow from './ui/SettingRow';
import IconButton from './ui/IconButton';

const names = { taxi: 'Такси', meeting: 'Встреча', walk: 'Прогулка' };
const menus = { safetyTools: 'Ещё', safetyTimer: 'Проверь меня', safetyCheckin: 'Ты в порядке?', safetyPresets: 'Мои сценарии', safetyPresetEdit: 'Настроить сценарий', safetyShare: 'Ссылка на прогулку' };

export default function SafetyTools({ safety, contacts, account, planning, trip, dialogs, notify }) {
  const { appStyles: s, colors, t, locale } = useSettings();
  const { dialog, setDialog } = dialogs;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
  const [minutes, setMinutes] = useState(15), [selected, setSelected] = useState([]);
  const [presetSlot, setPresetSlot] = useState('walk'), [sharing, setSharing] = useState(false);
  const [link, setLink] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const reminded = useRef(null), requestKey = useRef(null);
  const people = Object.values(contacts.people).filter(person => person.peerId && person.connectionStatus === 'accepted');
  const visible = !!menus[dialog];
  useEffect(() => {
    if (safety.appliedPreset && !account.loading && !account.active) trip.applySafetyPreset(safety.appliedPreset);
  }, [safety.appliedPreset?.slot, safety.appliedPreset?.minutes, account.loading, account.active?.id]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    setError(''); setFeedback(''); requestKey.current = null;
    if (dialog === 'safetyTimer') {
      setMinutes(safety.appliedPreset?.minutes || 15);
      setSelected([contacts.contact, ...contacts.backupIds].filter(id => contacts.people[id]?.connectionStatus === 'accepted'));
    }
  }, [dialog]);
  useEffect(() => {
    const timer = safety.timer;
    if (timer && timer.status === 'active' && clock >= timer.expectedAt && !dialog && reminded.current !== timer.expectedAt) {
      reminded.current = timer.expectedAt;
      setDialog('safetyCheckin');
    }
  }, [safety.timer?.expectedAt, clock, dialog]);
  const run = async operation => {
    if (busy) return;
    setBusy(true); setError(''); setFeedback('');
    try { await operation(); await safety.refresh(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) setDialog(null); };
  const contactPicker = <View>
    <Text style={s.rowSubtitle}>{t('Первый выбранный контакт — основной. Остальные — резервные.')}</Text>
    {!people.length && <Text style={s.mapError}>{t('Сначала добавьте контакты с принятым приглашением.')}</Text>}
    {people.map(person => <Pressable key={person.id} accessibilityRole="checkbox" accessibilityLabel={person.name} accessibilityState={{ checked: selected.includes(person.id), disabled: busy }} disabled={busy}
      onPress={() => setSelected(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])} style={s.menuAction}>
      <Text style={[s.rowTitle, s.flex]}>{person.name}</Text><Text style={s.blueText}>{selected.includes(person.id) ? selected[0] === person.id ? t('Основной') : '✓' : '+'}</Text>
    </Pressable>)}
  </View>;
  const timePicker = <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
    {[15, 30, 60].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={t('{count} мин', { count: value })} accessibilityState={{ checked: minutes === value, disabled: busy }} disabled={busy} onPress={() => setMinutes(value)} style={[s.settingsOption, { flex: 1, justifyContent: 'center', padding: 12 }, minutes === value && s.settingsOptionSelected]}>
      <Text style={s.rowTitle}>{t('{count} мин', { count: value })}</Text>
    </Pressable>)}
  </View>;
  const timerAction = action => run(async () => {
    if (!requestKey.current) requestKey.current = { action, id: actionKey() };
    if (requestKey.current.action !== action) requestKey.current = { action, id: actionKey() };
    const result = await api.safetyTimerAction(safety.timer.id, { action, clientId: requestKey.current.id });
    safety.updateTimer(result.timer); requestKey.current = null;
    if (action === 'extend') { setDialog('safetyTimer'); setFeedback('Проверка продлена на 15 минут'); }
    else { setDialog(null); notify(t(action === 'confirm' ? 'Проверка завершена: всё в порядке' : 'Проверка отменена')); }
  });
  const shareLink = async () => {
    if (Platform.OS === 'web' && navigator.share) await navigator.share({ title: 'SafeWalk', url: link.url });
    else if (Platform.OS === 'web' && navigator.clipboard) { await navigator.clipboard.writeText(link.url); setFeedback('Ссылка скопирована'); }
    else await Share.share({ message: link.url });
  };
  const editPreset = slot => {
    const saved = safety.presets.find(item => item.slot === slot);
    setPresetSlot(slot); setMinutes(saved?.minutes || (slot === 'meeting' ? 60 : 30));
    setSharing(saved?.sharing || false);
    setSelected(saved ? [saved.primaryId, ...saved.backupIds] : [contacts.contact, ...contacts.backupIds].filter(id => contacts.people[id]?.connectionStatus === 'accepted'));
    setDialog('safetyPresetEdit');
  };
  const applyPreset = slot => run(async () => {
    const result = await api.applySafetyPreset(slot);
    await contacts.reload(true); await account.refresh();
    trip.applySafetyPreset(result.preset);
    setSelected([result.preset.primaryId, ...result.preset.backupIds]); setMinutes(result.preset.minutes);
    setFeedback('Сценарий применён. Поездка или таймер запускаются отдельно.');
  });
  return <>
    {!!safety.timer && clock >= safety.timer.expectedAt && <View style={s.accountNotice}>
      <Text style={[s.accountNoticeText, s.flex]}>{t(safety.timer.status === 'alerted' ? safety.timer.notifiedCount ? 'Проверка пропущена. Тревога добавлена в чаты контактов.' : 'Не удалось оповестить контакты. Проверьте их доступность.' : 'Время проверки: подтвердите, что всё в порядке.')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Открыть проверку безопасности')} onPress={() => setDialog('safetyCheckin')}><Text style={s.blueText}>{t('Открыть')}</Text></Pressable>
    </View>}
    <ModalSheet visible={visible} title={t(menus[dialog] || '')} onClose={close}>
      {dialog === 'safetyTools' && <>
        <PreferenceRow title={t('Проверь меня')} icon="clock" value={safety.timer ? t('Проверка включена') : t('Таймер без маршрута')} onPress={() => setDialog('safetyTimer')} />
        <PreferenceRow title={t('Мои сценарии')} icon="sliders" value={t('Такси, встреча и прогулка')} onPress={() => setDialog('safetyPresets')} />
        <PreferenceRow title={t('Ссылка на прогулку')} icon="link" value={t('Временный доступ без аккаунта')} last onPress={() => setDialog('safetyShare')} />
        <PreferenceRow title={t('Статус уведомлений')} icon="bell" onPress={() => setDialog('notificationStatus')} />
      </>}
      {['safetyTimer', 'safetyCheckin'].includes(dialog) && <View style={{ gap: 12 }}>
        {safety.timer ? <>
          <Text style={s.cardTitle}>{t('Проверка в {time}', { time: new Date(safety.timer.expectedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</Text>
          <Text style={s.rowSubtitle}>{safety.timer.peers.map(person => person.name).join(', ')}</Text>
          <Text style={s.rowSubtitle}>{t(safety.timer.status === 'alerted' ? safety.timer.notifiedCount ? 'Тревога добавлена в чаты контактов. Подтверждения прочтения пока нет.' : 'Не удалось оповестить контакты. Проверьте их доступность.' : 'После окончания таймера есть одна минута на ответ. Затем выбранные контакты получат тревогу.')}</Text>
          <ActionButton title={t('Я в порядке')} icon="check" busy={busy} onPress={() => timerAction('confirm')} />
          {safety.timer.status === 'active' && <ActionButton title={t('Добавить 15 минут')} secondary disabled={busy} onPress={() => timerAction('extend')} />}
          <ActionButton title={t('Отменить проверку')} secondary disabled={busy} onPress={() => timerAction('cancel')} />
        </> : <>
          <Text style={s.modalDescription}>{t('Через сколько проверить, что всё в порядке?')}</Text>
          {timePicker}{contactPicker}
          <Text style={s.rowSubtitle}>{t('Контакты получат сообщение о начале проверки. Если вы не ответите после таймера, через минуту им придёт тревога.')}</Text>
          <ActionButton title={t('Включить проверку')} icon="clock" busy={busy} disabled={!selected.length || safety.loading || contacts.loading} onPress={() => run(async () => {
            if (!requestKey.current) requestKey.current = { id: actionKey() };
            const result = await api.startSafetyTimer({ clientId: requestKey.current.id, minutes, contactIds: selected });
            safety.updateTimer(result.timer); requestKey.current = null; setFeedback('Проверка включена');
          })} />
        </>}
      </View>}
      {dialog === 'safetyPresets' && <>
        {Object.entries(names).map(([slot, name]) => {
          const saved = safety.presets.find(item => item.slot === slot);
          return <View key={slot} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.flex}><PreferenceRow title={t(name)} value={saved ? t('{count} мин', { count: saved.minutes }) : t('Настроить сценарий')}
              accessibilityLabel={saved ? t('Применить: {name}', { name: t(name) }) : t(name)} disabled={busy}
              onPress={() => saved ? applyPreset(slot) : editPreset(slot)} /></View>
            {!!saved && <IconButton icon="edit-2" label={t('Настроить: {name}', { name: t(name) })} disabled={busy} onPress={() => editPreset(slot)} />}
          </View>;
        })}
      </>}
      {dialog === 'safetyPresetEdit' && <View style={{ gap: 12 }}>
        <Text style={s.cardTitle}>{t(names[presetSlot])}</Text>{timePicker}{contactPicker}
        <SettingRow compact title={t('Делиться геопозицией в поездке')} value={sharing} disabled={busy} onValueChange={setSharing} />
        <ActionButton title={t('Сохранить сценарий')} busy={busy} disabled={!selected.length} onPress={() => run(async () => {
          await api.saveSafetyPreset(presetSlot, { minutes, sharing, primaryId: selected[0], backupIds: selected.slice(1) });
          setDialog('safetyPresets');
        })} />
        {safety.presets.some(item => item.slot === presetSlot) && <Pressable accessibilityRole="button" accessibilityLabel={t('Удалить: {name}', { name: t(names[presetSlot]) })} disabled={busy} style={s.textAction} onPress={() => run(async () => { await api.deleteSafetyPreset(presetSlot); setDialog('safetyPresets'); })}><Text style={s.dangerText}>{t('Удалить сценарий')}</Text></Pressable>}
      </View>}
      {dialog === 'safetyShare' && <View style={{ gap: 12 }}>
        <Text style={s.modalDescription}>{t('Человек с этой ссылкой увидит место назначения, время прибытия и текущую геопозицию. Ссылка закроется после завершения прогулки или отзыва доступа.')}</Text>
        {account.active?.status === 'active' && account.active.sharing ? <>
          {timePicker}
          <ActionButton title={t('Создать временную ссылку')} icon="link" busy={busy} onPress={() => run(async () => {
            const result = await api.createJourneyLink({ journeyId: account.active.id, minutes });
            setLink({ ...result.link, url: `${apiBase()}${result.link.path}` });
          })} />
        </> : account.active?.status === 'active' ? <>
          <Text style={s.rowSubtitle}>{t('Чтобы поделиться поездкой, разрешите передачу геопозиции. Получатель ссылки сможет видеть ваше местоположение.')}</Text>
          <ActionButton title={t('Разрешить передачу геопозиции')} secondary busy={busy} onPress={() => run(async () => { await account.setPreference('sharing', true); })} />
        </> : <Text style={s.rowSubtitle}>{t('Для ссылки нужна активная прогулка с передачей геопозиции')}</Text>}
        {link && safety.links.some(item => item.id === link.id) && <>
          <Text selectable style={s.rowSubtitle}>{link.url}</Text>
          <ActionButton title={t('Поделиться ссылкой')} icon="share-2" secondary onPress={() => run(shareLink)} />
        </>}
        {safety.links.map(item => <PreferenceRow key={item.id} title={t('Отозвать ссылку')} value={t('Доступ до {time}', { time: new Date(item.expiresAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })} icon="x-circle" disabled={busy} onPress={() => run(async () => { await api.revokeJourneyLink(item.id); if (link?.id === item.id) setLink(null); })} />)}
        <Text style={s.rowSubtitle}>{t('Ссылка работает, пока доступен сервер SafeWalk. Для локального сервера получатель должен быть в той же сети.')}</Text>
      </View>}
      {visible && !!(error || safety.error) && <Text role="alert" style={s.mapError}>{t(error || safety.error)}</Text>}
      {visible && !!feedback && <Text accessibilityLiveRegion="polite" style={s.blueText}>{t(feedback)}</Text>}
    </ModalSheet>
  </>;
}
