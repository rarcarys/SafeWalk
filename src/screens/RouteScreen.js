import { View, Text, Pressable } from 'react-native';
import s from '../styles/appStyles';
import ContactSelector from '../components/ui/ContactSelector';
import ActionButton from '../components/ui/ActionButton';
import Icon from '../components/ui/Icon';
import { colors } from '../styles/theme';
import React from 'react';
export default function RouteScreen({
  routeState,
  destination,
  arrivalLabel,
  duration,
  extraMinutes,
  transport,
  distance,
  contact,
  onChooseContact,
  onArrive,
  onAddTime,
  onOpenSettings,
}) {
  return (
    <>
      <View style={s.tripState}>
        <View
          style={[
            s.stateDot,
            routeState === 'arrived' && {
              backgroundColor: '#32835d',
            },
          ]}
        />
        <Text style={s.tripStateText}>
          {routeState === 'arrived'
            ? 'Вы в безопасности'
            : 'Сопровождение активно'}
        </Text>
      </View>
      <Text style={s.panelTitle} numberOfLines={2}>
        {destination.trim() || 'Место назначения'}
      </Text>
      <View style={s.tripNumbers}>
        <View>
          <Text style={s.tripNumber}>{arrivalLabel}</Text>
          <Text style={s.tripNumberLabel}>Прибытие</Text>
        </View>
        <View style={s.numberDivider} />
        <View>
          <Text style={s.tripNumber}>
            {duration + extraMinutes}
            <Text style={s.minutesUnit}> мин</Text>
          </Text>
          <Text style={s.tripNumberLabel}>
            {transport === 'walk' ? 'Пешком' : 'На машине'} · {distance}
          </Text>
        </View>
      </View>
      <ContactSelector contact={contact} onPress={onChooseContact} />
      <ActionButton
        title={routeState === 'arrived' ? 'Готово' : 'Я на месте'}
        icon={routeState === 'arrived' ? undefined : 'check'}
        onPress={onArrive}
      />
      {routeState !== 'arrived' && (
        <ActionButton
          title="Добавить 5 минут"
          icon="clock"
          secondary
          onPress={onAddTime}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Сценарий при задержке"
        onPress={onOpenSettings}
        style={s.delayLink}
      >
        <Text style={s.delayLinkText}>
          Нет ответа 5 минут → сообщение близкому
        </Text>
        <Icon name="chevron-right" size={14} color={colors.muted} />
      </Pressable>
    </>
  );
}
