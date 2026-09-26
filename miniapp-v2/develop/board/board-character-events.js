(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!M||!A)return;

const IDLE_PACE=1.62;
const CALL_PACE=1.00;
const EVENTS=Object.freeze([
  Object.freeze({id:'POMPON_PEEK',category:'POMPON_CAMEO',story:'POMPONが端から様子をうかがう'}),
  Object.freeze({id:'POMPON_SPARKLE_SMUG',category:'POMPON_CAMEO',story:'キラッを自分の手柄だと思ってどや顔'}),
  Object.freeze({id:'POMPON_STAR_SHOCK',category:'POMPON_CAMEO',story:'星が横切る→POMPONが気づいてびっくり'}),
  Object.freeze({id:'POMPON_OOPS_QUESTION',category:'POMPON_CAMEO',story:'謎の？→POMPONが出てきて首をかしげる'}),
  Object.freeze({id:'CHIRU_PEEK',category:'CHIRU_CAMEO',story:'CHIRUが端から様子をうかがう'}),
  Object.freeze({id:'CHIRU_SNEAK',category:'CHIRU_CAMEO',story:'CHIRUが静かにこっそり横切る'}),
  Object.freeze({id:'CHIRU_STAR_DODGE',category:'CHIRU_CAMEO',story:'星が飛来→CHIRUが素早く回避'}),
  Object.freeze({id:'CHIRU_ALERT_SHOCK',category:'CHIRU_CAMEO',story:'警告マーク→CHIRUが飛び上がって驚く'}),
  Object.freeze({id:'POMPON_BRAKE_FAIL',category:'POMPON_STORY',story:'暴走→ブレーキ→止まれない→画面外衝突→ヨロヨロ→CHIRU呆れ'}),
  Object.freeze({id:'POMPON_SMUG_OOPS',category:'POMPON_STORY',story:'成功した気になる→どや顔→小さな事故→やっちまった顔'}),
  Object.freeze({id:'POMPON_STAR_FLYBACK',category:'POMPON_STORY',story:'星に気づく→近づく→勢い余って吹っ飛ぶ→ヨロヨロ帰還'}),
  Object.freeze({id:'POMPON_WRONG_WAY_VICTORY',category:'POMPON_STORY',story:'勝ち誇って逆走→間違いに気づいて固まる→そっと正しい方向へ退場'}),
  Object.freeze({id:'DUO_CHASE_CATCH',category:'DUO_STORY',story:'逃走→追跡→捕まえる→勢い余って事故→2体でもつれる'}),
  Object.freeze({id:'PEEK_DISCOVERY',category:'DUO_STORY',story:'両側から覗く→目が合う→びっくり→追いかけっこ'}),
  Object.freeze({id:'DUO_BOAST_DISBELIEF',category:'DUO_STORY',story:'POMPONが自慢→CHIRUが信じない→POMPON固まる'}),
  Object.freeze({id:'DUO_FAILURE_SCOLD',category:'DUO_STORY',story:'POMPONがやらかす→CHIRUが怒る→その場で説教'}),
  Object.freeze({id:'DUO_OH_NO_ESCAPE',category:'DUO_STORY',story:'警告に2人で気づく→やばい！→一緒に逃げる'}),
  Object.freeze({id:'DUO_FRIENDSHIP_OOPS',category:'DUO_STORY',story:'仲良く決める→小さな失敗→2人とも「あっ」'}),
  Object.freeze({id:'DUO_RESCUE_RELAY',category:'DUO_STORY',story:'止まれないPOMPONを遠くからCHIRUが追う→救助成功→2人でもつれる'}),
  Object.freeze({id:'DUO_QUIET_PEEK_RETREAT',category:'DUO_STORY',story:'左右からそっと覗く→目が合って静止→気まずくゆっくり引っ込む'}),
  Object.freeze({id:'BALL_RIDE_FAIL',category:'RARE_STORY',story:'ボール成功→調子に乗る→飛ぶ→CHIRU回避→POMPONだけ画面外事故'}),
  Object.freeze({id:'MEGA_SCREEN_TAKEOVER',category:'MEGA_STORY',story:'巨大POMPONが画面を占拠→掲示板を傾ける→CHIRUに見つかって縮こまる'}),
  Object.freeze({id:'MEGA_GREAT_CRASH',category:'MEGA_STORY',story:'巨大ボールとPOMPONが暴走→CHIRU参戦→全画面級クラッシュ→2人でもつれる'}),
]);

