(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!M||!A)return;

const IDLE_PACE=1.45;
const CALL_PACE=1.00;
const EVENTS=Object.freeze([
  Object.freeze({id:'POMPON_PEEK',category:'POMPON_CAMEO',story:'POMPONが端から様子をうかがう'}),
  Object.freeze({id:'POMPON_SPARKLE_SMUG',category:'POMPON_CAMEO',story:'キラッを自分の手柄だと思ってどや顔'}),
  Object.freeze({id:'CHIRU_PEEK',category:'CHIRU_CAMEO',story:'CHIRUが端から様子をうかがう'}),
  Object.freeze({id:'CHIRU_SNEAK',category:'CHIRU_CAMEO',story:'CHIRUが静かにこっそり横切る'}),
  Object.freeze({id:'POMPON_BRAKE_FAIL',category:'POMPON_STORY',story:'暴走→ブレーキ→止まれない→画面外衝突→ヨロヨロ→CHIRU呆れ'}),
  Object.freeze({id:'DUO_CHASE_CATCH',category:'DUO_STORY',story:'逃走→追跡→捕まえる→勢い余って事故→2体でもつれる'}),
  Object.freeze({id:'PEEK_DISCOVERY',category:'DUO_STORY',story:'両側から覗く→目が合う→びっくり→追いかけっこ'}),
  Object.freeze({id:'BALL_RIDE_FAIL',category:'RARE_STORY',story:'ボール成功→調子に乗る→飛ぶ→CHIRU回避→POMPONだけ画面外事故'}),
]);

let currentScope=null,running=false,currentId='';
const diagnostics={played:0,canceled:0,cleanupRuns:0,callPlayed:0,ambientPlayed:0,statusAccents:0,lastEvent:null,history:[]};

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function tm(ms,mode='idle'){return Math.round(Number(ms||0)*(mode==='call'?CALL_PACE:IDLE_PACE))}
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
  const el=A.createCharacter(name,className);if(!el)return null;
  el.style.opacity=String(opacity);el.style.transform=transform(x,y,scale,rotate,flip);
  return scope.add(el,layer);
}
function fx(scope,name,semantic,{x=0,y=0,scale=1,rotate=0,opacity=1,layer='front',className=''}={}){
  if(semantic&&!A.validatePairing(name,semantic))return null;
  const el=A.createEffect(name,className);if(!el)return null;
  el.style.opacity=String(opacity);el.style.transform=transform(x,y,scale,rotate,1);
  return scope.add(el,layer);
}
function hide(el){if(el)el.style.opacity='0'}
function anim(scope,el,keyframes,options={},mode='idle'){
  if(!el)return Promise.resolve();
  const opts={...options};
  if(Number.isFinite(Number(opts.duration)))opts.duration=tm(opts.duration,mode);
  if(Number.isFinite(Number(opts.delay)))opts.delay=tm(opts.delay,mode);
  return scope.animate(el,keyframes,opts);
}
function wait(scope,ms,mode='idle'){return scope.wait(tm(ms,mode))}
async function popFx(scope,name,semantic,x,y,scale=1,rotate=0,mode='idle'){
  const el=fx(scope,name,semantic,{x,y,scale:scale*.5,rotate,opacity:0});
  if(!el)return;
  await anim(scope,el,[
    {opacity:0,transform:transform(x,y,scale*.42,rotate)},
    {opacity:1,offset:.34,transform:transform(x,y,scale*1.15,rotate)},
    {opacity:.95,offset:.66,transform:transform(x,y,scale,rotate)},
    {opacity:0,transform:transform(x,y,scale*1.08,rotate)},
  ],{duration:360,easing:'cubic-bezier(.18,.86,.2,1)',fill:'forwards'},mode);
}
function shakeShell(scope,strength=.7,mode='idle'){
  if(M.isReduced())return Promise.resolve();
  const shell=document.querySelector('.queue-shell');if(!shell)return Promise.resolve();
  const px=Math.max(2,Math.round(6*strength));
  return anim(scope,shell,[
    {transform:'translate3d(0,0,0)'},
    {transform:'translate3d('+(-px)+'px,'+Math.round(px*.4)+'px,0)'},
    {transform:'translate3d('+px+'px,'+(-Math.round(px*.4))+'px,0)'},
    {transform:'translate3d('+(-Math.round(px*.55))+'px,1px,0)'},
    {transform:'translate3d(0,0,0)'},
  ],{duration:145,easing:'linear'},mode);
}
async function reducedEvent(scope,id,context={}){
  const r=rect(),s=scaleForStage()*.82;
  const map={
    POMPON_PEEK:['pompon_peek',r.width*.14,r.height*.64],
    POMPON_SPARKLE_SMUG:['pompon_smug',r.width*.28,r.height*.67],
    CHIRU_PEEK:['chiru_peek',r.width*.84,r.height*.64],
    CHIRU_SNEAK:['chiru_sneak',r.width*.74,r.height*.68],
    POMPON_BRAKE_FAIL:['pompon_wobble',r.width*.66,r.height*.68],
    DUO_CHASE_CATCH:['duo_entangled',r.width*.52,r.height*.65],
    PEEK_DISCOVERY:['duo_surprised',r.width*.5,r.height*.62],
    BALL_RIDE_FAIL:['pompon_ballride',r.width*.5,r.height*.64],
    CALL_DELIVERY:['chiru_retort',clamp((context.localX||r.width*.5)+r.width*.18,150,r.width-150),clamp(context.localY||r.height*.55,150,r.height-150)],
  };
  const [name,x,y]=map[id]||map.POMPON_PEEK;
  const el=pose(scope,name,{x,y,scale:s,opacity:0});
  await anim(scope,el,[
    {opacity:0,transform:transform(x,y+10,s*.96)},
    {opacity:1,offset:.28,transform:transform(x,y,s)},
    {opacity:1,offset:.72,transform:transform(x,y,s)},
    {opacity:0,transform:transform(x,y-6,s*.98)},
  ],{duration:620,easing:'ease-out',fill:'forwards'});
}

