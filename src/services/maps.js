import { request } from './api';
export function searchAddresses(query, city = 'Алматы') {
  return request('maps/search', {
    method: 'POST',
    body: {
      query,
      city,
    },
    timeout: 20000,
  });
}
export function fetchRoute(origin, target, mode) {
  return request('maps/route', {
    method: 'POST',
    body: {
      origin,
      target,
      mode: mode === 'walk' ? 'walk' : 'car',
    },
  });
}
export function reverseAddress(point, signal) {
  return request('maps/reverse', { method: 'POST', body: { latitude: point.latitude, longitude: point.longitude }, signal, timeout: 20000 });
}
export async function resolvePlaceAddress(point) {
  if (!/точка на карте|моё местоположение|map point|point on (?:the )?map|my location|картадағы нүкте|менің орным/i.test(point.name || '')) return point;
  const result = await reverseAddress(point);
  return { ...point, name: result.place.name };
}
