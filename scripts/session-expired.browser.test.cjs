const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

test('expired session opens a dismissible popup above the sign-in form', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('safewalk.last-user', JSON.stringify({ id: 'expired-user', name: 'Expired User' }));
  });
  await context.route('**/api/auth/me', route => route.fulfill({
    status: 401, json: { message: 'Требуется вход' },
  }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:8081');
  const message = page.getByText('Сессия завершена', { exact: true });
  await message.waitFor({ state: 'visible' });
  assert.equal(await message.count(), 1);
  await page.getByText('Войдите снова, чтобы продолжить пользоваться SafeWalk.', { exact: true }).waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '.preview/session-expired-popup.png' });
  await page.getByRole('button', { name: 'Войти', exact: true }).last().click();
  await message.waitFor({ state: 'hidden' });
  await page.getByLabel('Email', { exact: true }).fill('session@example.com');
  assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'session@example.com');
  assert.deepEqual(errors, []);
});
