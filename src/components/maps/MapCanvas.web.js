import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { useSettings } from '../../context/SettingsContext';
const latLng = point => [point.latitude, point.longitude];
const pin = (label, origin) => L.divIcon({
  className: 'safewalk-pin',
  html: `<span class="${origin ? 'origin' : 'target'}">${label}</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});
const tooltip = text => {
  const element = document.createElement('span');
  element.textContent = text;
  return element;
};
export default function MapCanvas({
  origin,
  target,
  route,
  focusRequest,
  onSelect,
  editable,
  currentPosition,
  onCurrentPositionPress,
  autoFrame = true
}) {
  const {
    isDark,
    fontScale,
    colors,
    t
  } = useSettings();
  const element = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  const select = useRef(onSelect);
  const canEdit = useRef(editable);
  const positionPress = useRef(onCurrentPositionPress);
  positionPress.current = onCurrentPositionPress;
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  select.current = onSelect;
  canEdit.current = editable;
  useEffect(() => {
    // Анимация Leaflet может продолжаться после ухода с экрана.
    const instance = L.map(element.current, {
      zoomControl: false,
      zoomAnimation: false
    }).setView(latLng(origin), 15);
    map.current = instance;
    L.control.zoom({
      position: 'topright'
    }).addTo(instance);
    instance.attributionControl.setPrefix(false);
    L.tileLayer(process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS</a>'
    }).on('tileerror', () => setTileError(true)).on('tileload', () => setTileError(false)).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    instance.on('click', event => {
      if (canEdit.current) select.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        name: t("Точка на карте")
      });
    });
    const record = () => {
      if (!element.current) return;
      element.current.dataset.zoom = instance.getZoom();
      element.current.dataset.center = JSON.stringify(instance.getCenter());
    };
    instance.on('moveend zoomend', record);
    record();
    const observer = new ResizeObserver(() => instance.invalidateSize({
      pan: false
    }));
    observer.observe(element.current);
    setReady(true);
    return () => {
      observer.disconnect();
      instance.off('moveend zoomend', record);
      instance.stop();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    layers.current.clearLayers();
    if (origin.chosen !== false) L.marker(latLng(origin), {
      icon: pin(t("А"), true)
    }).bindTooltip(tooltip(t("Точка отправления"))).addTo(layers.current);
    if (target) L.marker(latLng(target), {
      icon: pin(t("Б"), false)
    }).bindTooltip(tooltip(target.name)).addTo(layers.current);
    if (route) {
      L.polyline(route.coordinates.map(latLng), {
        color: '#ffffff',
        weight: 9
      }).addTo(layers.current);
      L.polyline(route.coordinates.map(latLng), {
        color: '#3169e8',
        weight: 5,
        lineCap: 'round'
      }).addTo(layers.current);
    }
  }, [ready, origin, target, route]);
  useEffect(() => {
    if (!ready || !autoFrame) return;
    if (route) map.current.fitBounds(L.latLngBounds(route.coordinates.map(latLng)), {
      padding: [40, 45],
      maxZoom: 16
    });else if (target) map.current.fitBounds(L.latLngBounds([latLng(origin), latLng(target)]), {
      padding: [40, 45],
      maxZoom: 16
    });
  }, [ready, route, target, autoFrame]);
  useEffect(() => {
    if (ready && focusRequest) map.current.setView(latLng(currentPosition || origin), 16, {
      animate: true
    });
  }, [ready, focusRequest]);
  useEffect(() => {
    if (!ready || !currentPosition) return;
    const marker = L.circleMarker(latLng(currentPosition), {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#3169e8',
      fillOpacity: 1
    }).bindTooltip(tooltip(t("Местоположение"))).addTo(map.current);
    marker.on('click', event => {
      if (positionPress.current) { L.DomEvent.stopPropagation(event); positionPress.current(currentPosition); }
    });
    return () => {
      marker.remove();
    };
  }, [ready, currentPosition]);
  return <div className={`safewalk-map-shell${isDark ? ' theme-dark' : ''}`} style={{
    '--map-surface': colors.surface,
    '--map-text': colors.ink,
    '--map-muted': colors.muted,
    '--map-border': colors.border,
    '--map-background': colors.mapBackground,
    '--map-link': colors.blue,
    '--map-font-size': `${12 * fontScale}px`,
    '--map-attribution-size': `${9 * fontScale}px`
  }}>
      <div ref={element} className="safewalk-map" role="application" aria-label={t("Карта маршрута")} data-map-ready={ready} />

      {tileError && <div className="map-error" role="status">{t("Нет связи с картой. Проверьте интернет.")}

      </div>}
    </div>;
}
