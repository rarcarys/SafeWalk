const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
test('twelve authored silhouettes and deforming, pausable vector preview', async t => {
 const poses=JSON.parse(fs.readFileSync('assets/mascot/expressive-stoat/pose-data.json','utf8'));
 assert.equal(poses.length,12);
 assert.equal(new Set(poses.map(p=>JSON.stringify(p.spine))).size,12);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(fs.readFileSync('assets/mascot/expressive-stoat/motion-preview.html','utf8'));
 assert.equal(await page.locator('article').count(),12);
 const deformation=await page.evaluate(async()=>{
  const svg=document.querySelector('article svg'), body=svg.querySelector('[id$="body-neck"]');
  function at(time){svg.setCurrentTime(time);return body.getBoundingClientRect().toJSON();}
  return [at(0),at(.95)];
 });
 assert.notEqual(deformation[0].height,deformation[1].height);
 await page.getByRole('button',{name:'Пауза',exact:true}).click();
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('article svg')].every(svg=>svg.animationsPaused())),true);
 await page.screenshot({path:'.preview/stoat-motion-gallery.png',fullPage:true});
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 assert.deepEqual(errors,[]);
 const reduce=await browser.newPage({reducedMotion:'reduce'});
 await reduce.setContent(fs.readFileSync('assets/mascot/expressive-stoat/motion-preview.html','utf8'));
 assert.equal(await reduce.evaluate(()=>document.querySelector('article svg').animationsPaused()),true);
});
