import { useSettings } from '../../context/SettingsContext';
import { avatarPalette } from '../../data/contacts';
import { View, Text, Image, Pressable, Modal, useWindowDimensions } from 'react-native';
import IconButton from './IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import presets from '../../data/avatars.json';
import React, { useState } from 'react';
export default function Avatar({
  person,
  small,
  large,
  initial,
  zoomable = true
}) {
  const {
    appStyles: s,
    fontScale,
    t
  } = useSettings();
  const data = typeof person === 'object' && person || avatarPalette[0];
  const [failedPhoto, setFailedPhoto] = useState(null);
  const [viewing, setViewing] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.max(100, Math.min(width - 32, height - insets.top - insets.bottom - 150, 560));
  const preset = presets.find(item => data.avatar === `preset:${item.id}`);
  const photo = typeof data.avatar === 'string' && data.avatar.startsWith('data:image/') && failedPhoto !== data.avatar;
  const thumbnail = <View style={[s.avatar, small && s.smallAvatar, large && s.largeAvatar, {
    backgroundColor: preset?.background || data.background || '#e1e9ec', overflow: 'hidden'
  }]}>
      {photo ? <Image source={{ uri: data.avatar }} accessibilityLabel={data.name} onError={() => setFailedPhoto(data.avatar)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} resizeMode="cover" /> : preset ? <Icon name={preset.icon} size={large ? 32 : small ? 17 : 23} color={preset.color} /> : <Text style={[s.avatarLetter, large && {
      fontSize: 27 * fontScale
    }, {
      color: data.foreground || '#4c707e'
    }]}>
        {initial || data.letter || Array.from(data.name || '?')[0]?.toUpperCase()}
      </Text>}
    </View>;
  if (!zoomable || (!photo && !preset)) return thumbnail;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Посмотреть аватар: {name}', { name: data.name || t('Профиль') })} onPress={event => { event.stopPropagation(); setViewing(true); }} style={{ flexShrink: 0 }}>{thumbnail}</Pressable>
    <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: '#101318f5', alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Закрыть просмотр аватара')} onPress={() => setViewing(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <View style={{ position: 'absolute', right: 16, top: insets.top + 12 }}><IconButton icon="x" color="#ffffff" label={t('Закрыть просмотр аватара')} onPress={() => setViewing(false)} /></View>
        <View style={{ width: size, height: size, borderRadius: 24, overflow: 'hidden', backgroundColor: preset?.background || '#e1e9ec', alignItems: 'center', justifyContent: 'center' }}>
          {photo ? <Image source={{ uri: data.avatar }} accessibilityLabel={t('Аватар крупным планом')} resizeMode="contain" style={{ width: size, height: size }} /> : <Icon name={preset.icon} size={size * 0.48} color={preset.color} />}
        </View>
        {!!data.name && <Text style={{ color: '#ffffff', fontSize: 16, marginTop: 20, paddingHorizontal: 24, textAlign: 'center' }}>{data.name}</Text>}
      </View>
    </Modal>
  </>;
}
