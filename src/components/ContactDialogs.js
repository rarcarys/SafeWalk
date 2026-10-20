import { useSettings } from '../context/SettingsContext';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import ModalSheet from './ui/ModalSheet';
import Avatar from './ui/Avatar';
import Icon from './ui/Icon';
import ActionButton from './ui/ActionButton';
import PreferenceRow from './ui/PreferenceRow';
import ContactPresence from './ContactPresence';
export default function ContactDialogs({
  dialogs,
  contacts,
  onOpenChat
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const {
    dialog,
    setDialog
  } = dialogs;
  const {
    people,
    contact,
    backupIds,
    inspectedContact,
    busy,
    loading,
    error: loadError
  } = contacts;
  const [primary, setPrimary] = useState(contact);
  const [reserves, setReserves] = useState(backupIds);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [mode, setMode] = useState('email');
  const [error, setError] = useState('');
  const {
    height
  } = useWindowDimensions();
  const person = people[inspectedContact];
  useEffect(() => {
    const existing = dialog === 'addContact' ? null : person;
    setPrimary(contact);
    setReserves(backupIds);
    setEmail(existing?.email || '');
    setName(existing?.name || '');
    setPhone(existing?.phone || '');
    setRelation(existing?.relation || '');
    setMode('email');
    setError('');
  }, [dialog, inspectedContact, contact, backupIds, person?.name, person?.email, person?.phone, person?.relation]);
  const close = () => {
    if (!busy) setDialog(null);
  };
  const save = async operation => {
    setError('');
    try {
      if (await operation()) setDialog(null);
    } catch (failure) {
      setError(failure.message);
    }
  };
  const warning = error || loadError;
  const problem = !!warning && <Text role="alert" style={s.mapError}>{t(warning)}</Text>;
  const input = (label, value, onChange, placeholder, type = 'default', length = 50) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={type} autoCapitalize={type === 'email-address' ? 'none' : 'sentences'} autoCorrect={false} maxLength={length} editable={!busy} style={s.contactInput} />;
  const emailField = input(t("Email контакта"), email, setEmail, t("Email аккаунта SafeWalk"), 'email-address', 254);
  const fields = <>
    {input(t("Имя контакта"), name, setName, mode === 'phone' || dialog === 'editContact' ? t("Имя контакта") : t("Имя (необязательно)"))}
    {mode === 'email' && dialog !== 'editContact' && emailField}
    {input(t("Телефон контакта"), phone, setPhone, mode === 'phone' ? t("Телефон с кодом страны") : t("Телефон (необязательно)"), 'phone-pad', 30)}
    {input(t("Кто вам этот человек"), relation, setRelation, t("Кто вам этот человек (необязательно)"))}
  </>;
  const blocked = loading || !!loadError || busy;
  return <>
    <ModalSheet visible={dialog === 'contact'} title={t("Контакты сопровождения")} onClose={close}>
      <Text style={s.modalDescription}>{Object.keys(people).length ? t("Выберите основной контакт и любое число резервных.") : t("Добавьте первый контакт. Для сопровождения и сообщений при задержке нужен аккаунт SafeWalk.")}</Text>
      {loading ? <ActivityIndicator color={colors.blue} /> : <ScrollView style={{
        maxHeight: height * 0.45
      }} keyboardShouldPersistTaps="handled">
          {!!Object.keys(people).length && <Text style={[s.groupLabel, {
          marginTop: 20
        }]}>{t("ОСНОВНОЙ КОНТАКТ")}</Text>}
          {Object.entries(people).map(([id, item]) => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={t("Основной: {value0}", {
          value0: item.name
        })} aria-checked={primary === id} aria-disabled={busy} accessibilityState={{
          checked: primary === id,
          disabled: busy
        }} disabled={busy} onPress={() => {
          setPrimary(id);
          setReserves(current => current.filter(value => value !== id));
        }} style={s.personRow}>

            <Avatar person={item} small />
            <View style={s.flex}><Text style={s.rowTitle}>{item.name}</Text><Text style={s.rowSubtitle}>{item.peerId ? t("В приложении") : t("Только звонок")}</Text></View>
            <View style={[s.radio, primary === id && s.radioSelected]}>{primary === id && <View style={s.radioDot} />}</View>
          </Pressable>)}
          {!!Object.keys(people).length && <Text style={[s.groupLabel, {
          marginTop: 22
        }]}>{"" + t("РЕЗЕРВНЫЕ КОНТАКТЫ ·") + " "}{reserves.length}</Text>}
          {Object.entries(people).filter(([id]) => id !== primary).map(([id, item]) => <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={t("Резервный: {value0}", {
          value0: item.name
        })} aria-checked={reserves.includes(id)} aria-disabled={busy} accessibilityState={{
          checked: reserves.includes(id),
          disabled: busy
        }} disabled={busy} onPress={() => setReserves(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])} style={s.personRow}>

            <Avatar person={item} small />
            <View style={s.flex}><Text style={s.rowTitle}>{item.name}</Text><Text style={s.rowSubtitle}>{item.peerId ? t("В приложении") : t("Только звонок")}</Text></View>
            <View style={[s.checkbox, reserves.includes(id) && s.checkboxSelected]}>{reserves.includes(id) && <Icon name="check" size={15} color={colors.white} />}</View>
          </Pressable>)}
        </ScrollView>}
      {problem}
      <View style={s.formActions}>
        {Object.keys(people).length ? <ActionButton title={t("Сохранить")} busy={busy} disabled={loading || !!loadError} onPress={() => save(() => contacts.saveSelection(primary, reserves))} /> : <ActionButton title={t("Добавить контакт")} icon="user-plus" disabled={blocked} onPress={() => setDialog('addContact')} />}
      </View>
    </ModalSheet>
    <ModalSheet visible={dialog === 'addContact'} title={t("Добавить контакт")} onClose={close}>
      <PreferenceRow title={t('Приглашение по ссылке')} icon="link" disabled={busy} onPress={() => setDialog('contactLinks')} />
      <View style={s.modeControl}>
        {[['email', t("В SafeWalk")], ['phone', t("По телефону")]].map(([id, label]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} aria-pressed={mode === id} disabled={busy} onPress={() => setMode(id)} style={[s.modeOption, mode === id && s.modeSelected]}>
            <Text style={s.modeLabel}>{label}</Text>
          </Pressable>)}
      </View>
      <Text style={[s.rowSubtitle, {
        marginTop: 12
      }]}>{mode === 'email' ? t("Email зарегистрированного аккаунта — для чата и сопровождения.") : t("Телефонный контакт можно вызвать из карточки и окна SOS. Сообщения в приложении требуют аккаунта.")}</Text>
      <ScrollView style={{
        maxHeight: height * 0.42
      }} keyboardShouldPersistTaps="handled">{fields}</ScrollView>
      {problem}
      <View style={s.formActions}><ActionButton title={t("Добавить")} icon="user-plus" busy={busy} disabled={loading || !!loadError || (mode === 'email' ? !email.trim() : !name.trim() || !phone.trim())} onPress={() => save(() => contacts.addContact({
          email: mode === 'email' ? email : undefined,
          name,
          phone,
          relation
        }))} /></View>
    </ModalSheet>
    <ModalSheet visible={dialog === 'person'} title={t('Контакт')} onClose={close}>
      {person && <>
        <View style={s.contactProfile}>
          <Avatar person={person} large />
          <View style={s.flex}>
            <Text style={s.contactProfileName}>{person.name}</Text>
            <ContactPresence presence={person.presence} detailed />
            <Text selectable style={s.contactProfileDetail}>{person.email || person.phone}</Text>
            <Text style={s.contactProfileDetail}>{[person.relation, t(person.peerId ? ({ accepted: 'В SafeWalk', pending: 'Ожидает принятия', declined: 'Приглашение отклонено', blocked: 'Заблокирован' })[person.connectionStatus] || 'Ожидает принятия' : 'Только звонок')].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <View style={s.contactActionList}>
          {!!person.peerId && <PreferenceRow compact title={t('Написать')} icon="message-circle" disabled={busy} onPress={() => onOpenChat(person)} />}
          {!!person.phone && <PreferenceRow compact title={t('Позвонить')} value={person.phone} icon="phone" disabled={busy} onPress={() => Linking.openURL(`tel:${person.phone}`).catch(() => setError(t('Не удалось открыть приложение для звонков. Наберите номер вручную.')))} />}
          <PreferenceRow compact title={t('Сопровождение')} value={t(contact === inspectedContact ? 'Основной контакт' : backupIds.includes(inspectedContact) ? 'Резервный контакт' : 'Не выбран для сопровождения')} icon="shield" onPress={() => setDialog('contact')} disabled={busy} />
          <PreferenceRow compact title={t('Ещё')} accessibilityLabel={t('Ещё: контакт')} icon="more-horizontal" onPress={() => setDialog('personMore')} disabled={busy} last />
        </View>
        {problem}
      </>}
    </ModalSheet>
    <ModalSheet visible={dialog === 'personMore'} title={person?.name || t('Контакт')} onClose={() => { if (!busy) setDialog('person'); }}>
      <PreferenceRow compact title={t('Изменить контакт')} icon="edit-2" disabled={busy} onPress={() => setDialog('editContact')} />
      {!person?.peerId && <PreferenceRow compact title={t('Связать аккаунт')} icon="user-plus" disabled={busy} onPress={() => setDialog('linkContact')} />}
      {!!person?.peerId && <PreferenceRow compact title={t('Заблокировать пользователя')} icon="slash" danger disabled={busy} onPress={() => setDialog('blockContact')} />}
      <PreferenceRow compact title={t('Удалить контакт')} icon="trash-2" danger disabled={busy} onPress={() => setDialog('deleteContact')} last />
    </ModalSheet>
    <ModalSheet visible={dialog === 'linkContact'} title={t('Связать аккаунт')} onClose={() => { if (!busy) setDialog('person'); }}>
      <Text style={s.modalDescription}>{t('Подключите аккаунт SafeWalk для чата и сопровождения.')}</Text>
      {emailField}{problem}
      <View style={s.formActions}><ActionButton title={t('Связать аккаунт')} busy={busy} disabled={loading || !!loadError || !email.trim()} onPress={() => save(() => contacts.linkContact(inspectedContact, email))} /></View>
    </ModalSheet>
    <ModalSheet visible={dialog === 'blockContact'} title={t('Заблокировать пользователя?')} onClose={() => { if (!busy) setDialog('personMore'); }}>
      <Text style={s.modalDescription}>{t('После блокировки контакт не сможет писать вам и сопровождать ваши прогулки.')}</Text>
      {problem}
      <ActionButton title={t('Заблокировать пользователя')} danger busy={busy} onPress={() => save(() => contacts.blockPerson(person.peerId))} />
    </ModalSheet>
    <ModalSheet visible={dialog === 'editContact'} title={t("Изменить контакт")} onClose={close}>
      <ScrollView style={{
        maxHeight: height * 0.45
      }} keyboardShouldPersistTaps="handled">{fields}</ScrollView>
      {problem}
      <View style={s.formActions}><ActionButton title={t("Сохранить контакт")} busy={busy} disabled={loading || !!loadError || !name.trim()} onPress={() => save(() => contacts.editContact(inspectedContact, {
          name,
          phone,
          relation
        }))} /></View>
    </ModalSheet>
    <ModalSheet visible={dialog === 'deleteContact'} title={t("Удалить контакт?")} onClose={close}>
      <Text style={s.modalDescription}>{person?.name}{" " + t("будет удалён из вашего круга. Доступ к вашим поездкам будет закрыт. История чата сохранится.") + ""}</Text>
      {problem}
      <View style={s.formActions}><ActionButton title={t("Удалить")} danger busy={busy} onPress={() => save(() => contacts.deleteContact(inspectedContact))} /></View>
      <ActionButton title={t("Отмена")} secondary disabled={busy} onPress={() => setDialog('person')} />
    </ModalSheet>
  </>;
}
