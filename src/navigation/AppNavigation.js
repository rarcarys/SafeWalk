import { View, Text, Pressable } from 'react-native';
import s from '../styles/appStyles';
import { tabs } from './tabs';
import Icon from '../components/ui/Icon';
import { colors } from '../styles/theme';
import Avatar from '../components/ui/Avatar';
import React from 'react';
export function Sidebar({ page, go, user }) {
  return (
    <View style={s.sidebar}>
      <Text style={s.sidebarBrand}>SafeWalk</Text>
      <View style={s.sideNav}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{
              selected: page === tab.id,
            }}
            onPress={() => go(tab.id)}
            style={[s.sideNavButton, page === tab.id && s.sideNavSelected]}
          >
            <Icon
              name={tab.icon}
              size={20}
              color={page === tab.id ? colors.ink : colors.muted}
            />
            <Text style={[s.sideNavText, page === tab.id && s.medium]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Открыть профиль"
        onPress={() => go('settings')}
        style={s.sidebarProfile}
      >
        <Avatar
          person="renata"
          small
          initial={Array.from(user.name)[0]?.toUpperCase()}
        />
        <Text style={s.profileShortcut} numberOfLines={1}>
          {user.name}
        </Text>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}
export function AppHeader({ desktop, origin, onOpenSOS }) {
  return (
    <View style={s.header}>
      {desktop ? (
        <View style={s.desktopHeaderLabel}>
          <Icon name="map-pin" size={16} color={colors.muted} />
          <Text style={s.headerLocation}>
            {origin.gps ? 'Моя геопозиция' : 'Алматы'}
          </Text>
        </View>
      ) : (
        <Text style={s.headerBrand}>SafeWalk</Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Открыть SOS"
        onPress={onOpenSOS}
        style={({ pressed }) => [s.sosHeaderButton, pressed && s.pressed]}
      >
        <Icon name="alert-circle" size={16} color={colors.red} />
        <Text style={s.sosHeaderText}>SOS</Text>
      </Pressable>
    </View>
  );
}
export function BottomNavigation({ page, go, bottomInset }) {
  return (
    <View
      style={[
        s.bottomNav,
        {
          paddingBottom: Math.max(bottomInset, 8),
        },
      ]}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{
            selected: page === tab.id,
          }}
          onPress={() => go(tab.id)}
          style={s.bottomNavButton}
        >
          <Icon
            name={tab.icon}
            size={21}
            color={page === tab.id ? colors.ink : '#95969b'}
          />
          <Text style={[s.bottomNavText, page === tab.id && s.bottomNavActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
