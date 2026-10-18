const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');
const fs = require('node:fs');

test('training, timers, presets, quick chat and guest links work from the mobile interface', { timeout: 120000 }, async t => {
  const { call, user, base } = await fixture(t);
  const owner = await user('tools-browser-owner'), peer = await user('tools-browser-peer');
  const result = await call('circle/contacts', owner.token, { email: peer.user.email });
  const contact = result.body.people.find(person => person.peerId === peer.user.id);
  await call(`circle/invitations/${owner.user.id}/respond`, peer.token, { decision: 'accepted' });
  await call('circle/selection', owner.token, { primaryId: contact.id, backupIds: [] }, 'PUT');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(async () => { await context.close(); await browser.close(); });
  let realSOS = 0;
  await context.route('**/api/auth/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/journeys/sos/send')) realSOS++;
    try { await route.fulfill({ response: await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search, timeout: 30000 }) }); }
    catch { await route.abort().catch(() => {}); }
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8081');
  await page.getByLabel('Email', { exact: true }).fill(owner.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('tab', { name: 'Настройки', exact: true }).click();
  const openTools = async () => {
    await page.getByRole('button', { name: 'Дополнительные возможности', exact: true }).click();
  };
  await openTools();
  fs.mkdirSync('.preview', { recursive: true });
  await page.getByRole('button', { name: 'Тренировка SOS', exact: true }).waitFor();
  await page.screenshot({ path: '.preview/safety-tools-menu.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Тренировка SOS', exact: true }).click();
  await page.getByRole('button', { name: 'Начать тренировку', exact: true }).click();
  await page.getByRole('button', { name: 'Смоделировать подтверждение', exact: true }).click();
  await page.getByRole('button', { name: 'Завершить тренировку', exact: true }).click();
  assert.equal(realSOS, 0);
  assert.equal((await call(`circle/chats/${owner.user.id}/messages`, peer.token)).body.messages.length, 0);

  await openTools();
  await page.getByRole('button', { name: 'Проверь меня', exact: true }).click();
  await page.getByRole('button', { name: 'Включить проверку', exact: true }).click();
  await page.getByRole('button', { name: 'Я в порядке', exact: true }).waitFor();
  assert.equal((await call('safety/state', owner.token)).body.timer.minutes, 15);
  await page.getByRole('button', { name: 'Я в порядке', exact: true }).click();
  await page.getByRole('button', { name: 'Дополнительные возможности', exact: true }).waitFor();
  assert.equal((await call('safety/state', owner.token)).body.timer, null);

  await openTools();
  await page.getByRole('button', { name: 'Мои сценарии', exact: true }).click();
  for (const name of ['Такси', 'Встреча', 'Прогулка']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Сохранить сценарий', exact: true }).click();
    await page.getByRole('button', { name: `Применить: ${name}`, exact: true }).waitFor();
  }
  assert.equal((await call('safety/state', owner.token)).body.presets.length, 3);
  await page.getByRole('button', { name: 'Применить: Такси', exact: true }).click();
  await page.getByText('Сценарий применён. Поездка или таймер запускаются отдельно.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();

  await page.getByRole('tab', { name: 'Чаты', exact: true }).click();
  await page.getByRole('button', { name: `Чат: ${peer.user.name}`, exact: true }).click();
  await page.getByLabel('Сообщение', { exact: true }).fill('Черновик останется');
  await page.getByRole('button', { name: 'Быстрые сообщения', exact: true }).click();
  await page.getByRole('button', { name: 'Позвони мне, пожалуйста.', exact: true }).click();
  await page.getByText('Позвони мне, пожалуйста.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Сообщение', { exact: true }).inputValue(), 'Черновик останется');
  assert.equal((await call(`circle/chats/${owner.user.id}/messages`, peer.token)).body.messages.filter(message => message.text === 'Позвони мне, пожалуйста.').length, 1);

  const point = { name: 'Тестовый парк', latitude: 43.24, longitude: 76.93 };
  await call('journeys/preferences', owner.token, { sharing: true }, 'PUT');
  const started = await call('journeys', owner.token, { clientId: 'browser_guest_trip', origin: point, target: point, transport: 'walk', minutes: 15, accompanied: true, route: { distance: 1000, duration: 900, coordinates: [point, point] } });
  await call(`journeys/${started.body.journey.id}/respond`, peer.token, { decision: 'accepted' });
  await page.reload();
  await page.getByRole('tab', { name: 'Маршруты', exact: true }).click();
  await page.getByRole('button', { name: 'Ещё: безопасность', exact: true }).click();
  await page.getByRole('button', { name: 'Ссылка на прогулку', exact: true }).click();
  const createdResponse = page.waitForResponse(response => response.url().endsWith('/safety/links') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Создать временную ссылку', exact: true }).click();
  const created = await (await createdResponse).json();
  const guest = await context.newPage();
  await guest.goto(base.replace('/api/auth/', '') + created.link.path);
  await guest.getByRole('heading', { name: point.name, exact: true }).waitFor();
  assert.equal(await guest.getByText(owner.user.email, { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Отозвать ссылку', exact: true }).click();
  await guest.reload();
  await guest.getByRole('status').getByText('Ссылка недоступна или срок её действия истёк', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
});
