(()=>{'use strict';
const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!M||!A)return;

let currentScope=null,running=false,currentId='';
const diagnostics={played:0,canceled:0,statusPlayed:0,cleanupRuns:0,lastEvent:null,history:[]};
const MICRO_EVENTS=Object.freeze(['FX_SPEED_PASS','FX_DUST_BOUNCE','FX_SPARKLE_SWEEP','FX_OFFSCREEN_BONK','FX_STAR_POP']);

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function boardRect(){const r=document.querySelector('.board')?.getBoundingClientRect?.();return r||{left:0,top:0,width:innerWidth,height:innerHeight,right:innerWidth,bottom:innerHeight}}
function t(x,y,s=1,r=0,flip=1){return 'translate3d('+(x-128)+'px,'+(y-128)+'px,0) rotate('+r+'deg) scale('+(s*flip)+','+s+')'}
function add(scope,name,{x=0,y=0,scale=1,rotate=0,flip=1,opacity=1,layer='front'}={}){
  const el=A.createEffect(name); if(!el)return null;
  el.style.opacity=String(opacity);el.style.transform=t(x,y,scale,rotate,flip);
  return scope.add(el,layer);
}
async function pop(scope,name,x,y,scale=1,rotate=0,duration=420){
  const el=add(scope,name,{x,y,scale:scale*.5,rotate,opacity:0}); if(!el)return;
  await scope.animate(el,[
    {opacity:0,transform:t(x,y,scale*.38,rotate)},
    {opacity:1,offset:.34,transform:t(x,y,scale*1.15,rotate)},
    {opacity:.95,offset:.68,transform:t(x,y,scale,rotate)},
    {opacity:0,transform:t(x,y,scale*1.08,rotate)}
  ],{duration,easing:'cubic-bezier(.18,.86,.2,1)',fill:'forwards'});
}
async function speedPass(scope){
  const r=boardRect(),left=Math.random()<.5,y=r.height*(.32+Math.random()*.42);
  const start=left?-180:r.width+180,end=left?r.width+180:-180,flip=left?1:-1;
  const mid1=left?r.width*.35:r.width*.65,mid2=left?r.width*.7:r.width*.3,dustMid=left?r.width*.42:r.width*.58;
  const line=add(scope,'speed_lines',{x:start,y,scale:1.2,flip,opacity:0,layer:'back'});
  const dust=add(scope,'dust_streak',{x:start,y:y+55,scale:.72,flip,opacity:0});
  await Promise.all([
    line?scope.animate(line,[{opacity:0,transform:t(start,y,.8,0,flip)},{opacity:.95,offset:.2,transform:t(mid1,y,1.28,0,flip)},{opacity:.7,offset:.75,transform:t(mid2,y,1.15,0,flip)},{opacity:0,transform:t(end,y,.8,0,flip)}],{duration:740,easing:'cubic-bezier(.14,.72,.18,1)',fill:'forwards'}):Promise.resolve(),
    dust?scope.animate(dust,[{opacity:0,transform:t(start,y+55,.45,0,flip)},{opacity:.85,offset:.32,transform:t(dustMid,y+55,.78,0,flip)},{opacity:0,transform:t(end,y+48,1.02,0,flip)}],{duration:780,easing:'ease-out',fill:'forwards'}):Promise.resolve()
  ]);
}
async function dustBounce(scope){
  const r=boardRect(),fromLeft=Math.random()<.5,x=fromLeft?r.width*.18:r.width*.82,y=r.height*.68,flip=fromLeft?1:-1;
  const dust=add(scope,'dust_burst',{x,y,scale:.72,opacity:0});
  const arc=add(scope,'jump_arc',{x:fromLeft?r.width*.36:r.width*.64,y:y-120,scale:.9,flip,opacity:0});
  await Promise.all([
    dust?scope.animate(dust,[{opacity:0,transform:t(x,y,.35)},{opacity:.9,offset:.34,transform:t(x,y,.82)},{opacity:0,transform:t(x,y,1.1)}],{duration:620,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
    arc?scope.animate(arc,[{opacity:0,transform:t(fromLeft?r.width*.25:r.width*.75,y-100,.65,0,flip)},{opacity:.9,offset:.35,transform:t(r.width*.5,y-155,.95,0,flip)},{opacity:0,transform:t(fromLeft?r.width*.75:r.width*.25,y-100,.82,0,flip)}],{duration:900,easing:'ease-in-out',fill:'forwards'}):Promise.resolve()
  ]);
}
async function sparkleSweep(scope){
  const r=boardRect(),spots=[[.22,.34,'magic_sparkle'],[.52,.48,'sparkle_gold'],[.78,.3,'magic_star']];
  await Promise.all(spots.map(([px,py,name],i)=>{
    const x=r.width*px,y=r.height*py,el=add(scope,name,{x,y,scale:.42+i*.08,opacity:0});
    return el?scope.animate(el,[{opacity:0,transform:t(x,y+14,.24)},{opacity:.95,offset:.3,transform:t(x,y,.58+i*.08)},{opacity:.8,offset:.68,transform:t(x+12,y-8,.52+i*.07,8)},{opacity:0,transform:t(x+24,y-20,.38,15)}],{duration:820,delay:i*120,easing:'ease-out',fill:'forwards'}):Promise.resolve();
  }));
}
async function offscreenBonk(scope){
  const r=boardRect(),right=Math.random()<.5,y=r.height*(.42+Math.random()*.28),edge=right?r.width-12:12,flip=right?1:-1;
  const slash=add(scope,'speed_slash',{x:right?r.width*.3:r.width*.7,y,scale:.8,flip,opacity:0});
  if(slash)await scope.animate(slash,[{opacity:0,transform:t(right?-100:r.width+100,y,.45,0,flip)},{opacity:.9,offset:.2,transform:t(right?r.width*.35:r.width*.65,y,.95,0,flip)},{opacity:0,transform:t(edge,y,.72,0,flip)}],{duration:480,easing:'cubic-bezier(.1,.8,.18,1)',fill:'forwards'});
  await scope.wait(120);
  await Promise.all([pop(scope,'impact_starburst',edge,y,1.02,right?-8:8,420),pop(scope,'dust_impact',edge,y+55,.72,0,500)]);
}
async function starPop(scope){
  const r=boardRect(),x=r.width*(.25+Math.random()*.5),y=r.height*(.3+Math.random()*.35);
  await Promise.all([pop(scope,'comic_star',x,y,.7,-8,600),pop(scope,'magic_star',x+70,y-45,.52,7,720),pop(scope,'sparkle_gold',x-65,y+35,.45,0,680)]);
}
const PLAYERS={FX_SPEED_PASS:speedPass,FX_DUST_BOUNCE:dustBounce,FX_SPARKLE_SWEEP:sparkleSweep,FX_OFFSCREEN_BONK:offscreenBonk,FX_STAR_POP:starPop};

async function play(id){
  if(running)return{played:false,reason:'busy'};
  const fn=PLAYERS[id];if(!fn)return{played:false,reason:'unknown'};
  const scope=M.createScope('sourcefx:'+id,1.25);currentScope=scope;running=true;currentId=id;
  diagnostics.played++;diagnostics.lastEvent={id,at:Date.now()};diagnostics.history.push({...diagnostics.lastEvent});diagnostics.history=diagnostics.history.slice(-40);
  try{await A.preloadEffects();if(scope.signal.aborted)return{played:false,reason:'aborted'};await fn(scope);return{played:true,id}}
  catch{return{played:false,reason:scope.signal.aborted?'aborted':'error',id}}
  finally{scope.cleanup();if(currentScope===scope){currentScope=null;running=false;currentId=''}diagnostics.cleanupRuns++}
}
async function playRandom({recent=[]}={}){
  const blocked=new Set(recent);let list=MICRO_EVENTS.filter(x=>!blocked.has(x));if(!list.length)list=[...MICRO_EVENTS];
  return play(list[Math.floor(Math.random()*list.length)]);
}
function cancel(reason='manual'){if(!currentScope)return false;diagnostics.canceled++;const s=currentScope;currentScope=null;running=false;currentId='';s.abort(reason);return true}
function localPoint(rect){const b=boardRect();return{x:rect?rect.left-b.left+rect.width/2:b.width*.5,y:rect?rect.top-b.top+rect.height/2:b.height*.5}}
async function playStatusReaction(kind,{rect}={}){
  const scope=M.createScope('sourcefx-status:'+kind,kind==='call'?1:1.1);diagnostics.statusPlayed++;
  const p=localPoint(rect),x=p.x,y=p.y;
  try{
    if(kind==='call')await Promise.all([pop(scope,'impact_starburst',x,y,1.05,0,520),pop(scope,'exclamation',x+95,y-90,.55,4,580),pop(scope,'dust_burst',x-65,y+70,.62,0,560)]);
    else if(kind==='guided'){
      const line=add(scope,'speed_lines',{x,y,scale:.9,opacity:0});
      if(line)await scope.animate(line,[{opacity:0,transform:t(x-40,y,.55)},{opacity:.9,offset:.25,transform:t(x+60,y,.95)},{opacity:0,transform:t(x+360,y,.72)}],{duration:620,easing:'cubic-bezier(.12,.78,.18,1)',fill:'forwards'});
    }else if(kind==='hold')await Promise.all([pop(scope,'dust_burst',x,y+55,.62,0,520),pop(scope,'alert_red',x+80,y-80,.48,0,540)]);
    else if(kind==='cancel')await Promise.all([pop(scope,'impact_burst',x,y,.82,0,520),pop(scope,'comic_star',x+75,y-55,.5,8,560)]);
  }finally{scope.cleanup()}
}
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,events:[...MICRO_EVENTS],sourcePolicy:'effects_pack_v2-only'}}
function resetForTest(){cancel('test-reset');diagnostics.played=0;diagnostics.canceled=0;diagnostics.statusPlayed=0;diagnostics.cleanupRuns=0;diagnostics.lastEvent=null;diagnostics.history=[]}

window.ASOBOON_BOARD_SOURCE_EFFECTS=Object.freeze({version:'1.0.0',events:MICRO_EVENTS,play,playRandom,playStatusReaction,cancel,isRunning:()=>running,getDiagnostics,resetForTest});
})();