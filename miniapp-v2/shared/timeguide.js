/* ASOBooN LINE MINI App v2 / Developing play-time guide */
(()=>{'use strict';
const VERSION='1.0.0';
const D=window.ASOBOON_V2_BUSINESS_DAY||{};
const OPENING_TIME='10:00';
let generation=0;
const $=id=>document.getElementById(id);
const pad=v=>String(v).padStart(2,'0');

function parseClock(value){
  const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return NaN;
  const h=Number(m[1]),min=Number(m[2]);
  if(h<0||h>23||min<0||min>59)return NaN;
  return h*60+min;
}
function formatClock(total){
  const n=Math.max(0,Math.min(23*60+59,Math.round(Number(total)||0)));
  return `${pad(Math.floor(n/60))}:${pad(n%60)}`;
}
function formatDate(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${Number(m[2])}月${Number(m[3])}日`:String(value||'');
}
function currentJst(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
function defaultEntry(day){
  const open=parseClock(OPENING_TIME),close=parseClock(day?.closingTime),now=currentJst();
  if(day?.operationalDate===now.date&&Number.isFinite(close)&&now.minutes>=open&&now.minutes<close){
    return formatClock(Math.floor(now.minutes/5)*5);
  }
  return OPENING_TIME;
}
function calculation(day,entryValue){
  if(!day||day.ok!==true)return{ok:false,message:'営業区分を確認できません。'};
  if(day.isClosed)return{ok:false,closed:true,message:'本日は休館日です。'};
  const entry=parseClock(entryValue),open=parseClock(OPENING_TIME),close=parseClock(day.closingTime);
  if(!Number.isFinite(entry))return{ok:false,message:'入場時刻を選択してください。'};
  if(!Number.isFinite(close))return{ok:false,message:'閉館時刻を確認できません。'};
  if(entry<open)return{ok:false,message:`入場時刻は${OPENING_TIME}以降を選択してください。`};
  if(entry>=close)return{ok:false,message:`閉館時刻（${day.closingTime}）より前の入場時刻を選択してください。`};
  const duration=Number(day.durationMinutes||0);
  const unlimited=!Number.isFinite(duration)||duration<=0;
  const end=unlimited?close:Math.min(entry+duration,close);
  return {ok:true,entry,close,duration,unlimited,end,endTime:formatClock(end),limitedByClose:!unlimited&&entry+duration>close};
}

function render(){return `<section class="page-card tg-page"><div class="page-head green"><small>PLAY TIME / DEVELOPING</small><h2>何時まであそべる？</h2></div><div class="page-body tg-body">
<div id="tgStatus" class="tg-status loading"><span>営業カレンダーを確認しています…</span></div>
<div id="tgDay" class="tg-day"><div><small>本日の営業</small><strong>確認中</strong></div><b>—</b></div>
<label class="tg-input"><span>入場した時刻</span><input id="tgEntry" type="time" step="300" value="10:00" disabled></label>
<div id="tgResult" class="tg-result loading"><small>利用終了の目安</small><strong>—</strong><p>営業区分を確認すると自動で計算します。</p></div>
<div class="tg-details"><div><span>利用時間</span><strong id="tgDuration">—</strong></div><div><span>閉館時刻</span><strong id="tgClose">—</strong></div></div>
<button id="tgReload" class="tg-reload" type="button">↻ 営業情報を再確認</button>
<p class="tg-note">終了時刻は目安です。館内アナウンス・スタッフの案内がある場合は、そちらを優先してください。</p>
</div></section>`}

function setStatus(text,kind='loading'){
  const el=$('tgStatus');if(!el)return;
  el.className=`tg-status ${kind}`;el.innerHTML=`<span>${String(text||'')}</span>`;
}
function renderCalculation(day){
  const input=$('tgEntry'),result=$('tgResult');if(!input||!result)return;
  const calc=calculation(day,input.value);
  if(!calc.ok){
    result.className='tg-result '+(calc.closed?'closed':'warn');
    result.querySelector('small').textContent=calc.closed?'本日の営業':'入力を確認してください';
    result.querySelector('strong').textContent=calc.closed?'休館日':'—';
    result.querySelector('p').textContent=calc.message;
    return;
  }
  result.className='tg-result ready';
  result.querySelector('small').textContent='利用終了の目安';
  result.querySelector('strong').textContent=calc.endTime;
  if(calc.unlimited){
    result.querySelector('p').textContent=`本日は時間制限なしです。閉館時刻の${day.closingTime}まで遊べます。`;
  }else if(calc.limitedByClose){
    result.querySelector('p').textContent=`入場から${day.durationLabel}ですが、閉館時刻の${day.closingTime}が終了目安です。`;
  }else{
    result.querySelector('p').textContent=`${input.value}に入場した場合、${day.durationLabel}後の${calc.endTime}が終了目安です。`;
  }
}
async function loadDay({force=false}={}){
  const gen=generation;
  const reload=$('tgReload');if(reload){reload.disabled=true;reload.textContent='確認中…'}
  setStatus('営業カレンダーを確認しています…','loading');
  try{
    if(typeof D.getCurrent!=='function')throw Error('営業日エンジンを読み込めませんでした。');
    const day=await D.getCurrent({force});
    if(gen!==generation||!$('tgEntry'))return;
    const dayEl=$('tgDay');
    dayEl.innerHTML=`<div><small>${formatDate(day.operationalDate)} の営業</small><strong>${day.businessType}</strong></div><b>${day.isClosed?'休館':day.durationLabel}</b>`;
    if($('tgDuration'))$('tgDuration').textContent=day.isClosed?'—':day.durationLabel;
    if($('tgClose'))$('tgClose').textContent=day.closingTime||'—';
    const input=$('tgEntry');input.disabled=Boolean(day.isClosed);input.value=defaultEntry(day);
    window.__ASOBOON_V2_TIMEGUIDE_DAY=day;
    if(day.isClosed)setStatus('本日は休館日です。','closed');
    else setStatus('営業カレンダーから本日の利用時間を確認しました。','ok');
    renderCalculation(day);
  }catch(e){
    if(gen!==generation||!$('tgEntry'))return;
    window.__ASOBOON_V2_TIMEGUIDE_DAY=null;
    $('tgEntry').disabled=true;
    if($('tgDuration'))$('tgDuration').textContent='—';
    if($('tgClose'))$('tgClose').textContent='—';
    setStatus('営業情報を確認できませんでした。','error');
    const result=$('tgResult');result.className='tg-result warn';result.querySelector('small').textContent='利用終了の目安';result.querySelector('strong').textContent='—';result.querySelector('p').textContent=String(e?.message||e||'営業情報の取得に失敗しました。');
  }finally{
    if(gen===generation&&reload){reload.disabled=false;reload.textContent='↻ 営業情報を再確認'}
  }
}
function mount(){
  generation+=1;
  $('tgEntry')?.addEventListener('input',()=>renderCalculation(window.__ASOBOON_V2_TIMEGUIDE_DAY));
  $('tgReload')?.addEventListener('click',()=>void loadDay({force:true}));
  void loadDay({force:true});
}
function unmount(){generation+=1;window.__ASOBOON_V2_TIMEGUIDE_DAY=null}

window.ASOBOON_V2_TIMEGUIDE=Object.freeze({version:VERSION,render,mount,unmount,calculate:calculation});
})();
