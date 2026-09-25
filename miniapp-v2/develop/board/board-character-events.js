(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!M||!A)return;

let currentScope=null;
let running=false;
let currentId='';
const diagnostics={played:0,canceled:0,cleanupRuns:0,callPlayed:0,lastEvent:null,history:[]};

const EVENTS=Object.freeze([
  Object.freeze({id:'POMPON_PEEK',category:'POMPON_CAMEO'}),
  Object.freeze({id:'POMPON_DASH_BY',category:'POMPON_CAMEO'}),
  Object.freeze({id:'CHIRU_WATCH',category:'CHIRU_CAMEO'}),
  Object.freeze({id:'CHIRU_EXASPERATED',category:'CHIRU_CAMEO'}),
  Object.freeze({id:'POMPON_BRAKE_FAIL',category:'POMPON_STORY'}),
  Object.freeze({id:'DUO_CHASE_CRASH',category:'DUO_STORY'}),
  Object.freeze({id:'PEEK_DISCOVERY',category:'POMPON_STORY'}),
  Object.freeze({id:'BALL_RIDE_FAIL',category:'DUO_STORY'}),
]);

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function rect(){
  const board=document.querySelector('.board');
  const r=board?.getBoundingClientRect?.();
  return r||{left:0,top:0,width:innerWidth,height:innerHeight,right:innerWidth,bottom:innerHeight};
}
function scaleForStage(){
  const r=rect();
  return clamp(Math.min(r.width/1080,r.height/1000),.72,1.28);
}
function transform(x,y,scale=1,rotate=0,flip=1){
  return 'translate3d('+(x-128)+'px,'+(y-128)+'px,0) rotate('+rotate+'deg) scale('+(scale*flip)+','+scale+')';
}
function pose(scope,name,{x=0,y=0,scale=1,rotate=0,flip=1,opacity=1,layer='front',className=''}={}){
  const el=A.createCharacter(name,className);
  if(!el)return null;
  el.style.opacity=String(opacity);
  el.style.transform=transform(x,y,scale,rotate,flip);
  scope.add(el,layer);
  return el;
}
function effect(scope,name,{x=0,y=0,scale=1,rotate=0,opacity=1,layer='front',className=''}={}){
  const el=A.createEffect(name,className);
  if(!el)return null;
  el.style.opacity=String(opacity);
  el.style.transform=transform(x,y,scale,rotate,1);
  scope.add(el,layer);
  return el;
}
function setHidden(el){if(el)el.style.opacity='0'}
async function popEffect(scope,name,x,y,scale=1.1,rotate=0){
  const el=effect(scope,name,{x,y,scale:scale*.55,rotate,opacity:0});
  if(!el)return;
  await scope.animate(el,[
    {opacity:0,transform:transform(x,y,scale*.45,rotate)},
    {opacity:1,offset:.36,transform:transform(x,y,scale*1.2,rotate)},
    {opacity:.92,offset:.64,transform:transform(x,y,scale,rotate)},
    {opacity:0,transform:transform(x,y,scale*1.08,rotate)},
  ],{duration:360,easing:'cubic-bezier(.18,.86,.2,1)',fill:'forwards'});
}
async function reducedEvent(scope,id,context={}){
  const r=rect(),s=scaleForStage()*.85;
  const map={
    POMPON_PEEK:['pompon_peek',r.width*.12,r.height*.62],
    POMPON_DASH_BY:['pompon_dash',r.width*.25,r.height*.68],
    CHIRU_WATCH:['chiru_watch',r.width*.82,r.height*.63],
    CHIRU_EXASPERATED:['chiru_exasperated',r.width*.78,r.height*.68],
    POMPON_BRAKE_FAIL:['pompon_brake',r.width*.28,r.height*.68],
    DUO_CHASE_CRASH:['duo_runaway_crash',r.width*.5,r.height*.62],
    PEEK_DISCOVERY:['duo_surprised',r.width*.5,r.height*.62],
    BALL_RIDE_FAIL:['pompon_ballride',r.width*.5,r.height*.62],
    CALL_DELIVERY:['chiru_retort',clamp((context.localX||r.width*.5)+r.width*.18,150,r.width-150),clamp(context.localY||r.height*.55,150,r.height-150)],
  };
  const [name,x,y]=map[id]||map.POMPON_PEEK;
  const el=pose(scope,name,{x,y,scale:s,opacity:0});
  await scope.animate(el,[
    {opacity:0,transform:transform(x,y+10,s*.96)},
    {opacity:1,offset:.28,transform:transform(x,y,s)},
    {opacity:1,offset:.72,transform:transform(x,y,s)},
    {opacity:0,transform:transform(x,y-6,s*.98)},
  ],{duration:520,easing:'ease-out',fill:'forwards'});
}

