import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

export default function MapCanvas({ origin, target, route, focusRequest, onSelect, editable }) {
  const map = useRef(null);
  const ready = useRef(false);
  const frame = () => {
    if (!ready.current) return;
    const coordinates = route?.coordinates || (target ? [origin, target] : null);
    if (coordinates) map.current?.fitToCoordinates(coordinates, { edgePadding: { top: 55, right: 45, bottom: 50, left: 45 }, animated: true });
  };
  useEffect(frame, [origin, target, route]);
  useEffect(() => {
    if (ready.current && focusRequest) map.current?.animateToRegion({ ...origin, latitudeDelta: 0.012, longitudeDelta: 0.012 });
  }, [focusRequest]);
  return <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={{ ...origin, latitudeDelta: 0.024, longitudeDelta: 0.024 }}
    onMapReady={() => { ready.current = true; frame(); }} showsCompass showsScale
    onPress={event => { if (editable) onSelect({ ...event.nativeEvent.coordinate, name: 'Точка на карте' }); }}>
    <Marker coordinate={origin} title={origin.gps ? 'Вы' : 'Точка отправления'} pinColor="#3169e8" />
    {target && <Marker coordinate={target} title={target.name} pinColor="#202124" />}
    {route && <><Polyline coordinates={route.coordinates} strokeColor="#ffffff" strokeWidth={9} /><Polyline coordinates={route.coordinates} strokeColor="#3169e8" strokeWidth={5} /></>}
  </MapView>;
}
