const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');

test('contact presence and battery show in the list, card and live chat; local heartbeat reports device battery', { timeout: 90000 }, async t => {
  const { call, user, base } = await fixture(t);
  const owner = await user('presence-browser'), peer = await user('presence-peer');
  await call('circle/contacts', owner.token, { email: peer.user.email });
  await call(`circle/invitations/${owner.user.id}/respond`, peer.token, { decision: 'accepted' });
  const status = await call('presence', peer.token, { battery: { level: 68, charging: true } }, 'PUT');
  assert.equal(status.status, 200);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(async () => { await context.close(); await browser.close(); });
  await context.addInitScript(() => { navigator.getBattery = async () => ({ level: 0.42, charging: false }); });
  const heartbeats = [];
  await context.route('**/api/auth/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/presence') && route.request().method() === 'PUT') heartbeats.push(route.request().postDataJSON());
    try { await route.fulfill({ response: await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search }) }); }
    catch { await route.abort().catch(() => {}); }
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8081');
  await page.getByLabel('Email', { exact: true }).fill(owner.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  const heartbeat = page.waitForResponse(response => response.url().endsWith('/presence') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await heartbeat;
  assert.deepEqual(heartbeats[0], { battery: { level: 42, charging: false } });
  const point = { name: 'Парк', latitude: 43.24, longitude: 76.93 };
  const trip = (await call('journeys', owner.token, { clientId: 'presence_trip_001', origin: point, target: point, transport: 'walk', minutes: 15, accompanied: true, route: { distance: 1000, duration: 900, coordinates: [point, point] } })).body.journey;
  assert.equal(trip.status, 'active');
  await page.reload();
  await page.getByText('68%', { exact: true }).waitFor();
  assert.equal(await page.getByText('42%', { exact: true }).count(), 0);
  assert.equal(await page.getByText(/Сервер подтвердил обновление|Передача координат ещё не подтверждена/).count(), 0);
  await page.screenshot({ path: '.preview/trip-contact-battery.png', fullPage: true, animations: 'disabled' });
  await call(`journeys/${trip.id}/action`, owner.token, { action: 'cancel', clientId: 'presence_cancel_001' });
  await page.reload();
  await page.getByRole('tab', { name: 'Контакты', exact: true }).click();
  const contact = page.getByRole('button', { name: `Контакт ${peer.user.name}`, exact: true });
  await contact.getByText('В сети', { exact: true }).waitFor();
  await contact.getByText('68%', { exact: true }).waitFor();
  await contact.click();
  await page.getByText('Заряд обновлён в', { exact: false }).waitFor();
  await page.screenshot({ path: '.preview/contact-presence.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Написать', exact: true }).click();
  await page.getByLabel('Сообщение', { exact: true }).waitFor();
  await page.getByText('В сети', { exact: true }).waitFor();
  await page.getByText('68%', { exact: true }).waitFor();
  await call('presence', peer.token, { battery: null }, 'PUT');
  const batteryText = page.getByText('68%', { exact: true });
  await batteryText.waitFor({ state: 'hidden', timeout: 15000 });
  assert.deepEqual(errors, []);
});
