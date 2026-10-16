import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../jounaisetumei-delight.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../jounaisetumei-core.html',import.meta.url),'utf8');
const wrapper=fs.readFileSync(new URL('../jounaisetumei.html',import.meta.url),'utf8');

function setup(reduced=false){
  let route='home',motionOff=false,hidden=false,click,mutations,styleText='';
  const nextFrames=[];
  const root={
    dataset:{},
    classList:{contains:(cls)=>cls==='eg-motion-off'&&motionOff},
    querySelector:(selector)=>{
      if(selector==='.eg-home')return route==='home'?{}:null;
      if(selector==='.eg-detail')return route==='home'?null:{};
      return null;
    },
    addEventListener:(type,handler,capture)=>{
      if(type==='click'&&capture===true)click=handler;
    }
  };
  const window={
    matchMedia:()=>({matches:reduced}),
    requestAnimationFrame:callback=>nextFrames.push(callback),
    __ASOBOON_CINEMA_TEST__:{screen:()=>route},
    addEventListener:()=>{}
  };
  const document={
    getElementById:id=>id==='exitGuideV2'?root:null,
    createElement:()=>({id:'',textContent:''}),
    head:{appendChild:(s)=>{styleText=s.textContent;}},
    addEventListener:()=>{},
    get hidden(){return hidden;}
  };
  class MutationObserver{constructor(callback){mutations=callback;}observe(){}}
  vm.runInNewContext(source,{window,document,MutationObserver,queueMicrotask});
  const fire=(dest,screen=dest)=>{
    click({target:{closest:selector=>selector==='button[data-guide]'?{dataset:{guide:dest}}:null}});
    route=screen;
  };
  const motionToggle=()=>{
    click({target:{closest:selector=>selector==='button[data-motion-toggle]'?{}:null}});
    motionOff=!motionOff;
    mutations();
  };
  return {root,fire,motionToggle,
    tick:async()=>{await Promise.resolve();while(nextFrames.length)nextFrames.shift()();mutations();},
    setRoute:name=>{route=name;mutations();},
    hide:()=>{hidden=true;mutations();},
    style:()=>styleText};
}

test('loads exactly once after audio without changing the instruction page or translations',()=>{
  assert.match(html,/<script src="\.\/jounaisetumei-audio\.js\?v=[^"]+"><\/script>\s*<script src="\.\/jounaisetumei-delight\.js\?v=20261016-layer1-r98"><\/script>/);
  assert.match(wrapper,/src="\.\/jounaisetumei-core\.html\?tablet_release=[^"]+"/); // release identifier changes independently; core audio/delight order is asserted above
  assert.doesNotMatch(source,/innerHTML\s*=|replaceChildren|SpeechSynthesisUtterance|fetch\(|new Audio\(|location\.href/);
  for(const target of ['.eg-receipt','.eg-two-holders','.eg-holder','family','adult','adult-yes','leave'])assert.ok(source.includes(target),target);
  assert.ok(!source.includes('setInterval('));
});

test('family, adult, adult-yes, leave animate after their synchronous detail rendering',async()=>{
  const s=setup();
  for(const route of ['family','adult','adult-yes','leave']){
    s.fire(route);
    await s.tick();
    assert.equal(s.root.dataset.delightRoute,route);
  }
});

test('warning and home never celebrate; idle reset clears previous route',async()=>{
  const s=setup();
  s.fire('family');await s.tick();assert.equal(s.root.dataset.delightRoute,'family');
  s.fire('adult-no');await s.tick();assert.equal(s.root.dataset.delightRoute,undefined);
  s.fire('leave');await s.tick();assert.equal(s.root.dataset.delightRoute,'leave');
  s.setRoute('home');assert.equal(s.root.dataset.delightRoute,undefined);
});

test('changing routes before a queued animation prevents stale effects',async()=>{
  const s=setup();
  s.fire('family');
  s.fire('adult');
  await s.tick();
  assert.equal(s.root.dataset.delightRoute,'adult');
});

test('motion OFF, reduced motion, hidden tab all disable comic animations',async()=>{
  const s=setup();
  s.motionToggle();
  s.fire('adult');await s.tick();assert.equal(s.root.dataset.delightRoute,undefined);
  const r=setup(true);
  r.fire('family');await r.tick();assert.equal(r.root.dataset.delightRoute,undefined);
  const h=setup();
  h.fire('leave');await h.tick();assert.equal(h.root.dataset.delightRoute,'leave');
  h.hide();assert.equal(h.root.dataset.delightRoute,undefined);
});

test('animation is one-shot, scoped to props, and respects accessibility',()=>{
  const css=setup().style();
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(prefers-reduced-motion:no-preference\)/);
  assert.match(css,/#exitGuideV2\.eg-motion-off/);
  assert.match(css,/data-delight-route="adult-yes"/);
  assert.doesNotMatch(css,/animation:[^;\n]*infinite/i);
  assert.doesNotMatch(css,/\.eg-detail-title|\.eg-step-text|\.eg-hint/);
  assert.doesNotMatch(css,/data-delight-route="adult-no"/);
});