async function pomponPeek(scope){
  const r=rect(),s=scaleForStage(),x=52,y=r.height*.64;
  const p=pose(scope,'pompon_peek',{x:-60,y,scale:s*.94,opacity:0});
  await anim(scope,p,[
    {opacity:0,transform:transform(-80,y,s*.86)},
    {opacity:1,offset:.30,transform:transform(x,y,s*.94)},
    {opacity:1,offset:.72,transform:transform(x+6,y,s*.94,2)},
    {opacity:0,transform:transform(-85,y,s*.86,-3)},
  ],{duration:980,easing:'cubic-bezier(.18,.8,.2,1)',fill:'forwards'});
}
async function pomponSparkleSmug(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.28,y=r.height*.67;
  const sparkle=fx(scope,'magic_sparkle','success',{x:x+80,y:y-90,scale:s*.62,opacity:0});
  if(sparkle)await anim(scope,sparkle,[
    {opacity:0,transform:transform(x+80,y-90,s*.35)},
    {opacity:1,offset:.45,transform:transform(x+80,y-90,s*.7)},
    {opacity:.75,transform:transform(x+70,y-100,s*.62)},
  ],{duration:420,easing:'ease-out',fill:'forwards'});
  const p=pose(scope,'pompon_smug',{x,y:y+55,scale:s*.86,opacity:0});
  await anim(scope,p,[
    {opacity:0,transform:transform(x,y+70,s*.76)},
    {opacity:1,offset:.28,transform:transform(x,y,s*.9,-2)},
    {opacity:1,offset:.72,transform:transform(x,y,s*.9,2)},
    {opacity:0,transform:transform(x-18,y+18,s*.82,-2)},
  ],{duration:860,easing:'cubic-bezier(.2,.78,.2,1)',fill:'forwards'});
}
async function chiruPeek(scope){
  const r=rect(),s=scaleForStage(),x=r.width-52,y=r.height*.64;
  const c=pose(scope,'chiru_peek',{x:r.width+80,y,scale:s*.86,flip:-1,opacity:0});
  await anim(scope,c,[
    {opacity:0,transform:transform(r.width+90,y,s*.8,0,-1)},
    {opacity:1,offset:.30,transform:transform(x,y,s*.88,0,-1)},
    {opacity:1,offset:.72,transform:transform(x-5,y,s*.88,-2,-1)},
    {opacity:0,transform:transform(r.width+90,y,s*.8,0,-1)},
  ],{duration:980,easing:'cubic-bezier(.2,.76,.2,1)',fill:'forwards'});
}
async function chiruSneak(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.72;
  const c=pose(scope,'chiru_sneak',{x:r.width+150,y,scale:s*.78,flip:-1,opacity:0});
  await anim(scope,c,[
    {opacity:0,transform:transform(r.width+150,y,s*.72,0,-1)},
    {opacity:1,offset:.18,transform:transform(r.width*.88,y,s*.78,-1,-1)},
    {opacity:1,offset:.72,transform:transform(r.width*.35,y+4,s*.78,2,-1)},
    {opacity:0,transform:transform(-150,y+6,s*.72,3,-1)},
  ],{duration:1250,easing:'cubic-bezier(.22,.6,.2,1)',fill:'forwards'});
}
async function brakeFail(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.68,stopX=r.width*.44;
  const dash=pose(scope,'pompon_dash',{x:-170,y,scale:s,opacity:0});
  const speed=fx(scope,'speed_lines','movement',{x:r.width*.2,y:y+15,scale:s*1.05,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,dash,[
      {opacity:0,transform:transform(-170,y,s*.9,-3)},
      {opacity:1,offset:.15,transform:transform(-20,y,s,-1)},
      {opacity:1,transform:transform(stopX-45,y,s*1.02,1)},
    ],{duration:390,easing:'cubic-bezier(.1,.78,.18,1)',fill:'forwards'}),
    anim(scope,speed,[
      {opacity:0,transform:transform(0,y+20,s*.55)},
      {opacity:.9,offset:.35,transform:transform(r.width*.2,y+20,s)},
      {opacity:0,transform:transform(stopX-95,y+12,s*1.25)},
    ],{duration:400,easing:'ease-out',fill:'forwards'}),
  ]);
  hide(dash);
  const brake=pose(scope,'pompon_brake',{x:stopX,y,scale:s*1.02});
  const dust=fx(scope,'dust_burst','impact',{x:stopX-95,y:y+70,scale:s*.72,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,brake,[
      {transform:transform(stopX,y,s*1.02,-2)},
      {transform:transform(stopX+22,y+4,s*1.06,3),offset:.45},
      {transform:transform(stopX+8,y,s*1.02,-1)},
    ],{duration:260,easing:'cubic-bezier(.2,.85,.2,1)',fill:'forwards'}),
    anim(scope,dust,[
      {opacity:0,transform:transform(stopX-110,y+72,s*.35)},
      {opacity:1,offset:.38,transform:transform(stopX-90,y+68,s*.82)},
      {opacity:0,transform:transform(stopX-55,y+55,s*1.05)},
    ],{duration:380,easing:'ease-out',fill:'forwards'}),
  ]);
  hide(brake);
  await wait(scope,100);
  const cannot=pose(scope,'pompon_cannot_stop',{x:stopX+20,y,scale:s,opacity:1});
  const trail=fx(scope,'dust_trail','movement',{x:stopX,y:y+55,scale:s*.85,opacity:.85,layer:'back'});
  await Promise.all([
    anim(scope,cannot,[
      {opacity:1,transform:transform(stopX+20,y,s,-2)},
      {opacity:1,offset:.45,transform:transform(r.width*.76,y+4,s,7)},
      {opacity:0,transform:transform(r.width+180,y-8,s*.92,16)},
    ],{duration:520,easing:'cubic-bezier(.18,.62,.18,1)',fill:'forwards'}),
    anim(scope,trail,[
      {opacity:.7,transform:transform(stopX,y+55,s*.55)},
      {opacity:.85,offset:.55,transform:transform(r.width*.62,y+45,s*.9)},
      {opacity:0,transform:transform(r.width*.88,y+35,s*1.2)},
    ],{duration:500,easing:'ease-out',fill:'forwards'}),
  ]);
  await wait(scope,80);
  await Promise.all([
    popFx(scope,'impact_starburst','impact',r.width-22,y-12,s*.92,-6),
    popFx(scope,'dust_impact','impact',r.width-35,y+45,s*.85,0),
    shakeShell(scope,.72),
  ]);
  await wait(scope,120);
  const wobble=pose(scope,'pompon_wobble',{x:r.width+140,y:r.height*.68,scale:s*.88,flip:-1,opacity:0});
  const dizzy=fx(scope,'dizzy_spiral','aftermath',{x:r.width*.78,y:r.height*.47,scale:s*.48,opacity:0});
  const chiru=pose(scope,'chiru_exasperated',{x:r.width*.2,y:r.height*.69,scale:s*.72,opacity:0});
  await Promise.all([
    anim(scope,wobble,[
      {opacity:0,transform:transform(r.width+140,r.height*.68,s*.82,7,-1)},
      {opacity:1,offset:.28,transform:transform(r.width*.8,r.height*.68,s*.88,-4,-1)},
      {opacity:1,offset:.72,transform:transform(r.width*.73,r.height*.68,s*.88,4,-1)},
      {opacity:0,transform:transform(r.width*.68,r.height*.7,s*.82,-2,-1)},
    ],{duration:720,easing:'cubic-bezier(.18,.72,.22,1)',fill:'forwards'}),
    anim(scope,dizzy,[
      {opacity:0,transform:transform(r.width*.78,r.height*.47,s*.25)},
      {opacity:.92,offset:.35,transform:transform(r.width*.78,r.height*.47,s*.5)},
      {opacity:0,transform:transform(r.width*.8,r.height*.44,s*.58,20)},
    ],{duration:620,easing:'ease-out',fill:'forwards'}),
    anim(scope,chiru,[
      {opacity:0,transform:transform(r.width*.2,r.height*.75,s*.65)},
      {opacity:1,offset:.35,transform:transform(r.width*.2,r.height*.69,s*.72)},
      {opacity:1,offset:.78,transform:transform(r.width*.2,r.height*.69,s*.72,-2)},
      {opacity:0,transform:transform(r.width*.2,r.height*.74,s*.66)},
    ],{duration:720,delay:120,easing:'ease-out',fill:'forwards'}),
  ]);
}
async function chaseCatch(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.69;
  const p=pose(scope,'pompon_dash',{x:-160,y,scale:s*.95,opacity:0});
  const c=pose(scope,'chiru_chase',{x:-330,y:y+10,scale:s*.82,opacity:0});
  const speed=fx(scope,'speed_lines','movement',{x:r.width*.2,y:y+22,scale:s,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,p,[
      {opacity:0,transform:transform(-160,y,s*.86)},
      {opacity:1,offset:.14,transform:transform(-20,y,s*.95)},
      {opacity:1,transform:transform(r.width+100,y-14,s*.95,3)},
    ],{duration:590,easing:'cubic-bezier(.1,.76,.16,1)',fill:'forwards'}),
    anim(scope,c,[
      {opacity:0,transform:transform(-320,y+12,s*.76)},
      {opacity:1,offset:.2,transform:transform(-120,y+12,s*.82)},
      {opacity:1,transform:transform(r.width-10,y-5,s*.82,3)},
    ],{duration:650,easing:'cubic-bezier(.12,.74,.18,1)',fill:'forwards'}),
    anim(scope,speed,[
      {opacity:0,transform:transform(0,y+25,s*.5)},
      {opacity:.85,offset:.35,transform:transform(r.width*.35,y+18,s*.95)},
      {opacity:0,transform:transform(r.width*.75,y+8,s*1.25)},
    ],{duration:610,easing:'ease-out',fill:'forwards'}),
  ]);
  hide(p);hide(c);
  const chase=pose(scope,'duo_chase',{x:r.width*.46,y:r.height*.64,scale:s*.86,opacity:0});
  await anim(scope,chase,[
    {opacity:0,transform:transform(r.width*.2,r.height*.64,s*.76,-2)},
    {opacity:1,offset:.2,transform:transform(r.width*.42,r.height*.64,s*.86,0)},
    {opacity:1,transform:transform(r.width*.72,r.height*.62,s*.86,3)},
  ],{duration:520,easing:'cubic-bezier(.15,.7,.18,1)',fill:'forwards'});
  hide(chase);
  const catchPose=pose(scope,'duo_runaway_crash',{x:r.width*.68,y:r.height*.63,scale:s*.82,opacity:0});
  const dust=fx(scope,'dust_trail','movement',{x:r.width*.58,y:r.height*.7,scale:s*.75,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,catchPose,[
      {opacity:0,transform:transform(r.width*.58,r.height*.63,s*.72,-4)},
      {opacity:1,offset:.28,transform:transform(r.width*.7,r.height*.63,s*.84,3)},
      {opacity:0,transform:transform(r.width+160,r.height*.6,s*.76,10)},
    ],{duration:500,easing:'cubic-bezier(.16,.68,.18,1)',fill:'forwards'}),
    anim(scope,dust,[
      {opacity:0,transform:transform(r.width*.55,r.height*.71,s*.4)},
      {opacity:.8,offset:.4,transform:transform(r.width*.72,r.height*.69,s*.78)},
      {opacity:0,transform:transform(r.width*.9,r.height*.65,s)},
    ],{duration:480,easing:'ease-out',fill:'forwards'}),
  ]);
  await wait(scope,70);
  await Promise.all([
    popFx(scope,'impact_burst','impact',r.width-15,r.height*.6,s*.85),
    popFx(scope,'dust_impact','impact',r.width-22,r.height*.7,s*.8),
    shakeShell(scope,.75),
  ]);
  await wait(scope,120);
  const tangled=pose(scope,'duo_entangled',{x:r.width*.55,y:r.height*.63,scale:s*.92,opacity:0});
  const dizzy=fx(scope,'dizzy_stars','aftermath',{x:r.width*.58,y:r.height*.42,scale:s*.52,opacity:0});
  await Promise.all([
    anim(scope,tangled,[
      {opacity:0,transform:transform(r.width*.58,r.height*.58,s*.72,8)},
      {opacity:1,offset:.28,transform:transform(r.width*.55,r.height*.63,s*.95,-3)},
      {opacity:1,offset:.78,transform:transform(r.width*.55,r.height*.63,s*.92,2)},
      {opacity:0,transform:transform(r.width*.55,r.height*.66,s*.84,0)},
    ],{duration:780,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards'}),
    anim(scope,dizzy,[
      {opacity:0,transform:transform(r.width*.58,r.height*.42,s*.3)},
      {opacity:.95,offset:.35,transform:transform(r.width*.58,r.height*.42,s*.54)},
      {opacity:0,transform:transform(r.width*.6,r.height*.4,s*.62,20)},
    ],{duration:650,easing:'ease-out',fill:'forwards'}),
  ]);
}
async function peekDiscovery(scope){
  const r=rect(),s=scaleForStage();
  const p=pose(scope,'pompon_peek',{x:-65,y:r.height*.63,scale:s*.86,opacity:0});
  await anim(scope,p,[
    {opacity:0,transform:transform(-75,r.height*.63,s*.78)},
    {opacity:1,transform:transform(48,r.height*.63,s*.86)},
  ],{duration:340,easing:'ease-out',fill:'forwards'});
  await wait(scope,180);
  const c=pose(scope,'chiru_peek',{x:r.width+70,y:r.height*.64,scale:s*.8,flip:-1,opacity:0});
  await anim(scope,c,[
    {opacity:0,transform:transform(r.width+80,r.height*.64,s*.72,0,-1)},
    {opacity:1,transform:transform(r.width-50,r.height*.64,s*.8,0,-1)},
  ],{duration:340,easing:'ease-out',fill:'forwards'});
  await wait(scope,220);
  hide(p);hide(c);
  const duo=pose(scope,'duo_surprised',{x:r.width*.5,y:r.height*.61,scale:s*.62,opacity:0});
  await Promise.all([
    anim(scope,duo,[
      {opacity:0,transform:transform(r.width*.5,r.height*.64,s*.5)},
      {opacity:1,offset:.3,transform:transform(r.width*.5,r.height*.58,s*.98,-2)},
      {opacity:1,offset:.72,transform:transform(r.width*.5,r.height*.61,s*.86,1)},
      {opacity:0,transform:transform(r.width*.5,r.height*.62,s*.78)},
    ],{duration:560,easing:'cubic-bezier(.17,.86,.22,1)',fill:'forwards'}),
    popFx(scope,'exclamation','alert',r.width*.58,r.height*.4,s*.55,-4),
  ]);
  const chase=pose(scope,'duo_chase',{x:r.width*.35,y:r.height*.66,scale:s*.8,opacity:0});
  const slash=fx(scope,'speed_slash','movement',{x:r.width*.45,y:r.height*.66,scale:s*.76,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,chase,[
      {opacity:0,transform:transform(r.width*.25,r.height*.66,s*.72)},
      {opacity:1,offset:.2,transform:transform(r.width*.38,r.height*.66,s*.8)},
      {opacity:0,transform:transform(r.width+170,r.height*.61,s*.74,5)},
    ],{duration:560,easing:'cubic-bezier(.12,.76,.16,1)',fill:'forwards'}),
    anim(scope,slash,[
      {opacity:0,transform:transform(r.width*.28,r.height*.68,s*.45)},
      {opacity:.9,offset:.38,transform:transform(r.width*.5,r.height*.65,s*.78)},
      {opacity:0,transform:transform(r.width*.82,r.height*.62,s)},
    ],{duration:530,easing:'ease-out',fill:'forwards'}),
  ]);
}
async function ballRideFail(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.66;
  const rider=pose(scope,'pompon_ballride',{x:-130,y,scale:s*.82,opacity:0});
  await anim(scope,rider,[
    {opacity:0,transform:transform(-130,y,s*.72,-5)},
    {opacity:1,offset:.18,transform:transform(r.width*.18,y,s*.82,-1)},
    {opacity:1,transform:transform(r.width*.52,y-8,s*.86,3)},
  ],{duration:720,easing:'cubic-bezier(.14,.68,.2,1)',fill:'forwards'});
  await Promise.all([
    popFx(scope,'sparkle_gold','success',r.width*.58,y-120,s*.58,5),
    popFx(scope,'magic_sparkle','success',r.width*.47,y-95,s*.44,-5),
  ]);
  await wait(scope,180);
  hide(rider);
  const fly=pose(scope,'pompon_fly',{x:r.width*.58,y:r.height*.55,scale:s*.78,opacity:0});
  const slash=fx(scope,'speed_slash','movement',{x:r.width*.62,y:r.height*.57,scale:s*.75,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,fly,[
      {opacity:0,transform:transform(r.width*.58,y,s*.68,-5)},
      {opacity:1,offset:.22,transform:transform(r.width*.68,r.height*.48,s*.8,-16)},
      {opacity:1,transform:transform(r.width*.78,r.height*.52,s*.76,-22)},
    ],{duration:420,easing:'cubic-bezier(.16,.66,.18,1)',fill:'forwards'}),
    anim(scope,slash,[
      {opacity:0,transform:transform(r.width*.55,r.height*.6,s*.4)},
      {opacity:.9,offset:.35,transform:transform(r.width*.7,r.height*.52,s*.76,-12)},
      {opacity:0,transform:transform(r.width*.82,r.height*.46,s)},
    ],{duration:410,easing:'ease-out',fill:'forwards'}),
  ]);
  hide(fly);
  const dodge=pose(scope,'chiru_dodge',{x:r.width*.78,y:r.height*.68,scale:s*.72,opacity:0});
  const arc=fx(scope,'jump_arc','dodge',{x:r.width*.77,y:r.height*.56,scale:s*.52,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,dodge,[
      {opacity:0,transform:transform(r.width*.78,r.height*.72,s*.62)},
      {opacity:1,offset:.26,transform:transform(r.width*.72,r.height*.62,s*.74,-5)},
      {opacity:0,transform:transform(r.width*.66,r.height*.68,s*.68,-2)},
    ],{duration:430,easing:'cubic-bezier(.18,.8,.2,1)',fill:'forwards'}),
    anim(scope,arc,[
      {opacity:0,transform:transform(r.width*.76,r.height*.58,s*.32)},
      {opacity:.9,offset:.35,transform:transform(r.width*.72,r.height*.53,s*.54,-8)},
      {opacity:0,transform:transform(r.width*.65,r.height*.58,s*.62,-15)},
    ],{duration:420,easing:'ease-out',fill:'forwards'}),
  ]);
  const duo=pose(scope,'duo_dodge',{x:r.width*.72,y:r.height*.62,scale:s*.82,opacity:0});
  await anim(scope,duo,[
    {opacity:0,transform:transform(r.width*.72,r.height*.62,s*.72,-4)},
    {opacity:1,offset:.3,transform:transform(r.width*.69,r.height*.6,s*.86,-8)},
    {opacity:0,transform:transform(r.width+150,r.height*.42,s*.7,-20)},
  ],{duration:460,easing:'cubic-bezier(.16,.7,.18,1)',fill:'forwards'});
  await wait(scope,80);
  await Promise.all([
    popFx(scope,'impact_starburst','impact',r.width-15,r.height*.42,s*.82,-6),
    popFx(scope,'dust_impact','impact',r.width-10,r.height*.54,s*.76),
    shakeShell(scope,.55),
  ]);
}
async function ambient(scope,id){
  const r=rect(),s=scaleForStage();
  if(id==='AMBIENT_MAGIC_STAR'){
    const e=fx(scope,'magic_star','ambient',{x:-70,y:r.height*.25,scale:s*.48,opacity:0});
    await anim(scope,e,[
      {opacity:0,transform:transform(-80,r.height*.25,s*.36,-8)},
      {opacity:.95,offset:.22,transform:transform(r.width*.2,r.height*.22,s*.5,4)},
      {opacity:.8,offset:.72,transform:transform(r.width*.72,r.height*.27,s*.48,-3)},
      {opacity:0,transform:transform(r.width+90,r.height*.23,s*.4,6)},
    ],{duration:1000,easing:'cubic-bezier(.2,.6,.2,1)',fill:'forwards'});
  }else if(id==='AMBIENT_SPEED_PASS'){
    const e=fx(scope,'speed_lines','ambient',{x:-20,y:r.height*.76,scale:s*.72,opacity:0,layer:'back'});
    await anim(scope,e,[
      {opacity:0,transform:transform(-60,r.height*.76,s*.45)},
      {opacity:.85,offset:.3,transform:transform(r.width*.3,r.height*.75,s*.75)},
      {opacity:0,transform:transform(r.width+80,r.height*.72,s*.95)},
    ],{duration:760,easing:'cubic-bezier(.12,.72,.18,1)',fill:'forwards'});
  }else{
    const target=id==='AMBIENT_CARD_GLINT'?document.querySelector('.queue-card'):null;
    const tr=target?.getBoundingClientRect?.();
    const b=rect();
    const x=tr?tr.left-b.left+tr.width*.78:r.width*.72;
    const y=tr?tr.top-b.top+tr.height*.25:r.height*.35;
    const name=id==='AMBIENT_CARD_GLINT'?'sparkle_gold':'magic_sparkle';
    const e=fx(scope,name,id==='AMBIENT_CARD_GLINT'?'success':'ambient',{x,y,scale:s*.5,opacity:0});
    await anim(scope,e,[
      {opacity:0,transform:transform(x,y,s*.28)},
      {opacity:1,offset:.36,transform:transform(x,y,s*.58)},
      {opacity:.72,offset:.7,transform:transform(x+5,y-4,s*.5,4)},
      {opacity:0,transform:transform(x+10,y-8,s*.62,8)},
    ],{duration:720,easing:'ease-out',fill:'forwards'});
  }
}
async function statusAccent(scope,kind,{localX,localY}={}){
  const r=rect(),s=scaleForStage(),x=clamp(localX||r.width*.5,100,r.width-100),y=clamp(localY||r.height*.55,100,r.height-100);
  if(kind==='guided'){
    const e=fx(scope,'speed_lines','movement',{x,y,scale:s*.65,opacity:0});
    await anim(scope,e,[
      {opacity:0,transform:transform(x-70,y,s*.4)},
      {opacity:.9,offset:.35,transform:transform(x,y,s*.72)},
      {opacity:0,transform:transform(x+120,y-8,s*.9)},
    ],{duration:430,easing:'ease-out',fill:'forwards'},'call');
  }else if(kind==='hold'){
    await popFx(scope,'dust_burst','impact',x-25,y+35,s*.58,0,'call');
  }else if(kind==='cancel'){
    await popFx(scope,'impact_starburst','impact',x,y,s*.62,-4,'call');
  }
}
async function callDelivery(scope,context={}){
  const r=rect(),s=scaleForStage();
  const x=clamp(Number(context.localX)||r.width*.5,150,r.width-150),y=clamp(Number(context.localY)||r.height*.55,150,r.height-150);
  if(M.isReduced())return reducedEvent(scope,'CALL_DELIVERY',{localX:x,localY:y});
  const p=pose(scope,'pompon_dash',{x:-160,y:y+20,scale:s*.88,opacity:0});
  const speed=fx(scope,'speed_lines','movement',{x:x*.4,y:y+26,scale:s*.82,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,p,[
      {opacity:0,transform:transform(-160,y+20,s*.78,-3)},
      {opacity:1,offset:.16,transform:transform(-10,y+20,s*.88,-1)},
      {opacity:1,transform:transform(x-150,y+12,s*.9,1)},
    ],{duration:420,easing:'cubic-bezier(.1,.78,.18,1)',fill:'forwards'},'call'),
    anim(scope,speed,[
      {opacity:0,transform:transform(0,y+28,s*.4)},
      {opacity:.88,offset:.35,transform:transform(x*.42,y+25,s*.8)},
      {opacity:0,transform:transform(x-140,y+16,s*1.02)},
    ],{duration:410,easing:'ease-out',fill:'forwards'},'call'),
  ]);
  hide(p);
  await popFx(scope,'dust_burst','impact',x-80,y+38,s*.58,0,'call');
  const retortX=x<r.width*.55?clamp(x+205,170,r.width-140):clamp(x-205,140,r.width-170);
  const flip=retortX>x?-1:1;
  const c=pose(scope,'chiru_retort',{x:retortX,y:y+65,scale:s*.68,flip,opacity:0});
  await Promise.all([
    anim(scope,c,[
      {opacity:0,transform:transform(retortX,y+85,s*.6,0,flip)},
      {opacity:1,offset:.28,transform:transform(retortX,y+65,s*.7,-2,flip)},
      {opacity:1,offset:.74,transform:transform(retortX,y+65,s*.7,2,flip)},
      {opacity:0,transform:transform(retortX,y+80,s*.62,0,flip)},
    ],{duration:520,easing:'ease-out',fill:'forwards'},'call'),
    popFx(scope,'exclamation','alert',x+12,y-90,s*.5,-3,'call'),
  ]);
}

