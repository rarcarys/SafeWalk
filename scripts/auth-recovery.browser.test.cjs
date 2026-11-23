const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');

test('recovery uses auth styling and preserves the two-step reset flow', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 }, reducedMotion: 'reduce' });
    let submitted;
    await page.route('**/api/auth/me', r => r.fulfill({ status: 401, json: { message: 'Войдите снова' } }));
    await page.route('**/api/auth/account/recover', r => { submitted = r.request().postDataJSON(); return r.fulfill({ status: 200, json: { ok: true } }); });
    await page.goto('http://localhost:8081');
    await page.getByRole('tab', { name: 'Вход', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Забыли пароль?', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Восстановить доступ', exact: true });
    await expect(dialog).toBeVisible();
    const recoveryMascot = dialog.getByTestId('firefly-canvas');
    await expect.poll(async () => Number(await recoveryMascot.getAttribute('data-error-amount'))).toBeGreaterThan(.7);
    await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(dialog.getByText('Введите корректный email', { exact: true })).toBeVisible();
    await dialog.getByLabel('Email', { exact: true }).fill('WALKER@example.com');
    await dialog.getByLabel('Код восстановления', { exact: true }).fill('saved-code');
    await page.screenshot({ path: `.preview/recovery-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await dialog.getByRole('button', { name: 'Назад', exact: true }).click();
    await expect(dialog.getByLabel('Код восстановления', { exact: true })).toHaveValue('saved-code');
    await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await dialog.getByLabel('Новый пароль', { exact: true }).fill('new-password');
    await dialog.getByLabel('Повторите пароль', { exact: true }).fill('different-password');
    await dialog.getByRole('button', { name: 'Восстановить доступ', exact: true }).click();
    await expect(dialog.getByText('Пароли не совпадают', { exact: true })).toBeVisible();
    assert.equal(submitted, undefined);
    await dialog.getByLabel('Повторите пароль', { exact: true }).fill('new-password');
    await dialog.getByRole('button', { name: 'Восстановить доступ', exact: true }).click();
    await expect(dialog.getByText('Доступ восстановлен', { exact: true })).toBeVisible();
    assert.deepEqual(submitted, { email: 'walker@example.com', code: 'saved-code', newPassword: 'new-password' });
    await dialog.getByRole('button', { name: 'Вернуться ко входу', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.close();
  }
});
