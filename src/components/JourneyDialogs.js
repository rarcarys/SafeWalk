import { useSettings } from '../context/SettingsContext';
import React, { useState } from 'react';
import ModalSheet from './ui/ModalSheet';
import { ActivityIndicator, ScrollView, Text, Pressable, View } from 'react-native';
import Icon from './ui/Icon';
import ActionButton from './ui/ActionButton';
import ContactDialogs from './ContactDialogs';
import TripDialogs from './TripDialogs';
import ContactLinks from './ContactLinks';
import NotificationStatus from './NotificationStatus';
export default function JourneyDialogs({
  dialogs,
  planning,
  trip,
  contacts,
  notifications,
  onSignOut,
  onOpenChat,
  account,
  sharedJourney,
  onOpenMap
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  const {
    dialog,
    setDialog,
    searchVersion
  } = dialogs;
  const {
    searchBusy,
    setSearchBusy,
    mapError,
    searchResults,
    selectTarget,
    buildRoute
  } = planning;
  const {
    routeState
  } = trip;
  const {
    notify
  } = notifications;
  const [logoutBusy, setLogoutBusy] = useState(false);
  return <>
      <ModalSheet visible={dialog === 'search'} title={t("Найденные места")} onClose={() => {
      searchVersion.current++;
      setSearchBusy(false);
      setDialog(null);
    }}>

        {searchBusy ? <ActivityIndicator color={colors.blue} style={{
        marginVertical: 24
      }} /> : <ScrollView style={{
        maxHeight: 310
      }} keyboardShouldPersistTaps="handled">

            {!!mapError && <Text accessibilityRole="alert" style={s.mapError}>
                {mapError}
              </Text>}
            {searchResults?.length === 0 && <Text style={s.modalDescription}>{t('Адрес не найден. Проверьте город, название улицы и номер дома. Если дома нет в данных карты, выберите точку вручную.')}

          </Text>}
            {searchResults?.map((point, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={t("Выбрать {value0}", {
          value0: point.name
        })} onPress={() => selectTarget(point, planning.collapsed)} style={s.searchResult}>

                <Icon name="map-pin" size={18} color={colors.blue} />
                <Text style={[s.rowTitle, s.flex]}>{point.name}</Text>
                <Icon name="chevron-right" size={16} />
              </Pressable>)}
          </ScrollView>}
        <Text style={s.modalFootnote}>{t("Поиск: OpenStreetMap. Введённый адрес передаётся сервису Nominatim.")}

        </Text>
      </ModalSheet>
      <ModalSheet visible={dialog === 'routeConsent'} title={t("Построить маршрут?")} onClose={() => setDialog(null)}>

        <Text style={s.modalDescription}>{t("Координаты точек А и Б будут переданы сервису маршрутов FOSSGIS. Передача координат контактам настраивается отдельно перед поездкой.")}


        </Text>
        <View style={{
        marginTop: 22
      }}>

          <ActionButton title={t("Разрешить и построить")} icon="navigation" onPress={buildRoute} />

        </View>

      </ModalSheet>
      <ModalSheet visible={dialog === 'logout'} title={t("Выйти из аккаунта?")} onClose={() => setDialog(null)}>

        <Text style={s.modalDescription}>
          {routeState === 'active' ? t("Поездка сохранится в аккаунте. Сценарий связи продолжит работать на сервере. Чтобы остановить его, сначала отмените поездку.") : t("Вы сможете войти снова в любое время.")}
        </Text>
        <View style={{
        marginTop: 22
      }}>

          <ActionButton title={t("Выйти")} busy={logoutBusy} onPress={async () => {
          setLogoutBusy(true);
          try {
            await onSignOut();
          } catch (error) {
            setDialog(null);
            notify(error.message);
          } finally {
            setLogoutBusy(false);
          }
        }} />

        </View>
        <ActionButton title={t("Отмена")} secondary onPress={() => setDialog(null)} />

      </ModalSheet>
      <TripDialogs dialogs={dialogs} planning={planning} trip={trip} account={account} contacts={contacts} notify={notify} sharedJourney={sharedJourney} onOpenChat={onOpenChat} onOpenMap={onOpenMap} />
      <ContactDialogs dialogs={dialogs} contacts={contacts} onOpenChat={onOpenChat} />
      <ContactLinks dialogs={dialogs} contacts={contacts} />
      <NotificationStatus dialogs={dialogs} journeyId={account.active?.id} />
    </>;
}
