(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const REFRESH_MS=10000;
const $=id=>document.getElementById(id);
const state={timer:0,rows:[],slotKey:'',lastColumns:0,lastGoodAt:0,busy:false};

function tokyoParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date);
  const out={};for(const p of parts)if(p.type!=='literal')out[p.type]=p.value;
  return {hour:Number(out.hour||0),minute:Number(out.minute||0),second:Number(out.second||0)};
}
function activeSlotKey(date=new Date()){
  const t=tokyoParts(date),m=t.hour*60+t.minute;
  if(m<12*60)return '10:00';
  if(m<14*60+30)return '12:30';
  return '15:00';
}
function clockText(value){
  const d=value?new Date(value):new Date();
  if(Number.isNaN(d.getTime()))return '--:--:--';
  return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function statusMeta(kind){
  switch(String(kind||'')){
    case'calling':return{label:'呼出中',mark:'',aria:'呼出中'};
    case'done':return{label:'案内済',mark:'✓',aria:'案内済み'};
    case'hold':return{label:'保留',mark:'!',aria:'保留'};
    case'canceled':return{label:'取消',mark:'×',aria:'取消'};
    default:return{label:'',mark:'',aria:'呼出前'};
  }
}
function renderRows(rows){
  const grid=$('queueGrid'),empty=$('emptyState');
  state.rows=Array.isArray(rows)?rows:[];
  if(!grid||!empty)return;
  if(!state.rows.length){grid.innerHTML='';grid.hidden=true;empty.hidden=false;requestAnimationFrame(layoutGrid);return;}
  empty.hidden=true;grid.hidden=false;
  grid.innerHTML=state.rows.map((row,index)=>{
    const kind=['waiting','calling','done','hold','canceled'].includes(String(row?.state||''))?String(row.state):'waiting';
    const m=statusMeta(kind),num=esc(row?.number||'—');
    return '<div class="queue-card '+kind+'" data-index="'+index+'" data-state="'+kind+'" aria-label="受付番号 '+num+' '+m.aria+'">'+
      '<span class="queue-mark" aria-hidden="true">'+m.mark+'</span>'+
      '<strong class="queue-number">'+num+'</strong>'+
      (m.label?'<small class="queue-state">'+m.label+'</small>':'<small class="queue-state blank" aria-hidden="true">呼出前</small>')+
      '</div>';
  }).join('');
  requestAnimationFrame(layoutGrid);
}
function preferredColumns(count){
  if(count<=35)return 4;
  if(count<=60)return 5;
  if(count<=90)return 6;
  if(count<=120)return 7;
  if(count<=150)return 8;
  if(count<=190)return 9;
  return Math.min(18,Math.max(10,Math.ceil(Math.sqrt(count*.62))));
}
function metrics(cols,count,w,h,gap){
  const rows=Math.max(1,Math.ceil(count/cols));
  const cellW=(w-gap*(cols-1))/cols;
  const cellH=(h-gap*(rows-1))/rows;
  const font=Math.min(cellW*.25,cellH*.46);
  return{cols,rows,cellW,cellH,font};
}
function chooseColumns(count,w,h,gap){
  const maxCols=Math.min(Math.max(4,count),18);
  const start=Math.min(maxCols,preferredColumns(count));
  let best=metrics(start,count,w,h,gap);
  for(let cols=4;cols<=maxCols;cols++){
    const m=metrics(cols,count,w,h,gap);
    const shapePenalty=Math.abs((m.cellW/Math.max(1,m.cellH))-1.75)*.35;
    const score=m.font-shapePenalty;
    const bestPenalty=Math.abs((best.cellW/Math.max(1,best.cellH))-1.75)*.35;
    const bestScore=best.font-bestPenalty;
    if(score>bestScore)best=m;
  }
  if(state.lastColumns>=4&&state.lastColumns<=maxCols){
    const old=metrics(state.lastColumns,count,w,h,gap);
    if(old.font>=best.font*.92)best=old;
  }
  state.lastColumns=best.cols;
  return best;
}
function layoutGrid(){
  const grid=$('queueGrid');if(!grid||grid.hidden||!state.rows.length)return;
  const box=grid.getBoundingClientRect(),count=state.rows.length;
  if(box.width<1||box.height<1)return;
  const gap=Math.max(4,Math.min(10,Math.round(Math.min(box.width,box.height)*.006)));
  const m=chooseColumns(count,box.width,box.height,gap);
  const font=Math.max(12,Math.min(52,m.font));
  grid.style.setProperty('--grid-gap',gap+'px');
  grid.style.setProperty('--number-size',font+'px');
  grid.style.setProperty('--state-size',Math.max(9,Math.min(16,font*.34))+'px');
  grid.style.gridTemplateColumns='repeat('+m.cols+', minmax(0, 1fr))';
  grid.style.gridTemplateRows='repeat('+m.rows+', minmax(0, 1fr))';
  grid.classList.toggle('ultra-compact',m.cellH<42||m.cellW<72);
  const callingRows=new Set();
  state.rows.forEach((r,i)=>{if(String(r?.state||'')==='calling')callingRows.add(Math.floor(i/m.cols));});
  grid.querySelectorAll('.queue-card').forEach((card,i)=>{
    const row=Math.floor(i/m.cols);
    let dist=99;callingRows.forEach(r=>{dist=Math.min(dist,Math.abs(r-row));});
    card.classList.toggle('current-band',dist===0);
    card.classList.toggle('near-band',dist===1);
  });
}
function setConnection(ok,text){
  const el=$('connection');if(!el)return;
  el.className='connection '+(ok?'ok':'warn');
  el.innerHTML='<span class="live-dot"></span>'+esc(text);
}
function renderPayload(data){
  const key=activeSlotKey(new Date());
  state.slotKey=key;
  const slot=Array.isArray(data?.slots)?data.slots.find(x=>String(x?.key||'')===key):null;
  $('slotLabel').textContent=key+'の回';
  $('slotCount').textContent=slot&&Number.isFinite(Number(slot.count))?'受付 '+Number(slot.count)+'組':'';
  $('updatedAt').textContent=clockText(data?.fetchedAt||Date.now());
  renderRows(slot?.rows||[]);
  state.lastGoodAt=Date.now();
  setConnection(true,'10秒ごとに自動更新');
}
async function fetchBoard(){
  if(state.busy)return;state.busy=true;
  try{
    if(!E.backendUrl||!/^https:\/\//.test(String(E.backendUrl)))throw Error('掲示板APIが設定されていません');
    const u=new URL(E.backendUrl);u.searchParams.set('action','boardStatus');u.searchParams.set('_',String(Date.now()));
    const r=await fetch(u.toString(),{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
    let d=null;try{d=await r.json()}catch{}
    if(!r.ok||d?.ok!==true)throw Error(String(d?.error||'呼出状況を取得できません'));
    renderPayload(d);
  }catch(e){
    setConnection(false,state.lastGoodAt?'更新待機中':'接続を確認しています');
    if(!state.lastGoodAt){$('slotLabel').textContent=activeSlotKey(new Date())+'の回';$('emptyState').hidden=false;$('emptyTitle').textContent='呼出状況を確認しています';$('emptyText').textContent='通信が戻ると自動で表示します。';}
  }finally{state.busy=false;}
}
function schedule(){clearInterval(state.timer);state.timer=setInterval(fetchBoard,REFRESH_MS);}
window.addEventListener('resize',()=>requestAnimationFrame(layoutGrid));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)fetchBoard();});
window.ASOBOON_CALL_BOARD_TEST=Object.freeze({activeSlotKey,statusMeta,preferredColumns});
fetchBoard();schedule();
})();
