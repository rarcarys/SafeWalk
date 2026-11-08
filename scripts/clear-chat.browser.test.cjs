const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');

test('chat clearing keeps recent SOS and refreshes another open session', { timeout: 90000 }, async t => {
  const { call, user, base } = await fixture(t);
  const a = await user('clear-browser-a'), b = await user('clear-browser-b');
  await call('circle/contacts', a.token, { email: b.user.email });
  await call(`circle/invitations/${a.user.id}/respond`, b.token, { decision: 'accepted' });
  await call(`circle/chats/${b.user.id}/messages`, a.token, { text: 'Будет удалено', clientId: 'clear_browser_ordinary' });
  await call('journeys/sos/send', a.token, { clientId: 'clear_browser_sos', includeLocation: false, note: 'Сохранённая тревога' });
  await call(`journeys/sos/${a.user.id}/clear_browser_sos/acknowledge`, b.token, {});
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(async () => { await context.close(); await browser.close(); });
  await context.route('**/api/auth/**', async route => {
    const url = new URL(route.request().url());
    try { await route.fulfill({ response: await route.fetch({ url: base + url.pathname.split('/api/auth/')[1] + url.search }) }); }
    catch { await route.abort().catch(() => {}); }
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8081');
  await page.getByLabel('Email', { exact: true }).fill(b.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('tab', { name: 'Чаты', exact: true }).click();
  await page.getByRole('button', { name: `Чат: ${a.user.name}`, exact: true }).click();
  await page.getByText('Будет удалено', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Очистить чат', exact: true }).click();
  await page.getByRole('button', { name: 'Оставить', exact: true }).click();
  await page.getByText('Будет удалено', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Очистить чат', exact: true }).click();
  await page.getByRole('button', { name: 'Очистить чат', exact: true }).last().click();
  await page.getByText('Будет удалено', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByText(/SOS от .*Сохранённая тревога/).waitFor();
  assert.equal((await call(`circle/chats/${b.user.id}/messages`, a.token)).body.messages.length, 3);
  await call(`circle/chats/${b.user.id}/messages`, a.token, { text: 'Новое после очистки', clientId: 'clear_browser_future' });
  await page.getByText('Новое после очистки', { exact: true }).waitFor();
  await call(`circle/chats/${a.user.id}/messages`, b.token, {}, 'DELETE');
  await page.getByText('Новое после очистки', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByText(/SOS от .*Сохранённая тревога/).waitFor();
  await page.screenshot({ path: '.preview/chat-cleared-protected-sos.png', fullPage: true, animations: 'disabled' });
  assert.deepEqual(errors, []);
});
