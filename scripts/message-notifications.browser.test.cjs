const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');

test('new messages show a banner, open their chat and stay quiet in the visible conversation', { timeout: 90000 }, async t => {
  const { call, user, base } = await fixture(t);
  const a = await user('banner-owner'), b = await user('banner-sender');
  await call('circle/contacts', a.token, { email: b.user.email });
  await call(`circle/invitations/${a.user.id}/respond`, b.token, { decision: 'accepted' });
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
  await page.getByLabel('Email', { exact: true }).fill(a.user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  const baseline = page.waitForResponse(response => response.url().endsWith('/notifications/messages'));
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await baseline;
  await call(`circle/chats/${a.user.id}/messages`, b.token, { text: 'Новое сообщение', clientId: 'banner_message_1' });
  const banner = page.getByRole('button', { name: `Открыть сообщение от ${b.user.name}`, exact: true });
  await banner.waitFor(); await banner.click();
  await page.getByLabel('Сообщение', { exact: true }).waitFor();
  await call(`circle/chats/${a.user.id}/messages`, b.token, { text: 'В открытом чате', clientId: 'banner_message_2' });
  await page.getByText('В открытом чате', { exact: true }).waitFor();
  await page.waitForTimeout(4500);
  assert.equal(await banner.count(), 0);
  assert.deepEqual(errors, []);
});
