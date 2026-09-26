(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const A=window.ASOBOON_BOARD_FOURTH_WALL_ASSETS;
if(!M||!A)return;

const MICRO_EVENTS=Object.freeze([
  Object.freeze({id:'FW_CRACK_CENTER',category:'FOURTH_WALL_MICRO',story:'中央に一瞬ヒビが走る'}),
  Object.freeze({id:'FW_CRACK_CORNER',category:'FOURTH_WALL_MICRO',story:'画面端からヒビが侵入する'}),
  Object.freeze({id:'FW_CRACK_CHAIN',category:'FOURTH_WALL_MICRO',story:'2か所へヒビが連鎖する'}),
  Object.freeze({id:'FW_FRAME_PULSE',category:'FOURTH_WALL_MICRO',story:'画面が一瞬だけ破れそうになる'}),
  Object.freeze({id:'FW_SHARD_BURST',category:'FOURTH_WALL_MICRO',story:'前景へ大きな破片が飛び出す'}),
  Object.freeze({id:'FW_FALSE_BREAK',category:'FOURTH_WALL_MICRO',story:'割れたと思わせて何も出てこない'}),
]);
const STORY_EVENTS=Object.freeze([
  Object.freeze({id:'FW_POMPON_PAW',category:'FOURTH_WALL_STORY',family:'pompon',asset:1,story:'巨大な肉球からPOMPONが押し出してくる'}),
  Object.freeze({id:'FW_POMPON_FEET_FIRST',category:'FOURTH_WALL_STORY',family:'pompon',asset:2,story:'POMPONが足から画面を突き破る'}),
  Object.freeze({id:'FW_POMPON_FACE_POP',category:'FOURTH_WALL_STORY',family:'pompon',asset:3,story:'POMPONが穴から顔を出してくる'}),
  Object.freeze({id:'FW_POMPON_SIDE_BREAK',category:'FOURTH_WALL_STORY',family:'pompon',asset:4,story:'POMPONが横から画面をこじ開ける'}),
  Object.freeze({id:'FW_POMPON_UPSIDE_DOWN',category:'FOURTH_WALL_STORY',family:'pompon',asset:5,story:'POMPONが逆さまで画面から飛び出す'}),
  Object.freeze({id:'FW_POMPON_LOW_PEEK',category:'FOURTH_WALL_STORY',family:'pompon',asset:6,story:'POMPONが下側の破れ目からこちらを見る'}),
  Object.freeze({id:'FW_CHIRU_REACH_OUT',category:'FOURTH_WALL_STORY',family:'duo',asset:1,story:'CHIRUが画面の外へ手を伸ばしてくる'}),
  Object.freeze({id:'FW_CHIRU_BREAKOUT',category:'FOURTH_WALL_STORY',family:'duo',asset:2,story:'CHIRUが破れ目からこちらへ飛び出す'}),
  Object.freeze({id:'FW_CHIRU_LOW_BREAK',category:'FOURTH_WALL_STORY',family:'duo',asset:3,story:'CHIRUが低い位置から画面を突破する'}),
  Object.freeze({id:'FW_DUO_RACE_OUT',category:'FOURTH_WALL_STORY',family:'duo',asset:4,story:'POMPONとCHIRUが一緒に突破してくる'}),
  Object.freeze({id:'FW_DUO_SHARED_BREAK',category:'FOURTH_WALL_STORY',family:'duo',asset:5,story:'2人で同じ破れ目から顔を出す'}),
  Object.freeze({id:'FW_DUO_SIDE_BY_SIDE',category:'FOURTH_WALL_STORY',family:'duo',asset:6,story:'2人並んで画面の外へ身を乗り出す'}),
  Object.freeze({id:'FW_KNOCK_KNOCK_POMPON',category:'FOURTH_WALL_STORY',family:'pompon',asset:3,special:'knock',story:'内側から二度ノック→静寂→POMPONの巨大な顔が飛び出す'}),
  Object.freeze({id:'FW_REPAIR_REBREAK_DUO',category:'FOURTH_WALL_STORY',family:'duo',asset:5,special:'rebreak',story:'割れ目が直ったと思わせる→間を置いて2人がもう一度破る'}),
]);
const EVENTS=Object.freeze([...MICRO_EVENTS,...STORY_EVENTS]);

const GROUPS=Object.freeze({
  crackCenter:Object.freeze([1,2,4,9,10,12]),
  crackCorner:Object.freeze([5,6,7,8]),
  crackDiagonal:Object.freeze([3,4]),
  crackWide:Object.freeze([10,11,12]),
  frameCenter:Object.freeze([1,2,3,4,8]),
  frameVertical:Object.freeze([5,7]),
  frameHorizontal:Object.freeze([6]),
  frameLeft:Object.freeze([9]),
  frameRight:Object.freeze([10]),
  frameBottom:Object.freeze([11]),
  frameTop:Object.freeze([12]),
  impactHard:Object.freeze([1,2,3,9,12,16,20]),
  impactDust:Object.freeze([6,7,13,15,23]),
  impactMotion:Object.freeze([4,11,14,17,21]),
  impactStars:Object.freeze([5,10,18,24]),
  impactEnergy:Object.freeze([8,19,22]),
  shards:Object.freeze(Array.from({length:20},(_,i)=>i+1)),
});
const variantBags=new Map();
let currentScope=null,running=false,currentId='';
const diagnostics={played:0,canceled:0,microPlayed:0,storyPlayed:0,cleanupRuns:0,lastEvent:null,history:[]};

function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function nextVariant(key,list){
  let bag=variantBags.get(key);
  if(!Array.isArray(bag)||!bag.length){bag=shuffle(list);variantBags.set(key,bag)}
  return bag.shift();
}
function boardRect(){const r=document.querySelector('.board')?.getBoundingClientRect?.();return r||{left:0,top:0,width:innerWidth,height:innerHeight}}
function boardScale(){const r=boardRect();return Math.max(.72,Math.min(1.3,Math.min(r.width/1080,r.height/1000)))}
function sizeOf(el){return{w:Number(el?.dataset?.fwW)||256,h:Number(el?.dataset?.fwH)||256}}
function tr(el,x,y,scale=1,rotate=0,flip=1){
  const {w,h}=sizeOf(el);return 'translate3d('+(x-w/2)+'px,'+(y-h/2)+'px,0) rotate('+rotate+'deg) scale('+(scale*flip)+','+scale+')';
}
function sprite(scope,family,id,className,{x,y,scale=1,rotate=0,flip=1,opacity=1}={}){
  const el=A.create(family,id,className);if(!el)return null;
  el.style.opacity=String(opacity);el.style.transform=tr(el,x,y,scale,rotate,flip);
  return scope.add(el,'front');
}
function animate(scope,el,keyframes,options={}){return el?scope.animate(el,keyframes,options):Promise.resolve()}
function wait(scope,ms){return scope.wait(ms)}
function quality(){return String(M.diagnostics?.().effectiveQuality||'HIGH').toUpperCase()}
function chooseAnchor(kind='center'){
  const r=boardRect();
  const map={
    center:[r.width*.5,r.height*.52],
    left:[r.width*.18,r.height*.55],
    right:[r.width*.82,r.height*.55],
    top:[r.width*.5,r.height*.2],
    bottom:[r.width*.5,r.height*.78],
    upperLeft:[r.width*.2,r.height*.25],
    lowerRight:[r.width*.8,r.height*.75],
  };
  return map[kind]||map.center;
}
function groupForStory(id){
  switch(id){
    case'FW_POMPON_SIDE_BREAK':return{anchor:'left',cracks:'crackCorner',frames:'frameLeft',impact:'impactHard',scale:1.02,rotate:-4};
    case'FW_POMPON_UPSIDE_DOWN':return{anchor:'top',cracks:'crackWide',frames:'frameTop',impact:'impactMotion',scale:1.02,rotate:0};
    case'FW_POMPON_LOW_PEEK':return{anchor:'bottom',cracks:'crackWide',frames:'frameBottom',impact:'impactDust',scale:.98,rotate:0};
    case'FW_CHIRU_REACH_OUT':return{anchor:'left',cracks:'crackCorner',frames:'frameLeft',impact:'impactStars',scale:.92,rotate:-2};
    case'FW_CHIRU_BREAKOUT':return{anchor:'right',cracks:'crackCorner',frames:'frameRight',impact:'impactHard',scale:.94,rotate:2};
    case'FW_CHIRU_LOW_BREAK':return{anchor:'bottom',cracks:'crackWide',frames:'frameBottom',impact:'impactDust',scale:.92,rotate:0};
    case'FW_DUO_RACE_OUT':return{anchor:'left',cracks:'crackDiagonal',frames:'frameHorizontal',impact:'impactMotion',scale:1.0,rotate:-3};
    case'FW_DUO_SHARED_BREAK':return{anchor:'center',cracks:'crackCenter',frames:'frameCenter',impact:'impactStars',scale:1.0,rotate:0};
    case'FW_DUO_SIDE_BY_SIDE':return{anchor:'center',cracks:'crackCenter',frames:'frameCenter',impact:'impactEnergy',scale:1.0,rotate:0};
    case'FW_POMPON_FEET_FIRST':return{anchor:'center',cracks:'crackCenter',frames:'frameCenter',impact:'impactHard',scale:1.05,rotate:2};
    case'FW_POMPON_FACE_POP':return{anchor:'center',cracks:'crackCenter',frames:'frameCenter',impact:'impactStars',scale:1.02,rotate:0};
    default:return{anchor:'center',cracks:'crackCenter',frames:'frameCenter',impact:'impactHard',scale:1.05,rotate:0};
  }
}
async function shake(scope,strength=.55){
  if(M.isReduced?.())return;
  const board=document.querySelector('.board');if(!board)return;
  const p=Math.max(2,Math.round(5*strength));
  await animate(scope,board,[
    {transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-p)+'px,1px,0)'},{transform:'translate3d('+p+'px,-1px,0)'},{transform:'translate3d(0,0,0)'}
  ],{duration:135,easing:'linear'});
}
async function reducedStory(scope,event){
  const cfg=groupForStory(event.id),[x,y]=chooseAnchor(cfg.anchor),s=boardScale();
  const frameId=nextVariant(cfg.frames,GROUPS[cfg.frames]);
  const character=sprite(scope,event.family,event.asset,'fw-character',{x,y,scale:s*.72,opacity:0});
  const frame=sprite(scope,'frames',frameId,'fw-frame-front',{x,y,scale:s*.78,opacity:0});
  await Promise.all([
    animate(scope,frame,[{opacity:0,transform:tr(frame,x,y,s*.68)},{opacity:.88,offset:.35,transform:tr(frame,x,y,s*.8)},{opacity:0,transform:tr(frame,x,y,s*.82)}],{duration:680,easing:'ease-out',fill:'forwards'}),
    animate(scope,character,[{opacity:0,transform:tr(character,x,y+14,s*.64,cfg.rotate)},{opacity:1,offset:.35,transform:tr(character,x,y,s*.78,cfg.rotate)},{opacity:1,offset:.72,transform:tr(character,x,y,s*.78,cfg.rotate)},{opacity:0,transform:tr(character,x,y+8,s*.68,cfg.rotate)}],{duration:720,easing:'ease-out',fill:'forwards'})
  ]);
}
async function breakoutStory(scope,event){
  const cfg=groupForStory(event.id),[x,y]=chooseAnchor(cfg.anchor),s=boardScale()*cfg.scale;
  await A.preloadFamilies(['cracks','frames','shards','impacts',event.family]);
  if(scope.signal.aborted)return;
  if(M.isReduced?.())return reducedStory(scope,event);

  const crackId=nextVariant(cfg.cracks,GROUPS[cfg.cracks]);
  const frameId=nextVariant(cfg.frames,GROUPS[cfg.frames]);
  const impactId=nextVariant(cfg.impact,GROUPS[cfg.impact]);
  const crack=sprite(scope,'cracks',crackId,'fw-crack',{x,y,scale:s*.72,opacity:0});
  const frameBack=sprite(scope,'frames',frameId,'fw-frame-back',{x,y,scale:s*.66,opacity:0});
  const character=sprite(scope,event.family,event.asset,'fw-character',{x,y:y+18,scale:s*.64,rotate:cfg.rotate,opacity:0});
  const frameFront=sprite(scope,'frames',frameId,'fw-frame-front',{x,y,scale:s*.66,opacity:0});
  const impact=sprite(scope,'impacts',impactId,'fw-impact',{x,y,scale:s*.35,opacity:0});
  const shardCount=quality()==='LOW'?1:2;
  const shards=[];
  for(let i=0;i<shardCount;i++){
    const sid=nextVariant('shards',GROUPS.shards);
    const shard=sprite(scope,'shards',sid,'fw-shard',{x,y,scale:s*(i? .42:.52),rotate:(i?18:-14),opacity:0});
    if(shard)shards.push(shard);
  }

  await wait(scope,420);
  await animate(scope,crack,[
    {opacity:0,transform:tr(crack,x,y,s*.35,cfg.rotate)},
    {opacity:1,offset:.4,transform:tr(crack,x,y,s*.78,cfg.rotate)},
    {opacity:.92,transform:tr(crack,x,y,s*.72,cfg.rotate)}
  ],{duration:520,easing:'cubic-bezier(.16,.82,.2,1)',fill:'forwards'});

  await wait(scope,420);

  await Promise.all([
    animate(scope,frameBack,[
      {opacity:0,transform:tr(frameBack,x,y,s*.42,cfg.rotate)},
      {opacity:1,offset:.42,transform:tr(frameBack,x,y,s*.92,cfg.rotate)},
      {opacity:.96,transform:tr(frameBack,x,y,s*.84,cfg.rotate)}
    ],{duration:520,easing:'cubic-bezier(.16,.9,.2,1)',fill:'forwards'}),
    animate(scope,frameFront,[
      {opacity:0,transform:tr(frameFront,x,y,s*.42,cfg.rotate)},
      {opacity:1,offset:.42,transform:tr(frameFront,x,y,s*.92,cfg.rotate)},
      {opacity:.98,transform:tr(frameFront,x,y,s*.84,cfg.rotate)}
    ],{duration:520,easing:'cubic-bezier(.16,.9,.2,1)',fill:'forwards'}),
    animate(scope,impact,[
      {opacity:0,transform:tr(impact,x,y,s*.22,cfg.rotate)},
      {opacity:1,offset:.35,transform:tr(impact,x,y,s*.78,cfg.rotate)},
      {opacity:0,transform:tr(impact,x,y,s*.92,cfg.rotate)}
    ],{duration:420,easing:'ease-out',fill:'forwards'}),
    shake(scope,.65)
  ]);
  await wait(scope,260);

  const shardJobs=shards.map((shard,i)=>{
    const sx=i%2===0?-1:1,sy=i===0?-1:1;
    return animate(scope,shard,[
      {opacity:0,transform:tr(shard,x,y,s*.22,(i?18:-14))},
      {opacity:1,offset:.26,transform:tr(shard,x+sx*70,y+sy*55,s*(i?.58:.7),(i?30:-26))},
      {opacity:0,transform:tr(shard,x+sx*180,y+sy*145,s*(i?.72:.84),(i?58:-52))}
    ],{duration:440,easing:'cubic-bezier(.16,.72,.2,1)',fill:'forwards'});
  });
  await Promise.all([
    ...shardJobs,
    animate(scope,character,[
      {opacity:0,transform:tr(character,x,y+30,s*.55,cfg.rotate)},
      {opacity:1,offset:.28,transform:tr(character,x,y-4,s*1.02,cfg.rotate)},
      {opacity:1,offset:.62,transform:tr(character,x,y,s*.94,cfg.rotate)},
      {opacity:1,transform:tr(character,x,y,s*.96,cfg.rotate)}
    ],{duration:900,easing:'cubic-bezier(.14,.82,.18,1)',fill:'forwards'})
  ]);
  await wait(scope,1250);
  await Promise.all([
    animate(scope,character,[
      {opacity:1,transform:tr(character,x,y,s*.96,cfg.rotate)},
      {opacity:0,transform:tr(character,x,y+18,s*.72,cfg.rotate)}
    ],{duration:620,easing:'ease-in',fill:'forwards'}),
    animate(scope,frameBack,[{opacity:.96},{opacity:0}],{duration:620,easing:'ease-in',fill:'forwards'}),
    animate(scope,frameFront,[{opacity:.98},{opacity:0}],{duration:620,easing:'ease-in',fill:'forwards'}),
    animate(scope,crack,[{opacity:.9},{opacity:0}],{duration:680,easing:'ease-in',fill:'forwards'})
  ]);
}
async function knockKnock(scope,event){
  const cfg=groupForStory(event.id),[x,y]=chooseAnchor('center'),s=boardScale()*1.18;
  await A.preloadFamilies(['cracks','frames','impacts','shards','pompon']);
  const crack=sprite(scope,'cracks',nextVariant('crackCenter',GROUPS.crackCenter),'fw-crack',{x,y,scale:s*.35,opacity:0});
  for(let i=0;i<2;i++){
    await Promise.all([
      animate(scope,crack,[{opacity:.18,transform:tr(crack,x,y,s*(.3+i*.08))},{opacity:.85,transform:tr(crack,x,y,s*(.48+i*.1))}],{duration:260,fill:'forwards'}),
      shake(scope,.32+i*.16)
    ]);
    await wait(scope,300);
  }
  await wait(scope,520);
  return breakoutStory(scope,event);
}
async function repairRebreak(scope,event){
  const [x,y]=chooseAnchor('center'),s=boardScale()*1.12;
  await A.preloadFamilies(['cracks','frames','impacts','duo']);
  const crack=sprite(scope,'cracks',nextVariant('crackWide',GROUPS.crackWide),'fw-crack',{x,y,scale:s*.78,opacity:0});
  await animate(scope,crack,[{opacity:0,transform:tr(crack,x,y,s*.3)},{opacity:1,transform:tr(crack,x,y,s*.78)}],{duration:420,fill:'forwards'});
  await wait(scope,420);
  await animate(scope,crack,[{opacity:1},{opacity:0,transform:tr(crack,x,y,s*.25)}],{duration:620,easing:'ease-in',fill:'forwards'});
  await wait(scope,720);
  return breakoutStory(scope,event);
}
async function crackPulse(scope,{anchor='center',group='crackCenter',double=false}={}){
  const [x,y]=chooseAnchor(anchor),s=boardScale();
  await A.preloadFamily('cracks');
  const ids=[nextVariant(group,GROUPS[group])];
  if(double)ids.push(nextVariant(group,GROUPS[group]));
  const els=ids.map((id,i)=>sprite(scope,'cracks',id,'fw-crack',{x:x+(i?95:-25),y:y+(i?70:-20),scale:s*(i?.52:.64),rotate:i?8:-5,opacity:0})).filter(Boolean);
  await Promise.all(els.map((el,i)=>animate(scope,el,[
    {opacity:0,transform:tr(el,x+(i?95:-25),y+(i?70:-20),s*.22,(i?8:-5))},
    {opacity:.95,offset:.38,transform:tr(el,x+(i?95:-25),y+(i?70:-20),s*(i?.58:.72),(i?8:-5))},
    {opacity:.78,offset:.72,transform:tr(el,x+(i?95:-25),y+(i?70:-20),s*(i?.55:.68),(i?8:-5))},
    {opacity:0,transform:tr(el,x+(i?95:-25),y+(i?70:-20),s*.6,(i?8:-5))}
  ],{duration:650+i*80,easing:'ease-out',fill:'forwards'})));
}
async function framePulse(scope){
  const [x,y]=chooseAnchor('center'),s=boardScale();
  await A.preloadFamilies(['cracks','frames','impacts']);
  const crack=sprite(scope,'cracks',nextVariant('crackCenter',GROUPS.crackCenter),'fw-crack',{x,y,scale:s*.5,opacity:0});
  const frame=sprite(scope,'frames',nextVariant('frameCenter',GROUPS.frameCenter),'fw-frame-front',{x,y,scale:s*.5,opacity:0});
  const impact=sprite(scope,'impacts',nextVariant('impactEnergy',GROUPS.impactEnergy),'fw-impact',{x,y,scale:s*.3,opacity:0});
  await Promise.all([
    animate(scope,crack,[{opacity:0,transform:tr(crack,x,y,s*.25)},{opacity:.9,offset:.4,transform:tr(crack,x,y,s*.62)},{opacity:0,transform:tr(crack,x,y,s*.64)}],{duration:620,easing:'ease-out',fill:'forwards'}),
    animate(scope,frame,[{opacity:0,transform:tr(frame,x,y,s*.28)},{opacity:.92,offset:.45,transform:tr(frame,x,y,s*.72)},{opacity:0,transform:tr(frame,x,y,s*.68)}],{duration:650,easing:'ease-out',fill:'forwards'}),
    animate(scope,impact,[{opacity:0,transform:tr(impact,x,y,s*.18)},{opacity:.85,offset:.35,transform:tr(impact,x,y,s*.55)},{opacity:0,transform:tr(impact,x,y,s*.7)}],{duration:420,easing:'ease-out',fill:'forwards'})
  ]);
}
async function shardBurst(scope){
  const [x,y]=chooseAnchor('center'),s=boardScale();
  await A.preloadFamilies(['shards','impacts']);
  const impact=sprite(scope,'impacts',nextVariant('impactStars',GROUPS.impactStars),'fw-impact',{x,y,scale:s*.28,opacity:0});
  const count=quality()==='LOW'?1:3,shards=[];
  for(let i=0;i<count;i++)shards.push(sprite(scope,'shards',nextVariant('shards',GROUPS.shards),'fw-shard',{x,y,scale:s*(.35+i*.06),rotate:-25+i*22,opacity:0}));
  await Promise.all([
    animate(scope,impact,[{opacity:0,transform:tr(impact,x,y,s*.2)},{opacity:1,offset:.32,transform:tr(impact,x,y,s*.68)},{opacity:0,transform:tr(impact,x,y,s*.82)}],{duration:440,easing:'ease-out',fill:'forwards'}),
    ...shards.filter(Boolean).map((el,i)=>{
      const a=(Math.PI*2/count)*i-.7,dx=Math.cos(a)*190,dy=Math.sin(a)*150;
      return animate(scope,el,[{opacity:0,transform:tr(el,x,y,s*.18,-20+i*18)},{opacity:1,offset:.25,transform:tr(el,x+dx*.35,y+dy*.35,s*.56,-5+i*25)},{opacity:0,transform:tr(el,x+dx,y+dy,s*.72,25+i*35)}],{duration:520,easing:'cubic-bezier(.16,.7,.2,1)',fill:'forwards'});
    })
  ]);
}
async function falseBreak(scope){
  const [x,y]=chooseAnchor('upperLeft'),s=boardScale();
  await A.preloadFamilies(['cracks','frames','impacts']);
  const crack=sprite(scope,'cracks',nextVariant('crackCorner',GROUPS.crackCorner),'fw-crack',{x,y,scale:s*.58,opacity:0});
  const frame=sprite(scope,'frames',nextVariant('frameLeft',GROUPS.frameLeft),'fw-frame-front',{x,y,scale:s*.58,opacity:0});
  const sparkle=sprite(scope,'impacts',24,'fw-impact',{x:x+80,y:y-50,scale:s*.28,opacity:0});
  await animate(scope,crack,[{opacity:0,transform:tr(crack,x,y,s*.25)},{opacity:.95,transform:tr(crack,x,y,s*.64)}],{duration:300,easing:'ease-out',fill:'forwards'});
  await animate(scope,frame,[{opacity:0,transform:tr(frame,x,y,s*.3)},{opacity:.94,transform:tr(frame,x,y,s*.7)}],{duration:280,easing:'ease-out',fill:'forwards'});
  await wait(scope,180);
  await Promise.all([
    animate(scope,crack,[{opacity:.95},{opacity:0}],{duration:280,fill:'forwards'}),
    animate(scope,frame,[{opacity:.94},{opacity:0}],{duration:280,fill:'forwards'}),
    animate(scope,sparkle,[{opacity:0,transform:tr(sparkle,x+80,y-50,s*.18)},{opacity:1,offset:.35,transform:tr(sparkle,x+80,y-50,s*.52)},{opacity:0,transform:tr(sparkle,x+90,y-60,s*.62,10)}],{duration:420,easing:'ease-out',fill:'forwards'})
  ]);
}
const MICRO_PLAYERS=Object.freeze({
  FW_CRACK_CENTER:s=>crackPulse(s,{anchor:'center',group:'crackCenter'}),
  FW_CRACK_CORNER:s=>crackPulse(s,{anchor:Math.random()<.5?'upperLeft':'lowerRight',group:'crackCorner'}),
  FW_CRACK_CHAIN:s=>crackPulse(s,{anchor:'center',group:'crackDiagonal',double:true}),
  FW_FRAME_PULSE:framePulse,
  FW_SHARD_BURST:shardBurst,
  FW_FALSE_BREAK:falseBreak,
});

