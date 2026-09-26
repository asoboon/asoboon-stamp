(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const FX=window.ASOBOON_BOARD_ANIMATIONS||null;
const IDLE=window.ASOBOON_BOARD_IDLE_EVENTS||null;
const DIRECTOR=window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR||null;
const REFRESH_MS=10000;
const $=id=>document.getElementById(id);
const state={timer:0,rows:[],slotKey:'',businessType:'',phase:'',lastColumns:0,lastGoodAt:0,busy:false};
const BOARD_OPEN_MINUTE=8*60;
const CLOSE_MINUTES=Object.freeze({'平日':17*60,'平日特定日':17*60,'土日祝日':18*60});

function tokyoParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date);
  const out={};for(const p of parts)if(p.type!=='literal')out[p.type]=p.value;
  return {year:Number(out.year||0),month:Number(out.month||0),day:Number(out.day||0),hour:Number(out.hour||0),minute:Number(out.minute||0),second:Number(out.second||0)};
}
function tokyoDateKey(date=new Date()){
  const t=tokyoParts(date),pad=v=>String(v).padStart(2,'0');
  return String(t.year)+'-'+pad(t.month)+'-'+pad(t.day);
}
function resolveBoardContext(date=new Date(),businessType=''){
  const type=String(businessType||''),t=tokyoParts(date),m=t.hour*60+t.minute;
  if(type==='休館')return{businessType:type,phase:'closed',slotKey:'',slotLabel:'休館日',slotSuffix:'',detail:'本日は休館日です'};
  if(!CLOSE_MINUTES[type])return{businessType:type,phase:'checking',slotKey:'',slotLabel:'確認中',slotSuffix:'',detail:'営業情報を確認しています'};
  if(m<BOARD_OPEN_MINUTE)return{businessType:type,phase:'before',slotKey:'',slotLabel:'まもなく',slotSuffix:'',detail:'8:00から呼出状況を表示します'};
  if(m>=CLOSE_MINUTES[type])return{businessType:type,phase:'ended',slotKey:'',slotLabel:'終了',slotSuffix:'',detail:'本日のご案内は終了しました'};
  if(type==='平日')return{businessType:type,phase:'active',slotKey:'weekday',slotLabel:'受付中',slotSuffix:'',detail:'時間制限なし'};
  if(type==='平日特定日'){
    const key=m<13*60?'10:00':'13:30';
    return{businessType:type,phase:'active',slotKey:key,slotLabel:key,slotSuffix:'の回',detail:'3時間利用'};
  }
  const key=m<12*60?'10:00':m<14*60+30?'12:30':'15:00';
  return{businessType:type,phase:'active',slotKey:key,slotLabel:key,slotSuffix:'の回',detail:'2時間30分利用'};
}
function activeSlotKey(date=new Date(),businessType='土日祝日'){
  return resolveBoardContext(date,businessType).slotKey;
}
function clockText(value){
  const d=value?new Date(value):new Date();
  if(Number.isNaN(d.getTime()))return '--:--:--';
  return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rowKey(row,index){
  const number=String(row?.number||'').trim();
  const order=Number(row?.order);
  return number+'::'+(Number.isFinite(order)?order:index+1);
}
function normalizeRows(rows){
  return (Array.isArray(rows)?rows:[]).map((row,index)=>({...row,__key:rowKey(row,index)}));
}
function statusMeta(kind){
  switch(String(kind||'')){
    case'calling':return{label:'呼出中',icon:'▶',aria:'呼出中'};
    case'done':return{label:'案内済',icon:'✓',aria:'案内済み'};
    case'hold':return{label:'保留',icon:'Ⅱ',aria:'保留'};
    default:return{label:'呼出前',icon:'•',aria:'呼出前'};
  }
}
function visibleRows(rows){
  return (Array.isArray(rows)?rows:[]).filter(row=>String(row?.state||'')!=='canceled');
}
function renderRows(rows){
  const grid=$('queueGrid'),empty=$('emptyState');
  state.rows=visibleRows(rows);
  if(!grid||!empty)return;
  if(!state.rows.length){grid.innerHTML='';grid.hidden=true;empty.hidden=false;requestAnimationFrame(layoutGrid);return;}
  empty.hidden=true;grid.hidden=false;
  grid.innerHTML=state.rows.map((row,index)=>{
    const kind=['waiting','calling','done','hold'].includes(String(row?.state||''))?String(row.state):'waiting';
    const m=statusMeta(kind),num=esc(row?.number||'—'),key=esc(row?.__key||rowKey(row,index));
    return '<div class="queue-card '+kind+'" data-index="'+index+'" data-row-key="'+key+'" data-state="'+kind+'" aria-label="受付番号 '+num+' '+m.aria+'">'+
      '<div class="number-wrap"><strong class="queue-number">'+num+'</strong></div>'+
      '<div class="status-rail"><span class="status-icon" aria-hidden="true">'+m.icon+'</span><span class="status-label">'+m.label+'</span></div>'+
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
  const rail=Math.max(13,Math.min(28,cellH*.25));
  const numberH=Math.max(1,cellH-rail);
  const font=Math.min(cellW*.29,numberH*.54);
  return{cols,rows,cellW,cellH,rail,font};
}
function chooseColumns(count,w,h,gap){
  const maxCols=Math.min(Math.max(4,count),18);
  const start=Math.min(maxCols,preferredColumns(count));
  let best=metrics(start,count,w,h,gap);
  for(let cols=4;cols<=maxCols;cols++){
    const m=metrics(cols,count,w,h,gap);
    const shapePenalty=Math.abs((m.cellW/Math.max(1,m.cellH))-1.65)*.3;
    const score=m.font-shapePenalty;
    const bestPenalty=Math.abs((best.cellW/Math.max(1,best.cellH))-1.65)*.3;
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
  const gap=Math.max(4,Math.min(10,Math.round(Math.min(box.width,box.height)*.0055)));
  const m=chooseColumns(count,box.width,box.height,gap);
  const font=Math.max(12,Math.min(58,m.font));
  grid.style.setProperty('--grid-gap',gap+'px');
  grid.style.setProperty('--number-size',font+'px');
  grid.style.setProperty('--state-size',Math.max(8,Math.min(15,font*.29))+'px');
  grid.style.gridTemplateColumns='repeat('+m.cols+', minmax(0, 1fr))';
  grid.style.gridTemplateRows='repeat('+m.rows+', minmax(0, 1fr))';
  grid.classList.toggle('ultra-compact',m.cellH<42||m.cellW<68);
  const callingRows=new Set();
  state.rows.forEach((r,i)=>{if(String(r?.state||'')==='calling')callingRows.add(Math.floor(i/m.cols));});
  grid.querySelectorAll('.queue-card').forEach((card,i)=>{
    const row=Math.floor(i/m.cols);
    let dist=99;callingRows.forEach(r=>{dist=Math.min(dist,Math.abs(r-row));});
    card.classList.toggle('current-band',dist===0);
    card.classList.toggle('near-band',dist===1);
  });
  const live=$('liveCaption');
  if(live){
    const callingNumbers=state.rows.filter(r=>String(r?.state||'')==='calling').map(r=>String(r?.number||'').trim()).filter(Boolean);
    live.textContent=callingNumbers.length===0?'呼出状況':callingNumbers.length===1?'ただいまご案内中 '+callingNumbers[0]:'ただいまご案内中 '+callingNumbers[0]+'〜'+callingNumbers[callingNumbers.length-1];
  }
}
function setConnection(ok,text){
  const el=$('connection');if(!el)return;
  el.className='connection '+(ok?'ok':'warn');
  el.innerHTML='<span class="live-dot"></span>'+esc(text);
}
function setSessionHeader(context,countText=''){
  const kicker=$('sessionKicker'),label=$('slotLabel'),suffix=$('slotSuffix'),count=$('slotCount');
  if(kicker)kicker.textContent=context.phase==='active'?'本日のご案内':'営業案内';
  if(label)label.textContent=context.slotLabel||'確認中';
  if(suffix){suffix.textContent=context.slotSuffix||'';suffix.hidden=!context.slotSuffix;}
  if(count)count.textContent=countText||context.detail||'';
}
function updateDiagnostics(context,data){
  const el=$('boardDiagnostics');if(!el)return;
  const debug=new URLSearchParams(location.search).get('debug')==='1'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  el.hidden=!debug;
  if(!debug)return;
  const director=DIRECTOR?.getDiagnostics?.()||null;
  const char=window.ASOBOON_BOARD_CHARACTER_EVENTS?.getDiagnostics?.()||null;
  const perf=window.ASOBOON_BOARD_EFFECTS?.diagnostics?.()||null;
  el.textContent=[
    String(data?.businessDate||tokyoDateKey()),
    'MODE: '+String(context?.businessType||data?.businessType||'UNKNOWN'),
    'SLOT: '+String(context?.slotKey||'NONE'),
    'PHASE: '+String(context?.phase||'UNKNOWN'),
    'ENT: '+String(director?.lastDecision||'—'),
    'CHAR: '+String(char?.currentId||'—'),
    'CHAR RATE: '+(director?.played?Math.round(Number(director.characterRate||0)*100)+'%':'—'),
    'QUALITY: '+String(perf?.effectiveQuality||'—'),
    'FPS: '+String(perf?.fps??'—')
  ].join(' / ');
}
function renderStaticBoard(context,data){
  if(DIRECTOR?.suspend)DIRECTOR.suspend(context?.phase||'inactive');else IDLE?.cancelIdleEvent?.('board-inactive');
  state.rows=[];state.lastColumns=0;
  const grid=$('queueGrid'),empty=$('emptyState');
  if(grid){grid.innerHTML='';grid.hidden=true;}
  if(empty)empty.hidden=false;
  setSessionHeader(context,'');
  $('updatedAt').textContent=clockText(data?.fetchedAt||Date.now());
  const title=$('emptyTitle'),text=$('emptyText');
  if(context.phase==='closed'){
    if(title)title.textContent='本日は休館日です';
    if(text)text.textContent='またあそびにきてね！';
    setConnection(true,'休館日');
  }else if(context.phase==='before'){
    if(title)title.textContent='まもなく表示開始';
    if(text)text.textContent='8:00から呼出状況を表示します。';
    setConnection(true,'営業開始前');
  }else if(context.phase==='ended'){
    if(title)title.textContent='本日のご案内は終了しました';
    if(text)text.textContent='またあそびにきてね！';
    setConnection(true,'本日の営業終了');
  }else{
    if(title)title.textContent='営業情報を確認しています';
    if(text)text.textContent='確認でき次第、自動で表示します。';
    setConnection(false,'営業情報を確認中');
  }
  updateDiagnostics(context,data);
}
function renderPayload(data){
  const context=resolveBoardContext(new Date(),data?.businessType);
  state.businessType=context.businessType;
  state.phase=context.phase;
  state.slotKey=context.slotKey;
  updateDiagnostics(context,data);

  if(data?.businessDate&&String(data.businessDate)!==tokyoDateKey(new Date())){
    renderStaticBoard({...context,phase:'checking',slotKey:'',slotLabel:'確認中',slotSuffix:'',detail:'営業日を確認しています'},data);
    return;
  }
  if(context.phase!=='active'){
    renderStaticBoard(context,data);
    state.lastGoodAt=Date.now();
    return;
  }

  const slot=Array.isArray(data?.slots)?data.slots.find(x=>String(x?.key||'')===context.slotKey):null;
  if(!slot){
    renderStaticBoard({...context,phase:'checking',slotKey:'',slotLabel:'確認中',slotSuffix:'',detail:'受付枠を確認しています'},data);
    return;
  }

  const allRows=normalizeRows(slot?.rows||[]);
  const grid=$('queueGrid');
  const previousFrame=FX?.capture?.(grid)||new Map();
  const rows=visibleRows(allRows);

  setSessionHeader(context,rows.length?'受付 '+rows.length+'組':context.detail);
  $('updatedAt').textContent=clockText(data?.fetchedAt||Date.now());
  const emptyTitle=$('emptyTitle'),emptyText=$('emptyText');
  if(emptyTitle)emptyTitle.textContent='ただいま準備中';
  if(emptyText)emptyText.textContent='受付が入ると、ここに番号が並びます。';

  // Data/render updates are immediate. The animation module only visualizes
  // state transitions after the fresh DOM is already on screen.
  renderRows(allRows);
  const observation=FX?.observe?.({
    slotKey:context.businessType+'::'+context.slotKey,
    rows:allRows,
    previousFrame,
    grid,
    onBeforeRealChange:()=>{if(DIRECTOR?.onRealChange)DIRECTOR.onRealChange();else IDLE?.onRealChange?.()},
  })||{baseline:false,dataChangeCount:0};

  if(observation.baseline){
    if(DIRECTOR?.onBaseline)DIRECTOR.onBaseline();else IDLE?.onBaseline?.();
  }else if(Number(observation.dataChangeCount||0)===0){
    if(DIRECTOR?.onStableUpdate)void DIRECTOR.onStableUpdate({grid});else void IDLE?.onStableUpdate?.({grid});
  }

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
    if(DIRECTOR?.onCommunicationError)DIRECTOR.onCommunicationError();else IDLE?.onCommunicationError?.();
    setConnection(false,state.lastGoodAt?'更新待機中':'接続確認中');
    if(!state.lastGoodAt){
      setSessionHeader({phase:'checking',slotLabel:'確認中',slotSuffix:'',detail:'呼出状況を確認しています'});
      $('emptyState').hidden=false;
      $('emptyTitle').textContent='呼出状況を確認しています';
      $('emptyText').textContent='通信が戻ると自動で表示します。';
    }
  }finally{state.busy=false;}
}
function schedule(){clearInterval(state.timer);state.timer=setInterval(fetchBoard,REFRESH_MS);}
window.addEventListener('resize',()=>requestAnimationFrame(layoutGrid));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)fetchBoard();});
window.ASOBOON_CALL_BOARD_TEST=Object.freeze({
  activeSlotKey,
  resolveBoardContext,
  tokyoDateKey,
  statusMeta,
  preferredColumns,
  visibleRows,
  normalizeRows,
  refresh:fetchBoard,
  idle:()=>IDLE?.getDiagnostics?.()||null,
  director:()=>DIRECTOR?.getDiagnostics?.()||null,
  characters:()=>window.ASOBOON_BOARD_CHARACTER_EVENTS?.getDiagnostics?.()||null,
});
fetchBoard();schedule();
})();
