const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');

test('mobile auth fields remain reachable above an overlay keyboard', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      // Emulate Safari: keyboard reduces visualViewport, leaving innerHeight unchanged.
      window.keyboardViewport = new EventTarget();
      window.keyboardViewport.height = 844;
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: window.keyboardViewport });
    });
    await page.route('**/api/auth/me', r => r.fulfill({ status: 401, json: { message: 'Войдите снова' } }));
    let loginAttempts = 0;
    await page.route('**/api/auth/login', r => { loginAttempts++; return r.fulfill({ status: 401, json: { message: 'Неверный пароль' } }); });
    await page.goto('http://localhost:8081');
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Войти', exact: true }).last().click();
    const visibleAboveKeyboard = async locator => {
      await expect.poll(async () => {
        const rect = await locator.boundingBox();
        return rect && rect.y >= 0 && rect.y + rect.height <= 424;
      }).toBe(true);
    };
    const password = page.getByLabel('Пароль', { exact: true });
    await page.getByLabel('Email', { exact: true }).fill('walker@example.com');
    await password.fill('keyboard-password');
    await page.evaluate(() => {
      window.keyboardViewport.height = 424;
      window.keyboardViewport.dispatchEvent(new Event('resize'));
    });
    await visibleAboveKeyboard(password);
    await expect.poll(async () => (await page.getByRole('tablist').boundingBox()).y + (await page.getByRole('tablist').boundingBox()).height).toBeLessThanOrEqual(0);
    const login = page.getByRole('button', { name: 'Войти', exact: true });
    await visibleAboveKeyboard(login);
    const manualScroll = await password.evaluate(input => {
      let scroll = input.parentElement;
      while (scroll && getComputedStyle(scroll).overflowY !== 'auto') scroll = scroll.parentElement;
      scroll.scrollTop = Math.max(0, scroll.scrollTop - 70);
      scroll.dispatchEvent(new WheelEvent('wheel', { deltaY: -70 }));
      window.keyboardViewport.dispatchEvent(new Event('scroll'));
      window.keyboardViewport.offsetTop = 18;
      window.keyboardViewport.dispatchEvent(new Event('scroll'));
      window.keyboardViewport.height = 400;
      window.keyboardViewport.dispatchEvent(new Event('resize'));
      window.keyboardViewport.height = 424;
      window.keyboardViewport.offsetTop = 0;
      window.keyboardViewport.dispatchEvent(new Event('resize'));
      return scroll.scrollTop;
    });
    await page.waitForTimeout(500);
    const retainedScroll = await password.evaluate(input => {
      let scroll = input.parentElement;
      while (scroll && getComputedStyle(scroll).overflowY !== 'auto') scroll = scroll.parentElement;
      return scroll.scrollTop;
    });
    assert.equal(retainedScroll, manualScroll, 'manual scrolling is not pulled back by visual viewport scroll events');
    await login.click();
    await expect.poll(() => loginAttempts).toBe(1);
    await page.getByRole('tab', { name: 'Регистрация', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('keyboard@example.com');
    await password.fill('keyboard-password');
    await visibleAboveKeyboard(password);
    const next = page.getByRole('button', { name: 'Продолжить', exact: true });
    await visibleAboveKeyboard(next);
    await next.click();
    const name = page.getByLabel('Имя', { exact: true });
    await name.fill('Алия');
    await visibleAboveKeyboard(name);
    const finish = page.getByRole('button', { name: 'Зарегистрироваться', exact: true });
    await visibleAboveKeyboard(finish);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `.preview/auth-keyboard-${width}.png` });
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await page.getByRole('tab', { name: 'Вход', exact: true }).click();
    await page.getByRole('button', { name: 'Забыли пароль?', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Восстановить доступ', exact: true });
    const heading = dialog.getByText('Восстановить доступ', { exact: true });
    const originalHeading = await heading.boundingBox();
    await dialog.getByLabel('Email', { exact: true }).fill('walker@example.com');
    const code = dialog.getByLabel('Код восстановления', { exact: true });
    await code.fill('saved-code');
    await visibleAboveKeyboard(code);
    await page.evaluate(() => { window.keyboardViewport.height = 360; window.keyboardViewport.dispatchEvent(new Event('resize')); });
    await expect.poll(async () => { const rect = await code.boundingBox(); return rect.y >= 0 && rect.y + rect.height <= 336; }).toBe(true);
    const resizedHeading = await heading.boundingBox();
    assert.equal(resizedHeading.height, originalHeading.height, 'heading retains its size above the keyboard');
    const continueRecovery = dialog.getByRole('button', { name: 'Продолжить', exact: true });
    await continueRecovery.click();
    await dialog.getByLabel('Новый пароль', { exact: true }).fill('new-password');
    const confirmation = dialog.getByLabel('Повторите пароль', { exact: true });
    await confirmation.fill('new-password');
    await expect.poll(async () => { const rect = await confirmation.boundingBox(); return rect.y >= 0 && rect.y + rect.height <= 336; }).toBe(true);
    await page.screenshot({ path: `.preview/recovery-keyboard-${width}.png` });
    await page.close();
  }
});
