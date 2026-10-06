const express = require('express');

const validPoint = value => value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
  && Math.abs(value.latitude) <= 85 && Math.abs(value.longitude) <= 180;

function createMapsRouter({ fetcher = fetch, interval = 1100 } = {}) {
  const router = express.Router();
  const caches = { search: new Map(), route: new Map() };
  const gates = { search: Promise.resolve(), route: Promise.resolve() };
  const pending = new Map();
  async function upstream(kind, url) {
    const cached = caches[kind].get(url);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (pending.has(url)) return pending.get(url);
    const task = gates[kind].then(async () => {
      const response = await fetcher(url, {
        headers: { 'User-Agent': 'SafeWalk/1.0', 'Accept-Language': 'ru' },
        signal: AbortSignal.timeout(7500),
      });
      if (!response.ok) throw new Error('Map provider unavailable');
      const value = await response.json();
      if (caches[kind].size >= 100) caches[kind].delete(caches[kind].keys().next().value);
      caches[kind].set(url, { value, expires: Date.now() + 15 * 60000 });
      return value;
    });
    gates[kind] = task.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, interval)));
    pending.set(url, task);
    try { return await task; } finally { pending.delete(url); }
  }
  router.use((_request, response, next) => {
    if (pending.size >= 5) return response.status(429).json({ message: 'Карта занята. Попробуйте через несколько секунд.' });
    next();
  });
  router.post('/search', async (request, response) => {
    const query = typeof request.body?.query === 'string' ? request.body.query.trim() : '';
    if (query.length < 3 || query.length > 180) return response.status(400).json({ message: 'Введите адрес от 3 до 180 символов' });
    const url = new URL(process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': 'ru' }).toString();
    try {
      const data = await upstream('search', url.href);
      if (!Array.isArray(data)) throw new Error('Invalid search response');
      const places = data.map(item => ({ name: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) })).filter(item => typeof item.name === 'string' && validPoint(item));
      response.json({ places });
    } catch { response.status(502).json({ message: 'Поиск адресов недоступен. Выберите точку на карте или повторите позже.' }); }
  });
  router.post('/route', async (request, response) => {
    const { origin, target, mode } = request.body || {};
    if (!validPoint(origin) || !validPoint(target) || !['walk', 'car'].includes(mode)) return response.status(400).json({ message: 'Проверьте точки маршрута' });
    const base = (process.env.ROUTING_URL || 'https://routing.openstreetmap.de').replace(/\/$/, '');
    const url = `${base}/routed-${mode === 'walk' ? 'foot' : 'car'}/route/v1/driving/${origin.longitude},${origin.latitude};${target.longitude},${target.latitude}?overview=full&geometries=geojson&steps=false`;
    try {
      const data = await upstream('route', url);
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || route.distance < 0 || route.duration < 0 || !Array.isArray(route.geometry?.coordinates)) throw new Error('No route');
      const coordinates = route.geometry.coordinates.map(point => ({ longitude: point[0], latitude: point[1] }));
      if (coordinates.length < 2 || !coordinates.every(validPoint)) throw new Error('Invalid geometry');
      response.json({ distance: route.distance, duration: route.duration, coordinates });
    } catch { response.status(502).json({ message: 'Не удалось построить маршрут. Попробуйте другую точку или повторите позже.' }); }
  });
  return router;
}

module.exports = { createMapsRouter, validPoint };
