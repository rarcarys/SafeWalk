const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');

test('stoat with scarf follows text and covers eyes for passwords', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: viewport.width > 960 ? 'no-preference' : 'reduce' });
    const page = await context.newPage();
    const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/rive|\.wasm/.test(request.url()) && !request.url().startsWith('http://localhost:8081/')) externalRequests.push(request.url()); });
    await context.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { message: 'Войдите снова' } }));
    await page.goto('http://localhost:8081');
    await page.getByRole('tab', { name: 'Вход', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Регистрация', exact: true }).click();
    await expect(page.getByTestId('firefly-idle')).toHaveAttribute('data-ready', 'ready', { timeout: 30000 });
    const canvas = page.getByTestId('firefly-canvas');
    await expect.poll(() => canvas.evaluate(element => {
      const data = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
      let painted = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 10) painted++;
      return painted;
    })).toBeGreaterThan(1000);
    const appearance = await canvas.evaluate(element => {
      const { width, height } = element;
      const data = element.getContext('2d').getImageData(0, 0, width, height).data;
      let cream = 0, green = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 220) continue;
        if (data[i] > 220 && data[i + 1] > 180 && data[i + 2] > 145) cream++;
        if (data[i + 1] > data[i] * 1.4 && data[i + 1] > data[i + 2] * 1.2) green++;
      }
      const corners = [0, width - 1, (height - 1) * width, height * width - 1].map(pixel => data[pixel * 4 + 3]);
      return { cream, green, corners };
    });
    assert.ok(appearance.cream > 1000, 'cream stoat artwork is visible');
    assert.ok(appearance.green > 100, 'signature green scarf is visible');
    assert.deepEqual(appearance.corners, [0, 0, 0, 0], 'mascot canvas has a transparent background');
    const email = page.getByLabel('Email', { exact: true });
    await email.fill('alexander@example.com');
    await expect(canvas).toHaveAttribute('data-checking', 'true');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `.preview/firefly-register-${viewport.width}.png`, fullPage: true });
    const watching = await canvas.screenshot();
    if (viewport.width > 960) await canvas.evaluate(element => {
      window.fireflyCoverSamples = [];
      const deadline = performance.now() + 1000;
      const sample = () => { window.fireflyCoverSamples.push(element.dataset.cover); if (performance.now() < deadline) requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
    });
    await page.getByLabel('Пароль', { exact: true }).fill('private-test-password');
    await expect(canvas).toHaveAttribute('data-hands-up', 'true');
    await expect(canvas).toHaveAttribute('data-checking', 'false');
    await expect.poll(async () => Number(await canvas.getAttribute('data-cover'))).toBeGreaterThan(0.95);
    const bounds = await page.getByTestId('firefly-privacy').boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
    await page.waitForTimeout(900);
    assert.notDeepEqual(await canvas.screenshot(), watching);
    if (viewport.width > 960) assert.ok(await page.evaluate(() => new Set(window.fireflyCoverSamples).size) > 5, 'original rig supplies intermediate hand poses');
    await page.screenshot({ path: `.preview/firefly-password-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
    await email.click();
    await expect(canvas).toHaveAttribute('data-hands-up', 'true');
    await page.getByRole('button', { name: 'Скрыть пароль', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('firefly@example.com');
    await expect(canvas).toHaveAttribute('data-hands-up', 'false');
    await expect.poll(async () => Number(await canvas.getAttribute('data-cover'))).toBeLessThan(0.05);
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const name = page.getByLabel('Имя', { exact: true });
    await name.fill('Александр');
    await expect(canvas).toHaveAttribute('data-checking', 'true');
    await expect(canvas).toHaveAttribute('data-hands-up', 'false');
    await name.press('Home');
    await expect(canvas).toHaveAttribute('data-look', '0');
    await page.waitForTimeout(450);
    const left = await canvas.getAttribute('data-pupil-x');
    await name.press('End');
    await expect(canvas).toHaveAttribute('data-look', '32');
    await expect.poll(() => canvas.getAttribute('data-pupil-x')).not.toBe(left);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await page.getByRole('tab', { name: 'Вход', exact: true }).click();
    await expect(canvas).toHaveCount(1);
    await page.getByLabel('Email', { exact: true }).fill('walker@example.com');
    await expect(canvas).toHaveAttribute('data-checking', 'true');
    await page.getByLabel('Пароль', { exact: true }).fill('private-login-password');
    await expect(canvas).toHaveAttribute('data-hands-up', 'true');
    await expect.poll(async () => Number(await canvas.getAttribute('data-cover'))).toBeGreaterThan(0.95);
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    await context.close();
  }
});

test('native stoat renders offline using the same Rive template', { timeout: 30000 }, async t => {
  const { createFireflyHtml } = await import('../src/services/fireflyHtml.js');
  const bundle = require('../assets/mascot/firefly-native-runtime.json');
  assert.equal(bundle.controller, fs.readFileSync('src/services/fireflyController.js', 'utf8').replace('export function createFireflyController', 'function createFireflyController'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 220, height: 184 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const bridge = '<script>window.fireflyMessages=[];window.ReactNativeWebView={postMessage:function(message){window.fireflyMessages.push(JSON.parse(message))}};</script>';
  await page.setContent(createFireflyHtml(bundle).replace('<body>', `<body>${bridge}`));
  await expect.poll(() => page.evaluate(() => window.fireflyMessages.some(event => event.type === 'ready'))).toBe(true);
  await page.evaluate(() => window.updateFirefly({ lookingAway: true, watching: false, progress: 0, reducedMotion: true }));
  await expect.poll(() => page.evaluate(() => window.fireflyMessages.at(-1).cover)).toBeGreaterThan(0.95);
  await page.screenshot({ path: '.preview/firefly-native-offline.png' });
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
});
