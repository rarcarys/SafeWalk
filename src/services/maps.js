import { request } from './api';
export function searchAddresses(query) {
  return request('maps/search', {
    method: 'POST',
    body: {
      query,
    },
  });
}
export function fetchRoute(origin, target, mode) {
  return request('maps/route', {
    method: 'POST',
    body: {
      origin,
      target,
      mode,
    },
  });
}