let currentScope=null,running=false,currentId='';
const diagnostics={played:0,canceled:0,cleanupRuns:0,callPlayed:0,ambientPlayed:0,statusAccents:0,duplicateSuppressions:0,lastEvent:null,history:[]};

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
const visibleCharactersByScope=new WeakMap();
function characterOwner(name){
  const key=String(name||'');
  if(key.startsWith('duo_'))return'DUO';
  if(key.startsWith('pompon_'))return'POMPON';
  if(key.startsWith('chiru_'))return'CHIRU';
  return'';
}
function suppressVisibleCharacter(el){
  if(!el||!el.isConnected)return;
  if(el.style.opacity!=='0')diagnostics.duplicateSuppressions+=1;
  try{el.getAnimations?.().forEach(animation=>animation.cancel())}catch{}
  el.style.opacity='0';
  el.style.visibility='hidden';
  el.dataset.pcSuppressed='1';
}
function registerCharacter(scope,el,name){
  if(!scope||!el)return el;
  const owner=characterOwner(name);if(!owner)return el;
  let state=visibleCharactersByScope.get(scope);
  if(!state){state={POMPON:null,CHIRU:null,DUO:null};visibleCharactersByScope.set(scope,state)}
  if(owner==='DUO'){
    suppressVisibleCharacter(state.POMPON);
    suppressVisibleCharacter(state.CHIRU);
    suppressVisibleCharacter(state.DUO);
    state.POMPON=null;state.CHIRU=null;state.DUO=el;
  }else{
    suppressVisibleCharacter(state[owner]);
    suppressVisibleCharacter(state.DUO);
    state.DUO=null;
    state[owner]=el;
  }
  el.dataset.pcOwner=owner;
  return el;
}
function pose(scope,name,{x=0,y=0,scale=1,rotate=0,flip=1,opacity=1,layer='front',className=''}={}){
  const el=A.createCharacter(name,className);if(!el)return null;
  Object.assign(el.dataset,{sceneX:String(x),sceneY:String(y),sceneScale:String(scale),sceneRotate:String(rotate),sceneFlip:String(flip)});
  el.style.opacity=String(opacity);el.style.transform=transform(x,y,scale,rotate,flip);
  return registerCharacter(scope,scope.add(el,layer),name);
}
function anchorPoint(el,key='CENTER'){
  const anchors=A.CHARACTER_ANCHORS?.[el?.dataset?.pcAsset]||{CENTER:[.5,.5]};
  const [nx,ny]=anchors[key]||anchors.CENTER||[.5,.5],x=Number(el?.dataset?.sceneX)||0,y=Number(el?.dataset?.sceneY)||0;
  const scale=Number(el?.dataset?.sceneScale)||1,flip=Number(el?.dataset?.sceneFlip)||1,rad=(Number(el?.dataset?.sceneRotate)||0)*Math.PI/180;
  const ox=(nx-.5)*256*scale*flip,oy=(ny-.5)*256*scale;
  return{x:x+ox*Math.cos(rad)-oy*Math.sin(rad),y:y+ox*Math.sin(rad)+oy*Math.cos(rad)};
}
function anchoredFx(scope,character,anchor,name,semantic,options={}){const p=anchorPoint(character,anchor);return fx(scope,name,semantic,{...options,x:p.x+(options.dx||0),y:p.y+(options.dy||0)})}
function fx(scope,name,semantic,{x=0,y=0,scale=1,rotate=0,opacity=1,layer='front',className=''}={}){
  if(semantic&&!A.validatePairing(name,semantic))return null;
  const el=A.createEffect(name,className);if(!el)return null;
  el.style.opacity=String(opacity);el.style.transform=transform(x,y,scale,rotate,1);
  return scope.add(el,layer);
}
function hide(el){if(el)el.style.opacity='0'}
function stageProp(scope,className='pc-mega-prop',layer='front'){
  const el=document.createElement('div');el.className=className;return scope.add(el,layer);
}
function stageBoard(){
  return document.querySelector('.board');
}
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
async function hold(scope,ms=260,mode='idle'){await wait(scope,ms,mode)}
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
    POMPON_STAR_SHOCK:['pompon_shocked',r.width*.56,r.height*.64],
    POMPON_OOPS_QUESTION:['pompon_oops',r.width*.48,r.height*.68],
    CHIRU_PEEK:['chiru_peek',r.width*.84,r.height*.64],
    CHIRU_SNEAK:['chiru_sneak',r.width*.74,r.height*.68],
    CHIRU_STAR_DODGE:['chiru_dodge',r.width*.58,r.height*.66],
    CHIRU_ALERT_SHOCK:['chiru_shocked',r.width*.62,r.height*.66],
    POMPON_BRAKE_FAIL:['pompon_wobble',r.width*.66,r.height*.68],
    POMPON_SMUG_OOPS:['pompon_oops',r.width*.5,r.height*.68],
    POMPON_STAR_FLYBACK:['pompon_wobble',r.width*.7,r.height*.68],
    DUO_CHASE_CATCH:['duo_entangled',r.width*.52,r.height*.65],
    PEEK_DISCOVERY:['duo_surprised',r.width*.5,r.height*.62],
    DUO_BOAST_DISBELIEF:['duo_boast_disbelief',r.width*.5,r.height*.64],
    DUO_FAILURE_SCOLD:['duo_failure_scold',r.width*.52,r.height*.65],
    DUO_OH_NO_ESCAPE:['duo_oh_no',r.width*.5,r.height*.63],
    DUO_FRIENDSHIP_OOPS:['duo_friendship_oops',r.width*.5,r.height*.64],
    BALL_RIDE_FAIL:['pompon_ballride',r.width*.5,r.height*.64],
    MEGA_SCREEN_TAKEOVER:['pompon_smug',r.width*.5,r.height*.48],
    MEGA_GREAT_CRASH:['duo_entangled',r.width*.52,r.height*.61],
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

