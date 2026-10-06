import {
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  View,
  ScrollView,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useJourney from './hooks/useJourney';
import s from './styles/appStyles';
import { StatusBar } from 'expo-status-bar';
import {
  Sidebar,
  AppHeader,
  BottomNavigation,
} from './navigation/AppNavigation';
import MapScreen from './screens/MapScreen';
import ContactsScreen from './screens/ContactsScreen';
import ProfileScreen from './screens/ProfileScreen';
import JourneyDialogs from './components/JourneyDialogs';
import React from 'react';
export default function SafeWalk({ user, onSignOut }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 960;
  const {
    planning,
    trip,
    contacts,
    preferences,
    navigation,
    dialogs,
    notifications,
  } = useJourney();
  const { page, go, scroll } = navigation;
  const { setDialog } = dialogs;
  return (
    <KeyboardAvoidingView
      style={[
        s.root,
        {
          paddingTop: insets.top,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <View style={s.shell}>
        {desktop && <Sidebar page={page} go={go} user={user} />}
        <View style={s.main}>
          <AppHeader
            desktop={desktop}
            origin={planning.origin}
            onOpenSOS={() => setDialog('sos')}
          />
          {page === 'home' || page === 'route' ? (
            <MapScreen
              planning={planning}
              trip={trip}
              contact={contacts.contact}
              sharing={preferences.sharing}
              dialogs={dialogs}
              navigation={navigation}
              desktop={desktop}
            />
          ) : (
            <ScrollView
              ref={scroll}
              style={s.flex}
              contentContainerStyle={s.listScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {page === 'contacts' ? (
                <ContactsScreen
                  contact={contacts.contact}
                  onAddContact={() => setDialog('contact')}
                  onSelectContact={(id) => {
                    contacts.setInspectedContact(id);
                    setDialog('person');
                  }}
                />
              ) : (
                <ProfileScreen
                  user={user}
                  contact={contacts.contact}
                  {...preferences}
                  onRequestSignOut={() => setDialog('logout')}
                />
              )}
            </ScrollView>
          )}
        </View>
      </View>
      {!desktop && (
        <BottomNavigation page={page} go={go} bottomInset={insets.bottom} />
      )}
      {!!notifications.toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            s.toast,
            {
              bottom: desktop ? 24 : 80 + insets.bottom,
            },
          ]}
        >
          <Text style={s.toastText}>{notifications.toast}</Text>
        </View>
      )}
      <JourneyDialogs
        dialogs={dialogs}
        planning={planning}
        trip={trip}
        contacts={contacts}
        notifications={notifications}
        onSignOut={onSignOut}
      />
    </KeyboardAvoidingView>
  );
}