async function play(id){
  if(running)return{played:false,reason:'busy'};
  const key=String(id||''),micro=MICRO_PLAYERS[key],story=STORY_EVENTS.find(x=>x.id===key);
  if(!micro&&!story)return{played:false,reason:'unknown-event'};
  const scope=M.createScope('fourth-wall:'+key);currentScope=scope;currentId=key;running=true;
  diagnostics.played++;if(micro)diagnostics.microPlayed++;else diagnostics.storyPlayed++;
  diagnostics.lastEvent={id:key,at:Date.now()};diagnostics.history.push({...diagnostics.lastEvent});diagnostics.history=diagnostics.history.slice(-50);
  try{
    if(micro)await micro(scope);else if(story.special==='knock')await knockKnock(scope,story);else if(story.special==='rebreak')await repairRebreak(scope,story);else await breakoutStory(scope,story);
    return{played:!scope.signal.aborted,id:key,reason:scope.signal.aborted?'aborted':undefined};
  }catch(e){
    return{played:false,id:key,reason:scope.signal.aborted?'aborted':'error'};
  }finally{
    scope.cleanup();
    if(currentScope===scope){currentScope=null;currentId='';running=false}
    diagnostics.cleanupRuns++;
  }
}
function cancel(reason='manual'){if(!currentScope)return false;diagnostics.canceled++;const s=currentScope;currentScope=null;currentId='';running=false;s.abort(reason);return true}
const SCENE_RECIPES=Object.freeze(Object.fromEntries(EVENTS.map(e=>[e.id,Object.freeze({impactPoint:'shared',beats:e.category==='FOURTH_WALL_STORY'?['warning','vibration','crack','break','hole','character','impact','shards','foreground','reaction','gag','exit']:['warning','action','hold','aftermath'],zOrder:['crack','rear-frame','character','impact','front-frame','foreground-shards'],minimumHoldMs:e.category==='FOURTH_WALL_STORY'?2400:900})])));
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,currentId,events:EVENTS.map(x=>x.id),sceneRecipeCount:Object.keys(SCENE_RECIPES).length,assets:A.diagnostics()}}
function resetForTest(){cancel('test-reset');variantBags.clear();diagnostics.played=0;diagnostics.canceled=0;diagnostics.microPlayed=0;diagnostics.storyPlayed=0;diagnostics.cleanupRuns=0;diagnostics.lastEvent=null;diagnostics.history=[]}

window.ASOBOON_BOARD_FOURTH_WALL_EVENTS=Object.freeze({
  version:'1.3.0',events:EVENTS,microEvents:MICRO_EVENTS,storyEvents:STORY_EVENTS,sceneRecipes:SCENE_RECIPES,play,cancel,isRunning:()=>running,getDiagnostics,resetForTest,playEventForTest:play
});
})();
