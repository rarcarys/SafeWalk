import {
  View,
  Text,
  Platform,
  Pressable,
  Linking,
  ScrollView,
} from 'react-native';
import s from '../styles/appStyles';
import MapCanvas from '../components/maps/MapCanvas';
import IconButton from '../components/ui/IconButton';
import RouteScreen from './RouteScreen';
import RoutePlanner from '../components/maps/RoutePlanner';
import Icon from '../components/ui/Icon';
import { colors } from '../styles/theme';
import React from 'react';
export default function MapScreen({
  planning,
  trip,
  contact,
  sharing,
  dialogs,
  navigation,
  desktop,
}) {
  const {
    origin,
    target,
    route,
    focusRequest,
    selectTarget,
    locationBusy,
    locate,
    collapsed,
    setCollapsed,
    recent,
  } = planning;
  const { routeState } = trip;
  const { setDialog } = dialogs;
  return (
    <View style={[s.workspace, desktop && s.desktopWorkspace]}>
      <View style={s.mapCanvas}>
        <MapCanvas
          origin={origin}
          target={target}
          route={route}
          focusRequest={focusRequest}
          onSelect={selectTarget}
          editable={routeState === 'planned'}
        />
        <View pointerEvents="none" style={s.mapStreet}>
          <View style={s.blueDot} />
          <Text style={s.mapStreetText}>
            {routeState === 'active'
              ? 'В пути'
              : origin.gps
                ? 'Моя геопозиция'
                : 'Алматы'}
          </Text>
        </View>
        <IconButton
          icon={locationBusy ? 'clock' : 'crosshair'}
          label="Моё местоположение"
          onPress={locate}
          style={s.locateButton}
        />
        {Platform.OS !== 'web' && route && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Данные маршрута OpenStreetMap и FOSSGIS"
            onPress={() =>
              Linking.openURL('https://routing.openstreetmap.de/about.html')
            }
            style={s.nativeAttribution}
          >
            <Text style={s.nativeAttributionText}>
              Маршрут © OpenStreetMap · FOSSGIS
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        style={[
          s.tripPanel,
          desktop && s.desktopTripPanel,
          !desktop &&
            collapsed && {
              maxHeight: 65,
            },
        ]}
        contentContainerStyle={[
          s.tripPanelContent,
          desktop && s.desktopPanelContent,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!desktop && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              collapsed ? 'Развернуть маршрут' : 'Свернуть маршрут'
            }
            onPress={() => setCollapsed((value) => !value)}
            style={s.sheetToggle}
          >
            <View style={s.sheetHandle} />
            {collapsed && (
              <Text style={s.collapsedTitle}>
                {target?.name || 'Куда идём?'}
              </Text>
            )}
          </Pressable>
        )}
        {(desktop || !collapsed) && (
          <>
            {routeState !== 'planned' ? (
              <RouteScreen
                routeState={routeState}
                destination={planning.destination}
                arrivalLabel={trip.arrivalLabel}
                duration={planning.duration}
                extraMinutes={trip.extraMinutes}
                transport={planning.transport}
                distance={planning.distance}
                contact={contact}
                onChooseContact={() => setDialog('contact')}
                onArrive={trip.onArrive}
                onAddTime={trip.onAddTime}
                onOpenSettings={() => navigation.go('settings')}
              />
            ) : (
              <RoutePlanner
                planning={planning}
                contact={contact}
                sharing={sharing}
                dialog={dialogs.dialog}
                onChooseContact={() => setDialog('contact')}
              />
            )}
            {desktop && routeState === 'planned' && (
              <View style={s.desktopTripExtra}>
                <Text style={s.groupLabel}>НЕДАВНИЕ МЕСТА</Text>
                {recent.length ? (
                  recent.map((point, index) => (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`Открыть ${point.name}`}
                      onPress={() => selectTarget(point)}
                      style={s.historyRow}
                    >
                      <Icon name="clock" size={17} color={colors.muted} />
                      <Text style={[s.rowTitle, s.flex]} numberOfLines={2}>
                        {point.name}
                      </Text>
                      <Icon
                        name="arrow-up-left"
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  ))
                ) : (
                  <Text style={s.rowSubtitle}>Пока нет выбранных мест</Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
