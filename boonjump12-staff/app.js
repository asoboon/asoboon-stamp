document.documentElement.style.setProperty('--sprite','url("data:image/webp;base64,'+(window.__B12S||'')+'")');
window.__B12S='';
(()=>{'use strict';
const STORE='asoboonBoonjump12Staff.v1';
const MACHINES=[{"key":"sport","name":"ニトロスポーツ","category":"SPEED","tier":"COMMON","art":0,"tempo":1.15,"window":0.16,"power":1.02,"feel":"王道高速 / 読みやすい"},{"key":"ssr","name":"コズミック・ファントム","category":"SPEED","tier":"RARE","art":1,"tempo":1.45,"window":0.11,"power":1.1,"feel":"超高速 / 高精度"},{"key":"wagon","name":"スマートワゴン","category":"LUXURY","tier":"COMMON","art":2,"tempo":0.8,"window":0.23,"power":0.96,"feel":"滑らか / 安定"},{"key":"princess","name":"プリンセス・スターライナー","category":"LUXURY","tier":"RARE","art":3,"tempo":0.74,"window":0.17,"power":1.04,"feel":"優雅 / 大きく安定"},{"key":"bike","name":"パワーバイク","category":"STREET","tier":"COMMON","art":4,"tempo":1.3,"window":0.14,"power":1.0,"feel":"クイック / 一瞬勝負"},{"key":"staff_blaze_custom","name":"ブレイズ・カスタム","category":"STREET","tier":"RARE","art":5,"tempo":1.5,"window":0.12,"power":1.08,"feel":"爆発的 / 攻撃的"},{"key":"staff_rock_buster_4x4","name":"ロックバスター4×4","category":"ARMORED","tier":"COMMON","art":6,"tempo":0.72,"window":0.24,"power":0.98,"feel":"重い / 安定"},{"key":"valkyrie","name":"ハイウェイ・ヴァルキリー","category":"ARMORED","tier":"RARE","art":7,"tempo":1.33,"window":0.1,"power":1.12,"feel":"重さ＋高速 / 精密"},{"key":"boon","name":"ブーン・ヘリテージ","category":"CLASSIC","tier":"COMMON","art":8,"tempo":0.95,"window":0.2,"power":1.0,"feel":"ニュートラル / 基準"},{"key":"staff_frost_roadster","name":"フロスト・ロードスター","category":"CLASSIC","tier":"RARE","art":9,"tempo":1.08,"window":0.13,"power":1.06,"feel":"滑らか / 繊細"},{"key":"staff_moss_gear_wrecker","name":"モスギア・レッカー","category":"AGING","tier":"COMMON","art":10,"tempo":0.78,"window":0.22,"power":0.97,"feel":"重め / 立て直し"},{"key":"buggy","name":"ラッキー・バギー","category":"AGING","tier":"RARE","art":11,"tempo":1.18,"window":0.15,"power":1.04,"feel":"荒い / 跳ねる"}];
const PHASES=['ACCEL','TURBO','NITRO'];
const byKey=Object.fromEntries(MACHINES.map(m=>[m.key,m]));
const load=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return {}}};
let state=Object.assign({selected:'boon',progress:{}},load());
if(!byKey[state.selected])state.selected='boon';
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){}};
const screens=[...document.querySelectorAll('.screen')];
const [
  homeArt,homeName,homeMeta,machineGrid,selectBtn,playBtn,retryBtn,
  gameName,gameMiniArt,judges,phaseLabel,phaseHint,target,marker,tapBtn,
  flightName,flightArt,liveDistance,resultName,resultDistance,resultPrecision,
  resultLevel,resultGrowth
]=[
  'homeArt','homeName','homeMeta','machineGrid','selectBtn','playBtn','retryBtn',
  'gameName','gameMiniArt','judges','phaseLabel','phaseHint','target','marker','tapBtn',
  'flightName','flightArt','liveDistance','resultName','resultDistance','resultPrecision',
  'resultLevel','resultGrowth'
].map(id=>document.getElementById(id));
const show=id=>{screens.forEach(s=>s.classList.toggle('active',s.id===id));scrollTo(0,0)};
const art=m=>{const c=m.art%4,r=Math.floor(m.art/4);return `<div class="art" style="--col:${c};--row:${r}"></div>`};
const meta=m=>`<span class="pill">${m.category}</span><span class="pill ${m.tier==='RARE'?'rare':''}">${m.tier}</span><span class="pill">${m.feel}</span>`;
const rec=k=>state.progress[k]||(state.progress[k]={xp:0,plays:0,best:0});
const level=xp=>Math.floor(Math.sqrt(Math.max(0,xp)/50));
function renderHome(){const m=byKey[state.selected];homeArt.innerHTML=art(m);homeName.textContent=m.name;homeMeta.innerHTML=meta(m)}
function renderGrid(){machineGrid.innerHTML=MACHINES.map(m=>`<button class="card ${m.key===state.selected?'selected':''}" data-key="${m.key}"><span class="tag">${m.category} · ${m.tier}</span>${art(m)}<b>${m.name}</b><small>${m.feel}</small></button>`).join('');machineGrid.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.key;save();renderHome();renderGrid();show('home')})}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
selectBtn.onclick=()=>{renderGrid();show('select')};playBtn.onclick=()=>startGame();retryBtn.onclick=()=>startGame();

