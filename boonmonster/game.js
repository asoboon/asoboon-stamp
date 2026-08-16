(()=>{
'use strict';
const VERSION='BOON MONSTER 育成ループ v0.2';
const BUILD='2026-08-16-growth-loop-v020';
const STORAGE_KEY='boon_monster_growth_loop_v0_2';
const EXPRESSIONS=['normal','blink','smile','surprised','sad','sleep','evolution_ready'];
const CHAR_ORDER=['mofuun','furoon','gigaan'];
const EXPR_ORDER=['normal','blink','smile','surprised','sad','sleep','evolution_ready'];
const CHARS={
  mofuun:{specId:'BM-BABY-MOF',name:'もふーん',outings:[['風の砂地','fen'],['森','sap']]},
  furoon:{specId:'BM-BABY-FLO',name:'ふろーん',outings:[['草原','rab'],['水辺','otr']]},
  gigaan:{specId:'BM-BABY-GIG',name:'ぎがーん',outings:[['岩場','liz'],['高台','eag']]}
};
const $=s=>document.querySelector(s), wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=v=>Math.max(0,Math.min(100,v));
const now=()=>Date.now();
function freshPet(){return {fuel:72,condition:84,mood:78,maturity:0,outingHistory:[],evolutionDirection:{},evolutionReady:false,sleeping:false,lastPlayedAt:now(),careLast:{}}}
function fresh(){return {version:VERSION,build:BUILD,currentCharacter:'mofuun',pets:{mofuun:freshPet(),furoon:freshPet(),gigaan:freshPet()}}}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!x||!x.pets)return fresh();for(const k of Object.keys(CHARS)){x.pets[k]={...freshPet(),...(x.pets[k]||{})};x.pets[k].evolutionDirection=x.pets[k].evolutionDirection||{};x.pets[k].careLast=x.pets[k].careLast||{}};return x}catch{return fresh()}}
let G=load(), expression='normal', reactionToken=0, blinkTimer=null, idleTimer=null;
const char=()=>CHARS[G.currentCharacter], pet=()=>G.pets[G.currentCharacter];
const img=$('#monsterImg'),motion=$('#monsterMotion'),aura=$('#aura'),particles=$('#particles');
function save(){pet().lastPlayedAt=now();localStorage.setItem(STORAGE_KEY,JSON.stringify(G))}
function applySprite(e){const c=EXPR_ORDER.indexOf(e),r=CHAR_ORDER.indexOf(G.currentCharacter);img.style.transform=`translate(${-c*192}px,${-r*192}px)`}
function setMessage(t){$('#message').textContent=t}
function setVisual(e){if(!EXPRESSIONS.includes(e))e='normal';expression=e;applySprite(e);motion.className='monster-motion';aura.classList.remove('on');particles.classList.remove('on');if(e==='smile')motion.classList.add('motion-jump');if(e==='surprised')motion.classList.add('motion-pop');if(e==='sad')motion.classList.add('motion-sad');if(e==='sleep')motion.classList.add('motion-sleep');if(e==='evolution_ready'){motion.classList.add('motion-evo');aura.classList.add('on');particles.classList.add('on')}}
function persistentExpression(){const p=pet();if(p.evolutionReady)return'evolution_ready';if(p.sleeping)return'sleep';if(p.mood<30||p.condition<25||p.fuel<10)return'sad';return'normal'}
function maturityText(){const p=pet();if(p.evolutionReady)return'なんだか様子が違う……！';if(p.maturity>=6)return'雰囲気が変わってきた…';if(p.maturity>=3)return'最近ちょっと大きくなった？';if(p.sleeping)return'すやすや眠っている';if(p.mood>=85)return'ごきげん！';return'のんびりしている'}
function render(){const p=pet();$('#specId').textContent=char().specId;$('#monsterName').textContent=char().name;img.alt=char().name;$('#maturityHint').textContent=maturityText();for(const k of ['fuel','condition','mood']){$(`#${k}Val`).textContent=Math.round(p[k]);$(`#${k}Bar`).style.width=clamp(p[k])+'%'}save()}
function restorePersistent(){setVisual(persistentExpression());render()}
async function react(seq){const token=++reactionToken;for(const [e,ms] of seq){if(token!==reactionToken)return;setVisual(e);await wait(ms)}if(token===reactionToken)restorePersistent()}
async function tapMonster(){if(pet().evolutionReady){setMessage('なんだか様子が違う……！');return react([['evolution_ready',700]])}if(pet().sleeping){pet().sleeping=false;setMessage('おはよう！');render();return react([['surprised',260],['smile',430]])}setMessage('こっちを見た！');await react([['surprised',260],['smile',500]])}
function scheduleBlink(){clearTimeout(blinkTimer);blinkTimer=setTimeout(async()=>{if(persistentExpression()==='normal'&&expression==='normal'){const t=++reactionToken;setVisual('blink');await wait(100);if(t===reactionToken)restorePersistent()}scheduleBlink()},4000+Math.random()*4000)}
function scheduleIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(persistentExpression()==='normal'&&expression==='normal'){motion.classList.add('motion-bob');setTimeout(()=>motion.classList.remove('motion-bob'),600)}scheduleIdle()},5000+Math.random()*5000)}
function decayFromTime(){for(const k of Object.keys(CHARS)){const p=G.pets[k];const h=Math.max(0,Math.min(48,(now()-(p.lastPlayedAt||now()))/3600000));if(h>.25){p.fuel=clamp(p.fuel-h*.28);p.condition=clamp(p.condition-h*.09);p.mood=clamp(p.mood-h*.12)}}}
function addMaturity(v){const p=pet();p.maturity=Math.min(10,p.maturity+v);if(p.maturity>=10)p.evolutionReady=true}
function careAllowed(kind){const last=pet().careLast[kind]||0;return now()-last>=3500}
async function doCare(kind){const p=pet();if(!careAllowed(kind)){setMessage('ちょっと待ってね');return}p.careLast[kind]=now();if(kind==='pet'){p.mood=clamp(p.mood+10);addMaturity(.15);setMessage('うれしそう！');render();await react([['smile',600]])}else if(kind==='refuel'){p.fuel=clamp(p.fuel+35);addMaturity(.1);setMessage('まんたんに近づいた！');render();await react([['surprised',230],['smile',500]])}else if(kind==='inspect'){p.condition=clamp(p.condition+24);addMaturity(.1);setMessage('調子がよくなった！');render();await react([['smile',600]])}openSheet('care')}
async function doOuting(label,dir){const p=pet();if(p.evolutionReady){setMessage('今は進化の予感がする…');closeSheet();return}if(p.sleeping){p.sleeping=false}if(p.fuel<20){p.fuel=clamp(p.fuel+35);setMessage('給油して出発！');render();await react([['surprised',220],['smile',400]])}p.fuel=clamp(p.fuel-18);p.condition=clamp(p.condition-4);p.mood=clamp(p.mood+6);addMaturity(2.5);p.evolutionDirection[dir]=(p.evolutionDirection[dir]||0)+1;p.outingHistory.push({label,at:new Date().toISOString()});if(p.outingHistory.length>20)p.outingHistory.shift();render();closeSheet();setMessage(`${label}へおでかけ！`);motion.classList.add('motion-bob');await react([['surprised',250],['smile',650]]);if(p.evolutionReady){setMessage('なんだか様子が違う……！');restorePersistent()}else setMessage('たのしかった！')}
function openSheet(type){const body=$('#sheetBody'),title=$('#sheetTitle'),kick=$('#sheetKicker');body.innerHTML='';$('#sheet').hidden=false;$('#sheetBackdrop').hidden=false;document.querySelectorAll('.main-nav button').forEach(b=>b.classList.remove('active'));$(`#${type}Btn`)?.classList.add('active');if(type==='care'){title.textContent='おせわ';kick.textContent='STATUSを整える';[['なでる','MOODが上がる','🫶','pet'],['給油','FUELを回復','⛽','refuel'],['点検','CONDITIONを回復','🔧','inspect']].forEach(([a,b,c,d])=>body.appendChild(card(a,b,c,()=>doCare(d))))}if(type==='outing'){title.textContent='おでかけ';kick.textContent='どこへ行く？';char().outings.forEach(([label,dir])=>body.appendChild(card(label,'体験は進化の個性として記録されます','🗺️',()=>doOuting(label,dir))));const hist=document.createElement('div');hist.className='history';hist.textContent=pet().outingHistory.length?'最近：'+pet().outingHistory.slice(-3).map(x=>x.label).join(' / '):'まだおでかけしていません';body.appendChild(hist)}if(type==='garage'){title.textContent='ガレージ';kick.textContent='整備と休憩';body.appendChild(card(pet().sleeping?'起こす':'休ませる',pet().sleeping?'通常状態に戻します':'睡眠状態にします','🌙',()=>{pet().sleeping=!pet().sleeping;render();restorePersistent();setMessage(pet().sleeping?'おやすみ…':'おはよう！');openSheet('garage')}));body.appendChild(card('軽い整備','CONDITIONを少し回復','🧰',()=>{pet().condition=clamp(pet().condition+12);render();react([['smile',500]]);openSheet('garage')}));const hist=document.createElement('div');hist.className='history';hist.innerHTML=`<b>${char().name}</b><br>FUEL ${Math.round(pet().fuel)} / CONDITION ${Math.round(pet().condition)} / MOOD ${Math.round(pet().mood)}<br>${maturityText()}`;body.appendChild(hist);const q=document.createElement('div');q.className='qa-switch';for(const k of Object.keys(CHARS)){const b=document.createElement('button');b.textContent=CHARS[k].name;b.onclick=()=>switchCharacter(k);q.appendChild(b)}body.appendChild(q)}}
function card(title,sub,icon,on){const b=document.createElement('button');b.className='action-card';b.innerHTML=`<strong>${title}</strong><small>${sub}</small><em>${icon}</em>`;b.onclick=on;return b}
function closeSheet(){$('#sheet').hidden=true;$('#sheetBackdrop').hidden=true}
function switchCharacter(k){if(!CHARS[k])return;G.currentCharacter=k;reactionToken++;render();restorePersistent();setMessage(`${char().name}に切り替えました`);openSheet('garage')}
function publicState(){const p=pet();return {version:VERSION,current_character:G.currentCharacter,spec_id:char().specId,expression,fuel:p.fuel,condition:p.condition,mood:p.mood,maturity_hint:maturityText(),evolution_ready:p.evolutionReady,sleeping:p.sleeping,outing_history:p.outingHistory.map(x=>({label:x.label,at:x.at})),last_played_at:p.lastPlayedAt}}
window.BoonMonsterV02={getPublicState:publicState,setCharacter:switchCharacter,openCare:()=>openSheet('care'),openOuting:()=>openSheet('outing'),openGarage:()=>openSheet('garage'),triggerTap:tapMonster,triggerExpression:async e=>{if(!EXPRESSIONS.includes(e))throw Error('unknown expression');reactionToken++;setVisual(e);render();await wait(600);restorePersistent()},_getInternalState:()=>JSON.parse(JSON.stringify(G))};
$('#monsterStage').onclick=tapMonster;$('#careBtn').onclick=()=>openSheet('care');$('#outingBtn').onclick=()=>openSheet('outing');$('#garageBtn').onclick=()=>openSheet('garage');$('#sheetClose').onclick=closeSheet;$('#sheetBackdrop').onclick=closeSheet;
decayFromTime();setVisual(persistentExpression());render();scheduleBlink();scheduleIdle();save();
})();
