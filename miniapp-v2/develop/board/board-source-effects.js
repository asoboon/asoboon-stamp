(()=>{'use strict';
const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!M||!A)return;

const PACE=1.35;
let currentScope=null,running=false,currentId='';
const diagnostics={played:0,canceled:0,statusPlayed:0,cleanupRuns:0,lastEvent:null,history:[]};
const MICRO_EVENTS=Object.freeze(['FX_MAGIC_STAR_PASS','FX_SPARKLE_SWEEP','FX_CARD_GLINT','FX_SPEED_PASS','FX_DUST_GUST','FX_MAGIC_TRAIL']);

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function ms(v){return Math.round(Number(v||0)*PACE)}
function boardRect(){const r=document.querySelector('.board')?.getBoundingClientRect?.();return r||{left:0,top:0,width:innerWidth,height:innerHeight,right:innerWidth,bottom:innerHeight}}
function t(x,y,s=1,r=0,flip=1){return 'translate3d('+(x-128)+'px,'+(y-128)+'px,0) rotate('+r+'deg) scale('+(s*flip)+','+s+')'}
function add(scope,name,semantic,{x=0,y=0,scale=1,rotate=0,flip=1,opacity=1,layer='front'}={}){
  if(semantic&&!A.validatePairing?.(name,semantic))return null;
  const el=A.createEffect(name);if(!el)return null;
  el.style.opacity=String(opacity);el.style.transform=t(x,y,scale,rotate,flip);
  return scope.add(el,layer);
}
function anim(scope,el,keyframes,options={}){
  if(!el)return Promise.resolve();
  const opts={...options};
  if(Number.isFinite(Number(opts.duration)))opts.duration=ms(opts.duration);
  if(Number.isFinite(Number(opts.delay)))opts.delay=ms(opts.delay);
  return scope.animate(el,keyframes,opts);
}
async function pop(scope,name,semantic,x,y,scale=1,rotate=0,duration=520){
  const el=add(scope,name,semantic,{x,y,scale:scale*.5,rotate,opacity:0});if(!el)return;
  await anim(scope,el,[
    {opacity:0,transform:t(x,y,scale*.38,rotate)},
    {opacity:1,offset:.34,transform:t(x,y,scale*1.12,rotate)},
    {opacity:.94,offset:.68,transform:t(x,y,scale,rotate)},
    {opacity:0,transform:t(x,y,scale*1.06,rotate)}
  ],{duration,easing:'cubic-bezier(.18,.86,.2,1)',fill:'forwards'});
}

async function magicStarPass(scope){
  const r=boardRect(),fromLeft=Math.random()<.5,y=r.height*(.23+Math.random()*.18),start=fromLeft?-90:r.width+90,end=fromLeft?r.width+90:-90,flip=fromLeft?1:-1;
  const star=add(scope,'magic_star','ambient',{x:start,y,scale:.46,flip,opacity:0});
  await anim(scope,star,[
    {opacity:0,transform:t(start,y,.34,-6,flip)},
    {opacity:.95,offset:.24,transform:t(fromLeft?r.width*.22:r.width*.78,y-8,.52,4,flip)},
    {opacity:.84,offset:.72,transform:t(fromLeft?r.width*.72:r.width*.28,y+8,.48,-3,flip)},
    {opacity:0,transform:t(end,y-4,.36,7,flip)}
  ],{duration:1150,easing:'cubic-bezier(.2,.62,.2,1)',fill:'forwards'});
}
async function sparkleSweep(scope){
  const r=boardRect(),spots=[[.25,.3,'magic_sparkle'],[.54,.42,'sparkle_gold'],[.8,.28,'magic_sparkle']];
  await Promise.all(spots.map(([px,py,name],i)=>{
    const x=r.width*px,y=r.height*py,el=add(scope,name,'ambient',{x,y,scale:.42+i*.06,opacity:0});
    return anim(scope,el,[
      {opacity:0,transform:t(x,y+12,.24)},
      {opacity:.95,offset:.32,transform:t(x,y,.56+i*.06)},
      {opacity:.78,offset:.7,transform:t(x+10,y-7,.5+i*.05,7)},
      {opacity:0,transform:t(x+20,y-16,.34,13)}
    ],{duration:760,delay:i*120,easing:'ease-out',fill:'forwards'});
  }));
}
async function cardGlint(scope){
  const r=boardRect(),cards=[...document.querySelectorAll('.queue-card')],card=cards.length?cards[Math.floor(Math.random()*cards.length)]:null,cr=card?.getBoundingClientRect?.();
  const x=cr?cr.left-r.left+cr.width*.78:r.width*.68,y=cr?cr.top-r.top+cr.height*.24:r.height*.42;
  const e=add(scope,'sparkle_gold','ambient',{x,y,scale:.5,opacity:0});
  await anim(scope,e,[
    {opacity:0,transform:t(x,y,.26,-5)},
    {opacity:1,offset:.32,transform:t(x,y,.6,2)},
    {opacity:.8,offset:.68,transform:t(x+4,y-4,.52,7)},
    {opacity:0,transform:t(x+8,y-10,.34,12)}
  ],{duration:720,easing:'ease-out',fill:'forwards'});
}
async function speedPass(scope){
  const r=boardRect(),fromLeft=Math.random()<.5,y=r.height*(.73+Math.random()*.08),start=fromLeft?-100:r.width+100,end=fromLeft?r.width+100:-100,flip=fromLeft?1:-1;
  const line=add(scope,'speed_lines','ambient',{x:start,y,scale:.72,flip,opacity:0,layer:'back'});
  await anim(scope,line,[
    {opacity:0,transform:t(start,y,.45,0,flip)},
    {opacity:.82,offset:.28,transform:t(fromLeft?r.width*.28:r.width*.72,y,.78,0,flip)},
    {opacity:.72,offset:.72,transform:t(fromLeft?r.width*.72:r.width*.28,y-4,.72,0,flip)},
    {opacity:0,transform:t(end,y-6,.52,0,flip)}
  ],{duration:820,easing:'cubic-bezier(.14,.68,.2,1)',fill:'forwards'});
}

async function dustGust(scope){
  const r=boardRect(),fromLeft=Math.random()<.5,y=r.height*.79,start=fromLeft?-90:r.width+90,end=fromLeft?r.width+90:-90,flip=fromLeft?1:-1;
  const dust=add(scope,'dust_streak','ambient',{x:start,y,scale:.62,flip,opacity:0,layer:'back'});
  await anim(scope,dust,[
    {opacity:0,transform:t(start,y,.38,0,flip)},
    {opacity:.72,offset:.28,transform:t(fromLeft?r.width*.28:r.width*.72,y-4,.7,0,flip)},
    {opacity:.62,offset:.72,transform:t(fromLeft?r.width*.72:r.width*.28,y+2,.68,0,flip)},
    {opacity:0,transform:t(end,y-2,.44,0,flip)}
  ],{duration:980,easing:'cubic-bezier(.18,.62,.2,1)',fill:'forwards'});
}
async function magicTrail(scope){
  const r=boardRect(),fromLeft=Math.random()<.5,startX=fromLeft?-70:r.width+70,endX=fromLeft?r.width+70:-70,flip=fromLeft?1:-1;
  const points=[[0,.34],[.5,.28],[1,.4]];
  await Promise.all(points.map(([p,py],i)=>{
    const x=startX+(endX-startX)*p,y=r.height*py;
    const e=add(scope,'magic_sparkle','ambient',{x,y,scale:.38+i*.05,flip,opacity:0});
    return anim(scope,e,[
      {opacity:0,transform:t(x,y+8,.2,0,flip)},
      {opacity:.95,offset:.34,transform:t(x,y,.5+i*.06,4,flip)},
      {opacity:.7,offset:.72,transform:t(x+(fromLeft?20:-20),y-8,.44+i*.05,8,flip)},
      {opacity:0,transform:t(x+(fromLeft?35:-35),y-14,.3,12,flip)}
    ],{duration:760,delay:i*120,easing:'ease-out',fill:'forwards'});
  }));
}
const PLAYERS=Object.freeze({FX_MAGIC_STAR_PASS:magicStarPass,FX_SPARKLE_SWEEP:sparkleSweep,FX_CARD_GLINT:cardGlint,FX_SPEED_PASS:speedPass,FX_DUST_GUST:dustGust,FX_MAGIC_TRAIL:magicTrail});

async function play(id){
  if(running)return{played:false,reason:'busy'};
  const fn=PLAYERS[String(id||'')];if(!fn)return{played:false,reason:'unknown'};
  const scope=M.createScope('sourcefx:'+id);currentScope=scope;running=true;currentId=id;
  diagnostics.played++;diagnostics.lastEvent={id,at:Date.now()};diagnostics.history.push({...diagnostics.lastEvent});diagnostics.history=diagnostics.history.slice(-40);
  try{await A.preloadEffects();if(scope.signal.aborted)return{played:false,reason:'aborted'};await fn(scope);return{played:true,id}}
  catch{return{played:false,reason:scope.signal.aborted?'aborted':'error',id}}
  finally{scope.cleanup();if(currentScope===scope){currentScope=null;running=false;currentId=''}diagnostics.cleanupRuns++}
}
async function playRandom({recent=[]}={}){
  const blocked=new Set(recent),fresh=MICRO_EVENTS.filter(x=>!blocked.has(x)),list=fresh.length?fresh:[...MICRO_EVENTS];
  return play(list[Math.floor(Math.random()*list.length)]);
}
function cancel(reason='manual'){if(!currentScope)return false;diagnostics.canceled++;const s=currentScope;currentScope=null;running=false;currentId='';s.abort(reason);return true}
function localPoint(rect){const b=boardRect();return{x:rect?rect.left-b.left+rect.width/2:b.width*.5,y:rect?rect.top-b.top+rect.height/2:b.height*.5}}

async function playStatusReaction(kind,{rect}={}){
  const scope=M.createScope('sourcefx-status:'+kind);diagnostics.statusPlayed++;
  const p=localPoint(rect),x=p.x,y=p.y;
  try{
    if(kind==='call'){
      await Promise.all([pop(scope,'dust_burst','impact',x-70,y+55,.58,0,440),pop(scope,'exclamation','alert',x+85,y-85,.48,3,500)]);
    }else if(kind==='guided'){
      const line=add(scope,'speed_lines','movement',{x,y,scale:.78,opacity:0});
      await anim(scope,line,[{opacity:0,transform:t(x-40,y,.46)},{opacity:.88,offset:.28,transform:t(x+55,y,.82)},{opacity:0,transform:t(x+320,y-6,.62)}],{duration:520,easing:'cubic-bezier(.12,.74,.18,1)',fill:'forwards'});
    }else if(kind==='hold'){
      await Promise.all([pop(scope,'dust_burst','impact',x-20,y+45,.56,0,460),pop(scope,'alert_red','alert',x+78,y-80,.42,0,480)]);
    }else if(kind==='cancel'){
      await Promise.all([pop(scope,'impact_burst','impact',x,y,.72,0,480),pop(scope,'comic_star','impact',x+68,y-50,.42,7,500)]);
    }
  }finally{scope.cleanup()}
}
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,events:[...MICRO_EVENTS],pace:PACE,sourcePolicy:'effects_pack_v2-only',semanticPolicy:'context-matched-only'}}
function resetForTest(){cancel('test-reset');diagnostics.played=0;diagnostics.canceled=0;diagnostics.statusPlayed=0;diagnostics.cleanupRuns=0;diagnostics.lastEvent=null;diagnostics.history=[]}

window.ASOBOON_BOARD_SOURCE_EFFECTS=Object.freeze({version:'3.0.0',events:MICRO_EVENTS,play,playRandom,playStatusReaction,cancel,isRunning:()=>running,getDiagnostics,resetForTest});
})();