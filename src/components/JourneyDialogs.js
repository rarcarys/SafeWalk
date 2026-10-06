import React, { useState } from 'react';
import ModalSheet from './ui/ModalSheet';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  Pressable,
  View,
} from 'react-native';
import { colors } from '../styles/theme';
import s from '../styles/appStyles';
import Icon from './ui/Icon';
import ActionButton from './ui/ActionButton';
import Avatar from './ui/Avatar';
import { people } from '../data/contacts';
export default function JourneyDialogs({
  dialogs,
  planning,
  trip,
  contacts,
  notifications,
  onSignOut,
}) {
  const { dialog, setDialog, searchVersion } = dialogs;
  const {
    searchBusy,
    setSearchBusy,
    mapError,
    searchResults,
    selectTarget,
    buildRoute,
  } = planning;
  const { routeState } = trip;
  const { contact, setContact, inspectedContact } = contacts;
  const { notify } = notifications;
  const [logoutBusy, setLogoutBusy] = useState(false);
  return (
    <>
      {' '}
      <ModalSheet
        visible={dialog === 'search'}
        title="Найденные места"
        onClose={() => {
          searchVersion.current++;
          setSearchBusy(false);
          setDialog(null);
        }}
      >
        {searchBusy ? (
          <ActivityIndicator
            color={colors.blue}
            style={{
              marginVertical: 24,
            }}
          />
        ) : (
          <ScrollView
            style={{
              maxHeight: 310,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {!!mapError && (
              <Text accessibilityRole="alert" style={s.mapError}>
                {mapError}
              </Text>
            )}
            {searchResults?.length === 0 && (
              <Text style={s.modalDescription}>
                Ничего не найдено. Уточните адрес и город.
              </Text>
            )}
            {searchResults?.map((point, index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Выбрать ${point.name}`}
                onPress={() => selectTarget(point)}
                style={s.searchResult}
              >
                <Icon name="map-pin" size={18} color={colors.blue} />
                <Text style={[s.rowTitle, s.flex]}>{point.name}</Text>
                <Icon name="chevron-right" size={16} />
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Text style={s.modalFootnote}>
          Поиск: OpenStreetMap. Введённый адрес передаётся сервису Nominatim.
        </Text>
      </ModalSheet>
      <ModalSheet
        visible={dialog === 'routeConsent'}
        title="Построить маршрут?"
        onClose={() => setDialog(null)}
      >
        <Text style={s.modalDescription}>
          Координаты точек А и Б будут переданы сервису маршрутов FOSSGIS.
          Близким ваша геопозиция не отправляется.
        </Text>
        <View
          style={{
            marginTop: 22,
          }}
        >
          <ActionButton
            title="Разрешить и построить"
            icon="navigation"
            onPress={buildRoute}
          />
        </View>
        <ActionButton
          title="Отмена"
          secondary
          onPress={() => setDialog(null)}
        />
      </ModalSheet>
      <ModalSheet
        visible={dialog === 'logout'}
        title="Выйти из аккаунта?"
        onClose={() => setDialog(null)}
      >
        <Text style={s.modalDescription}>
          {routeState === 'active'
            ? 'Текущее сопровождение будет завершено.'
            : 'Вы сможете войти снова в любое время.'}
        </Text>
        <View
          style={{
            marginTop: 22,
          }}
        >
          <ActionButton
            title="Выйти"
            busy={logoutBusy}
            onPress={async () => {
              setLogoutBusy(true);
              try {
                await onSignOut();
              } catch (error) {
                setDialog(null);
                notify(error.message);
              } finally {
                setLogoutBusy(false);
              }
            }}
          />
        </View>
        <ActionButton
          title="Отмена"
          secondary
          onPress={() => setDialog(null)}
        />
      </ModalSheet>
      <ModalSheet
        visible={dialog === 'sos'}
        title="Отправить SOS?"
        onClose={() => setDialog(null)}
      >
        <Text style={s.modalDescription}>
          Попросите Дану и маму связаться с вами.
        </Text>
        <View style={s.sosRecipients}>
          <Avatar person="dana" small />
          <Avatar person="mom" small />
          <Text style={s.rowSubtitle}>2 контакта</Text>
        </View>
        <ActionButton
          title="Отправить SOS"
          danger
          onPress={() => {
            setDialog(null);
            notify(
              'Не удалось отправить сообщения. Свяжитесь с близкими напрямую.',
            );
          }}
        />
        <ActionButton
          title="Отмена"
          secondary
          onPress={() => setDialog(null)}
        />
      </ModalSheet>
      <ModalSheet
        visible={dialog === 'contact'}
        title="Кто будет на связи"
        onClose={() => setDialog(null)}
      >
        {['dana', 'mom'].map((id) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={people[id].name}
            accessibilityState={{
              checked: contact === id,
            }}
            onPress={() => {
              setContact(id);
              setDialog(null);
            }}
            style={s.personRow}
          >
            <Avatar person={id} />
            <View style={s.flex}>
              <Text style={s.personName}>{people[id].name}</Text>
              <Text style={s.rowSubtitle}>{people[id].relation}</Text>
            </View>
            <View style={[s.radio, contact === id && s.radioSelected]}>
              {contact === id && <View style={s.radioDot} />}
            </View>
          </Pressable>
        ))}
      </ModalSheet>
      <ModalSheet
        visible={dialog === 'person'}
        title={people[inspectedContact].name}
        onClose={() => setDialog(null)}
      >
        <Text style={s.modalDescription}>
          {people[inspectedContact].relation} ·{' '}
          {inspectedContact === contact ? 'основной' : 'резервный'} контакт
          сопровождения
        </Text>
        <View
          style={{
            marginTop: 20,
          }}
        >
          <ActionButton
            title={
              inspectedContact === contact
                ? 'Выбрать другой контакт'
                : 'Сделать основным'
            }
            secondary
            onPress={() => {
              if (inspectedContact === contact) setDialog('contact');
              else {
                setContact(inspectedContact);
                setDialog(null);
              }
            }}
          />
        </View>
      </ModalSheet>
    </>
  );
}
