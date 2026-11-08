const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');

test('registration validates credentials first, preserves back navigation and submits the name only on step two',{timeout:90000},async t=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const page=await context.newPage(),submissions=[];
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{message:'Войдите снова'}}));
  await page.route('**/api/auth/register',async route=>{
   const body=route.request().postDataJSON();submissions.push(body);
   if(submissions.length===1)return route.fulfill({status:409,json:{message:'Этот email уже зарегистрирован.',fields:{email:'Email уже зарегистрирован'}}});
   return route.fulfill({status:201,json:{user:{id:'registration-preview-user',name:body.name,email:body.email}}});
  });
  await page.goto('http://localhost:8081');await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Войти',exact:true}).last().click();
  await page.getByRole('tab',{name:'Регистрация',exact:true}).click();
  await expect(page.getByLabel('Имя',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Повторите пароль',{exact:true})).toHaveCount(0);
  const email=page.getByLabel('Email',{exact:true}),password=page.getByLabel('Пароль',{exact:true});
  await email.fill('bad');await password.fill('short');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.getByText('Введите корректный email',{exact:true})).toBeVisible();
  await expect(page.getByText('Не менее 8 символов',{exact:true})).toBeVisible();
  assert.equal(submissions.length,0);
  await email.fill('  WALKER@example.com  ');await password.fill('private-step-password');
  await page.screenshot({path:`.preview/auth-register-step1-${viewport.width}.png`,fullPage:true});
  await password.press('Enter');
  const name=page.getByLabel('Имя',{exact:true});
  await expect(name).toBeVisible();await expect(email).toHaveCount(0);await expect(password).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Назад',exact:true})).toBeVisible();
  assert.equal(submissions.length,0,'step one creates no partial account');
  await name.fill('  ');await page.getByRole('button',{name:'Зарегистрироваться',exact:true}).click();
  await expect(page.getByText('Укажите имя',{exact:true})).toBeVisible();assert.equal(submissions.length,0);
  await name.fill('  Алия  ');
  await page.getByRole('button',{name:'Назад',exact:true}).click();
  await expect(email).toHaveValue('WALKER@example.com');await expect(password).toHaveValue('private-step-password');
  await expect(password).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(name).toHaveValue('  Алия  ');
  await page.screenshot({path:`.preview/auth-register-step2-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Зарегистрироваться',exact:true}).click();
  await expect(email).toBeVisible();await expect(page.getByText('Email уже зарегистрирован',{exact:true})).toBeVisible();
  assert.deepEqual(submissions,[{email:'walker@example.com',password:'private-step-password',name:'Алия'}]);
  await expect(password).toHaveValue('private-step-password');
  await email.fill('new-walker@example.com');await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(name).toHaveValue('  Алия  ');
  await page.getByRole('button',{name:'Зарегистрироваться',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Регистрация',exact:true})).toHaveCount(0);
  assert.equal(submissions.length,2);
  assert.deepEqual(submissions[1],{email:'new-walker@example.com',password:'private-step-password',name:'Алия'});
  await context.close();
 }
});
