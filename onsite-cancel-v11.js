(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const STORAGE_KEY='asoboon_current_reservation_v3';
const CALL_KEY='asoboon_callstatus_number_v4';
const NOTICE_KEY='asoboon_cancel_notice_v1';
const OLD_PENDING_KEY='asoboon_cancel_pending_v2';
const API='https://cl.airwait.jp/WCLP/api/external/stateless/reservations';
let busy=false,lastCheck=0;

const receiptKey=v=>String(v??'').normalize('NFKC').replace(/\D/g,'').replace(/^0+(?=\d)/,'');
function current(){try{const r=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return r&&r.receiptNo&&r.waitTypeId?r:null}catch{return null}}
function notice(){try{const r=JSON.parse(localStorage.getItem(NOTICE_KEY)||'null');return r&&r.receiptNo?r:null}catch{return null}}
function airwaitUrl(v){try{const u=new URL(String(v||''));return u.protocol==='https:'&&/(^|\.)airwait\.jp$/i.test(u.hostname)?u.href:''}catch{return''}}
function clearActive(rec){
  try{localStorage.removeItem(STORAGE_KEY)}catch{}
  try{const x=JSON.parse(localStorage.getItem(CALL_KEY)||'null');if(!x||receiptKey(x.number)===receiptKey(rec?.receiptNo))localStorage.removeItem(CALL_KEY)}catch{try{localStorage.removeItem(CALL_KEY)}catch{}}
}
function rememberCancelled(rec){try{localStorage.setItem(NOTICE_KEY,JSON.stringify({receiptNo:String(rec.receiptNo),waitTypeName:String(rec.waitTypeName||'現地受付'),cancelledAt:Date.now()}))}catch{}}
function success(d){return d?.success===true||String(d?.resultCode?.code??'')==='0000'}
async function page(rec,start,kind){
  const body={storeId:C.airwaitStoreId||'',waitTypeId:String(rec?.waitTypeId||''),sortStatus:'0',isDesc:'1',start:String(start),limit:'100'};
  if(kind==='active')body.isEnabledStatus='1';
  if(kind==='cancel')body.status='3';
  const r=await fetch(`${API}?key=${encodeURIComponent(C.airwaitApiKey||'')}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams(body),cache:'no-store',credentials:'omit'});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const d=await r.json();if(!success(d))throw new Error(d?.resultCode?.defaultMessage||'reservation read failed');
  return{rows:Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[],count:Number(d?.innerDto?.count||0)};
}
async function contains(rec,kind){
  let start=1,seen=0;const target=receiptKey(rec?.receiptNo);
  for(let i=0;i<30;i++){
    const p=await page(rec,start,kind);
    if(p.rows.some(x=>String(x?.waitTypeId??'')===String(rec?.waitTypeId??'')&&receiptKey(x?.number)===target))return true;
    seen+=p.rows.length;if(!p.rows.length||p.rows.length<100||(p.count&&seen>=p.count))break;start+=p.rows.length;
  }
  return false;
}
function showNotice(){
  const rec=notice();if(!rec)return;
  const apply=()=>{
    const flow=document.getElementById('receptionFlow');if(!flow)return false;
    let box=document.getElementById('asbCancelledNotice');
    if(!box){box=document.createElement('div');box.id='asbCancelledNotice';box.style.cssText='margin:12px 0;padding:14px;border:2px solid #d7a59e;border-radius:15px;background:#fff0ed;color:#85362e;font-size:.74rem;line-height:1.55;font-weight:850;box-shadow:0 7px 16px rgba(66,42,27,.08)';flow.parentNode.insertBefore(box,flow)}
    box.innerHTML=`<strong style="display:block;font-size:.9rem">${String(rec.receiptNo)}番はキャンセルされました</strong><span style="display:block;margin-top:4px">Airウェイトの取消を確認したため、ミニアプリの受付済み状態も解除しました。新しい現地受付を行えます。</span><button id="asbDismissCancelled" type="button" style="display:block;width:100%;min-height:44px;margin-top:10px;border:1px solid #c89a92;border-radius:11px;background:#fffaf0;color:#71332d;font-weight:950">表示を消す</button>`;
    document.getElementById('asbDismissCancelled')?.addEventListener('click',()=>{try{localStorage.removeItem(NOTICE_KEY)}catch{}box.remove()});return true;
  };
  if(!apply()){let n=0;const t=setInterval(()=>{if(apply()||++n>40)clearInterval(t)},200)}
}
function installCancelButton(){
  const apply=()=>{
    const rec=current(),host=document.querySelector('#currentCard .current-actions');if(!host)return false;
    let b=document.getElementById('asbAirwaitCancelBtn');
    if(!b){b=document.createElement('button');b.id='asbAirwaitCancelBtn';b.type='button';b.className='btn light';b.style.cssText='grid-column:1/-1;border:2px solid #d49d94;background:#fff0ed;color:#8b3028';b.textContent='予約をキャンセルする';host.appendChild(b);b.addEventListener('click',()=>{const r=current();if(!r)return;const url=airwaitUrl(r.shortUrl);if(!url){alert('この受付はミニアプリからキャンセル画面を開けません。スタッフへお声がけください。');return}if(!confirm(`${r.receiptNo}番の予約をキャンセルしますか？\n\nAirウェイトの正式なキャンセル画面へ移動します。`))return;location.href=url})}
    b.hidden=!(rec&&airwaitUrl(rec.shortUrl));return true;
  };
  if(!apply()){let n=0;const t=setInterval(()=>{if(apply()||++n>40)clearInterval(t)},200)}
}
async function reconcileCurrent(force=false){
  const rec=current();if(!rec||busy)return;
  const now=Date.now();if(!force&&now-lastCheck<5000)return;lastCheck=now;busy=true;
  try{
    // AirWAITの有効ステータス（待ち・保留・対応中）に存在する受付だけを「受付済み」とする。
    const active=await contains(rec,'active');
    if(active)return;
    // 有効でなければ端末ロックを即解除。取消だった場合だけ通知を残す。
    let cancelled=false;try{cancelled=await contains(rec,'cancel')}catch{}
    if(cancelled)rememberCancelled(rec);
    clearActive(rec);
    const u=new URL(location.href);u.searchParams.set('from','miniapp-secret');u.searchParams.set('released','1');u.searchParams.set('_',String(Date.now()));location.replace(u.href);
  }catch(e){console.warn('onsite active-state reconciliation failed',e)}finally{busy=false}
}
function clearStaleActiveByDay(){
  const rec=current();if(!rec)return;
  try{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const today=`${p.year}-${p.month}-${p.day}`;if(rec.operationalDay&&String(rec.operationalDay)<today)clearActive(rec)}catch{}
}
try{localStorage.removeItem(OLD_PENDING_KEY)}catch{}
clearStaleActiveByDay();showNotice();installCancelButton();reconcileCurrent(true);
setInterval(()=>{installCancelButton();reconcileCurrent(false)},6000);
window.addEventListener('online',()=>reconcileCurrent(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcileCurrent(true)});
window.addEventListener('pageshow',()=>{showNotice();reconcileCurrent(true)});
})();
