import { useSettings } from '../context/SettingsContext';
import { View, Text, Pressable } from 'react-native';
import { tabs } from './tabs';
import Icon from '../components/ui/Icon';
import Avatar from '../components/ui/Avatar';
import IconButton from '../components/ui/IconButton';
import React from 'react';
export function Sidebar({
  page,
  go,
  user,
  unreadCount
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  return <View style={s.sidebar}>
      <Text style={s.sidebarBrand}>SafeWalk</Text>
      <View style={s.sideNav}>
        {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={t(tab.label)} aria-selected={page === tab.id} accessibilityState={{
        selected: page === tab.id
      }} onPress={() => go(tab.id)} style={[s.sideNavButton, page === tab.id && s.sideNavSelected]}>

            <Icon name={tab.icon} size={20} color={page === tab.id ? colors.ink : colors.muted} />

            <Text style={[s.sideNavText, page === tab.id && s.medium]}>
              {t(tab.label)}
            </Text>
            {tab.id === 'chats' && unreadCount > 0 && <Text style={s.unreadBadge}>{unreadCount > 99 ? '99+' : unreadCount}</Text>}
          </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Открыть профиль")} onPress={() => go('profile')} style={s.sidebarProfile}>

        <Avatar person={user} small initial={Array.from(user.name)[0]?.toUpperCase()} />

        <Text style={s.profileShortcut} numberOfLines={1}>
          {user.name}
        </Text>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
    </View>;
}
export function AppHeader({
  desktop,
  origin,
  onOpenSOS,
  onOpenProfile
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  return <View style={s.header}>
      {desktop ? <View style={s.desktopHeaderLabel}>
          <Icon name="map-pin" size={16} color={colors.muted} />
          <Text style={s.headerLocation}>
            {origin.chosen ? origin.name : t("Выберите точку отправления")}
          </Text>
        </View> : <Text style={s.headerBrand}>SafeWalk</Text>}
      <View style={s.headerActions}>
      <IconButton icon="user" label={t("Открыть профиль")} onPress={onOpenProfile} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("Открыть SOS")} onPress={onOpenSOS} style={({
        pressed
      }) => [s.sosHeaderButton, pressed && s.pressed]}>

        <Icon name="alert-circle" size={16} color={colors.red} />
        <Text style={s.sosHeaderText}>SOS</Text>
      </Pressable>
      </View>
    </View>;
}
export function BottomNavigation({
  page,
  go,
  bottomInset,
  unreadCount
}) {
  const {
    appStyles: s,
    colors,
    t
  } = useSettings();
  return <View style={[s.bottomNav, {
    paddingBottom: Math.max(bottomInset, 8)
  }]}>

      {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={t(tab.label)} aria-selected={page === tab.id} accessibilityState={{
      selected: page === tab.id
    }} onPress={() => go(tab.id)} style={s.bottomNavButton}>

          <View style={{
        position: 'relative'
      }}><Icon name={tab.icon} size={21} color={page === tab.id ? colors.ink : colors.muted} />
          {tab.id === 'chats' && unreadCount > 0 && <Text style={s.navBadge}>{unreadCount > 99 ? '99+' : unreadCount}</Text>}</View>
          <Text style={[s.bottomNavText, page === tab.id && s.bottomNavActive]}>
            {t(tab.label)}
          </Text>
        </Pressable>)}
    </View>;
}
