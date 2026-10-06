const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { createMapsRouter } = require('./maps.cjs');

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
