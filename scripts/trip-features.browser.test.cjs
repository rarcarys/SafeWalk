const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');

test('SOS rehearsal is local, countdown cancels, home uses GPS and arrival finishes the trip', { timeout: 120000 }, async t => {
  const { call, user, base } = await fixture(t);
  const owner = await user('trip-features-owner'), peer = await user('trip-features-peer');
  const added = await call('circle/contacts', owner.token, { email: peer.user.email });
  const contact = added.body.people.find(person => person.peerId === peer.user.id);
  await call(`circle/invitations/${owner.user.id}/respond`, peer.token, { decision: 'accepted' });
  await call('circle/selection', owner.token, { primaryId: contact.id, backupIds: [] }, 'PUT');
  const home = { name: 'Дом для проверки', latitude: 43.25, longitude: 76.94 };
  await call('journeys/places/home', owner.token, home, 'PUT');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 43.24, longitude: 76.93 } });
  t.after(async () => { await context.close(); await browser.close(); });
  let sent = 0, routed = 0;
  await context.route('**/api/auth/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/journeys/sos/send')) sent++;
    if (url.pathname.endsWith('/maps/route')) {
      routed++;
      const body = route.request().postDataJSON();
      assert.equal(body.origin.latitude, 43.24);
      await route.fulfill({ json: { distance: 1000, duration: 600, coordinates: [body.origin, home] } });
      return;
    }
    try { await route.fulfill({ response: await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search }) }); }
    catch { await route.abort().catch(() => {}); }
  });
  const page = await context.newPage(), errors = [];
  t.after(async () => { if (!page.isClosed()) await page.screenshot({ path: '.preview/trip-features.png', fullPage: true }); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8081');
  await page.getByLabel('Email', { exact: true }).fill(owner.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть SOS', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Тестовый режим SOS', exact: true }).click();
  await page.getByRole('button', { name: 'Проверить SOS без отправки', exact: true }).click();
  await page.getByText('Проверка завершена.', { exact: false }).waitFor();
  assert.equal(sent, 0);
  await page.getByRole('checkbox', { name: 'Тестовый режим SOS', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить SOS в чаты', exact: true }).click();
  await page.getByRole('button', { name: 'Отменить отправку SOS', exact: true }).click();
  await page.waitForTimeout(5200);
  assert.equal(sent, 0);
  await page.getByRole('button', { name: 'Отправить SOS в чаты', exact: true }).click();
  await page.getByText('SOS добавлен в чаты:', { exact: false }).waitFor();
  assert.equal(sent, 1);
  await page.getByRole('button', { name: 'Быстрый маршрут домой', exact: true }).click();
  await page.getByRole('button', { name: 'Построить маршрут домой', exact: true }).click();
  await page.getByRole('button', { name: 'Начать с сопровождением', exact: true }).waitFor();
  assert.equal(routed, 1);
  for (const mode of ['Такси', 'Машина', 'Автобус']) {
    await page.getByRole('radiogroup').getByRole('radio', { name: mode, exact: true }).click();
    await page.getByRole('radiogroup').getByRole('radio', { name: mode, exact: true, checked: true }).waitFor();
  }
  await page.getByLabel('Часы в пути', { exact: true }).fill('1');
  await page.getByLabel('Минуты в пути', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Увеличить время на 5 минут', exact: true }).click();
  assert.equal(await page.getByLabel('Минуты в пути', { exact: true }).inputValue(), '30');
  await page.getByRole('checkbox', { name: 'С сопровождением', exact: true }).click();
  await page.getByRole('button', { name: 'Начать без сопровождения', exact: true }).click();
  await page.getByText('Геопозиция не передаётся контактам', { exact: true }).waitFor();
  assert.equal((await call('journeys/state', owner.token)).body.active.transport, 'bus');
  assert.equal((await call('journeys/state', owner.token)).body.active.minutes, 90);
  await page.getByRole('button', { name: 'Я на месте', exact: true }).click();
  await page.getByText('Прибытие подтверждено', { exact: true }).first().waitFor();
  assert.equal((await call('journeys/state', owner.token)).body.active, null);
  assert.deepEqual(errors, []);
});