let phase=0,vals=[],raf=0,startAt=0,pos=.1,locked=false;
function grade(p){if(p>=.95)return'SUPER';if(p>=.85)return'CRITICAL';if(p>=.70)return'GREAT';if(p>=.50)return'GOOD';return'MISS'}
function drawJudges(){judges.innerHTML=PHASES.map((p,i)=>`<div class="judge"><small>${p}</small><strong>${vals[i]?grade(vals[i]):'---'}</strong></div>`).join('')}
function startGame(){cancelAnimationFrame(raf);phase=0;vals=[];locked=false;const m=byKey[state.selected];gameName.textContent=m.name;gameMiniArt.innerHTML=art(m);drawJudges();show('game');nextPhase()}
function nextPhase(){const m=byKey[state.selected];phaseLabel.textContent=`${phase+1} / 3 ${PHASES[phase]}`;phaseHint.textContent=phase===0?'中心でACCEL！':phase===1?'中心でTURBO！':'最後のNITROを決めろ！';target.style.width=`${Math.round(m.window*100)}%`;startAt=performance.now();locked=false;loop()}
function loop(now=performance.now()){const m=byKey[state.selected];const period=1800/Math.max(.45,m.tempo*(1+phase*.10));const t=((now-startAt)%period)/period;pos=t<.5?t*2:(1-t)*2;marker.style.left=`${pos*100}%`;raf=requestAnimationFrame(loop)}
tapBtn.onclick=()=>{if(locked)return;locked=true;cancelAnimationFrame(raf);const precision=Math.max(0,1-Math.abs(pos-.5)/.5);vals.push(precision);drawJudges();if(phase<2){phase++;setTimeout(nextPhase,430)}else setTimeout(fly,500)};
function fly(){const m=byKey[state.selected],avg=vals.reduce((a,b)=>a+b,0)/3,combo=vals.filter(v=>v>=.85).length;const distance=Math.round((520+avg*1550+combo*95)*m.power);flightName.textContent=m.name;flightArt.innerHTML=art(m);const car=flightArt.firstElementChild;liveDistance.textContent='0m';show('flight');const t0=performance.now();const dur=1450;function anim(now){const t=Math.min(1,(now-t0)/dur),x=8+t*68,y=43+Math.sin(t*Math.PI)*150;car.style.left=x+'%';car.style.bottom=y+'px';car.style.transform=`scale(1.55) rotate(${(-8+16*t)}deg)`;liveDistance.textContent=Math.round(distance*t)+'m';if(t<1)requestAnimationFrame(anim);else setTimeout(()=>finish(distance,avg),250)}car.style.position='absolute';requestAnimationFrame(anim)}
function finish(distance,avg){const m=byKey[state.selected],r=rec(m.key),before=level(r.xp),gain=10+Math.round(avg*24);r.xp+=gain;r.plays++;r.best=Math.max(r.best,distance);const after=level(r.xp);save();resultName.textContent=m.name;resultDistance.textContent=distance.toLocaleString()+'m';resultPrecision.textContent=(avg*100).toFixed(1)+'%';resultLevel.textContent=after;resultGrowth.innerHTML=`PLAY ${r.plays} · BEST ${r.best.toLocaleString()}m · XP +${gain}${after>before?' · <span class="levelup">LEVEL UP!</span>':''}`;show('result')}
renderHome();renderGrid();
})();
