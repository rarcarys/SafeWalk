const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { fixture } = require('../server/test-support.cjs');

test('chat reaction picker saves, displays and removes reactions', { timeout: 90000 }, async t => {
  const { call, user, base } = await fixture(t);
  const a = await user('reaction-browser'), b = await user('reaction-peer');
  await call('circle/contacts', a.token, { email: b.user.email });
  await call(`circle/invitations/${a.user.id}/respond`, b.token, { decision: 'accepted' });
  const message = (await call(`circle/chats/${b.user.id}/messages`, a.token, { text: 'Проверка реакции', clientId: 'browser-reaction-1' })).body.message;
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
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('tab', { name: 'Чаты', exact: true }).click();
  await page.getByRole('button', { name: `Чат: ${b.user.name}`, exact: true }).click();
  const bubble = page.getByRole('button', { name: 'Реакция на сообщение: Проверка реакции', exact: true });
  await bubble.click();
  assert.equal(await page.getByText('Реакция на сообщение', { exact: true }).count(), 0);
  await page.waitForTimeout(400);
  await bubble.dblclick({ delay: 100 });
  await page.getByText('❤️ 1', { exact: true }).waitFor();
  await bubble.hover();
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Реакция 👍', exact: true }).click();
  await page.getByText('👍 1', { exact: true }).waitFor();
  await page.waitForTimeout(1100);
  await bubble.dblclick({ delay: 100 });
  await page.getByText('❤️ 1', { exact: true }).waitFor();
  await call(`circle/chats/${a.user.id}/messages/${message.id}/reaction`, b.token, { emoji: '❤️' }, 'PUT');
  await page.getByText('❤️ 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Реакция ❤️', exact: true }).click();
  await page.getByText('❤️ 1', { exact: true }).waitFor();
  assert.equal((await call(`circle/chats/${b.user.id}/messages`, a.token)).body.reactions.length, 1);
  assert.deepEqual(errors, []);
});
