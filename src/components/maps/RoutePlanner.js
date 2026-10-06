import { Text, Pressable, View, TextInput } from 'react-native';
import s from '../../styles/appStyles';
import Icon from '../ui/Icon';
import { colors } from '../../styles/theme';
import IconButton from '../ui/IconButton';
import ContactSelector from '../ui/ContactSelector';
import ActionButton from '../ui/ActionButton';
import React from 'react';
export default function RoutePlanner({
  planning,
  contact,
  sharing,
  dialog,
  onChooseContact,
}) {
  const {
    route,
    origin,
    locate,
    destinationInput,
    destination,
    setDestination,
    setTarget,
    resetRoute,
    searchPlaces,
    transport,
    setTransport,
    duration,
    distance,
    mapError,
    target,
    start,
    mapBusy,
  } = planning;
  return (
    <>
      <Text style={s.panelTitle}>Куда идём?</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Изменить точку отправления"
        onPress={locate}
        style={s.originRow}
      >
        <View style={s.originDot} />
        <Text style={s.originText}>{origin.name}</Text>
        <Icon name="crosshair" size={15} color={colors.blue} />
      </Pressable>
      <View style={s.destinationField}>
        <Icon name="map-pin" size={18} />
        <TextInput
          ref={destinationInput}
          accessibilityLabel="Место назначения"
          style={s.destinationInput}
          value={destination}
          onChangeText={(value) => {
            setDestination(value);
            setTarget(null);
            resetRoute();
          }}
          placeholder="Адрес или место"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          onSubmitEditing={searchPlaces}
        />
        {!!destination && (
          <IconButton
            icon="x"
            label="Очистить адрес"
            onPress={() => {
              setDestination('');
              setTarget(null);
              resetRoute();
              destinationInput.current?.focus();
            }}
            style={s.clearAddress}
          />
        )}
        <IconButton
          icon="search"
          label="Найти адрес"
          onPress={searchPlaces}
          style={s.clearAddress}
        />
      </View>
      <View style={s.modeControl}>
        {[
          ['walk', 'Пешком', 'user'],
          ['car', 'На машине', 'truck'],
        ].map(([id, label, icon]) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{
              selected: transport === id,
            }}
            onPress={() => {
              if (id !== transport) {
                setTransport(id);
                resetRoute();
              }
            }}
            style={[s.modeOption, transport === id && s.modeSelected]}
          >
            <Icon
              name={icon}
              size={16}
              color={transport === id ? colors.ink : colors.muted}
            />
            <Text
              style={[
                s.modeLabel,
                transport !== id && {
                  color: colors.muted,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {route && (
        <View style={s.routeSummary}>
          <Icon name="navigation" size={16} color={colors.blue} />
          <Text style={s.routeSummaryText}>{duration} мин</Text>
          <Text style={s.rowSubtitle}>{distance}</Text>
          <Text style={s.routeEstimate}>
            ≈{' '}
            {new Date(Date.now() + duration * 60000).toLocaleTimeString(
              'ru-RU',
              {
                hour: '2-digit',
                minute: '2-digit',
              },
            )}
          </Text>
        </View>
      )}
      {!!mapError && dialog !== 'search' && (
        <Text accessibilityRole="alert" style={s.mapError}>
          {mapError}
        </Text>
      )}
      <ContactSelector contact={contact} onPress={onChooseContact} />
      <ActionButton
        title={
          route
            ? 'Начать сопровождение'
            : target
              ? 'Построить маршрут'
              : 'Найти место'
        }
        onPress={start}
        busy={mapBusy}
        icon={route ? 'arrow-right' : 'navigation'}
      />
      <View style={s.sharingStatus}>
        <Icon
          name={sharing ? 'map-pin' : 'lock'}
          size={12}
          color={colors.muted}
        />
        <Text style={s.sharingStatusText}>
          {sharing
            ? 'Настройка передачи геопозиции включена'
            : 'Геопозиция не передаётся'}
        </Text>
      </View>
    </>
  );
}
