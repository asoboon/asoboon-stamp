(()=>{'use strict';
const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!M||!A)return;

let currentScope=null,running=false,currentId='';
const diagnostics={played:0,canceled:0,cleanupRuns:0,callPlayed:0,lastEvent:null,history:[]};

const EVENTS=Object.freeze([
  {id:'POMPON_PEEK',category:'POMPON_CAMEO',standalone:true},
  {id:'POMPON_DASH_BY',category:'POMPON_CAMEO',standalone:true},
  {id:'CHIRU_PEEK',category:'CHIRU_CAMEO',standalone:true},
  {id:'CHIRU_SNEAK',category:'CHIRU_CAMEO',standalone:true},
  {id:'POMPON_BRAKE_FAIL',category:'POMPON_STORY',standalone:false},
  {id:'DUO_CHASE_CRASH',category:'DUO_STORY',standalone:false},
  {id:'PEEK_DISCOVERY',category:'POMPON_STORY',standalone:false},
  {id:'BALL_RIDE_FAIL',category:'DUO_STORY',standalone:false},
].map(Object.freeze));

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function rect(){const r=document.querySelector('.board')?.getBoundingClientRect?.();return r||{left:0,top:0,width:innerWidth,height:innerHeight,right:innerWidth,bottom:innerHeight}}
function scaleForStage(){const r=rect();return clamp(Math.min(r.width/1080,r.height/1000),.72,1.28)}
function t(x,y,s=1,r=0,flip=1){return 'translate3d('+(x-128)+'px,'+(y-128)+'px,0) rotate('+r+'deg) scale('+(s*flip)+','+s+')'}
function pose(scope,name,{x=0,y=0,scale=1,rotate=0,flip=1,opacity=1,layer='front'}={}){
  const el=A.createCharacter(name);if(!el)return null;el.style.opacity=String(opacity);el.style.transform=t(x,y,scale,rotate,flip);return scope.add(el,layer);
}
function fx(scope,name,{x=0,y=0,scale=1,rotate=0,flip=1,opacity=1,layer='front'}={}){
  const el=A.createEffect(name);if(!el)return null;el.style.opacity=String(opacity);el.style.transform=t(x,y,scale,rotate,flip);return scope.add(el,layer);
}
function hide(el){if(el)el.style.opacity='0'}
async function pop(scope,name,x,y,scale=1,rotate=0,duration=430){
  const el=fx(scope,name,{x,y,scale:scale*.45,rotate,opacity:0});if(!el)return;
  await scope.animate(el,[{opacity:0,transform:t(x,y,scale*.34,rotate)},{opacity:1,offset:.34,transform:t(x,y,scale*1.16,rotate)},{opacity:.94,offset:.68,transform:t(x,y,scale,rotate)},{opacity:0,transform:t(x,y,scale*1.08,rotate)}],{duration,easing:'cubic-bezier(.18,.86,.2,1)',fill:'forwards'});
}
async function reduced(scope,id,context={}){
  const r=rect(),s=scaleForStage()*.82;
  const map={
    POMPON_PEEK:['pompon_peek',r.width*.13,r.height*.64],
    POMPON_DASH_BY:['pompon_dash',r.width*.35,r.height*.68],
    CHIRU_PEEK:['chiru_peek',r.width*.84,r.height*.64],
    CHIRU_SNEAK:['chiru_sneak',r.width*.72,r.height*.68],
    POMPON_BRAKE_FAIL:['pompon_cannot_stop',r.width*.5,r.height*.67],
    DUO_CHASE_CRASH:['duo_entangled',r.width*.5,r.height*.62],
    PEEK_DISCOVERY:['duo_surprised',r.width*.5,r.height*.62],
    BALL_RIDE_FAIL:['duo_dodge',r.width*.5,r.height*.62],
    CALL_DELIVERY:['chiru_retort',clamp((context.localX||r.width*.5)+r.width*.18,150,r.width-150),clamp(context.localY||r.height*.55,150,r.height-150)]
  };
  const [name,x,y]=map[id]||map.POMPON_PEEK;const el=pose(scope,name,{x,y,scale:s,opacity:0});
  await scope.animate(el,[{opacity:0,transform:t(x,y+8,s*.96)},{opacity:1,offset:.28,transform:t(x,y,s)},{opacity:1,offset:.72,transform:t(x,y,s)},{opacity:0,transform:t(x,y-6,s*.98)}],{duration:650,easing:'ease-out',fill:'forwards'});
}

async function pomponPeek(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.64;const p=pose(scope,'pompon_peek',{x:-70,y,scale:s*.94,opacity:0});
  await scope.animate(p,[{opacity:0,transform:t(-80,y,s*.86)},{opacity:1,offset:.28,transform:t(44,y,s*.96)},{opacity:1,offset:.7,transform:t(52,y,s*.96,2)},{opacity:0,transform:t(-86,y,s*.88,-3)}],{duration:930,easing:'cubic-bezier(.2,.72,.2,1)',fill:'forwards'});
}
async function pomponDashBonk(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.69;const p=pose(scope,'pompon_dash',{x:-190,y,scale:s*1.05,opacity:0});const line=fx(scope,'speed_lines',{x:-80,y:y+18,scale:s,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(p,[{opacity:0,transform:t(-190,y,s*.92,-3)},{opacity:1,offset:.14,transform:t(-35,y,s*1.05,-1)},{opacity:1,offset:.82,transform:t(r.width+40,y-15,s*1.05,2)},{opacity:0,transform:t(r.width+220,y-30,s*.94,4)}],{duration:650,easing:'cubic-bezier(.1,.78,.16,1)',fill:'forwards'}),
    line?scope.animate(line,[{opacity:0,transform:t(-80,y+20,s*.5)},{opacity:.9,offset:.32,transform:t(r.width*.35,y+18,s*1.05)},{opacity:0,transform:t(r.width+120,y,s*.8)}],{duration:640,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
  await scope.wait(150);await Promise.all([pop(scope,'impact_starburst',r.width-12,y-5,s*.78,-8,430),pop(scope,'dust_impact',r.width-18,y+58,s*.55,0,480)]);
}
async function chiruPeek(scope){
  const r=rect(),s=scaleForStage(),x=r.width+70,y=r.height*.64;const c=pose(scope,'chiru_peek',{x,y,scale:s*.9,flip:-1,opacity:0});
  const q=fx(scope,'question',{x:r.width-135,y:y-120,scale:s*.28,opacity:0});
  await Promise.all([
    scope.animate(c,[{opacity:0,transform:t(r.width+90,y,s*.82,0,-1)},{opacity:1,offset:.28,transform:t(r.width-48,y,s*.9,0,-1)},{opacity:1,offset:.7,transform:t(r.width-55,y,s*.9,-2,-1)},{opacity:0,transform:t(r.width+95,y,s*.82,0,-1)}],{duration:950,easing:'cubic-bezier(.2,.72,.2,1)',fill:'forwards'}),
    q?scope.animate(q,[{opacity:0,transform:t(r.width-135,y-115,s*.2,-4)},{opacity:.9,offset:.38,transform:t(r.width-135,y-125,s*.44,-4)},{opacity:.8,offset:.68,transform:t(r.width-135,y-132,s*.4,2)},{opacity:0,transform:t(r.width-135,y-145,s*.32,5)}],{duration:650,delay:210,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
}
async function chiruSneak(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.69;const c=pose(scope,'chiru_sneak',{x:r.width+170,y,scale:s*.84,flip:-1,opacity:0});
  const q=fx(scope,'question',{x:r.width*.55,y:y-130,scale:s*.32,opacity:0});
  await Promise.all([
    scope.animate(c,[{opacity:0,transform:t(r.width+170,y,s*.76,0,-1)},{opacity:1,offset:.18,transform:t(r.width*.82,y,s*.84,0,-1)},{opacity:1,offset:.62,transform:t(r.width*.48,y-5,s*.84,-2,-1)},{opacity:0,transform:t(r.width*.24,y,s*.76,0,-1)}],{duration:1250,easing:'cubic-bezier(.28,.55,.3,1)',fill:'forwards'}),
    q?scope.animate(q,[{opacity:0,transform:t(r.width*.56,y-120,s*.2)},{opacity:.9,offset:.35,transform:t(r.width*.56,y-130,s*.4)},{opacity:0,transform:t(r.width*.56,y-145,s*.34)}],{duration:700,delay:300,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
}

async function brakeFail(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.68,stop=r.width*.43;
  const dash=pose(scope,'pompon_dash',{x:-180,y,scale:s*1.04,opacity:0});const speed=fx(scope,'speed_lines',{x:r.width*.18,y:y+20,scale:s,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(dash,[{opacity:0,transform:t(-180,y,s*.9,-3)},{opacity:1,offset:.13,transform:t(-25,y,s*1.04,-1)},{opacity:1,transform:t(stop,y,s*1.04,1)}],{duration:420,easing:'cubic-bezier(.1,.78,.18,1)',fill:'forwards'}),
    speed?scope.animate(speed,[{opacity:0,transform:t(0,y+20,s*.45)},{opacity:.88,offset:.3,transform:t(r.width*.22,y+20,s)},{opacity:0,transform:t(stop-80,y+12,s*1.15)}],{duration:430,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
  hide(dash);
  const brake=pose(scope,'pompon_brake',{x:stop,y,scale:s*1.03});const dust=fx(scope,'dust_burst',{x:stop-70,y:y+70,scale:s*.58,opacity:0});
  await Promise.all([
    scope.animate(brake,[{transform:t(stop,y,s*1.03,-3)},{transform:t(stop+30,y+2,s*1.08,4),offset:.45},{transform:t(stop+10,y,s*1.03,-1)}],{duration:360,easing:'cubic-bezier(.2,.82,.2,1)',fill:'forwards'}),
    dust?scope.animate(dust,[{opacity:0,transform:t(stop-70,y+70,s*.28)},{opacity:1,offset:.32,transform:t(stop-60,y+70,s*.72)},{opacity:0,transform:t(stop-40,y+55,s*.95)}],{duration:500,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
  hide(brake);await scope.wait(110);
  const cannot=pose(scope,'pompon_cannot_stop',{x:stop+15,y,scale:s*1.03});
  await scope.animate(cannot,[{opacity:1,transform:t(stop+15,y,s*1.03,-2)},{opacity:1,offset:.35,transform:t(stop+145,y+4,s*1.04,5)},{opacity:0,transform:t(r.width+210,y-12,s*.94,13)}],{duration:500,easing:'cubic-bezier(.2,.58,.18,1)',fill:'forwards'});
  await scope.wait(130);await Promise.all([pop(scope,'impact_starburst',r.width-12,y-8,s*.82,-8,450),pop(scope,'dust_impact',r.width-15,y+60,s*.6,0,520)]);
  await scope.wait(130);
  const wobble=pose(scope,'pompon_wobble',{x:r.width+150,y:r.height*.67,scale:s*.9,flip:-1,opacity:0});const dizzy=fx(scope,'dizzy_spiral',{x:r.width*.77,y:r.height*.48,scale:s*.4,opacity:0});const c=pose(scope,'chiru_exasperated',{x:r.width*.18,y:r.height*.69,scale:s*.75,opacity:0});
  await Promise.all([
    scope.animate(wobble,[{opacity:0,transform:t(r.width+150,r.height*.67,s*.82,8,-1)},{opacity:1,offset:.26,transform:t(r.width*.82,r.height*.67,s*.9,-5,-1)},{opacity:1,offset:.72,transform:t(r.width*.74,r.height*.67,s*.9,4,-1)},{opacity:0,transform:t(r.width*.69,r.height*.7,s*.84,-2,-1)}],{duration:760,easing:'cubic-bezier(.18,.7,.22,1)',fill:'forwards'}),
    dizzy?scope.animate(dizzy,[{opacity:0,transform:t(r.width*.77,r.height*.5,s*.2)},{opacity:.9,offset:.3,transform:t(r.width*.77,r.height*.48,s*.45)},{opacity:0,transform:t(r.width*.77,r.height*.44,s*.38,20)}],{duration:650,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
    scope.animate(c,[{opacity:0,transform:t(r.width*.18,r.height*.74,s*.68)},{opacity:1,offset:.3,transform:t(r.width*.18,r.height*.69,s*.75)},{opacity:1,offset:.78,transform:t(r.width*.18,r.height*.69,s*.75,-2)},{opacity:0,transform:t(r.width*.18,r.height*.73,s*.7)}],{duration:760,delay:120,easing:'ease-out',fill:'forwards'})
  ]);
}
async function chaseCatch(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.68;
  const p=pose(scope,'pompon_dash',{x:-190,y,scale:s*.98,opacity:0});const c=pose(scope,'chiru_chase',{x:-340,y:y+10,scale:s*.88,opacity:0});const line=fx(scope,'speed_lines',{x:r.width*.2,y:y+20,scale:s,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(p,[{opacity:0,transform:t(-190,y,s*.88)},{opacity:1,offset:.12,transform:t(-30,y,s*.98)},{opacity:0,transform:t(r.width+170,y-18,s*.9,4)}],{duration:650,easing:'cubic-bezier(.1,.78,.16,1)',fill:'forwards'}),
    scope.animate(c,[{opacity:0,transform:t(-340,y+10,s*.78)},{opacity:1,offset:.18,transform:t(-120,y+10,s*.88)},{opacity:0,transform:t(r.width+90,y-8,s*.82,3)}],{duration:700,easing:'cubic-bezier(.12,.76,.18,1)',fill:'forwards'}),
    line?scope.animate(line,[{opacity:0,transform:t(0,y+20,s*.5)},{opacity:.85,offset:.35,transform:t(r.width*.4,y+16,s)},{opacity:0,transform:t(r.width+120,y,s*.75)}],{duration:680,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
  await scope.wait(120);
  const chase=pose(scope,'duo_chase',{x:r.width*.52,y:r.height*.62,scale:s*.7,opacity:0});
  await scope.animate(chase,[{opacity:0,transform:t(r.width*.35,r.height*.62,s*.55)},{opacity:1,offset:.28,transform:t(r.width*.5,r.height*.62,s*.78)},{opacity:0,transform:t(r.width*.78,r.height*.6,s*.68)}],{duration:620,easing:'cubic-bezier(.18,.75,.2,1)',fill:'forwards'});
  const catchPose=pose(scope,'duo_runaway_crash',{x:r.width*.56,y:r.height*.6,scale:s*.62,opacity:0});
  await scope.animate(catchPose,[{opacity:0,transform:t(r.width*.56,r.height*.6,s*.48,-5)},{opacity:1,offset:.25,transform:t(r.width*.56,r.height*.6,s*.78,2)},{opacity:1,offset:.7,transform:t(r.width*.6,r.height*.6,s*.72,-2)},{opacity:0,transform:t(r.width+140,r.height*.58,s*.62,8)}],{duration:720,easing:'cubic-bezier(.18,.78,.2,1)',fill:'forwards'});
  await scope.wait(120);await Promise.all([pop(scope,'impact_burst',r.width-12,r.height*.6,s*.72,0,460),pop(scope,'dust_impact',r.width-18,r.height*.7,s*.62,0,520)]);
  const ent=pose(scope,'duo_entangled',{x:r.width*.72,y:r.height*.62,scale:s*.66,opacity:0});
  await scope.animate(ent,[{opacity:0,transform:t(r.width*.82,r.height*.58,s*.5,10)},{opacity:1,offset:.28,transform:t(r.width*.69,r.height*.62,s*.72,-4)},{opacity:1,offset:.72,transform:t(r.width*.64,r.height*.63,s*.68,2)},{opacity:0,transform:t(r.width*.58,r.height*.68,s*.58,-2)}],{duration:760,easing:'cubic-bezier(.2,.72,.24,1)',fill:'forwards'});
}
async function peekDiscovery(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.64;
  const p=pose(scope,'pompon_peek',{x:-65,y,scale:s*.88,opacity:0});
  await scope.animate(p,[{opacity:0,transform:t(-80,y,s*.8)},{opacity:1,transform:t(42,y,s*.88)}],{duration:420,easing:'ease-out',fill:'forwards'});
  await scope.wait(180);
  const c=pose(scope,'chiru_peek',{x:r.width+65,y,scale:s*.82,flip:-1,opacity:0});
  await scope.animate(c,[{opacity:0,transform:t(r.width+80,y,s*.74,0,-1)},{opacity:1,transform:t(r.width-44,y,s*.82,0,-1)}],{duration:440,easing:'ease-out',fill:'forwards'});
  await scope.wait(180);hide(p);hide(c);
  await pop(scope,'exclamation',r.width*.5,r.height*.42,s*.5,0,430);
  const duo=pose(scope,'duo_surprised',{x:r.width*.5,y:r.height*.6,scale:s*.58,opacity:0});
  await scope.animate(duo,[{opacity:0,transform:t(r.width*.5,r.height*.62,s*.46)},{opacity:1,offset:.28,transform:t(r.width*.5,r.height*.57,s*.78,-2)},{opacity:1,offset:.66,transform:t(r.width*.5,r.height*.6,s*.7,1)},{opacity:0,transform:t(r.width*.56,r.height*.6,s*.62,3)}],{duration:650,easing:'cubic-bezier(.17,.82,.22,1)',fill:'forwards'});
  const chase=pose(scope,'duo_chase',{x:r.width*.55,y:r.height*.62,scale:s*.58,opacity:0});
  await scope.animate(chase,[{opacity:0,transform:t(r.width*.45,r.height*.62,s*.45)},{opacity:1,offset:.25,transform:t(r.width*.56,r.height*.62,s*.68)},{opacity:0,transform:t(r.width+170,r.height*.58,s*.58,4)}],{duration:650,easing:'cubic-bezier(.12,.78,.18,1)',fill:'forwards'});
}
async function ballRideFail(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.67;
  const ball=document.createElement('div');ball.className='pc-giant-ball';scope.add(ball,'back');
  const rider=pose(scope,'pompon_ballride',{x:-170,y:y-40,scale:s*.8,opacity:0});
  await Promise.all([
    scope.animate(ball,[{opacity:0,transform:'translate3d(-300px,'+(y-120)+'px,0) rotate(-40deg) scale(.72)'},{opacity:1,offset:.15,transform:'translate3d(-80px,'+(y-120)+'px,0) rotate(10deg) scale(.94)'},{opacity:1,transform:'translate3d('+(r.width*.5-120)+'px,'+(y-120)+'px,0) rotate(250deg) scale(1)'}],{duration:760,easing:'cubic-bezier(.12,.72,.18,1)',fill:'forwards'}),
    scope.animate(rider,[{opacity:0,transform:t(-180,y-40,s*.72,-6)},{opacity:1,offset:.15,transform:t(-5,y-40,s*.8,-2)},{opacity:1,transform:t(r.width*.5+5,y-40,s*.8,3)}],{duration:760,easing:'cubic-bezier(.12,.72,.18,1)',fill:'forwards'})
  ]);
  await Promise.all([pop(scope,'sparkle_gold',r.width*.57,y-145,s*.45,4,620),pop(scope,'magic_sparkle',r.width*.45,y-165,s*.38,-5,680)]);
  await scope.wait(180);
  await Promise.all([
    scope.animate(ball,[{opacity:1,transform:'translate3d('+(r.width*.5-120)+'px,'+(y-120)+'px,0) rotate(250deg) scale(1)'},{opacity:1,offset:.55,transform:'translate3d('+(r.width*.82-120)+'px,'+(y-140)+'px,0) rotate(470deg) scale(1.04)'},{opacity:0,transform:'translate3d('+(r.width+260)+'px,'+(y-190)+'px,0) rotate(760deg) scale(.92)'}],{duration:560,easing:'cubic-bezier(.2,.58,.14,1)',fill:'forwards'}),
    scope.animate(rider,[{opacity:1,transform:t(r.width*.5+5,y-40,s*.8,3)},{opacity:.8,offset:.55,transform:t(r.width*.82,y-75,s*.78,10)},{opacity:0,transform:t(r.width+120,y-170,s*.68,24)}],{duration:560,easing:'cubic-bezier(.2,.58,.14,1)',fill:'forwards'})
  ]);
  const fly=pose(scope,'pompon_fly',{x:r.width*.73,y:r.height*.54,scale:s*.76,rotate:-8,opacity:0});const dodge=pose(scope,'chiru_dodge',{x:r.width*.22,y:r.height*.69,scale:s*.72,opacity:0});
  await Promise.all([
    scope.animate(fly,[{opacity:0,transform:t(r.width*.76,r.height*.62,s*.62,-8)},{opacity:1,offset:.2,transform:t(r.width*.62,r.height*.5,s*.78,-16)},{opacity:0,transform:t(r.width*.3,r.height*.57,s*.68,-28)}],{duration:600,easing:'cubic-bezier(.18,.68,.16,1)',fill:'forwards'}),
    scope.animate(dodge,[{opacity:0,transform:t(r.width*.2,r.height*.7,s*.62)},{opacity:1,offset:.25,transform:t(r.width*.2,r.height*.66,s*.74,-4)},{opacity:0,transform:t(r.width*.08,r.height*.65,s*.66,-8)}],{duration:620,easing:'cubic-bezier(.18,.7,.2,1)',fill:'forwards'})
  ]);
  const duo=pose(scope,'duo_dodge',{x:r.width*.38,y:r.height*.61,scale:s*.62,opacity:0});
  await scope.animate(duo,[{opacity:0,transform:t(r.width*.48,r.height*.56,s*.48,-10)},{opacity:1,offset:.28,transform:t(r.width*.36,r.height*.6,s*.7,-4)},{opacity:0,transform:t(-150,r.height*.65,s*.58,-12)}],{duration:680,easing:'cubic-bezier(.18,.72,.18,1)',fill:'forwards'});
  await scope.wait(100);await Promise.all([pop(scope,'impact_starburst',10,r.height*.62,s*.72,8,430),pop(scope,'dust_impact',14,r.height*.72,s*.58,0,500)]);
}
async function callDelivery(scope,context={}){
  const r=rect(),s=scaleForStage(),x=clamp(Number(context.localX)||r.width*.5,150,r.width-150),y=clamp(Number(context.localY)||r.height*.55,150,r.height-150);
  if(M.isReduced())return reduced(scope,'CALL_DELIVERY',{localX:x,localY:y});
  const p=pose(scope,'pompon_dash',{x:-180,y:y+15,scale:s*.9,opacity:0});const line=fx(scope,'speed_lines',{x:x*.42,y:y+25,scale:s*.85,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(p,[{opacity:0,transform:t(-180,y+15,s*.8,-3)},{opacity:1,offset:.15,transform:t(-20,y+15,s*.9,-1)},{opacity:1,transform:t(x-140,y+8,s*.92,2)}],{duration:390,easing:'cubic-bezier(.08,.8,.18,1)',fill:'forwards'}),
    line?scope.animate(line,[{opacity:0,transform:t(0,y+25,s*.45)},{opacity:.85,offset:.35,transform:t(x*.42,y+22,s*.85)},{opacity:0,transform:t(x-140,y+18,s*1.02)}],{duration:380,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
  hide(p);await Promise.all([pop(scope,'impact_starburst',x-25,y,s*.65,-6,400),pop(scope,'dust_burst',x-55,y+55,s*.5,0,430),pop(scope,'exclamation',x+80,y-90,s*.42,5,460)]);
  const rx=x<r.width*.55?clamp(x+205,180,r.width-140):clamp(x-205,140,r.width-180),flip=rx>x?-1:1;const c=pose(scope,'chiru_retort',{x:rx,y:y+70,scale:s*.68,flip,opacity:0});
  await scope.animate(c,[{opacity:0,transform:t(rx,y+90,s*.58,0,flip)},{opacity:1,offset:.28,transform:t(rx,y+70,s*.7,-2,flip)},{opacity:1,offset:.72,transform:t(rx,y+70,s*.7,2,flip)},{opacity:0,transform:t(rx,y+84,s*.62,0,flip)}],{duration:560,easing:'ease-out',fill:'forwards'});
}

const PLAYERS={POMPON_PEEK:pomponPeek,POMPON_DASH_BY:pomponDashBonk,CHIRU_PEEK:chiruPeek,CHIRU_SNEAK:chiruSneak,POMPON_BRAKE_FAIL:brakeFail,DUO_CHASE_CRASH:chaseCatch,PEEK_DISCOVERY:peekDiscovery,BALL_RIDE_FAIL:ballRideFail,CALL_DELIVERY:callDelivery};

async function play(id,context={}){
  const key=String(id||''),fn=PLAYERS[key];if(!fn||running)return{played:false,reason:fn?'busy':'unknown-event'};
  const timeScale=key==='CALL_DELIVERY'?.95:1.35;const scope=M.createScope('character:'+key,timeScale);currentScope=scope;currentId=key;running=true;
  diagnostics.played++;if(key==='CALL_DELIVERY')diagnostics.callPlayed++;diagnostics.lastEvent={id:key,at:Date.now()};diagnostics.history.push({...diagnostics.lastEvent});diagnostics.history=diagnostics.history.slice(-40);
  try{await A.preloadAll();if(scope.signal.aborted)return{played:false,reason:'aborted'};if(M.isReduced()&&key!=='CALL_DELIVERY')await reduced(scope,key,context);else await fn(scope,context);return{played:true,id:key}}
  catch{return{played:false,id:key,reason:scope.signal.aborted?'aborted':'error'}}
  finally{scope.cleanup();if(currentScope===scope){currentScope=null;currentId='';running=false}diagnostics.cleanupRuns++}
}
function cancel(reason='manual'){if(!currentScope)return false;diagnostics.canceled++;const s=currentScope;currentScope=null;currentId='';running=false;s.abort(reason);return true}
function randomEvent(category,recent=[]){const blocked=new Set(recent);let opts=EVENTS.filter(x=>x.category===category&&!blocked.has(x.id));if(!opts.length)opts=EVENTS.filter(x=>x.category===category);return opts[Math.floor(Math.random()*opts.length)]||null}
async function playRandom(category,{grid=null,recent=[]}={}){const e=randomEvent(category,recent);return e?play(e.id,{grid}):{played:false,reason:'no-event'}}
function boardPoint(viewportRect){const b=rect();return viewportRect?{x:viewportRect.left-b.left+viewportRect.width*.5,y:viewportRect.top-b.top+viewportRect.height*.5}:{x:b.width*.5,y:b.height*.55}}
async function playCallDelivery({number='',rect:targetRect=null}={}){if(running&&currentId==='CALL_DELIVERY')return{played:false,reason:'rapid-call'};cancel('real-call');const p=boardPoint(targetRect);return play('CALL_DELIVERY',{number,localX:p.x,localY:p.y})}
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,reduced:M.isReduced(),assets:A.diagnostics(),semanticPolicy:'standalone-only cameos; contextual reactions only inside stories'}}
function resetForTest(){cancel('test-reset');diagnostics.played=0;diagnostics.canceled=0;diagnostics.cleanupRuns=0;diagnostics.callPlayed=0;diagnostics.lastEvent=null;diagnostics.history=[]}

window.ASOBOON_BOARD_CHARACTER_EVENTS=Object.freeze({version:'2.0.0',events:EVENTS,play,playRandom,playCallDelivery,cancel,isRunning:()=>running,getDiagnostics,resetForTest,playEventForTest:async id=>play(id,{grid:document.getElementById('queueGrid')})});
})();