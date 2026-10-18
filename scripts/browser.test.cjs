const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');
const fs = require('node:fs');

test('saved route, readiness, low battery warning and one-tap arrival', { timeout: 90000 }, async t => {
  const { call, user, base } = await fixture(t);
  const account = await user('safety-browser');
  const origin = { name: 'Start', latitude: 43.24, longitude: 76.93 };
  const target = { name: 'Study', latitude: 43.25, longitude: 76.94 };
  await call('journeys/favorites/study', account.token, { origin, target, transport: 'walk' }, 'PUT');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 43.24, longitude: 76.93 } });
  t.after(async () => { await context.close(); await browser.close(); });
  await context.addInitScript(() => { navigator.getBattery = async () => ({ level: 0.15, charging: false }); });
  const reverseRequests = [];
  await context.route('**/api/auth/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/maps/reverse')) {
      const point = route.request().postDataJSON();
      reverseRequests.push(point);
      await route.fulfill({ json: { place: { ...point, name: point.latitude === 43.24 && point.longitude === 76.93 ? 'улица Сатпаева, 22, Алматы' : 'проспект Абая, 150, Алматы' }, approximate: false } }); return;
    }
    if (url.pathname.endsWith('/maps/route')) {
      await route.fulfill({ json: { distance: 1000, duration: 600, coordinates: [origin, target] } }); return;
    }
    if (url.pathname.endsWith('/maps/search')) {
      assert.deepEqual(route.request().postDataJSON(), { query: 'Толе би 59', city: 'Алматы' });
      await route.fulfill({ json: { places: [{ ...target, name: 'Толе би 59, Алматы' }] } }); return;
    }
    try {
      const result = await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search, timeout: 30000 });
      await route.fulfill({ response: result });
    } catch { await route.abort().catch(() => {}); }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8081');
  await page.getByLabel('Email', { exact: true }).fill(account.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('button', { name: 'Мои места', exact: true }).waitFor();
  fs.mkdirSync('.preview', { recursive: true });
  await page.screenshot({ path: '.preview/map-simple-home.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('tab', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Если я задержусь', exact: true }).click();
  await page.getByRole('button', { name: 'Задержка перед тревогой', exact: true }).click();
  await page.getByRole('button', { name: '1 мин', exact: true }).click();
  await page.getByRole('button', { name: 'Задержка перед тревогой', exact: true }).getByText('1 мин', { exact: true }).waitFor();
  assert.equal((await call('journeys/state', account.token)).body.preferences.delayMinutes, 1);
  await page.getByRole('button', { name: 'Повторная тревога', exact: true }).click();
  await page.getByRole('button', { name: '3 мин', exact: true }).click();
  await page.getByRole('button', { name: 'Повторная тревога', exact: true }).getByText('3 мин', { exact: true }).waitFor();
  assert.equal((await call('journeys/state', account.token)).body.preferences.escalationMinutes, 3);
  await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Карта', exact: true }).click();
  const map = page.getByRole('application', { name: 'Карта маршрута', exact: true });
  const initialMap = await map.boundingBox();
  await page.getByRole('button', { name: 'Увеличить карту', exact: true }).first().click();
  const expandedMap = await map.boundingBox();
  assert.ok(expandedMap.height > initialMap.height + 30, 'expanding frees screen space for the map');
  await page.getByLabel('Место назначения', { exact: true }).fill('Толе би 59');
  await page.getByRole('button', { name: 'Найти адрес', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать Толе би 59, Алматы', exact: true }).click();
  await page.getByRole('button', { name: 'Построить маршрут', exact: true }).waitFor();
  assert.ok((await map.boundingBox()).height > 844 * 0.45, 'choosing a result keeps the map large with a compact destination row');
  assert.equal(await page.getByLabel('Место назначения', { exact: true }).inputValue(), 'Толе би 59, Алматы');
  await page.getByRole('button', { name: 'Мои места', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить адрес: Дом', exact: true }).last().click();
  await page.getByLabel('Адрес места', { exact: true }).fill('Толе би 59');
  await page.getByRole('button', { name: 'Найти адрес', exact: true }).last().click();
  await page.getByRole('button', { name: 'Выбрать Толе би 59, Алматы', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить: Дом', exact: true }).click();
  assert.equal((await call('journeys/state', account.token)).body.places.find(item => item.slot === 'home').name, 'Толе би 59, Алматы');
  await page.getByRole('button', { name: 'Выбрать: Дом', exact: true }).last().click();
  fs.mkdirSync('.preview', { recursive: true });
  await page.screenshot({ path: '.preview/mobile-expanded-map.png', fullPage: true });
  await page.getByRole('button', { name: 'Показать маршрут', exact: true }).first().click();
  await page.getByRole('button', { name: 'Мои места', exact: true }).click();
  await page.getByRole('button', { name: 'Повторить маршрут: Учёба', exact: true }).click();
  await page.getByRole('button', { name: 'Разрешить и построить', exact: true }).click();
  await page.getByRole('button', { name: 'Ещё', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить маршрут', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить: Дом', exact: true }).click();
  assert.equal((await call('journeys/state', account.token)).body.favoriteRoutes.find(item => item.slot === 'home').target.name, 'Study');
  await page.getByRole('button', { name: 'Мои места', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить адрес: Учёба', exact: true }).click();
  await page.getByText('Адрес места: Учёба', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Использовать адрес с карты', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить: Учёба', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать: Учёба', exact: true }).last().waitFor();
  await page.getByRole('button', { name: 'Добавить адрес: Работа', exact: true }).last().click();
  await page.getByRole('button', { name: 'Выбрать точку на карте', exact: true }).click();
  await page.getByRole('heading', { name: 'Укажите: Работа', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Сохранить: Работа', exact: true }).isDisabled(), true);
  const pickerMap = page.locator('[data-map-ready="true"]').last();
  assert.ok((await pickerMap.boundingBox()).height > 844 * 0.6, 'place selection uses most of the phone screen');
  await pickerMap.click({ position: { x: 100, y: 100 } });
  await pickerMap.click({ position: { x: 180, y: 160 } });
  await page.getByLabel('Адрес выбранной точки', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Адрес выбранной точки"]')?.value === 'проспект Абая, 150, Алматы');
  fs.mkdirSync('.preview', { recursive: true });
  await page.screenshot({ path: '.preview/place-map-picker.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Сохранить: Работа', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать: Работа', exact: true }).last().waitFor();
  const savedWork = (await call('journeys/state', account.token)).body.places.find(item => item.slot === 'work');
  assert.equal(savedWork.name, 'проспект Абая, 150, Алматы');
  assert.equal(savedWork.latitude, reverseRequests.at(-1).latitude);
  assert.equal(savedWork.longitude, reverseRequests.at(-1).longitude);
  assert.ok(savedWork.latitude > 43 && savedWork.latitude < 44);
  assert.ok(savedWork.longitude > 76 && savedWork.longitude < 78);
  await page.getByRole('button', { name: 'Редактировать места', exact: true }).click();
  await page.getByRole('button', { name: 'Изменить адрес: Дом', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать точку на карте', exact: true }).click();
  await page.locator('[data-map-ready="true"]').last().click({ position: { x: 100, y: 150 } });
  await page.getByRole('button', { name: 'Назад к адресу', exact: true }).click();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  assert.equal((await call('journeys/state', account.token)).body.places.find(item => item.slot === 'home').name, 'Толе би 59, Алматы');
  await page.getByRole('button', { name: 'Редактировать места', exact: true }).click();
  await page.getByRole('button', { name: 'Изменить адрес: Дом', exact: true }).click();
  await page.getByRole('button', { name: 'Выбрать точку на карте', exact: true }).click();
  await page.getByRole('button', { name: 'Моё местоположение', exact: true }).last().click();
  await page.waitForFunction(() => {
    const maps = document.querySelectorAll('[data-map-ready="true"]');
    const center = JSON.parse(maps[maps.length - 1].dataset.center || '{}');
    return Math.abs(center.lat - 43.24) < 0.0001 && Math.abs(center.lng - 76.93) < 0.0001;
  });
  await page.getByRole('button', { name: 'Сохранить: Дом', exact: true }).click();
  const gpsHome = (await call('journeys/state', account.token)).body.places.find(item => item.slot === 'home');
  assert.equal(gpsHome.name, 'улица Сатпаева, 22, Алматы');
  assert.equal(gpsHome.latitude, 43.24);
  assert.equal(gpsHome.longitude, 76.93);
  fs.mkdirSync('.preview', { recursive: true });
  await page.screenshot({ path: '.preview/my-places.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Выбрать: Учёба', exact: true }).last().click();
  await page.getByRole('button', { name: 'Построить маршрут', exact: true }).click();
  await page.getByRole('button', { name: 'Разрешить и построить', exact: true }).click();
  await page.getByRole('button', { name: 'Начать поездку', exact: true }).click();
  await page.getByText('Готовность к поездке', { exact: true }).waitFor();
  await page.getByText('Связь с сервером: доступна', { exact: true }).waitFor();
  await page.getByText('Заряд: 15%', { exact: true }).waitFor();
  fs.mkdirSync('.preview', { recursive: true });
  await page.waitForTimeout(400); // Let the native-style modal fade finish before visual inspection.
  await page.screenshot({ path: '.preview/trip-readiness.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Начать без сопровождения', exact: true }).click();
  await page.getByText('Низкий заряд телефона', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await page.getByRole('button', { name: 'Увеличить карту', exact: true }).first().click();
  await page.getByText('Study', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Я на месте', exact: true }).click();
  await page.getByRole('button', { name: 'Показать маршрут', exact: true }).first().click();
  await page.getByText('Прибытие подтверждено', { exact: true }).first().waitFor();
  assert.equal((await call('journeys/state', account.token)).body.active, null);
  assert.equal((await call('journeys/state', account.token)).body.places.find(item => item.slot === 'study').name, 'Study');
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await page.getByRole('button', { name: 'Мои места', exact: true }).click();
  await page.getByRole('button', { name: 'Редактировать места', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить адрес: Работа', exact: true }).click();
  await page.getByText('Удалить адрес?', { exact: true }).waitFor();
  assert.ok((await call('journeys/state', account.token)).body.places.some(item => item.slot === 'work'), 'opening confirmation does not delete the address');
  await page.getByRole('button', { name: 'Удалить адрес', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить адрес: Работа', exact: true }).waitFor();
  const afterDelete = (await call('journeys/state', account.token)).body.places;
  assert.equal(afterDelete.some(item => item.slot === 'work'), false);
  assert.ok(afterDelete.some(item => item.slot === 'home'));
  assert.deepEqual(errors, []);
});

test('two browser sessions: account, contact consent, live chat, offline queue and trip consent', { timeout: 120000 }, async t => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch('http://localhost:8081')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const { call, user, base } = await fixture(t);
  const alice = await user('ui-alice'), bob = await user('ui-bob');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  t.after(async () => { for (const context of contexts) await context.close(); await browser.close(); });
  const errors = [];
  async function login(account) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contexts.push(context);
    // Route API calls to an isolated temporary database, keeping real browser cookies.
    await context.route('**/api/auth/**', async route => {
      try {
        const url = new URL(route.request().url());
        const result = await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search, timeout: 30000 });
        await route.fulfill({ response: result });
      } catch { await route.abort().catch(() => {}); }
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8081');
    await page.getByLabel('Email', { exact: true }).fill(account.user.email);
    await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.getByRole('button', { name: 'Открыть профиль', exact: true }).first().waitFor();
    return { page, context };
  }
  const a = await login(alice), b = await login(bob);
  await a.page.getByRole('button', { name: 'Открыть профиль', exact: true }).first().click();
  await a.page.getByRole('button', { name: 'Редактировать имя', exact: true }).click();
  await a.page.getByLabel('Имя', { exact: true }).fill('Alice Updated');
  await a.page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  assert.equal((await call('me', alice.token)).body.user.name, 'Alice Updated');
  await a.page.getByRole('tab', { name: 'Контакты', exact: true }).click();
  await a.page.getByRole('button', { name: 'Добавить контакт', exact: true }).first().click();
  await a.page.getByLabel('Email контакта', { exact: true }).fill(bob.user.email);
  await a.page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await b.page.getByRole('tab', { name: 'Контакты', exact: true }).click();
  await b.page.getByRole('button', { name: 'Принять', exact: true }).click();
  await a.page.getByText('В SafeWalk', { exact: true }).waitFor();
  await a.page.getByRole('button', { name: `Контакт ${bob.user.name}`, exact: true }).click();
  await a.page.getByRole('button', { name: 'Написать', exact: true }).click();
  await a.page.getByLabel('Сообщение', { exact: true }).fill('Live browser message');
  await a.page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
  await b.page.getByRole('button', { name: 'Контакт Alice Updated', exact: true }).click();
  await b.page.getByRole('button', { name: 'Написать', exact: true }).click();
  await b.page.getByText('Live browser message', { exact: true }).waitFor();
  // Abort only API requests to simulate a disconnected local server without breaking Metro.
  let offline = true;
  await a.context.route('**/api/auth/**', async (route, fallback) => {
    if (offline) await route.abort(); else await route.fallback();
  });
  await a.page.getByLabel('Сообщение', { exact: true }).fill('Queued browser message');
  await a.page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
  await a.page.getByText('Сообщения ожидают отправки. Проверьте очередь во вкладке «Маршруты».', { exact: true }).waitFor();
  await a.page.reload();
  await a.page.getByText('Неотправленных действий: 1', { exact: true }).waitFor();
  offline = false;
  await b.page.getByText('Queued browser message', { exact: true }).waitFor({ timeout: 20000 });
  const origin = { name: 'Start', latitude: 43, longitude: 76 }, target = { name: 'Home', latitude: 43.01, longitude: 76.01 };
  const started = await call('journeys', alice.token, { clientId: 'browser_journey_key', origin, target, transport: 'walk', minutes: 10, accompanied: true, route: { distance: 1000, duration: 600, coordinates: [origin, target] } });
  assert.equal(started.body.journey.status, 'pending');
  await b.page.getByRole('tab', { name: 'Маршруты', exact: true }).click();
  await b.page.getByRole('button', { name: 'Поездка: Alice Updated', exact: true }).click();
  await b.page.getByText('Ожидаем сопровождающего', { exact: true }).last().waitFor();
  await b.page.getByRole('button', { name: 'Принять сопровождение', exact: true }).click();
  assert.equal((await call('journeys/state', alice.token)).body.active.status, 'active');
  assert.deepEqual(errors, []);
});

test('mobile viewport: local HTTPS, account controls and honest browser capability messages', { timeout: 60000 }, async t => {
  const { user, base } = await fixture(t);
  const account = await user('mobile-test');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  t.after(async () => { await context.close(); await browser.close(); });
  await context.route('**/api/auth/**', async route => {
    try {
      const url = new URL(route.request().url());
      const result = await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search, headers: { ...route.request().headers(), origin: 'http://localhost:8081' }, timeout: 30000 });
      await route.fulfill({ response: result });
    } catch { await route.abort().catch(() => {}); }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://localhost:8443');
  assert.equal(await page.evaluate(() => window.isSecureContext), true);
  await page.getByLabel('Email', { exact: true }).fill(account.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('tab', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Оформление', exact: true }).click();
  await page.getByRole('button', { name: 'Тема приложения', exact: true }).click();
  await page.getByRole('radio', { name: 'Тёмная', exact: true }).click();
  await page.getByRole('button', { name: 'Оформление', exact: true }).getByText('Тёмная · Русский', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Оформление', exact: true }).click();
  await page.getByRole('button', { name: 'Тема приложения', exact: true }).click();
  await page.getByRole('radio', { name: 'Светлая', exact: true }).click();
  fs.mkdirSync('.preview', { recursive: true });
  await page.screenshot({ path: '.preview/settings-clean.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Разрешения телефона', exact: true }).click();
  await page.getByRole('button', { name: 'Включить фоновую геолокацию', exact: true }).click();
  await page.getByText('Фоновая геолокация доступна в установленной мобильной сборке', { exact: true }).waitFor();
  fs.mkdirSync('.preview', { recursive: true });
  await page.screenshot({ path: '.preview/mobile-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await page.getByRole('button', { name: 'Открыть профиль', exact: true }).first().click();
  const nameRow = page.getByRole('button', { name: 'Редактировать имя', exact: true });
  assert.ok((await nameRow.boundingBox()).height <= 56, 'account actions are compact list rows');
  await page.screenshot({ path: '.preview/profile-clean.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Сменить пароль', exact: true }).click();
  await page.getByLabel('Новый пароль', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
});