const PLAYERS=Object.freeze({
  POMPON_PEEK:pomponPeek,POMPON_SPARKLE_SMUG:pomponSparkleSmug,
  CHIRU_PEEK:chiruPeek,CHIRU_SNEAK:chiruSneak,
  POMPON_BRAKE_FAIL:brakeFail,DUO_CHASE_CATCH:chaseCatch,
  PEEK_DISCOVERY:peekDiscovery,BALL_RIDE_FAIL:ballRideFail,
  CALL_DELIVERY:callDelivery,
});

async function runScoped(label,fn,context={},mode='idle'){
  if(running)return{played:false,reason:'busy'};
  const scope=M.createScope(label);currentScope=scope;currentId=label.split(':').at(-1)||label;running=true;
  try{
    await A.preloadAll();
    if(scope.signal.aborted)return{played:false,reason:'aborted'};
    await fn(scope,context,mode);
    return{played:true,id:currentId};
  }catch(e){
    return{played:false,id:currentId,reason:scope.signal.aborted?'aborted':'error'};
  }finally{
    scope.cleanup();
    if(currentScope===scope){currentScope=null;currentId='';running=false}
    diagnostics.cleanupRuns+=1;
  }
}
async function play(id,context={}){
  const key=String(id||''),fn=PLAYERS[key];
  if(!fn)return{played:false,reason:'unknown-event'};
  if(running)return{played:false,reason:'busy'};
  diagnostics.played+=1;if(key==='CALL_DELIVERY')diagnostics.callPlayed+=1;
  diagnostics.lastEvent={id:key,at:Date.now()};diagnostics.history.push({...diagnostics.lastEvent});diagnostics.history=diagnostics.history.slice(-40);
  return runScoped('character:'+key,fn,context,key==='CALL_DELIVERY'?'call':'idle');
}
function cancel(reason='manual'){
  if(!currentScope)return false;
  diagnostics.canceled+=1;const scope=currentScope;currentScope=null;currentId='';running=false;scope.abort(reason);return true;
}
function randomEvent(category,recent=[]){
  const blocked=new Set(Array.isArray(recent)?recent:[]);
  let options=EVENTS.filter(x=>x.category===category&&!blocked.has(x.id));
  if(!options.length)options=EVENTS.filter(x=>x.category===category);
  return options[Math.floor(Math.random()*options.length)]||null;
}
async function playRandom(category,{grid=null,recent=[]}={}){
  const e=randomEvent(category,recent);if(!e)return{played:false,reason:'no-event'};
  return play(e.id,{grid});
}
async function playAmbientEffect({grid=null}={}){
  if(running)return{played:false,reason:'busy'};
  const ids=['AMBIENT_MAGIC_STAR','AMBIENT_SPARKLE','AMBIENT_CARD_GLINT','AMBIENT_SPEED_PASS'];
  const id=ids[Math.floor(Math.random()*ids.length)];
  diagnostics.ambientPlayed+=1;
  return runScoped('ambient:'+id,(scope)=>ambient(scope,id),{grid});
}
function localPoint(viewportRect){
  const b=rect();if(!viewportRect)return{x:b.width*.5,y:b.height*.55};
  return{x:viewportRect.left-b.left+viewportRect.width*.5,y:viewportRect.top-b.top+viewportRect.height*.5};
}
async function playStatusAccent(kind,{rect:targetRect=null}={}){
  if(running)return{played:false,reason:'busy'};
  const p=localPoint(targetRect);diagnostics.statusAccents+=1;
  return runScoped('status:'+String(kind||''),(scope)=>statusAccent(scope,String(kind||''),{localX:p.x,localY:p.y}),{});
}
async function playCallDelivery({number='',rect:targetRect=null}={}){
  if(running&&currentId==='CALL_DELIVERY')return{played:false,reason:'rapid-call'};
  cancel('real-call');const p=localPoint(targetRect);
  return play('CALL_DELIVERY',{number,localX:p.x,localY:p.y});
}
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,reduced:M.isReduced(),assets:A.diagnostics(),idlePace:IDLE_PACE}}
function resetForTest(){cancel('test-reset');diagnostics.played=0;diagnostics.canceled=0;diagnostics.cleanupRuns=0;diagnostics.callPlayed=0;diagnostics.ambientPlayed=0;diagnostics.statusAccents=0;diagnostics.lastEvent=null;diagnostics.history=[]}

window.ASOBOON_BOARD_CHARACTER_EVENTS=Object.freeze({
  version:'2.0.0',events:EVENTS,play,playRandom,playAmbientEffect,playStatusAccent,playCallDelivery,cancel,isRunning:()=>running,
  getDiagnostics,resetForTest,playEventForTest:async id=>play(id,{grid:document.getElementById('queueGrid')}),
});
})();