async function pomponStarShock(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.46;
  const star=fx(scope,'magic_star','ambient',{x:-70,y,scale:s*.46,opacity:0});
  const p=pose(scope,'pompon_shocked',{x:r.width*.62,y:r.height*.68,scale:s*.78,opacity:0});
  await Promise.all([
    anim(scope,star,[
      {opacity:0,transform:transform(-80,y,s*.3,-8)},
      {opacity:1,offset:.28,transform:transform(r.width*.28,y-8,s*.52,4)},
      {opacity:.9,offset:.72,transform:transform(r.width*.52,y+4,s*.48,-3)},
      {opacity:0,transform:transform(r.width*.72,y-3,s*.36,7)}
    ],{duration:900,easing:'cubic-bezier(.18,.65,.2,1)',fill:'forwards'}),
    anim(scope,p,[
      {opacity:0,transform:transform(r.width*.62,r.height*.74,s*.68)},
      {opacity:1,offset:.5,transform:transform(r.width*.62,r.height*.68,s*.82,-3)},
      {opacity:1,offset:.78,transform:transform(r.width*.62,r.height*.68,s*.78,3)},
      {opacity:0,transform:transform(r.width*.62,r.height*.72,s*.7)}
    ],{duration:920,easing:'ease-out',fill:'forwards'})
  ]);
}
async function pomponOopsQuestion(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.48,y=r.height*.68;
  const q=fx(scope,'question','question',{x:x+55,y:y-115,scale:s*.52,opacity:0});
  const p=pose(scope,'pompon_oops',{x,y:y+60,scale:s*.82,opacity:0});
  await Promise.all([
    anim(scope,q,[
      {opacity:0,transform:transform(x+55,y-95,s*.24,-8)},
      {opacity:1,offset:.34,transform:transform(x+55,y-120,s*.58,4)},
      {opacity:.9,offset:.72,transform:transform(x+48,y-124,s*.52,-2)},
      {opacity:0,transform:transform(x+40,y-132,s*.42,6)}
    ],{duration:860,easing:'ease-out',fill:'forwards'}),
    anim(scope,p,[
      {opacity:0,transform:transform(x,y+70,s*.72)},
      {opacity:1,offset:.32,transform:transform(x,y,s*.84,-2)},
      {opacity:1,offset:.78,transform:transform(x,y,s*.84,2)},
      {opacity:0,transform:transform(x,y+26,s*.76)}
    ],{duration:980,easing:'cubic-bezier(.2,.76,.2,1)',fill:'forwards'})
  ]);
}
async function chiruStarDodge(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.58;
  const star=fx(scope,'magic_star','ambient',{x:-80,y,scale:s*.48,opacity:0});
  const c=pose(scope,'chiru_dodge',{x:r.width*.58,y:r.height*.68,scale:s*.72,opacity:0});
  const arc=fx(scope,'jump_arc','dodge',{x:r.width*.58,y:r.height*.56,scale:s*.5,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,star,[
      {opacity:0,transform:transform(-90,y,s*.34,-6)},
      {opacity:1,offset:.25,transform:transform(r.width*.28,y-6,s*.5,2)},
      {opacity:.92,offset:.68,transform:transform(r.width*.53,y+5,s*.48,-2)},
      {opacity:0,transform:transform(r.width+90,y-4,s*.34,5)}
    ],{duration:980,easing:'cubic-bezier(.16,.68,.2,1)',fill:'forwards'}),
    anim(scope,c,[
      {opacity:0,transform:transform(r.width*.58,r.height*.72,s*.64)},
      {opacity:1,offset:.42,transform:transform(r.width*.55,r.height*.61,s*.76,-5)},
      {opacity:0,transform:transform(r.width*.49,r.height*.69,s*.68,-2)}
    ],{duration:780,delay:220,easing:'cubic-bezier(.18,.8,.2,1)',fill:'forwards'}),
    anim(scope,arc,[
      {opacity:0,transform:transform(r.width*.58,r.height*.58,s*.28)},
      {opacity:.88,offset:.45,transform:transform(r.width*.54,r.height*.54,s*.52,-8)},
      {opacity:0,transform:transform(r.width*.48,r.height*.6,s*.62,-15)}
    ],{duration:760,delay:220,easing:'ease-out',fill:'forwards'})
  ]);
}
async function chiruAlertShock(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.62,y=r.height*.68;
  const alert=fx(scope,'alert_red','alert',{x:x+70,y:y-115,scale:s*.48,opacity:0});
  const c=pose(scope,'chiru_shocked',{x,y:y+55,scale:s*.76,opacity:0});
  await Promise.all([
    anim(scope,alert,[
      {opacity:0,transform:transform(x+70,y-105,s*.22)},
      {opacity:1,offset:.28,transform:transform(x+70,y-125,s*.56,0)},
      {opacity:1,offset:.62,transform:transform(x+70,y-125,s*.52,3)},
      {opacity:0,transform:transform(x+70,y-138,s*.38,6)}
    ],{duration:760,easing:'ease-out',fill:'forwards'}),
    anim(scope,c,[
      {opacity:0,transform:transform(x,y+72,s*.64)},
      {opacity:1,offset:.34,transform:transform(x,y,s*.8,-4)},
      {opacity:1,offset:.72,transform:transform(x,y,s*.78,4)},
      {opacity:0,transform:transform(x,y+28,s*.68)}
    ],{duration:900,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards'})
  ]);
}
async function pomponSmugOops(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.48,y=r.height*.68;
  const sparkle=fx(scope,'sparkle_gold','success',{x:x+80,y:y-110,scale:s*.54,opacity:0});
  const smug=pose(scope,'pompon_smug',{x,y:y+40,scale:s*.84,opacity:0});
  await Promise.all([
    anim(scope,sparkle,[
      {opacity:0,transform:transform(x+80,y-100,s*.26)},
      {opacity:1,offset:.34,transform:transform(x+80,y-118,s*.62)},
      {opacity:.75,transform:transform(x+72,y-126,s*.52,6)}
    ],{duration:520,easing:'ease-out',fill:'forwards'}),
    anim(scope,smug,[
      {opacity:0,transform:transform(x,y+55,s*.74)},
      {opacity:1,offset:.3,transform:transform(x,y,s*.86,-2)},
      {opacity:1,transform:transform(x,y,s*.86,2)}
    ],{duration:700,easing:'cubic-bezier(.2,.78,.2,1)',fill:'forwards'})
  ]);
  hide(smug);
  await wait(scope,80);
  await Promise.all([
    popFx(scope,'comic_star','impact',x+8,y+38,s*.5,4),
    popFx(scope,'dust_impact','impact',x-35,y+70,s*.46,0)
  ]);
  const oops=pose(scope,'pompon_oops',{x,y,scale:s*.82,opacity:0});
  await anim(scope,oops,[
    {opacity:0,transform:transform(x,y-6,s*.7,-4)},
    {opacity:1,offset:.3,transform:transform(x,y,s*.86,2)},
    {opacity:1,offset:.78,transform:transform(x,y,s*.82,-2)},
    {opacity:0,transform:transform(x,y+18,s*.74)}
  ],{duration:760,easing:'ease-out',fill:'forwards'});
}
async function pomponStarFlyback(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.4,y=r.height*.66;
  const star=fx(scope,'magic_star','ambient',{x:r.width*.26,y:r.height*.5,scale:s*.5,opacity:0});
  const curious=pose(scope,'pompon_smug',{x,y,scale:s*.78,opacity:0});
  await Promise.all([
    anim(scope,star,[
      {opacity:0,transform:transform(r.width*.18,r.height*.48,s*.3)},
      {opacity:1,offset:.36,transform:transform(r.width*.34,r.height*.5,s*.54)},
      {opacity:.9,transform:transform(r.width*.48,r.height*.48,s*.5,5)}
    ],{duration:650,easing:'ease-out',fill:'forwards'}),
    anim(scope,curious,[
      {opacity:0,transform:transform(x,y+45,s*.7)},
      {opacity:1,offset:.34,transform:transform(x,y,s*.8,-2)},
      {opacity:1,transform:transform(x+25,y-4,s*.8,2)}
    ],{duration:650,easing:'ease-out',fill:'forwards'})
  ]);
  hide(curious);hide(star);
  const fly=pose(scope,'pompon_fly',{x:r.width*.52,y:r.height*.57,scale:s*.76,opacity:0});
  const slash=fx(scope,'speed_slash','movement',{x:r.width*.58,y:r.height*.57,scale:s*.7,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,fly,[
      {opacity:0,transform:transform(r.width*.5,r.height*.62,s*.64,-6)},
      {opacity:1,offset:.25,transform:transform(r.width*.64,r.height*.5,s*.8,-18)},
      {opacity:0,transform:transform(r.width+150,r.height*.36,s*.7,-28)}
    ],{duration:520,easing:'cubic-bezier(.16,.68,.18,1)',fill:'forwards'}),
    anim(scope,slash,[
      {opacity:0,transform:transform(r.width*.5,r.height*.6,s*.36)},
      {opacity:.9,offset:.36,transform:transform(r.width*.68,r.height*.5,s*.72,-12)},
      {opacity:0,transform:transform(r.width*.88,r.height*.4,s*.92,-18)}
    ],{duration:500,easing:'ease-out',fill:'forwards'})
  ]);
  await popFx(scope,'impact_starburst','impact',r.width-15,r.height*.36,s*.72,-6);
  await wait(scope,120);
  const wobble=pose(scope,'pompon_wobble',{x:r.width+120,y:r.height*.68,scale:s*.84,flip:-1,opacity:0});
  const dizzy=fx(scope,'dizzy_stars','aftermath',{x:r.width*.78,y:r.height*.46,scale:s*.46,opacity:0});
  await Promise.all([
    anim(scope,wobble,[
      {opacity:0,transform:transform(r.width+120,r.height*.68,s*.78,6,-1)},
      {opacity:1,offset:.3,transform:transform(r.width*.8,r.height*.68,s*.86,-4,-1)},
      {opacity:1,offset:.76,transform:transform(r.width*.72,r.height*.68,s*.84,4,-1)},
      {opacity:0,transform:transform(r.width*.68,r.height*.72,s*.76,-2,-1)}
    ],{duration:760,easing:'cubic-bezier(.18,.72,.22,1)',fill:'forwards'}),
    anim(scope,dizzy,[
      {opacity:0,transform:transform(r.width*.78,r.height*.46,s*.25)},
      {opacity:.92,offset:.34,transform:transform(r.width*.78,r.height*.46,s*.5)},
      {opacity:0,transform:transform(r.width*.8,r.height*.43,s*.58,20)}
    ],{duration:650,easing:'ease-out',fill:'forwards'})
  ]);
}
async function duoBoastDisbelief(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.5,y=r.height*.65;
  const smug=pose(scope,'pompon_smug',{x:r.width*.38,y,scale:s*.78,opacity:0});
  const sparkle=fx(scope,'sparkle_gold','success',{x:r.width*.42,y:y-115,scale:s*.48,opacity:0});
  await Promise.all([
    anim(scope,smug,[
      {opacity:0,transform:transform(r.width*.38,y+45,s*.68)},
      {opacity:1,offset:.3,transform:transform(r.width*.38,y,s*.8,-2)},
      {opacity:1,transform:transform(r.width*.38,y,s*.8,2)}
    ],{duration:620,easing:'ease-out',fill:'forwards'}),
    anim(scope,sparkle,[
      {opacity:0,transform:transform(r.width*.42,y-100,s*.24)},
      {opacity:1,offset:.38,transform:transform(r.width*.42,y-120,s*.56)},
      {opacity:.6,transform:transform(r.width*.44,y-130,s*.46,5)}
    ],{duration:560,easing:'ease-out',fill:'forwards'})
  ]);
  hide(smug);hide(sparkle);
  const duo=pose(scope,'duo_boast_disbelief',{x,y,scale:s*.9,opacity:0});
  const sweat=fx(scope,'sweat','reaction',{x:r.width*.63,y:y-95,scale:s*.42,opacity:0});
  await Promise.all([
    anim(scope,duo,[
      {opacity:0,transform:transform(x,y+8,s*.76)},
      {opacity:1,offset:.28,transform:transform(x,y,s*.92,-2)},
      {opacity:1,offset:.78,transform:transform(x,y,s*.9,2)},
      {opacity:0,transform:transform(x,y+18,s*.82)}
    ],{duration:900,easing:'cubic-bezier(.18,.8,.2,1)',fill:'forwards'}),
    anim(scope,sweat,[
      {opacity:0,transform:transform(r.width*.63,y-90,s*.24)},
      {opacity:.95,offset:.35,transform:transform(r.width*.63,y-105,s*.46)},
      {opacity:0,transform:transform(r.width*.65,y-80,s*.4)}
    ],{duration:620,delay:140,easing:'ease-out',fill:'forwards'})
  ]);
}
async function duoFailureScold(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.5,y=r.height*.66;
  const oops=pose(scope,'pompon_oops',{x:r.width*.4,y,scale:s*.76,opacity:0});
  await anim(scope,oops,[
    {opacity:0,transform:transform(r.width*.4,y+42,s*.66)},
    {opacity:1,offset:.3,transform:transform(r.width*.4,y,s*.78,-2)},
    {opacity:1,transform:transform(r.width*.4,y,s*.78,2)}
  ],{duration:560,easing:'ease-out',fill:'forwards'});
  hide(oops);
  const angry=pose(scope,'chiru_angry',{x:r.width*.63,y,scale:s*.7,flip:-1,opacity:0});
  await Promise.all([
    anim(scope,angry,[
      {opacity:0,transform:transform(r.width*.63,y+35,s*.62,0,-1)},
      {opacity:1,offset:.3,transform:transform(r.width*.63,y,s*.74,-3,-1)},
      {opacity:1,transform:transform(r.width*.6,y,s*.74,3,-1)}
    ],{duration:560,easing:'ease-out',fill:'forwards'}),
    popFx(scope,'anger','anger',r.width*.68,y-110,s*.46,2)
  ]);
  hide(angry);
  const duo=pose(scope,'duo_failure_scold',{x,y,scale:s*.9,opacity:0});
  await anim(scope,duo,[
    {opacity:0,transform:transform(x,y+6,s*.76)},
    {opacity:1,offset:.28,transform:transform(x,y,s*.92,-2)},
    {opacity:1,offset:.78,transform:transform(x,y,s*.9,2)},
    {opacity:0,transform:transform(x,y+20,s*.82)}
  ],{duration:920,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards'});
}
async function duoOhNoEscape(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.5,y=r.height*.64;
  const alert=fx(scope,'alert_red','alert',{x,y:y-130,scale:s*.56,opacity:0});
  const duo=pose(scope,'duo_oh_no',{x,y:y+25,scale:s*.86,opacity:0});
  await Promise.all([
    anim(scope,alert,[
      {opacity:0,transform:transform(x,y-110,s*.24)},
      {opacity:1,offset:.3,transform:transform(x,y-135,s*.62)},
      {opacity:1,offset:.7,transform:transform(x,y-135,s*.56,4)},
      {opacity:0,transform:transform(x,y-150,s*.4,8)}
    ],{duration:720,easing:'ease-out',fill:'forwards'}),
    anim(scope,duo,[
      {opacity:0,transform:transform(x,y+38,s*.74)},
      {opacity:1,offset:.34,transform:transform(x,y,s*.9,-2)},
      {opacity:1,offset:.72,transform:transform(x,y,s*.88,2)},
      {opacity:0,transform:transform(x,y+10,s*.8)}
    ],{duration:760,easing:'ease-out',fill:'forwards'})
  ]);
  const chase=pose(scope,'duo_chase',{x:r.width*.42,y:r.height*.68,scale:s*.8,opacity:0});
  const speed=fx(scope,'speed_lines','movement',{x:r.width*.5,y:r.height*.7,scale:s*.82,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,chase,[
      {opacity:0,transform:transform(r.width*.35,r.height*.68,s*.7)},
      {opacity:1,offset:.22,transform:transform(r.width*.46,r.height*.68,s*.82)},
      {opacity:0,transform:transform(r.width+170,r.height*.62,s*.74,5)}
    ],{duration:560,easing:'cubic-bezier(.12,.74,.16,1)',fill:'forwards'}),
    anim(scope,speed,[
      {opacity:0,transform:transform(r.width*.36,r.height*.71,s*.4)},
      {opacity:.88,offset:.35,transform:transform(r.width*.58,r.height*.68,s*.8)},
      {opacity:0,transform:transform(r.width*.88,r.height*.63,s)}
    ],{duration:540,easing:'ease-out',fill:'forwards'})
  ]);
}
async function duoFriendshipOops(scope){
  const r=rect(),s=scaleForStage(),x=r.width*.5,y=r.height*.64;
  const duo=pose(scope,'duo_friendship_oops',{x,y,scale:s*.88,opacity:0});
  const spark=fx(scope,'magic_sparkle','success',{x:x+80,y:y-110,scale:s*.48,opacity:0});
  await Promise.all([
    anim(scope,duo,[
      {opacity:0,transform:transform(x,y+18,s*.74)},
      {opacity:1,offset:.28,transform:transform(x,y,s*.9,-2)},
      {opacity:1,offset:.7,transform:transform(x,y,s*.9,2)},
      {opacity:0,transform:transform(x,y,s*.84)}
    ],{duration:760,easing:'ease-out',fill:'forwards'}),
    anim(scope,spark,[
      {opacity:0,transform:transform(x+80,y-100,s*.24)},
      {opacity:1,offset:.36,transform:transform(x+80,y-120,s*.56)},
      {opacity:0,transform:transform(x+88,y-128,s*.42,7)}
    ],{duration:620,easing:'ease-out',fill:'forwards'})
  ]);
  await wait(scope,80);
  await popFx(scope,'comic_star','impact',x+12,y+20,s*.52,5);
  const oh=pose(scope,'duo_oh_no',{x,y,scale:s*.86,opacity:0});
  await anim(scope,oh,[
    {opacity:0,transform:transform(x,y-4,s*.72,-4)},
    {opacity:1,offset:.28,transform:transform(x,y,s*.9,2)},
    {opacity:1,offset:.78,transform:transform(x,y,s*.86,-2)},
    {opacity:0,transform:transform(x,y+18,s*.78)}
  ],{duration:720,easing:'ease-out',fill:'forwards'});
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
async function megaScreenTakeover(scope){
  const r=rect(),s=scaleForStage(),board=stageBoard();
  const wash=stageProp(scope,'pc-mega-wash takeover','back');
  await anim(scope,wash,[{opacity:0},{opacity:.58,offset:.34},{opacity:.42,offset:.78},{opacity:0}],{duration:1800,easing:'ease-in-out',fill:'forwards'});
  const p=pose(scope,'pompon_smug',{x:r.width*.5,y:r.height+210,scale:s*.92,opacity:0});
  await anim(scope,p,[
    {opacity:0,transform:transform(r.width*.5,r.height+210,s*.75,-2)},
    {opacity:1,offset:.24,transform:transform(r.width*.5,r.height*.68,s*1.35,2)},
    {opacity:1,offset:.68,transform:transform(r.width*.5,r.height*.48,s*2.28,-1)},
    {opacity:1,transform:transform(r.width*.5,r.height*.46,s*2.18,1)},
  ],{duration:980,easing:'cubic-bezier(.12,.82,.18,1)',fill:'forwards'});
  await hold(scope,520);
  if(board&&!M.isReduced()){
    await anim(scope,board,[
      {transform:'translate3d(0,0,0) rotate(0deg) scale(1)'},
      {transform:'translate3d(-12px,8px,0) rotate(-1.2deg) scale(.992)',offset:.28},
      {transform:'translate3d(14px,-5px,0) rotate(1.05deg) scale(.996)',offset:.55},
      {transform:'translate3d(-6px,2px,0) rotate(-.4deg) scale(.999)',offset:.78},
      {transform:'translate3d(0,0,0) rotate(0deg) scale(1)'},
    ],{duration:620,easing:'cubic-bezier(.2,.8,.2,1)'});
  }
  hide(p);
  const shocked=pose(scope,'pompon_shocked',{x:r.width*.5,y:r.height*.48,scale:s*2.08,opacity:0});
  const alert=anchoredFx(scope,shocked,'HEAD','exclamation','alert',{dx:130,dy:-70,scale:s*1.15,opacity:0});
  await Promise.all([
    anim(scope,shocked,[
      {opacity:0,transform:transform(r.width*.5,r.height*.5,s*1.72,-5)},
      {opacity:1,offset:.2,transform:transform(r.width*.5,r.height*.45,s*2.15,5)},
      {opacity:1,transform:transform(r.width*.5,r.height*.46,s*2.04,-2)},
    ],{duration:620,easing:'cubic-bezier(.18,.88,.2,1)',fill:'forwards'}),
    anim(scope,alert,[{opacity:0},{opacity:1,offset:.28},{opacity:1}],{duration:560,fill:'forwards'})
  ]);
  await hold(scope,480);
  const c=pose(scope,'chiru_retort',{x:r.width*.82,y:r.height*.64,scale:s*1.18,flip:-1,opacity:0});
  await anim(scope,c,[
    {opacity:0,transform:transform(r.width+120,r.height*.7,s*.9,0,-1)},
    {opacity:1,offset:.3,transform:transform(r.width*.84,r.height*.64,s*1.22,-4,-1)},
    {opacity:1,transform:transform(r.width*.78,r.height*.62,s*1.18,2,-1)},
  ],{duration:700,easing:'ease-out',fill:'forwards'});
  await hold(scope,560);
  await Promise.all([
    anim(scope,shocked,[{opacity:1},{opacity:.96,offset:.2,transform:transform(r.width*.48,r.height*.53,s*1.6,-4)},{opacity:0,transform:transform(r.width*.38,r.height+210,s*.65,-8)}],{duration:920,easing:'cubic-bezier(.3,.1,.48,1)',fill:'forwards'}),
    anim(scope,c,[{opacity:1},{opacity:1,offset:.58,transform:transform(r.width*.7,r.height*.62,s*1.16,0,-1)},{opacity:0,transform:transform(r.width*.64,r.height*.72,s*.92,2,-1)}],{duration:920,easing:'ease-in',fill:'forwards'}),
    anim(scope,alert,[{opacity:1},{opacity:0}],{duration:420,fill:'forwards'})
  ]);
  await hold(scope,260);
}
async function megaGreatCrash(scope){
  const r=rect(),s=scaleForStage(),impactX=r.width*.58,impactY=r.height*.57,board=stageBoard();
  const wash=stageProp(scope,'pc-mega-wash crash','back');
  const ball=stageProp(scope,'pc-giant-ball pc-mega-ball','back');
  ball.style.opacity='0';ball.style.transform=transform(-220,r.height*.56,s*1.1,-12);
  const p=pose(scope,'pompon_cannot_stop',{x:-170,y:r.height*.66,scale:s*1.12,opacity:0});
  await Promise.all([
    anim(scope,wash,[{opacity:0},{opacity:.42,offset:.25},{opacity:.3,offset:.76},{opacity:0}],{duration:2100,fill:'forwards'}),
    anim(scope,ball,[
      {opacity:0,transform:transform(-240,r.height*.57,s*.9,-12)},
      {opacity:1,offset:.2,transform:transform(r.width*.18,r.height*.57,s*1.28,70)},
      {opacity:1,offset:.72,transform:transform(impactX-60,impactY,s*1.72,240)},
      {opacity:1,transform:transform(impactX,impactY,s*1.88,285)},
    ],{duration:1050,easing:'cubic-bezier(.12,.74,.18,1)',fill:'forwards'}),
    anim(scope,p,[
      {opacity:0,transform:transform(-170,r.height*.68,s*.88,-4)},
      {opacity:1,offset:.22,transform:transform(r.width*.2,r.height*.67,s*1.12,-2)},
      {opacity:1,transform:transform(impactX-150,r.height*.64,s*1.18,8)},
    ],{duration:980,easing:'cubic-bezier(.1,.76,.16,1)',fill:'forwards'})
  ]);
  await hold(scope,240);
  const c=pose(scope,'chiru_chase',{x:r.width+150,y:r.height*.66,scale:s*1.08,flip:-1,opacity:0});
  await anim(scope,c,[
    {opacity:0,transform:transform(r.width+150,r.height*.68,s*.84,0,-1)},
    {opacity:1,offset:.25,transform:transform(r.width*.82,r.height*.66,s*1.08,2,-1)},
    {opacity:1,transform:transform(impactX+135,r.height*.62,s*1.14,-5,-1)},
  ],{duration:720,easing:'cubic-bezier(.14,.74,.18,1)',fill:'forwards'});
  await hold(scope,260);
  hide(p);hide(c);
  await Promise.all([
    popFx(scope,'impact_starburst','impact',impactX,impactY,s*1.65,-4),
    popFx(scope,'impact_burst','impact',impactX+20,impactY+25,s*1.5,5),
    popFx(scope,'dust_impact','impact',impactX,impactY+80,s*1.4),
    shakeShell(scope,1.25),
    board&&!M.isReduced()?anim(scope,board,[
      {transform:'translate3d(0,0,0)'},
      {transform:'translate3d(-16px,8px,0) scale(.988)',offset:.2},
      {transform:'translate3d(17px,-7px,0) scale(.992)',offset:.38},
      {transform:'translate3d(-10px,-4px,0)',offset:.58},
      {transform:'translate3d(7px,3px,0)',offset:.74},
      {transform:'translate3d(0,0,0)'}
    ],{duration:680,easing:'linear'}):Promise.resolve()
  ]);
  hide(ball);
  await hold(scope,280);
  const tangled=pose(scope,'duo_entangled',{x:impactX,y:impactY+55,scale:s*1.62,opacity:0});
  const dizzy=anchoredFx(scope,tangled,'HEAD','dizzy_stars','aftermath',{scale:s*1.05,opacity:0});
  await Promise.all([
    anim(scope,tangled,[
      {opacity:0,transform:transform(impactX,impactY+15,s*1.05,9)},
      {opacity:1,offset:.24,transform:transform(impactX,impactY+55,s*1.68,-5)},
      {opacity:1,transform:transform(impactX,impactY+55,s*1.62,2)},
    ],{duration:620,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'}),
    anim(scope,dizzy,[{opacity:0},{opacity:1,offset:.3},{opacity:.95}],{duration:600,fill:'forwards'})
  ]);
  await hold(scope,820);
  await Promise.all([
    anim(scope,tangled,[{opacity:1},{opacity:0,transform:transform(impactX+90,impactY+90,s*1.15,7)}],{duration:720,easing:'ease-in',fill:'forwards'}),
    anim(scope,dizzy,[{opacity:.95},{opacity:0}],{duration:520,fill:'forwards'})
  ]);
}
async function pomponWrongWayVictory(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.62;
  const proud=pose(scope,'pompon_smug',{x:r.width+150,y,scale:s*1.12,flip:-1,opacity:0});
  const sparkle=anchoredFx(scope,proud,'HAND','sparkle_gold','success',{scale:s*.62,opacity:0,layer:'front'});
  await Promise.all([
    anim(scope,proud,[{opacity:0,transform:transform(r.width+150,y,s*.92,0,-1)},{opacity:1,offset:.26,transform:transform(r.width*.7,y,s*1.12,-2,-1)},{opacity:1,transform:transform(r.width*.48,y,s*1.14,2,-1)}],{duration:720,easing:'cubic-bezier(.18,.72,.2,1)',fill:'forwards'}),
    anim(scope,sparkle,[{opacity:0},{opacity:1,offset:.45},{opacity:.8}],{duration:680,fill:'forwards'})
  ]);
  await hold(scope,360);
  hide(proud);hide(sparkle);
  const shocked=pose(scope,'pompon_shocked',{x:r.width*.48,y,scale:s*1.22,flip:-1,opacity:0});
  const question=anchoredFx(scope,shocked,'HEAD','question','question',{dx:65,dy:-35,scale:s*.64,opacity:0});
  await Promise.all([
    anim(scope,shocked,[{opacity:0,transform:transform(r.width*.48,y+10,s*.92,0,-1)},{opacity:1,offset:.28,transform:transform(r.width*.48,y,s*1.22,-3,-1)},{opacity:1,transform:transform(r.width*.48,y,s*1.18,2,-1)}],{duration:520,easing:'ease-out',fill:'forwards'}),
    anim(scope,question,[{opacity:0},{opacity:1,offset:.35},{opacity:1}],{duration:480,fill:'forwards'})
  ]);
  await hold(scope,520);
  hide(shocked);hide(question);
  const sneak=pose(scope,'pompon_peek',{x:r.width*.48,y:y+18,scale:s*.98,opacity:1});
  await anim(scope,sneak,[{opacity:1,transform:transform(r.width*.48,y+18,s*.98)},{opacity:1,offset:.34,transform:transform(r.width*.4,y+18,s*.94,-3)},{opacity:0,transform:transform(-150,y+30,s*.82,-5)}],{duration:920,easing:'cubic-bezier(.35,.05,.55,1)',fill:'forwards'});
}
async function duoRescueRelay(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.65,impactX=r.width*.72;
  const p=pose(scope,'pompon_cannot_stop',{x:-180,y,scale:s*1.12,opacity:0});
  const trail=anchoredFx(scope,p,'TRAIL_ORIGIN','dust_trail','movement',{scale:s*.82,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,p,[{opacity:0,transform:transform(-180,y,s*.92)},{opacity:1,offset:.22,transform:transform(r.width*.28,y,s*1.12,-4)},{opacity:1,transform:transform(impactX,y,s*1.16,7)}],{duration:780,easing:'cubic-bezier(.12,.72,.2,1)',fill:'forwards'}),
    anim(scope,trail,[{opacity:0},{opacity:.85,offset:.3},{opacity:0}],{duration:760,fill:'forwards'})
  ]);
  await hold(scope,240);
  const c=pose(scope,'chiru_chase',{x:-180,y:y+18,scale:s*.92,opacity:0});
  await anim(scope,c,[{opacity:0,transform:transform(-180,y+18,s*.76)},{opacity:1,offset:.22,transform:transform(r.width*.22,y+18,s*.92)},{opacity:1,transform:transform(impactX-145,y+8,s*1.02,-3)}],{duration:820,easing:'cubic-bezier(.14,.7,.2,1)',fill:'forwards'});
  await hold(scope,260);
  hide(p);hide(c);
  await Promise.all([popFx(scope,'impact_burst','impact',impactX,y,s*1.18),shakeShell(scope,.82)]);
  await hold(scope,180);
  const tangled=pose(scope,'duo_entangled',{x:impactX-25,y,scale:s*1.25,opacity:0});
  const dizzy=anchoredFx(scope,tangled,'HEAD','dizzy_stars','aftermath',{scale:s*.7,opacity:0});
  await Promise.all([
    anim(scope,tangled,[{opacity:0,transform:transform(impactX-25,y-20,s*.9,8)},{opacity:1,offset:.25,transform:transform(impactX-25,y,s*1.28,-4)},{opacity:1,transform:transform(impactX-25,y,s*1.25,2)}],{duration:540,easing:'cubic-bezier(.16,.86,.2,1)',fill:'forwards'}),
    anim(scope,dizzy,[{opacity:0},{opacity:1,offset:.35},{opacity:.9}],{duration:520,fill:'forwards'})
  ]);
  await hold(scope,620);
  await anim(scope,tangled,[{opacity:1},{opacity:0,transform:transform(impactX+120,y+30,s*.95,8)}],{duration:520,fill:'forwards'});
}
async function duoQuietPeekRetreat(scope){
  const r=rect(),s=scaleForStage(),y=r.height*.58;
  const p=pose(scope,'pompon_peek',{x:-120,y,scale:s*1.04,opacity:0});
  const c=pose(scope,'chiru_peek',{x:r.width+120,y:y+8,scale:s*.98,flip:-1,opacity:0});
  await Promise.all([
    anim(scope,p,[{opacity:0,transform:transform(-120,y,s*.86)},{opacity:1,transform:transform(r.width*.18,y,s*1.04)}],{duration:720,easing:'ease-out',fill:'forwards'}),
    anim(scope,c,[{opacity:0,transform:transform(r.width+120,y+8,s*.82,0,-1)},{opacity:1,transform:transform(r.width*.82,y+8,s*.98,0,-1)}],{duration:880,easing:'ease-out',fill:'forwards'})
  ]);
  await hold(scope,560);
  const alert=fx(scope,'exclamation','alert',{x:r.width*.5,y:r.height*.3,scale:s*.7,opacity:0});
  await anim(scope,alert,[{opacity:0,transform:transform(r.width*.5,r.height*.3,s*.3)},{opacity:1,offset:.28,transform:transform(r.width*.5,r.height*.3,s*.75)},{opacity:1,transform:transform(r.width*.5,r.height*.3,s*.68)}],{duration:440,fill:'forwards'});
  await hold(scope,480);
  await Promise.all([
    anim(scope,p,[{opacity:1},{opacity:1,offset:.4,transform:transform(r.width*.1,y,s*.98,-3)},{opacity:0,transform:transform(-140,y,s*.82,-4)}],{duration:980,easing:'ease-in',fill:'forwards'}),
    anim(scope,c,[{opacity:1},{opacity:1,offset:.4,transform:transform(r.width*.9,y+8,s*.92,3,-1)},{opacity:0,transform:transform(r.width+140,y+8,s*.78,4,-1)}],{duration:980,easing:'ease-in',fill:'forwards'}),
    anim(scope,alert,[{opacity:1},{opacity:0}],{duration:420,fill:'forwards'})
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
  const r=rect(),s=scaleForStage(),x=clamp(localX||r.width*.5,120,r.width-120),y=clamp(localY||r.height*.55,130,r.height-130);
  if(kind==='guided'){
    const p=pose(scope,'pompon_dash',{x:x-r.width*.28,y:y+28,scale:s*1.08,opacity:0});
    const e=fx(scope,'speed_lines','movement',{x:x-r.width*.16,y:y+34,scale:s*1.05,opacity:0,layer:'back'});
    await Promise.all([
      anim(scope,p,[
        {opacity:0,transform:transform(x-r.width*.32,y+28,s*.9,-3)},
        {opacity:1,offset:.2,transform:transform(x-r.width*.22,y+24,s*1.06,-1)},
        {opacity:1,offset:.72,transform:transform(x+35,y+8,s*1.1,2)},
        {opacity:0,transform:transform(x+r.width*.34,y-12,s*.96,5)},
      ],{duration:760,easing:'cubic-bezier(.12,.76,.16,1)',fill:'forwards'},'call'),
      anim(scope,e,[
        {opacity:0,transform:transform(x-r.width*.28,y+36,s*.5)},
        {opacity:.92,offset:.34,transform:transform(x-r.width*.08,y+26,s*1.02)},
        {opacity:0,transform:transform(x+r.width*.25,y+4,s*1.32)},
      ],{duration:720,easing:'ease-out',fill:'forwards'},'call')
    ]);
    await hold(scope,220,'call');
  }else if(kind==='hold'){
    const p=pose(scope,'pompon_brake',{x:x-75,y:y+48,scale:s*1.08,opacity:0});
    await anim(scope,p,[
      {opacity:0,transform:transform(x-145,y+48,s*.9,-4)},
      {opacity:1,offset:.2,transform:transform(x-52,y+48,s*1.12,5)},
      {opacity:1,offset:.68,transform:transform(x-84,y+46,s*1.08,-3)},
      {opacity:1,transform:transform(x-72,y+46,s*1.08,0)},
    ],{duration:760,easing:'cubic-bezier(.18,.88,.2,1)',fill:'forwards'},'call');
    await Promise.all([
      popFx(scope,'dust_burst','impact',x-66,y+80,s*.86,0,'call'),
      shakeShell(scope,.5,'call')
    ]);
    await hold(scope,320,'call');
    hide(p);
    const c=pose(scope,'chiru_shocked',{x:x+120,y:y+44,scale:s*.92,opacity:0});
    const alert=anchoredFx(scope,c,'HEAD','alert_red','alert',{dx:42,dy:-20,scale:s*.58,opacity:0});
    await Promise.all([
      anim(scope,c,[
        {opacity:0,transform:transform(x+120,y+72,s*.76)},
        {opacity:1,offset:.24,transform:transform(x+120,y+42,s*.94,-4)},
        {opacity:1,offset:.82,transform:transform(x+120,y+42,s*.92,3)},
        {opacity:0,transform:transform(x+120,y+60,s*.8)},
      ],{duration:840,easing:'ease-out',fill:'forwards'},'call'),
      anim(scope,alert,[{opacity:0},{opacity:1,offset:.3},{opacity:1,offset:.72},{opacity:0}],{duration:700,fill:'forwards'},'call')
    ]);
    await hold(scope,260,'call');
  }else if(kind==='cancel'){
    const p=pose(scope,'pompon_shocked',{x:x-105,y:y+48,scale:s*1.18,opacity:0});
    const alert=anchoredFx(scope,p,'HEAD','exclamation','alert',{dx:48,dy:-24,scale:s*.64,opacity:0});
    await Promise.all([
      anim(scope,p,[
        {opacity:0,transform:transform(x-105,y+82,s*.9,-7)},
        {opacity:1,offset:.22,transform:transform(x-105,y+42,s*1.22,5)},
        {opacity:1,offset:.84,transform:transform(x-105,y+42,s*1.18,-3)},
        {opacity:0,transform:transform(x-140,y+64,s*.96,-8)},
      ],{duration:920,easing:'cubic-bezier(.18,.86,.2,1)',fill:'forwards'},'call'),
      anim(scope,alert,[{opacity:0},{opacity:1,offset:.25},{opacity:1,offset:.7},{opacity:0}],{duration:740,fill:'forwards'},'call')
    ]);
    await hold(scope,360,'call');
  }
}
async function callDelivery(scope,context={}){
  const r=rect(),s=scaleForStage();
  const x=clamp(Number(context.localX)||r.width*.5,160,r.width-160),y=clamp(Number(context.localY)||r.height*.55,160,r.height-160);
  if(M.isReduced())return reducedEvent(scope,'CALL_DELIVERY',{localX:x,localY:y});
  const p=pose(scope,'pompon_dash',{x:-190,y:y+26,scale:s*1.08,opacity:0});
  const speed=fx(scope,'speed_lines','movement',{x:x*.36,y:y+30,scale:s*1.08,opacity:0,layer:'back'});
  await Promise.all([
    anim(scope,p,[
      {opacity:0,transform:transform(-190,y+26,s*.9,-4)},
      {opacity:1,offset:.16,transform:transform(-20,y+24,s*1.05,-1)},
      {opacity:1,offset:.76,transform:transform(x-135,y+12,s*1.12,2)},
      {opacity:1,transform:transform(x-118,y+10,s*1.08,1)},
    ],{duration:560,easing:'cubic-bezier(.1,.78,.18,1)',fill:'forwards'},'call'),
    anim(scope,speed,[
      {opacity:0,transform:transform(0,y+34,s*.45)},
      {opacity:.92,offset:.32,transform:transform(x*.4,y+28,s*1.02)},
      {opacity:0,transform:transform(x-120,y+14,s*1.36)},
    ],{duration:540,easing:'ease-out',fill:'forwards'},'call'),
  ]);
  await hold(scope,140,'call');
  hide(p);
  await Promise.all([
    popFx(scope,'dust_burst','impact',x-58,y+46,s*.92,0,'call'),
    popFx(scope,'impact_burst','impact',x-18,y+6,s*.86,-4,'call')
  ]);
  await hold(scope,220,'call');
  const retortX=x<r.width*.55?clamp(x+225,190,r.width-150):clamp(x-225,150,r.width-190);
  const flip=retortX>x?-1:1;
  const c=pose(scope,'chiru_retort',{x:retortX,y:y+62,scale:s*.92,flip,opacity:0});
  const alert=anchoredFx(scope,c,'HEAD','exclamation','alert',{dx:44,dy:-24,scale:s*.62,opacity:0});
  await Promise.all([
    anim(scope,c,[
      {opacity:0,transform:transform(retortX,y+92,s*.74,0,flip)},
      {opacity:1,offset:.24,transform:transform(retortX,y+60,s*.94,-3,flip)},
      {opacity:1,offset:.82,transform:transform(retortX,y+60,s*.92,3,flip)},
      {opacity:0,transform:transform(retortX,y+84,s*.78,0,flip)},
    ],{duration:880,easing:'ease-out',fill:'forwards'},'call'),
    anim(scope,alert,[{opacity:0},{opacity:1,offset:.28},{opacity:1,offset:.7},{opacity:0}],{duration:760,fill:'forwards'},'call'),
  ]);
  await hold(scope,380,'call');
}

const PLAYERS=Object.freeze({
  POMPON_PEEK:pomponPeek,POMPON_SPARKLE_SMUG:pomponSparkleSmug,POMPON_STAR_SHOCK:pomponStarShock,POMPON_OOPS_QUESTION:pomponOopsQuestion,
  CHIRU_PEEK:chiruPeek,CHIRU_SNEAK:chiruSneak,CHIRU_STAR_DODGE:chiruStarDodge,CHIRU_ALERT_SHOCK:chiruAlertShock,
  POMPON_BRAKE_FAIL:brakeFail,POMPON_SMUG_OOPS:pomponSmugOops,POMPON_STAR_FLYBACK:pomponStarFlyback,
  POMPON_WRONG_WAY_VICTORY:pomponWrongWayVictory,
  DUO_CHASE_CATCH:chaseCatch,PEEK_DISCOVERY:peekDiscovery,DUO_BOAST_DISBELIEF:duoBoastDisbelief,DUO_FAILURE_SCOLD:duoFailureScold,DUO_OH_NO_ESCAPE:duoOhNoEscape,DUO_FRIENDSHIP_OOPS:duoFriendshipOops,
  DUO_RESCUE_RELAY:duoRescueRelay,DUO_QUIET_PEEK_RETREAT:duoQuietPeekRetreat,
  BALL_RIDE_FAIL:ballRideFail,MEGA_SCREEN_TAKEOVER:megaScreenTakeover,MEGA_GREAT_CRASH:megaGreatCrash,CALL_DELIVERY:callDelivery,
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
const SCENE_RECIPES=Object.freeze(Object.fromEntries(EVENTS.map(e=>[e.id,Object.freeze({cast:e.id.startsWith('CHIRU')?['CHIRU']:e.id.startsWith('DUO')||e.id==='PEEK_DISCOVERY'?['POMPON','CHIRU']:['POMPON'],actionZone:e.id.includes('PEEK')?'edges':'full-stage',beats:['anticipation','entrance','action','hold','incident','reaction','aftermath','exit'],anchors:['ENTRY_POINT','TRAIL_ORIGIN','IMPACT','FACE','HEAD'],zOrder:['rear-effect','character','front-effect'],minimumReactionHoldMs:e.category.includes('STORY')?780:520})])));
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,reduced:M.isReduced(),assets:A.diagnostics(),idlePace:IDLE_PACE,sceneRecipeCount:Object.keys(SCENE_RECIPES).length,characterContinuity:'single-instance-per-character'}}
function resetForTest(){cancel('test-reset');diagnostics.played=0;diagnostics.canceled=0;diagnostics.cleanupRuns=0;diagnostics.callPlayed=0;diagnostics.ambientPlayed=0;diagnostics.statusAccents=0;diagnostics.duplicateSuppressions=0;diagnostics.lastEvent=null;diagnostics.history=[]}

window.ASOBOON_BOARD_CHARACTER_EVENTS=Object.freeze({
  version:'4.0.0',events:EVENTS,sceneRecipes:SCENE_RECIPES,play,playRandom,playAmbientEffect,playStatusAccent,playCallDelivery,cancel,isRunning:()=>running,
  getDiagnostics,resetForTest,playEventForTest:async id=>play(id,{grid:document.getElementById('queueGrid')}),
});
})();
