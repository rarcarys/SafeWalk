const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('@playwright/test');
const {DOMParser}=require('@xmldom/xmldom');
const sharp=require('sharp');

test('pupils stay in eye apertures and the existing front paws leave the ground for privacy',async t=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:880,height:736}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}canvas{width:880px;height:736px}</style><canvas width="880" height="736"></canvas>');
 await page.addScriptTag({content:fs.readFileSync('src/services/fireflyController.js','utf8').replace('export function createFireflyController','window.createFireflyController = function createFireflyController')});
 const doc=new DOMParser().parseFromString(fs.readFileSync('assets/mascot/g215-clean/stoat.svg','utf8'),'image/svg+xml');
 const openings=['left','right'].map(side=>Array.from(doc.getElementsByTagName('path')).find(n=>n.getAttribute('id')===`eye-${side}-white`).getAttribute('d'));
 const seams=['head-shape','ear-left-outer','ear-right-outer'].map(id=>Array.from(doc.getElementsByTagName('path')).find(n=>n.getAttribute('id')===id).getAttribute('d'));
 const report=await page.evaluate(async({openings,seams})=>{
  const inputs=[{name:'numLook',value:50},{name:'isHandsUp',value:false},{name:'isChecking',value:false}];
  for(const input of inputs){input.asNumber=()=>input;input.asBool=()=>input;}
  const nodes={Ctrl_look:{tx:398.6,ty:312.67},Ctrl_hand_left:{tx:0,ty:741.33},Ctrl_eye_left:{tx:0,ty:0},Ctrl_eye_right:{tx:0,ty:0},Ctrl_eyelid_top_Left:{tx:0,ty:0},Ctrl_eyelid_bottom_left:{tx:0,ty:29.36}};
  let poseOverride=null;
  const board={advance(){},stateMachineByName(){return{};},node(name){return{worldTransform(){
   const value=name==='Ctrl_pupils'?{tx:.12+(inputs[0].value-50)/8,ty:-12.68}:name==='Ctrl_hand_left'?{tx:0,ty:741.33-526.28*(poseOverride??(inputs[1].value?1:0))}:nodes[name];
   return{xx:1,yy:1,...value,delete(){}};
  }};},delete(){}};
  let frameId=0;const scheduled=new Map();
  const engine={load:async()=>({defaultArtboard:()=>board,unref(){}}),StateMachineInstance:class{inputCount(){return inputs.length;}input(i){return inputs[i];}advanceAndApply(){}delete(){}},requestAnimationFrame(callback){scheduled.set(++frameId,callback);return frameId;},cancelAnimationFrame(id){scheduled.delete(id);}};
  let ready;let covers=[];const loaded=new Promise(resolve=>ready=resolve);
  const canvas=document.querySelector('canvas');
  canvas.getContext('2d',{willReadFrequently:true});
  const controller=window.createFireflyController({RuntimeLoader:{awaitInstance:async()=>engine}},canvas,{buffer:new ArrayBuffer(1)},event=>{if(event.type==='ready')ready();if(event.type==='state')covers.push(event.cover);if(event.type==='error')throw Error('Renderer failed');});
  await loaded;
  function snapshot(progress){controller.update({watching:true,lookingAway:false,progress,reducedMotion:true});return canvas.getContext('2d').getImageData(0,0,880,736).data.slice();}
  const masks=openings.map(d=>{
   const mask=document.createElement('canvas');mask.width=880;mask.height=736;
   const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.scale(4,4);ctx.translate(110,175);ctx.scale(.265,.265);ctx.translate(-290,-685);ctx.fill(new Path2D(d));
   // Allow one output pixel for antialiasing of the clipping boundary.
   ctx.lineWidth=2;ctx.stroke(new Path2D(d));
   return ctx.getImageData(0,0,880,736).data;
  });
  const baseline=snapshot(.5),results=[];
  // The full figure must remain connected; the header deliberately crops its lower body.
  const cropHeight=736,seen=new Uint8Array(880*cropHeight);
  const queue=new Int32Array(seen.length),components=[];
  for(let start=0;start<seen.length;start++){
   if(seen[start]||baseline[start*4+3]<160)continue;
   let head=0,end=1;queue[0]=start;seen[start]=1;
   while(head<end){const pixel=queue[head++],x=pixel%880;
    for(const next of [x>0?pixel-1:-1,x<879?pixel+1:-1,pixel-880,pixel+880]){
     if(next<0||next>=seen.length||seen[next]||baseline[next*4+3]<160)continue;
     seen[next]=1;queue[end++]=next;
    }
   }
   if(end>20)components.push(end);
  }
  for(const progress of [0,1,.5]){
   const pixels=snapshot(progress);let outside=0,changed=0;const bounds=[880,736,0,0];
   const whites=[0,0];
   for(let i=0;i<pixels.length;i+=4){
    const difference=Math.max(...[0,1,2,3].map(c=>Math.abs(pixels[i+c]-baseline[i+c])))>8;
    if(difference){changed++;if(!masks.some(mask=>mask[i+3]>0)){outside++;const x=i/4%880,y=Math.floor(i/4/880);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}
    masks.forEach((mask,index)=>{if(mask[i+3]>230&&pixels[i]===255&&pixels[i+1]===255&&pixels[i+2]===255)whites[index]++;});
   }
   const pinX=Math.round(4*(110+(351-290)*.265)),pinY=Math.round(4*(175+(390-685)*.265));
   const pin=Array.from(pixels.slice((pinY*880+pinX)*4,(pinY*880+pinX)*4+4));
   results.push({progress,outside,changed,whites,bounds,pin});
  }
  function groundToes(pixels){
   let count=0;
   for(const [left,top,right,bottom] of [[300,660,347,688],[388,660,440,689]]){
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
     const px=Math.round(4*(110+(x-290)*.265)),py=Math.round(4*(175+(y-685)*.265));
     const i=(py*880+px)*4;
     if(pixels[i]>200&&pixels[i+1]<195&&pixels[i+2]<160&&pixels[i+3]>220)count++;
    }
   }
   return count;
  }
  const before=groundToes(baseline);
  controller.update({watching:false,lookingAway:true,progress:.5,reducedMotion:true});
  const raised=canvas.getContext('2d').getImageData(0,0,880,736).data;
  const after=groundToes(raised);
  const hiddenEyes=document.createElement('canvas');hiddenEyes.width=880;hiddenEyes.height=736;
  const hiddenCtx=hiddenEyes.getContext('2d',{willReadFrequently:true});
  hiddenCtx.scale(4,4);hiddenCtx.translate(110,175);hiddenCtx.scale(.265,.265);hiddenCtx.translate(-290,-685+26);
  openings.forEach(d=>hiddenCtx.fill(new Path2D(d)));
  const hiddenMask=hiddenCtx.getImageData(0,0,880,736).data;let exposedEye=0;
  for(let i=0;i<raised.length;i+=4)if(hiddenMask[i+3]>230&&Math.max(raised[i],raised[i+1],raised[i+2])<70&&raised[i+3]>220)exposedEye++;
  let time=1000;
  function advance(seconds){for(let step=0;step<seconds*20;step++){
   const entry=scheduled.entries().next().value;if(!entry)break;
   scheduled.delete(entry[0]);time+=50;entry[1](time);
  }}
  const read=()=>canvas.getContext('2d').getImageData(0,0,880,736).data.slice();
  function regionChanges(a,b,box){let changed=0;for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++){
   const px=Math.round(4*(110+(x-290)*.265)),py=Math.round(4*(175+(y-685)*.265)),i=(py*880+px)*4;
   if(Math.max(...[0,1,2,3].map(c=>Math.abs(a[i+c]-b[i+c])))>12)changed++;
  }return changed;}
  controller.update({watching:false,lookingAway:false,progress:.5,reducedMotion:false});
  advance(.05);const restFrame=read();advance(1.2);const inhaleFrame=read();
  const motion={body:regionChanges(restFrame,inhaleFrame,[250,400,475,640]),tail:regionChanges(restFrame,inhaleFrame,[40,395,230,640])};
  motion.frames=[];
  for(let i=0;i<6;i++){motion.frames.push(canvas.toDataURL('image/png'));advance(.8);}
  controller.update({watching:false,lookingAway:false,progress:.5,reducedMotion:true});
  const still=read();advance(1.2);const later=read();
  motion.reducedIsStill=still.every((value,i)=>value===later[i]);
  const missing=[];
  function samplePose(phase){
   poseOverride=phase;controller.update({watching:false,lookingAway:true,progress:.5,reducedMotion:true});
   const pixels=read(),mask=document.createElement('canvas');mask.width=880;mask.height=736;
   const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.scale(4,4);ctx.translate(110,175);ctx.scale(.265,.265);ctx.translate(-290,-685+26*phase);
   seams.forEach(d=>ctx.fill(new Path2D(d)));
   const alpha=ctx.getImageData(0,0,880,736).data;let count=0;
   for(let i=3;i<pixels.length;i+=4)if(alpha[i]>250&&pixels[i]<235)count++;
   missing.push(count);return canvas.toDataURL('image/png');
  }
  const phases=[0,.15,.3,.5,.7,.9,1];
  const up=phases.map(samplePose),down=[...phases].reverse().map(samplePose);
  const transition={up,down,samples:missing.length,baselineMissing:missing[0],maxMissing:Math.max(...missing)};
  poseOverride=null;
  controller.update({watching:false,lookingAway:true,progress:.5,reducedMotion:true});
  controller.cleanup();return {gaze:results,paws:{before,after,exposedEye},motion,transition,visibleComponents:components.length};
 },{openings,seams});
 await page.screenshot({path:'.preview/mascot-eyes-fixed.png'});
 for(const result of report.gaze){
  assert.equal(result.outside,0,`no pupil pixels escape the aperture at ${result.progress}`);
  assert.ok(result.whites.every(count=>count>200),`both white eye areas remain visible at ${result.progress}`);
  assert.deepEqual(result.pin,[255,255,255,255],'scarf location mark renders pure white');
  if(result.progress!==.5)assert.ok(result.changed>100,'gaze visibly changes');
 }
 assert.ok(report.paws.before>10,'front toes are present on the ground at rest');
 assert.ok(report.paws.after<report.paws.before*.1,'front toes move up with their existing paws, leaving no second pair on the ground');
 assert.equal(report.paws.exposedEye,0,'eyes and their dark rims are completely concealed in the reference privacy pose');
 assert.ok(report.motion.body>30,'body breathes even with stationary Rive controls');
 assert.ok(report.motion.tail>30,'tail gently moves independently of the gaze');
 assert.equal(report.motion.reducedIsStill,true,'reduced motion stops ambient animation');
 const tailTiles=await Promise.all(report.motion.frames.map(async(data,index)=>({input:await sharp(Buffer.from(data.split(',')[1],'base64')).resize(330,276).flatten({background:'#E0E8DA'}).png().toBuffer(),left:index*330,top:0})));
 await sharp({create:{width:1980,height:276,channels:4,background:'#E0E8DA'}}).composite(tailTiles).png().toFile('.preview/mascot-tail-motion.png');
 assert.equal(report.visibleComponents,1,'tail and torso stay connected in the full character artwork');
 assert.equal(report.transition.samples,14,'both directions cover the full range of intermediate poses');
 assert.ok(report.transition.maxMissing<=report.transition.baselineMissing+4,'head and ear joins stay opaque throughout both transitions');
 const tiles=[];
 for(const [row,frames] of [report.transition.up,report.transition.down].entries())for(const [column,data] of frames.entries()){
  tiles.push({input:await sharp(Buffer.from(data.split(',')[1],'base64')).resize(220,184).flatten({background:'#F5F4F0'}).png().toBuffer(),left:column*220,top:row*184});
 }
 await sharp({create:{width:1540,height:368,channels:4,background:'#F5F4F0'}}).composite(tiles).png().toFile('.preview/mascot-transition-frames.png');
 assert.deepEqual(errors,[]);
});