async function pomponPeek(scope){
  const r=rect(),s=scaleForStage();
  const p=pose(scope,'pompon_peek',{x:-22,y:r.height*.64,scale:s*.95,opacity:0});
  await scope.animate(p,[
    {opacity:0,transform:transform(-60,r.height*.64,s*.92)},
    {opacity:1,offset:.34,transform:transform(42,r.height*.64,s*.98)},
    {opacity:1,offset:.72,transform:transform(48,r.height*.64,s*.98,2)},
    {opacity:0,transform:transform(-70,r.height*.64,s*.92,-4)},
  ],{duration:820,easing:'cubic-bezier(.18,.8,.2,1)',fill:'forwards'});
}
async function pomponDashBy(scope){
  const r=rect(),s=scaleForStage();
  const y=r.height*.69;
  const trail=effect(scope,'speed_trail',{x:r.width*.18,y:y+18,scale:s*1.3,opacity:0,layer:'back'});
  const p=pose(scope,'pompon_dash',{x:-190,y,scale:s*1.08,opacity:0});
  const jobs=[
    scope.animate(p,[
      {opacity:0,transform:transform(-190,y,s*.95,-3)},
      {opacity:1,offset:.12,transform:transform(-55,y,s*1.08,-1)},
      {opacity:1,offset:.82,transform:transform(r.width+40,y-20,s*1.08,2)},
      {opacity:0,transform:transform(r.width+220,y-35,s*.96,4)},
    ],{duration:520,easing:'cubic-bezier(.12,.82,.18,1)',fill:'forwards'}),
  ];
  if(trail)jobs.push(scope.animate(trail,[
    {opacity:0,transform:transform(r.width*.12,y+12,s*.7)},
    {opacity:.88,offset:.35,transform:transform(r.width*.35,y+12,s*1.2)},
    {opacity:0,transform:transform(r.width*.7,y,s*1.5)},
  ],{duration:500,easing:'ease-out',fill:'forwards'}));
  await Promise.all(jobs);
}
async function chiruWatch(scope){
  const r=rect(),s=scaleForStage();
  const c=pose(scope,'chiru_watch',{x:r.width+50,y:r.height*.64,scale:s*.92,flip:-1,opacity:0});
  await scope.animate(c,[
    {opacity:0,transform:transform(r.width+80,r.height*.64,s*.85,0,-1)},
    {opacity:1,offset:.28,transform:transform(r.width-48,r.height*.64,s*.92,0,-1)},
    {opacity:1,offset:.72,transform:transform(r.width-52,r.height*.64,s*.92,-3,-1)},
    {opacity:0,transform:transform(r.width+90,r.height*.64,s*.85,0,-1)},
  ],{duration:900,easing:'cubic-bezier(.2,.75,.2,1)',fill:'forwards'});
}
async function chiruExasperated(scope){
  const r=rect(),s=scaleForStage();
  const x=r.width*.76,y=r.height+30;
  const c=pose(scope,'chiru_exasperated',{x,y,scale:s*.9,opacity:0});
  const sweat=effect(scope,'sweat',{x:x+100,y:r.height*.62,scale:s*.58,opacity:0});
  const jobs=[scope.animate(c,[
    {opacity:0,transform:transform(x,y+80,s*.82)},
    {opacity:1,offset:.28,transform:transform(x,r.height*.73,s*.9)},
    {opacity:1,offset:.76,transform:transform(x,r.height*.73,s*.9,-2)},
    {opacity:0,transform:transform(x,r.height+80,s*.84)},
  ],{duration:880,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards'})];
  if(sweat)jobs.push(scope.animate(sweat,[
    {opacity:0,transform:transform(x+98,r.height*.61,s*.3)},
    {opacity:1,offset:.35,transform:transform(x+98,r.height*.61,s*.56)},
    {opacity:0,transform:transform(x+110,r.height*.66,s*.52)},
  ],{duration:520,delay:180,easing:'ease-out',fill:'forwards'}));
  await Promise.all(jobs);
}
async function brakeFail(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.68,stopX=r.width*.46;
  const dash=pose(scope,'pompon_dash',{x:-180,y,scale:s*1.08,opacity:0});
  const trail=effect(scope,'speed_trail',{x:r.width*.15,y:y+28,scale:s,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(dash,[
      {opacity:0,transform:transform(-180,y,s*.95,-3)},
      {opacity:1,offset:.12,transform:transform(-40,y,s*1.08,-1)},
      {opacity:1,transform:transform(stopX,y,s*1.08,1)},
    ],{duration:300,easing:'cubic-bezier(.1,.82,.18,1)',fill:'forwards'}),
    trail?scope.animate(trail,[
      {opacity:0,transform:transform(0,y+22,s*.7)},
      {opacity:.9,offset:.28,transform:transform(r.width*.2,y+22,s*1.1)},
      {opacity:0,transform:transform(stopX-70,y+16,s*1.45)},
    ],{duration:310,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
  ]);
  setHidden(dash);
  const brake=pose(scope,'pompon_brake',{x:stopX,y,scale:s*1.08,rotate:-2});
  const dust=effect(scope,'dust_impact',{x:stopX-90,y:y+78,scale:s*.75,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(brake,[
      {transform:transform(stopX,y,s*1.08,-2)},
      {transform:transform(stopX+24,y+3,s*1.12,3),offset:.42},
      {transform:transform(stopX+9,y,s*1.08,-1)},
    ],{duration:190,easing:'cubic-bezier(.2,.85,.2,1)',fill:'forwards'}),
    dust?scope.animate(dust,[
      {opacity:0,transform:transform(stopX-110,y+72,s*.35)},
      {opacity:1,offset:.35,transform:transform(stopX-90,y+72,s*.88)},
      {opacity:0,transform:transform(stopX-65,y+58,s*1.2)},
    ],{duration:330,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
  ]);
  await scope.wait(150);
  await scope.animate(brake,[
    {opacity:1,transform:transform(stopX+9,y,s*1.08,-1)},
    {opacity:1,offset:.3,transform:transform(stopX+120,y+4,s*1.06,4)},
    {opacity:0,transform:transform(r.width+220,y-10,s*.96,12)},
  ],{duration:390,easing:'cubic-bezier(.2,.58,.18,1)',fill:'forwards'});
  void popEffect(scope,'collision_arc',r.width-18,y-10,s*.85,-18);
  await scope.wait(95);
  const wobble=pose(scope,'pompon_wobble',{x:r.width+170,y:r.height*.67,scale:s*.92,flip:-1,opacity:0});
  const c=pose(scope,'chiru_exasperated',{x:r.width*.18,y:r.height*.69,scale:s*.78,opacity:0});
  await Promise.all([
    scope.animate(wobble,[
      {opacity:0,transform:transform(r.width+170,r.height*.67,s*.86,8,-1)},
      {opacity:1,offset:.28,transform:transform(r.width*.83,r.height*.67,s*.92,-5,-1)},
      {opacity:1,offset:.74,transform:transform(r.width*.76,r.height*.67,s*.92,4,-1)},
      {opacity:0,transform:transform(r.width*.72,r.height*.7,s*.88,-2,-1)},
    ],{duration:520,easing:'cubic-bezier(.18,.72,.22,1)',fill:'forwards'}),
    scope.animate(c,[
      {opacity:0,transform:transform(r.width*.18,r.height*.75,s*.72)},
      {opacity:1,offset:.34,transform:transform(r.width*.18,r.height*.69,s*.78)},
      {opacity:1,offset:.78,transform:transform(r.width*.18,r.height*.69,s*.78,-2)},
      {opacity:0,transform:transform(r.width*.18,r.height*.73,s*.74)},
    ],{duration:520,delay:80,easing:'ease-out',fill:'forwards'}),
  ]);
}
async function chaseCrash(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.68;
  const p=pose(scope,'pompon_dash',{x:-180,y,scale:s,opacity:0});
  const c=pose(scope,'chiru_chase',{x:-330,y:y+12,scale:s*.9,opacity:0});
  const trail=effect(scope,'speed_trail',{x:r.width*.2,y:y+25,scale:s*1.25,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(p,[
      {opacity:0,transform:transform(-190,y,s*.9)},
      {opacity:1,offset:.12,transform:transform(-30,y,s)},
      {opacity:1,offset:.86,transform:transform(r.width+45,y-20,s,2)},
      {opacity:0,transform:transform(r.width+220,y-32,s*.92,5)},
    ],{duration:520,easing:'cubic-bezier(.1,.82,.16,1)',fill:'forwards'}),
    scope.animate(c,[
      {opacity:0,transform:transform(-340,y+14,s*.82)},
      {opacity:1,offset:.18,transform:transform(-130,y+14,s*.9)},
      {opacity:1,offset:.86,transform:transform(r.width-50,y-8,s*.9,2)},
      {opacity:0,transform:transform(r.width+150,y-18,s*.82,5)},
    ],{duration:560,easing:'cubic-bezier(.12,.8,.18,1)',fill:'forwards'}),
    trail?scope.animate(trail,[
      {opacity:0,transform:transform(0,y+26,s*.7)},
      {opacity:.9,offset:.35,transform:transform(r.width*.35,y+20,s*1.1)},
      {opacity:0,transform:transform(r.width*.75,y+8,s*1.45)},
    ],{duration:520,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
  ]);
  await scope.wait(100);
  const duo=pose(scope,'duo_runaway_crash',{x:r.width*.52,y:r.height*.61,scale:s*.55,rotate:-7,opacity:0});
  const arc=effect(scope,'collision_arc',{x:r.width*.52,y:r.height*.55,scale:s*.5,opacity:0});
  const boom=effect(scope,'exclamation',{x:r.width*.64,y:r.height*.43,scale:s*.45,opacity:0});
  const shell=document.querySelector('.queue-shell');
  const jobs=[
    scope.animate(duo,[
      {opacity:0,transform:transform(r.width*.52,r.height*.61,s*.48,-12)},
      {opacity:1,offset:.28,transform:transform(r.width*.52,r.height*.61,s*1.18,5)},
      {opacity:1,offset:.62,transform:transform(r.width*.52,r.height*.61,s,-2)},
      {opacity:0,transform:transform(r.width*.55,r.height*.58,s*.92,5)},
    ],{duration:520,easing:'cubic-bezier(.16,.9,.18,1)',fill:'forwards'}),
  ];
  if(arc)jobs.push(scope.animate(arc,[
    {opacity:0,transform:transform(r.width*.52,r.height*.55,s*.35)},
    {opacity:1,offset:.32,transform:transform(r.width*.52,r.height*.55,s*1.05)},
    {opacity:0,transform:transform(r.width*.52,r.height*.55,s*1.45)},
  ],{duration:430,easing:'ease-out',fill:'forwards'}));
  if(boom)jobs.push(scope.animate(boom,[
    {opacity:0,transform:transform(r.width*.64,r.height*.43,s*.3,-8)},
    {opacity:1,offset:.36,transform:transform(r.width*.64,r.height*.43,s*.72,5)},
    {opacity:0,transform:transform(r.width*.64,r.height*.4,s*.82,2)},
  ],{duration:420,easing:'ease-out',fill:'forwards'}));
  if(shell&&!M.isReduced())jobs.push(scope.animate(shell,[
    {transform:'translate3d(0,0,0)'},
    {transform:'translate3d(-5px,2px,0)'},
    {transform:'translate3d(5px,-2px,0)'},
    {transform:'translate3d(-3px,1px,0)'},
    {transform:'translate3d(0,0,0)'},
  ],{duration:150,easing:'linear'}));
  await Promise.all(jobs);
}
async function peekDiscovery(scope){
  const r=rect(),s=scaleForStage();
  const p=pose(scope,'pompon_peek',{x:-55,y:r.height*.63,scale:s*.9,opacity:0});
  await scope.animate(p,[
    {opacity:0,transform:transform(-70,r.height*.63,s*.82)},
    {opacity:1,transform:transform(42,r.height*.63,s*.9)},
  ],{duration:260,easing:'ease-out',fill:'forwards'});
  await scope.wait(135);
  const c=pose(scope,'chiru_watch',{x:r.width+55,y:r.height*.64,scale:s*.84,flip:-1,opacity:0});
  await scope.animate(c,[
    {opacity:0,transform:transform(r.width+65,r.height*.64,s*.78,0,-1)},
    {opacity:1,transform:transform(r.width-48,r.height*.64,s*.84,0,-1)},
  ],{duration:260,easing:'ease-out',fill:'forwards'});
  await scope.wait(130);
  void popEffect(scope,'exclamation',r.width*.3,r.height*.45,s*.6,-6);
  await scope.wait(95);
  setHidden(p);setHidden(c);
  const duo=pose(scope,'duo_surprised',{x:r.width*.5,y:r.height*.6,scale:s*.58,opacity:0});
  await scope.animate(duo,[
    {opacity:0,transform:transform(r.width*.5,r.height*.62,s*.48)},
    {opacity:1,offset:.3,transform:transform(r.width*.5,r.height*.57,s*1.05,-2)},
    {opacity:1,offset:.62,transform:transform(r.width*.5,r.height*.6,s*.92,1)},
    {opacity:0,transform:transform(r.width+160,r.height*.58,s*.82,5)},
  ],{duration:520,easing:'cubic-bezier(.17,.86,.22,1)',fill:'forwards'});
}
async function ballRideFail(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.66;
  const ball=document.createElement('div');
  ball.className='pc-giant-ball';
  scope.add(ball,'back');
  const rider=pose(scope,'pompon_ballride',{x:-170,y:y-42,scale:s*.84,opacity:0});
  const start=-190,mid=r.width*.48;
  await Promise.all([
    scope.animate(ball,[
      {opacity:0,transform:'translate3d('+(start-120)+'px,'+(y-120)+'px,0) rotate(-30deg) scale(.7)'},
      {opacity:1,offset:.15,transform:'translate3d(-80px,'+(y-120)+'px,0) rotate(10deg) scale(.92)'},
      {opacity:1,transform:'translate3d('+(mid-120)+'px,'+(y-120)+'px,0) rotate(220deg) scale(1)'},
    ],{duration:520,easing:'cubic-bezier(.12,.76,.18,1)',fill:'forwards'}),
    scope.animate(rider,[
      {opacity:0,transform:transform(start,y-42,s*.75,-7)},
      {opacity:1,offset:.16,transform:transform(-5,y-42,s*.84,-2)},
      {opacity:1,transform:transform(mid+5,y-42,s*.84,3)},
    ],{duration:520,easing:'cubic-bezier(.12,.76,.18,1)',fill:'forwards'}),
  ]);
  void popEffect(scope,'sparkle',mid+90,y-145,s*.62,8);
  await scope.wait(150);
  await Promise.all([
    scope.animate(ball,[
      {opacity:1,transform:'translate3d('+(mid-120)+'px,'+(y-120)+'px,0) rotate(220deg) scale(1)'},
      {opacity:1,offset:.55,transform:'translate3d('+(r.width*.82-120)+'px,'+(y-135)+'px,0) rotate(430deg) scale(1.04)'},
      {opacity:0,transform:'translate3d('+(r.width+260)+'px,'+(y-180)+'px,0) rotate(720deg) scale(.92)'},
    ],{duration:430,easing:'cubic-bezier(.2,.62,.14,1)',fill:'forwards'}),
    scope.animate(rider,[
      {opacity:1,transform:transform(mid+5,y-42,s*.84,3)},
      {opacity:.8,offset:.55,transform:transform(r.width*.82,y-70,s*.82,10)},
      {opacity:0,transform:transform(r.width+140,y-170,s*.7,24)},
    ],{duration:430,easing:'cubic-bezier(.2,.62,.14,1)',fill:'forwards'}),
  ]);
  const fly=pose(scope,'pompon_fly',{x:r.width*.72,y:r.height*.55,scale:s*.78,rotate:-8,opacity:0});
  const shock=pose(scope,'chiru_shocked',{x:r.width*.22,y:r.height*.67,scale:s*.72,opacity:0});
  await Promise.all([
    scope.animate(fly,[
      {opacity:0,transform:transform(r.width*.74,r.height*.62,s*.65,-10)},
      {opacity:1,offset:.22,transform:transform(r.width*.65,r.height*.5,s*.8,-18)},
      {opacity:0,transform:transform(r.width*.42,-150,s*.72,-35)},
    ],{duration:430,easing:'cubic-bezier(.18,.72,.16,1)',fill:'forwards'}),
    scope.animate(shock,[
      {opacity:0,transform:transform(r.width*.22,r.height*.73,s*.64)},
      {opacity:1,offset:.3,transform:transform(r.width*.22,r.height*.67,s*.75,-2)},
      {opacity:1,offset:.72,transform:transform(r.width*.22,r.height*.67,s*.72,2)},
      {opacity:0,transform:transform(r.width*.22,r.height*.72,s*.66)},
    ],{duration:520,easing:'ease-out',fill:'forwards'}),
    popEffect(scope,'exclamation',r.width*.27,r.height*.42,s*.55,4),
  ]);
  const duo=pose(scope,'duo_fly',{x:r.width*.52,y:r.height*.46,scale:s*.65,opacity:0});
  await scope.animate(duo,[
    {opacity:0,transform:transform(r.width*.55,r.height*.54,s*.45,-12)},
    {opacity:1,offset:.3,transform:transform(r.width*.5,r.height*.42,s*.72,-18)},
    {opacity:0,transform:transform(r.width*.28,-160,s*.55,-32)},
  ],{duration:360,easing:'cubic-bezier(.2,.7,.18,1)',fill:'forwards'});
}
async function callDelivery(scope,context={}){
  const r=rect(),s=scaleForStage();
  const targetX=clamp(Number(context.localX)||r.width*.5,150,r.width-150);
  const targetY=clamp(Number(context.localY)||r.height*.55,150,r.height-150);
  if(M.isReduced())return reducedEvent(scope,'CALL_DELIVERY',{localX:targetX,localY:targetY});
  const p=pose(scope,'pompon_dash',{x:-180,y:targetY+15,scale:s*.92,opacity:0});
  const trail=effect(scope,'speed_trail',{x:targetX*.45,y:targetY+30,scale:s,opacity:0,layer:'back'});
  await Promise.all([
    scope.animate(p,[
      {opacity:0,transform:transform(-180,targetY+15,s*.82,-3)},
      {opacity:1,offset:.15,transform:transform(-20,targetY+15,s*.92,-1)},
      {opacity:1,transform:transform(targetX-145,targetY+8,s*.95,2)},
    ],{duration:330,easing:'cubic-bezier(.08,.82,.18,1)',fill:'forwards'}),
    trail?scope.animate(trail,[
      {opacity:0,transform:transform(0,targetY+30,s*.55)},
      {opacity:.85,offset:.35,transform:transform(targetX*.45,targetY+28,s*.95)},
      {opacity:0,transform:transform(targetX-150,targetY+20,s*1.25)},
    ],{duration:320,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
  ]);
  setHidden(p);
  const arc=popEffect(scope,'collision_arc',targetX-35,targetY,s*.72,-6);
  const stars=popEffect(scope,'stars',targetX+20,targetY-55,s*.58,5);
  await Promise.all([arc,stars]);
  const retortX=targetX<r.width*.55?clamp(targetX+210,180,r.width-140):clamp(targetX-210,140,r.width-180);
  const flip=retortX>targetX?-1:1;
  const c=pose(scope,'chiru_retort',{x:retortX,y:targetY+70,scale:s*.7,flip,opacity:0});
  await scope.animate(c,[
    {opacity:0,transform:transform(retortX,targetY+90,s*.62,0,flip)},
    {opacity:1,offset:.28,transform:transform(retortX,targetY+70,s*.72,-2,flip)},
    {opacity:1,offset:.72,transform:transform(retortX,targetY+70,s*.72,2,flip)},
    {opacity:0,transform:transform(retortX,targetY+84,s*.65,0,flip)},
  ],{duration:460,easing:'ease-out',fill:'forwards'});
}

const PLAYERS=Object.freeze({
  POMPON_PEEK:pomponPeek,
  POMPON_DASH_BY:pomponDashBy,
  CHIRU_WATCH:chiruWatch,
  CHIRU_EXASPERATED:chiruExasperated,
  POMPON_BRAKE_FAIL:brakeFail,
  DUO_CHASE_CRASH:chaseCrash,
  PEEK_DISCOVERY:peekDiscovery,
  BALL_RIDE_FAIL:ballRideFail,
  CALL_DELIVERY:callDelivery,
});

async function play(id,context={}){
  const key=String(id||'');
  const fn=PLAYERS[key];
  if(!fn||running)return{played:false,reason:fn?'busy':'unknown-event'};
  const scope=M.createScope('character:'+key);
  currentScope=scope;currentId=key;running=true;
  diagnostics.played+=1;
  if(key==='CALL_DELIVERY')diagnostics.callPlayed+=1;
  diagnostics.lastEvent={id:key,at:Date.now()};
  diagnostics.history.push({...diagnostics.lastEvent});
  diagnostics.history=diagnostics.history.slice(-40);
  try{
    await A.preloadAll();
    if(scope.signal.aborted)return{played:false,reason:'aborted'};
    if(M.isReduced()&&key!=='CALL_DELIVERY')await reducedEvent(scope,key,context);
    else await fn(scope,context);
    return{played:true,id:key};
  }catch(e){
    return{played:false,id:key,reason:scope.signal.aborted?'aborted':'error'};
  }finally{
    scope.cleanup();
    if(currentScope===scope){currentScope=null;currentId='';running=false}
    diagnostics.cleanupRuns+=1;
  }
}
function cancel(reason='manual'){
  if(!currentScope)return false;
  diagnostics.canceled+=1;
  const scope=currentScope;
  currentScope=null;currentId='';running=false;
  scope.abort(reason);
  return true;
}
function randomEvent(category,recent=[]){
  const blocked=new Set(Array.isArray(recent)?recent:[]);
  let options=EVENTS.filter(x=>x.category===category&&!blocked.has(x.id));
  if(!options.length)options=EVENTS.filter(x=>x.category===category);
  return options[Math.floor(Math.random()*options.length)]||null;
}
async function playRandom(category,{grid=null,recent=[]}={}){
  const e=randomEvent(category,recent);
  if(!e)return{played:false,reason:'no-event'};
  return play(e.id,{grid});
}
function boardLocalPoint(viewportRect){
  const b=rect();
  if(!viewportRect)return{x:b.width*.5,y:b.height*.55};
  return{x:viewportRect.left-b.left+viewportRect.width*.5,y:viewportRect.top-b.top+viewportRect.height*.5};
}
async function playCallDelivery({number='',rect:targetRect=null}={}){
  if(running&&currentId==='CALL_DELIVERY')return{played:false,reason:'rapid-call'};
  cancel('real-call');
  const p=boardLocalPoint(targetRect);
  return play('CALL_DELIVERY',{number,localX:p.x,localY:p.y});
}
function getDiagnostics(){
  return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,reduced:M.isReduced(),assets:A.diagnostics()};
}
function resetForTest(){
  cancel('test-reset');
  diagnostics.played=0;diagnostics.canceled=0;diagnostics.cleanupRuns=0;diagnostics.callPlayed=0;diagnostics.lastEvent=null;diagnostics.history=[];
}

window.ASOBOON_BOARD_CHARACTER_EVENTS=Object.freeze({
  version:'1.0.0',events:EVENTS,
  play,playRandom,playCallDelivery,cancel,isRunning:()=>running,
  getDiagnostics,resetForTest,
  playEventForTest:async id=>play(id,{grid:document.getElementById('queueGrid')}),
});
})();