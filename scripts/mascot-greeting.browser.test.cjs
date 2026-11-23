const test=require('node:test');
const {chromium,expect}=require('@playwright/test');
test('stoat waves its existing front paw once on opening the auth screen',{timeout:60000},async t=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 await page.route('**/api/auth/me',r=>r.fulfill({status:401,json:{message:'Войдите снова'}}));
 await page.goto('http://localhost:8081');await page.getByRole('tab',{name:'Вход',exact:true}).waitFor();
 const canvas=page.getByTestId('firefly-canvas');
 await expect(page.getByTestId('firefly-idle')).toHaveAttribute('data-ready','ready',{timeout:30000});
 await page.getByRole('button',{name:'Повторить приветствие'}).click();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-wave-amount'))).toBeGreaterThan(.95);
 await canvas.screenshot({path:'.preview/mascot-greeting.png'});
 await expect.poll(async()=>Number(await canvas.getAttribute('data-wave-amount')),{timeout:7000}).toBeLessThan(.001);
 await page.getByRole('tab',{name:'Регистрация',exact:true}).click();
 await page.waitForTimeout(1000);
 await expect.poll(async()=>Number(await canvas.getAttribute('data-wave-amount'))).toBeLessThan(.001);
 await page.getByRole('button',{name:'Повторить приветствие'}).click();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-wave-amount'))).toBeGreaterThan(.95);
});
