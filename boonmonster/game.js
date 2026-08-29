(()=>{
'use strict';
const VERSION='BOON MONSTER PLAYABLE PROTOTYPE v0.3.1';
const BUILD='2026-08-29-hidden-game-hotfix-1';
const STORAGE_KEY='boon_monster_playable_prototype_v0_3';
const THRESHOLD={baby:5,animal:6,category:7};
const ATLAS_PATH='./assets/baby-expressions.png?v=20260829-1335';
const LOCK_REGISTRY_PATH='./data/pixel_lock_registry.json?v=20260829-1';
const BABIES={
  'BM-BABY-MOF':{name:'もふーん',row:0,options:[['風の砂地','wind','BM-FEN-ANIMAL'],['草原','field','BM-RAB-ANIMAL']]},
  'BM-BABY-FLO':{name:'ふろーん',row:1,options:[['森','forest','BM-SAP-ANIMAL'],['水辺','water','BM-OTR-ANIMAL']]},
  'BM-BABY-GIG':{name:'ぎがーん',row:2,options:[['岩場','rock','BM-LIZ-ANIMAL'],['高台','highland','BM-EAG-ANIMAL']]}
};
const ANIMALS={FEN:'ふぇねーん',SAP:'さぱーん',RAB:'らびーん',OTR:'うそーん',LIZ:'りざーん',EAG:'わしーん'};
const CATEGORIES={
  SPD:{name:'SPEED',label:'タイムアタック'},STR:{name:'STREET',label:'ナイトシティ'},LUX:{name:'LUXURY',label:'グランドツアー'},CLS:{name:'CLASSIC',label:'ヘリテージロード'},ARM:{name:'ARMORED',label:'ラフロード'},AGI:{name:'AGING',label:'ロングラン'}
};
const EXPRS=['normal','blink','smile','surprised','sad','sleep','evolution_ready'];
const $=s=>document.querySelector(s);
const REQUIRED_IDS=['build','fuelVal','fuelBar','conditionVal','conditionBar','moodVal','moodBar','growthVal','growthBar','stageLabel','specId','monsterStage','monsterCanvas','lockedFallback','monsterMotion','aura','particles','monsterName','maturityHint','message','playBtn','careBtn','dexBtn','newBtn','loadBtn','saveState','sheetBackdrop','sheet','sheetKicker','sheetTitle','sheetClose','sheetBody'];
const missing=REQUIRED_IDS.filter(id=>!document.getElementById(id));
if(missing.length){
  console.error('BOON MONSTER boot aborted: missing DOM ids',missing);
  if(window.__boonShowBootError)window.__boonShowBootError('画面データの新旧が混在しています。再読込してください。');
  return;
}
const clamp=v=>Math.max(0,Math.min(100,v));
const speciesCode=spec=>spec.split('-')[1];
const categoryCode=spec=>spec.split('-')[2];
const stageFromSpec=spec=>spec.includes('BABY')?'baby':spec.includes('ANIMAL')?'animal':spec.endsWith('CATEGORY')?'category':'final';
const stageLabel=s=>({baby:'幼体',animal:'動物',category:'カテゴリ',final:'最終進化'}[s]||s);
function labelFor(spec){
  if(BABIES[spec]) return BABIES[spec].name;
  const sp=ANIMALS[speciesCode(spec)]||speciesCode(spec);
  if(spec.includes('ANIMAL')) return sp;
  const category=CATEGORIES[categoryCode(spec)];
  const cat=category?category.name:categoryCode(spec);
  if(spec.endsWith('CATEGORY')) return `${sp}・${cat}`;
  if(spec.endsWith('-L')) return `${sp}・${cat} LIGHT`;
  if(spec.endsWith('-D')) return `${sp}・${cat} DARK`;
  return spec;
}
function fresh(baby='BM-BABY-MOF'){
  return {version:VERSION,build:BUILD,activePet:baby,currentSpecId:baby,stage:'baby',maturity:0,turn:0,babyDirectionScores:{},categoryDirectionScores:{},lastDirection:null,rankDirectionState:null,evolutionHistory:[],discoveredDex:[baby],fuel:72,condition:84,mood:78,saveVersion:3,lastMessage:'今日はなにしよう？'};
}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return x&&x.currentSpecId?Object.assign(fresh(x.currentSpecId),x):fresh()}catch(e){console.warn('BOON MONSTER storage read unavailable',e);return fresh()}}
let G=load(),expression='normal';
const canvas=$('#monsterCanvas'),ctx=canvas.getContext('2d'),fallback=$('#lockedFallback'),motion=$('#monsterMotion'),aura=$('#aura'),particles=$('#particles');
if(!ctx){
  console.error('BOON MONSTER canvas 2D context unavailable');
  if(window.__boonShowBootError)window.__boonShowBootError('この端末でキャラクター表示を初期化できませんでした。');
  return;
}
ctx.imageSmoothingEnabled=false;
const atlas=new Image();let atlasReady=false;
const lockedSprite=new Image();let lockedRegistry=new Map(),lockedSpec='',lockedReady=false,lockedRegistryReady=false;
atlas.onload=()=>{atlasReady=true;renderVisual()};
atlas.onerror=()=>{console.error('BOON MONSTER baby atlas load error',ATLAS_PATH);fallback.hidden=false;fallback.innerHTML='<span>BABY</span><b>'+labelFor(G.currentSpecId)+'</b><small>'+G.currentSpecId+'</small><em>IMAGE LOAD RETRY</em>'};
atlas.src=ATLAS_PATH;
lockedSprite.onload=()=>{lockedReady=true;renderVisual()};
lockedSprite.onerror=()=>{lockedReady=false;console.error('BOON MONSTER locked asset load error',lockedSpec);fallback.hidden=false;fallback.innerHTML='<span>ASSET ERROR</span><b>'+G.currentSpecId+'</b><small>LOCKED PIXEL ASSET</small><em>IMAGE LOAD FAILED</em>'};
async function loadLockedRegistry(){
  try{
    const response=await fetch(LOCK_REGISTRY_PATH,{cache:'no-store'});
    if(!response.ok)throw new Error(`registry HTTP ${response.status}`);
    const payload=await response.json();
    if(payload.assetCount!==117||!Array.isArray(payload.assets))throw new Error('registry count mismatch');
    lockedRegistry=new Map(payload.assets.map(item=>[item.specId,item]));
    lockedRegistryReady=true;renderVisual();
  }catch(error){
    console.error('BOON MONSTER locked asset registry load error',error);
    fallback.hidden=false;fallback.innerHTML='<span>ASSET ERROR</span><b>'+G.currentSpecId+'</b><small>117 PIXEL LOCK REGISTRY</small><em>REGISTRY LOAD FAILED</em>';
  }
}
loadLockedRegistry();
function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(G));$('#saveState').textContent='SAVED'}
  catch(e){console.warn('BOON MONSTER storage write unavailable',e);$('#saveState').textContent='MEMORY ONLY'}
}
function register(spec){if(!G.discoveredDex.includes(spec))G.discoveredDex.push(spec)}
function currentBaby(){return BABIES[G.currentSpecId]||null}
function renderBabySprite(expr='normal'){
  const b=currentBaby();if(!b||!atlasReady)return false;
  const col=Math.max(0,EXPRS.indexOf(expr));ctx.clearRect(0,0,96,96);ctx.drawImage(atlas,col*96,b.row*96,96,96,0,0,96,96);canvas.hidden=false;fallback.hidden=true;canvas.dataset.expression=expr;return true;
}
function renderVisual(){
  motion.className='monster-motion';aura.classList.toggle('on',G.stage==='final');particles.classList.toggle('on',G.stage==='final');
  const asset=lockedRegistry.get(G.currentSpecId);
  if(!lockedRegistryReady){canvas.hidden=true;fallback.hidden=false;fallback.innerHTML=`<span>ASSET LOADING</span><b>${G.currentSpecId}</b><small>117 PIXEL LOCK REGISTRY</small>`;return}
  if(!asset){canvas.hidden=true;fallback.hidden=false;fallback.innerHTML=`<span>ASSET ERROR</span><b>${G.currentSpecId}</b><small>SPEC ID NOT FOUND</small>`;return}
  if(lockedSpec!==G.currentSpecId){lockedSpec=G.currentSpecId;lockedReady=false;lockedSprite.src=asset.runtimePath;canvas.hidden=true;fallback.hidden=false;fallback.innerHTML=`<span>ASSET LOADING</span><b>${G.currentSpecId}</b><small>${asset.fileKey}</small>`;return}
  if(!lockedReady){canvas.hidden=true;fallback.hidden=false;fallback.innerHTML=`<span>ASSET LOADING</span><b>${G.currentSpecId}</b><small>${asset.fileKey}</small>`;return}
  ctx.clearRect(0,0,96,96);ctx.drawImage(lockedSprite,0,0,96,96);canvas.hidden=false;fallback.hidden=true;canvas.dataset.specId=G.currentSpecId;
}
function progressText(){if(G.stage==='final')return'最終進化 COMPLETE';return`${stageLabel(G.stage)} ${G.maturity} / ${THRESHOLD[G.stage]}`}
function render(){
  $('#build').textContent=`BOON MONSTER TEST v0.3.1 · ${BUILD}`;$('#specId').textContent=G.currentSpecId;$('#stageLabel').textContent=stageLabel(G.stage);$('#monsterName').textContent=labelFor(G.currentSpecId);$('#maturityHint').textContent=progressText();$('#message').textContent=G.lastMessage;
  for(const k of ['fuel','condition','mood']){$(`#${k}Val`).textContent=Math.round(G[k]);$(`#${k}Bar`).style.width=clamp(G[k])+'%'}
  const max=THRESHOLD[G.stage]||1;$('#growthBar').style.width=(G.stage==='final'?100:Math.min(100,G.maturity/max*100))+'%';$('#growthVal').textContent=G.stage==='final'?'DONE':`${G.maturity}/${max}`;renderVisual();save();
}
function commitEvolution(next){const from=G.currentSpecId;G.currentSpecId=next;G.activePet=next;G.stage=stageFromSpec(next);G.maturity=0;G.turn=0;G.lastDirection=null;G.evolutionHistory.push({from:from,to:next,at:new Date().toISOString()});register(next);G.lastMessage=`${labelFor(next)}へ進化した！`;render();openEvolution()}
function topDirection(scores,options){let best=-1,candidates=[];for(const o of options){const key=o[1],v=scores[key]||0;if(v>best){best=v;candidates=[o]}else if(v===best)candidates.push(o)}if(candidates.length===1)return candidates[0];return candidates.find(o=>o[1]===G.lastDirection)||candidates[0]}
function growth(kind,key,label){
  G.turn++;G.maturity++;G.lastDirection=key;G.fuel=clamp(G.fuel-4);G.mood=clamp(G.mood+2);G.lastMessage=`${label}を体験した！`;
  if(kind==='baby')G.babyDirectionScores[key]=(G.babyDirectionScores[key]||0)+1;
  if(kind==='category')G.categoryDirectionScores[key]=(G.categoryDirectionScores[key]||0)+1;
  if(G.stage==='baby'&&G.maturity>=THRESHOLD.baby){const route=topDirection(G.babyDirectionScores,BABIES[G.currentSpecId].options);return commitEvolution(route[2])}
  if(G.stage==='animal'&&G.maturity>=THRESHOLD.animal){const ranked=Object.entries(G.categoryDirectionScores).sort((a,b)=>b[1]-a[1]);let code=ranked.length?ranked[0][0]:'SPD';const top=ranked.length?ranked[0][1]:0;const ties=ranked.filter(x=>x[1]===top).map(x=>x[0]);if(ties.length>1&&ties.includes(G.lastDirection))code=G.lastDirection;return commitEvolution(`BM-${speciesCode(G.currentSpecId)}-${code}-CATEGORY`)}
  render();closeSheet();
}
function chooseRank(rank){if(G.stage!=='category')return;G.rankDirectionState=rank;const base=G.currentSpecId.replace('-CATEGORY','');commitEvolution(`${base}-${rank==='LIGHT'?'L':'D'}`)}
function card(title,sub,icon,on){const b=document.createElement('button');b.className='action-card';b.innerHTML=`<strong>${title}</strong><small>${sub}</small><em>${icon}</em>`;b.onclick=on;return b}
function openSheet(title,kicker='BOON MONSTER'){$('#sheetTitle').textContent=title;$('#sheetKicker').textContent=kicker;$('#sheetBody').innerHTML='';$('#sheet').hidden=false;$('#sheetBackdrop').hidden=false}
function closeSheet(){$('#sheet').hidden=true;$('#sheetBackdrop').hidden=true}
function openPlay(){
  openSheet(G.stage==='final'?'育成完了':'体験を選ぶ',`${stageLabel(G.stage)} / GROWTH`);const body=$('#sheetBody');
  if(G.stage==='baby'){for(const [label,key]of BABIES[G.currentSpecId].options)body.append(card(label,'1育成ターン · 動物進化方向','🗺️',()=>growth('baby',key,label)))}
  else if(G.stage==='animal'){for(const[code,c]of Object.entries(CATEGORIES))body.append(card(c.label,`${c.name}へ影響 · 1育成ターン`,'🏁',()=>growth('category',code,c.label)))}
  else if(G.stage==='category'){const note=document.createElement('div');note.className='notice';note.textContent='LIGHT / DARKの正式なプレイヤー判定ルールは未確定です。この2ボタンは縦切り試作専用です。';body.append(note);body.append(card('FORCE LIGHT','PROTOTYPE DEBUG ONLY','✦',()=>chooseRank('LIGHT')),card('FORCE DARK','PROTOTYPE DEBUG ONLY','◆',()=>chooseRank('DARK')))}
  else{const done=document.createElement('div');done.className='notice';done.innerHTML=`最終進化完了。<b>${labelFor(G.currentSpecId)}</b> は図鑑へ登録済みです。`;body.append(done);body.append(card('もう一度育てる','NEW GAME','↻',openNewGame))}
}
function openCare(){openSheet('おせわ','FREE INTERACTION / TURN消費なし');const body=$('#sheetBody');body.append(card('なでる','MOOD +10 · 育成ターン消費なし','🫶',()=>care('pet')),card('給油','FUEL +30 · 育成ターン消費なし','⛽',()=>care('fuel')),card('点検','CONDITION +20 · 育成ターン消費なし','🔧',()=>care('condition')))}
function care(kind){if(kind==='pet'){G.mood=clamp(G.mood+10);G.lastMessage='うれしそう！'}if(kind==='fuel'){G.fuel=clamp(G.fuel+30);G.lastMessage='給油した！'}if(kind==='condition'){G.condition=clamp(G.condition+20);G.lastMessage='調子がよくなった！'}expression='smile';render();closeSheet();setTimeout(()=>{expression='normal';renderVisual()},500)}
function openDex(){openSheet('図鑑',`DISCOVERED ${G.discoveredDex.length}`);const body=$('#sheetBody'),grid=document.createElement('div');grid.className='dex-grid';for(const spec of G.discoveredDex){const d=document.createElement('div');d.className='dex-item';d.innerHTML=`<span>${stageLabel(stageFromSpec(spec))}</span><b>${labelFor(spec)}</b><small>${spec}</small>`;grid.append(d)}body.append(grid);const hist=document.createElement('div');hist.className='history';hist.textContent=G.evolutionHistory.length?'進化履歴: '+G.evolutionHistory.map(x=>`${x.from} → ${x.to}`).join(' / '):'まだ進化していません';body.append(hist);body.append(card('NEW GAME','幼体を選び直して最初からテスト','↻',openNewGame))}
function openNewGame(){openSheet('NEW GAME','START BABY');const body=$('#sheetBody');for(const[spec,b]of Object.entries(BABIES))body.append(card(b.name,spec,'🥚',()=>{G=fresh(spec);expression='normal';closeSheet();render()}))}
function openEvolution(){openSheet('EVOLUTION','NEW STAGE UNLOCKED');const body=$('#sheetBody'),d=document.createElement('div');d.className='evolution-card';d.innerHTML=`<strong>${labelFor(G.currentSpecId)}</strong><span>${stageLabel(G.stage)}</span><small>${G.currentSpecId}</small>`;body.append(d);body.append(card(G.stage==='final'?'ENDINGへ':'育成を続ける',G.stage==='final'?'図鑑に登録済み':'次の段階へ','→',()=>{closeSheet();G.lastMessage=G.stage==='final'?'最終進化 COMPLETE':'次の育成を始めよう！';render()}))}
function tapMonster(){if(G.stage!=='baby'){G.lastMessage=`${labelFor(G.currentSpecId)}がこちらを見ている`;render();return}expression='surprised';G.lastMessage='こっちを見た！';if(atlasReady)renderBabySprite(expression);else render();setTimeout(()=>{expression='smile';if(atlasReady)renderBabySprite(expression)},220);setTimeout(()=>{expression='normal';renderVisual()},650)}
function loadGame(){G=load();G.lastMessage='保存データを読み込みました';render()}
window.BoonMonsterPrototype={version:VERSION,build:BUILD,getState:()=>JSON.parse(JSON.stringify(G)),newGame:spec=>{G=fresh(spec&&BABIES[spec]?spec:'BM-BABY-MOF');render()},openPlay:openPlay,openDex:openDex,save:save,load:loadGame};
$('#monsterStage').onclick=tapMonster;$('#playBtn').onclick=openPlay;$('#careBtn').onclick=openCare;$('#dexBtn').onclick=openDex;$('#newBtn').onclick=openNewGame;$('#loadBtn').onclick=loadGame;$('#sheetClose').onclick=closeSheet;$('#sheetBackdrop').onclick=closeSheet;
render();
})();
