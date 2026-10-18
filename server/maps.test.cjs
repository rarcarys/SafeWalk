const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { createMapsRouter } = require('./maps.cjs');
const { searchTerms } = require('./maps.cjs');

test('reverse geocoding formats addresses without moving the selected point', async t => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use(createMapsRouter({ interval: 0, fetcher: async url => {
    calls.push(new URL(url));
    const lat = Number(new URL(url).searchParams.get('lat'));
    if (lat === 44) throw new Error('Offline');
    if (lat === 45) return { ok: true, json: async () => ({ error: 'Unable to geocode' }) };
    return { ok: true, json: async () => ({ lat: '43.23', lon: '76.88', display_name: '150, проспект Абая, Алматы, Казахстан', address: { road: 'проспект Абая', ...(lat === 43 ? {} : { house_number: '150' }), city: 'Алматы' } }) };
  } }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function reverse(point) {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/reverse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(point) });
    return { status: result.status, body: await result.json() };
  }
  for (const point of [{}, { latitude: 100, longitude: 76 }, { latitude: '43.24', longitude: 76 }]) assert.equal((await reverse(point)).status, 400);
  assert.equal(calls.length, 0);
  const point = { latitude: 43.2375124, longitude: 76.8839976 };
  const result = await reverse(point);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.place, { ...point, name: 'проспект Абая, 150, Алматы' });
  assert.equal(result.body.approximate, false);
  assert.equal(calls[0].pathname, '/reverse');
  assert.equal(calls[0].searchParams.get('zoom'), '18');
  assert.equal(calls[0].searchParams.get('lat'), '43.237512');
  await reverse(point);
  assert.equal(calls.length, 1);
  const partial = await reverse({ latitude: 43, longitude: 76 });
  assert.equal(partial.body.place.name, 'проспект Абая, Алматы');
  assert.equal(partial.body.approximate, true);
  assert.equal((await reverse({ latitude: 44, longitude: 76 })).status, 502);
  assert.equal((await reverse({ latitude: 45, longitude: 76 })).status, 404);
});

test('Almaty address normalization keeps street, city and house separate', () => {
  for (const query of ['Абая 150', 'Алматы, Абая 150', 'пр. Абая 150', 'Абай 150, Алматы']) {
    assert.deepEqual(searchTerms(query, 'Алматы'), { query: 'проспект Абая 150', street: '150 проспект Абая', house: '150' });
  }
  assert.equal(searchTerms('ул. Толе би, д. 59', 'Алматы').street, '59 улица Толе би');
  assert.equal(searchTerms('Абая 150/2', 'Алматы').house, '150/2');
  assert.equal(searchTerms('Абая 150', 'Астана').query, 'Абая 150');
});

test('house search uses the selected city, falls back and rejects street centroids', async t => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use(createMapsRouter({ interval: 0, fetcher: async url => {
    const params = new URL(url).searchParams;
    calls.push(params);
    return { ok: true, json: async () => params.has('street') ? [{ display_name: 'Улица без дома', lat: '43.2', lon: '76.9', address: { road: 'Абая' } }] : [
      { display_name: '150, проспект Абая, Алматы', lat: '43.2375', lon: '76.884', address: { house_number: '150', road: 'проспект Абая' } },
      { display_name: '151, проспект Абая, Алматы', lat: '43.238', lon: '76.885', address: { house_number: '151' } },
      { display_name: '150, другой город, другая страна', lat: '55.75', lon: '37.6', address: { house_number: '150', country_code: 'ru' } },
    ] };
  } }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function search(body) {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: result.status, body: await result.json() };
  }
  const result = await search({ query: 'Абая 150', city: 'Алматы' });
  assert.equal(result.status, 200);
  assert.equal(result.body.places.length, 1);
  assert.equal(result.body.places[0].latitude, 43.2375);
  assert.equal(calls[0].get('street'), '150 проспект Абая');
  assert.equal(calls[0].get('city'), 'Алматы');
  assert.equal(calls[0].get('countrycodes'), 'kz');
  assert.equal(calls[0].has('q'), false);
  assert.equal(calls[1].get('q'), 'проспект Абая 150, Алматы');
  assert.equal(calls[1].get('countrycodes'), 'kz');
  await search({ query: 'Алматы, Абая 150' });
  assert.equal(calls.length, 2, 'normalized equivalent queries reuse the cache');
  const missing = await search({ query: 'Абая 999' });
  assert.deepEqual(missing.body.places, []);
  assert.equal((await search({ query: 'Абая 150', city: {} })).status, 400);
  await search({ query: 'Абая 150', city: 'Астана' });
  assert.equal(calls.at(-2).get('city'), 'Астана');
});

test('map validation, caching, profiles and provider failures', async t => {
  let calls = [];
  const point = { latitude: 43.2405, longitude: 76.936 };
  const target = { latitude: 43.235, longitude: 76.927 };
  const app = express();
  app.use(express.json());
  app.use(createMapsRouter({ interval: 0, fetcher: async url => {
    calls.push(url);
    if (url.includes('unavailable')) throw new Error('Offline');
    return { ok: true, json: async () => url.includes('/search') ? [{ display_name: 'Алматы', lat: '43.24', lon: '76.93' }] : { code: 'Ok', routes: [{ distance: 1294.2, duration: 1037.1, geometry: { coordinates: [[76.936, 43.2405], [76.927, 43.235]] } }] } };
  } }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (endpoint, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  await t.test('rejects invalid coordinates and transport modes without external requests', async () => {
    for (const body of [{}, { origin: { latitude: 100, longitude: 0 }, target, mode: 'walk' }, { origin: point, target, mode: 'bike' }, { origin: { latitude: '43', longitude: 0 }, target, mode: 'walk' }]) assert.equal((await call('route', body)).status, 400);
    assert.equal(calls.length, 0);
  });
  await t.test('geocoding requires explicit valid query and caches results', async () => {
    assert.equal((await call('search', { query: 'a' })).status, 400);
    assert.equal((await call('search', { query: 'x'.repeat(181) })).status, 400);
    const result = await call('search', { query: 'Алматы' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.places[0], { name: 'Алматы', latitude: 43.24, longitude: 76.93 });
    await call('search', { query: 'Алматы' });
    assert.equal(calls.length, 1);
  });
  await t.test('preserves route metrics and converts GeoJSON coordinate order', async () => {
    const result = await call('route', { origin: point, target, mode: 'walk' });
    assert.equal(result.status, 200);
    assert.equal(result.body.distance, 1294.2);
    assert.equal(result.body.duration, 1037.1);
    assert.deepEqual(result.body.coordinates, [point, target]);
    assert.match(calls.at(-1), /routed-foot/);
    const count = calls.length;
    await call('route', { origin: point, target, mode: 'walk' });
    assert.equal(calls.length, count);
  });
  await t.test('driving requests use the car provider, not walking estimates', async () => {
    assert.equal((await call('route', { origin: point, target, mode: 'car' })).status, 200);
    assert.match(calls.at(-1), /routed-car/);
  });
  await t.test('provider failures are actionable errors, not fabricated places', async () => {
    const result = await call('search', { query: 'unavailable' });
    assert.equal(result.status, 502);
    assert.match(result.body.message, /Выберите точку/);
  });
});
