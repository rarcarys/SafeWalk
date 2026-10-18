const express = require('express');

const validPoint = value => value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
  && Math.abs(value.latitude) <= 85 && Math.abs(value.longitude) <= 180;

function searchTerms(input, city) {
  let query = input.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (city) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query = query.replace(new RegExp(`^(?:г\\.?\\s*)?${escaped}\\s*[,;]?\\s*|\\s*[,;]?\\s*(?:г\\.?\\s*)?${escaped}$`, 'iu'), '').trim();
  }
  query = query.replace(/(^|\s)(?:пр-т\.?|просп\.|пр\.)(?=\s)/giu, '$1проспект')
    .replace(/(^|\s)ул\.(?=\s)/giu, '$1улица')
    .replace(/(^|\s)мкр\.(?=\s)/giu, '$1микрорайон')
    .replace(/,?\s+(?:дом|д\.)\s*(?=\d)/giu, ' ');
  // A bare surname otherwise also matches streets named Abay outside Almaty,
  // and obsolete names of unrelated streets inside the city.
  if (/^алматы$/iu.test(city)) query = query.replace(/^(?:Абай|Абая)(?=\s|$)/iu, 'проспект Абая');
  const house = query.match(/^(.*?)\s+(\d+[а-яa-z]?(?:[\/-]\d+[а-яa-z]?)?)$/iu);
  return { query, street: house && /[а-яa-zәіңғүұқөһ]/iu.test(house[1]) ? `${house[2]} ${house[1].replace(/,$/, '')}` : null, house: house?.[2] };
}

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
    const city = request.body?.city === undefined ? 'Алматы' : request.body.city;
    if (typeof city !== 'string' || city.length > 100) return response.status(400).json({ message: 'Проверьте город поиска' });
    const selectedCity = city.trim();
    const terms = searchTerms(query, selectedCity);
    const makeURL = structured => {
      const url = new URL(process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
      const params = { format: 'jsonv2', limit: '8', addressdetails: '1', countrycodes: 'kz', 'accept-language': 'ru' };
      if (structured) Object.assign(params, { street: terms.street, city: selectedCity });
      else params.q = [terms.query, selectedCity].filter(Boolean).join(', ') || query;
      url.search = new URLSearchParams(params).toString();
      return url.href;
    };
    try {
      // Do not suggest a street centroid as though it were a requested house.
      const readResults = data => {
        if (!Array.isArray(data)) throw new Error('Invalid search response');
        const local = data.filter(item => !item?.address?.country_code || item.address.country_code.toLowerCase() === 'kz');
        return terms.house ? local.filter(item => item?.address?.house_number?.toLocaleLowerCase() === terms.house.toLocaleLowerCase()) : local;
      };
      let data = readResults(await upstream('search', makeURL(!!terms.street && !!selectedCity)));
      if (!data.length && terms.street && selectedCity) data = readResults(await upstream('search', makeURL(false)));
      const places = data.map(item => ({ name: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) })).filter(item => typeof item.name === 'string' && validPoint(item));
      response.json({ places });
    } catch { response.status(502).json({ message: 'Поиск адресов недоступен. Выберите точку на карте или повторите позже.' }); }
  });
  router.post('/reverse', async (request, response) => {
    const point = request.body;
    if (!validPoint(point)) return response.status(400).json({ message: 'Некорректная точка на карте' });
    const url = new URL(process.env.REVERSE_GEOCODER_URL || 'reverse', process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ format: 'jsonv2', lat: point.latitude.toFixed(6), lon: point.longitude.toFixed(6), zoom: '18', addressdetails: '1', layer: 'address', 'accept-language': 'ru' }).toString();
    try {
      // Reverse lookups share Nominatim's request gate and cache with searches.
      const data = await upstream('search', url.href);
      if (data?.error) return response.status(404).json({ message: 'Адрес этой точки не найден. Укажите адрес вручную.' });
      if (!data || typeof data.display_name !== 'string' || !data.display_name.trim()) throw new Error('Invalid reverse response');
      const address = data.address || {};
      const street = address.road || address.pedestrian || address.residential || address.footway || address.path;
      const city = address.city || address.town || address.village || address.hamlet;
      const name = (street ? [[street, address.house_number].filter(Boolean).join(', '), city].filter(Boolean).join(', ') : data.display_name).slice(0, 500);
      response.json({ place: { latitude: point.latitude, longitude: point.longitude, name }, approximate: !street || !address.house_number });
    } catch { response.status(502).json({ message: 'Не удалось определить адрес. Укажите его вручную.' }); }
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

module.exports = { createMapsRouter, validPoint, searchTerms };
