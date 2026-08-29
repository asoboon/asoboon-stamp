(()=>{
'use strict';

const BUILD='17.1.0';
const TEST_WAIT_TYPE_ID='0042';
const TEST_NAME='テスト入場不可';
const PANEL_ID='asoboon-airwait-auto-v17';
const TARGET_POOL=10;
const SCAN_MS=1800;
const CLICK_GAP_MS=1500;
const VERIFY_TIMEOUT_MS=7000;
const LOCK_KEY='asoboon_aw_auto_lock_v17';
const AUTO_KEY='asoboon_aw_auto_enabled_v171';
const INSTANCE=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let auto=false;
let busy=false;
let lastActionAt=0;
let lastMessage='起動しました';
let lastSnapshot=null;
let timer=0;
let overlay=null;
let observer=null;

const norm=v=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function jstMinutes(){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return Number(p.hour)*60+Number(p.minute)+Number(p.second)/60;
}
function inWindow(){const m=jstMinutes();return m>=8*60&&m<18*60}
function visible(el){
  if(!el||!(el instanceof Element))return false;
  const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();return r.width>0&&r.height>0;
}
function inOverlay(el){
  return !!(el instanceof Element && el.closest(`#${PANEL_ID}`));
}
function text(el){return norm(el?.innerText||el?.textContent||'')}
function receiptFromText(s){
  const m=norm(s).match(/(?:^|\D)(\d{3,6})\s*番(?:\D|$)/);
  return m?m[1]:'';
}
function callButtonText(s){
  const t=norm(s);
  if(!t)return false;
  if(/呼出中|再呼出|呼び出し中|取消|キャンセル|保留|完了/.test(t))return false;
  return /^(呼出|呼び出し|呼出する|呼び出す|通常呼出|通常呼び出し)$/.test(t);
}
function callingText(s){return /呼出中|呼び出し中/.test(norm(s))}

function buttonsIn(root){
  return [...root.querySelectorAll('button,[role="button"],a')].filter(el=>visible(el)&&!inOverlay(el));
}
function findTargetLabelElements(){
  const sel='h1,h2,h3,h4,h5,div,span,p,td,th,button,label';
  return [...document.querySelectorAll(sel)].filter(el=>{
    if(!visible(el)||inOverlay(el))return false;
    const t=text(el);
    return t===TEST_NAME || (t.includes(TEST_NAME)&&t.length<=120) || (t.includes(TEST_WAIT_TYPE_ID)&&t.includes('テスト')&&t.length<=160);
  });
}
function candidateScore(root){
  if(!root||!visible(root))return -1;
  const t=text(root);if(!t.includes(TEST_NAME)&&!t.includes(TEST_WAIT_TYPE_ID))return -1;
  const bs=buttonsIn(root);
  const calls=bs.filter(b=>callButtonText(text(b))).length;
  const nums=(t.match(/\d{3,6}\s*番/g)||[]).length;
  const calling=(t.match(/呼出中|呼び出し中/g)||[]).length;
  if(calls===0&&nums===0&&calling===0)return -1;
  const r=root.getBoundingClientRect();
  const area=Math.max(1,r.width*r.height);
  return calls*100+nums*20+calling*20-Math.log(area);
}
function findTargetRoot(){
  const labels=findTargetLabelElements();
  let best=null,bestScore=-Infinity;
  for(const label of labels){
    let cur=label;
    for(let i=0;i<10&&cur&&cur!==document.documentElement;i++,cur=cur.parentElement){
      const sc=candidateScore(cur);
      if(sc>bestScore){bestScore=sc;best=cur}
      if(sc>=120)break;
    }
  }
  return best;
}
function nearestRow(el,root){
  let cur=el;
  let best=null;
  for(let i=0;i<8&&cur&&cur!==root?.parentElement;i++,cur=cur.parentElement){
    const t=text(cur);const no=receiptFromText(t);
    if(no){
      const calls=buttonsIn(cur).filter(b=>callButtonText(text(b))).length;
      const callings=callingText(t);
      if(calls<=2||callings){best={el:cur,receipt:no,text:t};break}
    }
    if(cur===root)break;
  }
  return best;
}
function snapshot(){
  const root=findTargetRoot();
  if(!root)return{root:null,calling:new Set(),available:[],message:'テスト枠0042を画面内に検出できません'};
  const calling=new Set();
  const available=[];
  const seenRows=new Set();

  for(const el of [...root.querySelectorAll('tr,li,section,article,div')]){
    if(!visible(el)||inOverlay(el))continue;
    const t=text(el);if(!callingText(t))continue;
    const no=receiptFromText(t);if(no)calling.add(no);
  }

  for(const btn of buttonsIn(root)){
    if(!callButtonText(text(btn)))continue;
    const row=nearestRow(btn,root);if(!row||!row.receipt)continue;
    const key=row.receipt+'|'+row.text.slice(0,80);if(seenRows.has(key))continue;seenRows.add(key);
    if(calling.has(row.receipt))continue;
    available.push({button:btn,row:row.el,receipt:row.receipt,rowText:row.text});
  }

  available.sort((a,b)=>{
    if(a.row===b.row)return 0;
    const pos=a.row.compareDocumentPosition(b.row);
    return pos&Node.DOCUMENT_POSITION_FOLLOWING?-1:1;
  });

  return{root,calling,available,message:`0042検出 / 呼出中 ${calling.size}/${TARGET_POOL} / 呼出候補 ${available.length}`};
}

async function loadAuto(){
  try{const d=await chrome.storage.local.get(AUTO_KEY);auto=d[AUTO_KEY]===true}catch{auto=false}
}
async function setAuto(v,msg=''){
  auto=!!v;try{await chrome.storage.local.set({[AUTO_KEY]:auto})}catch{}
  if(msg)lastMessage=msg;renderOverlay();
}
async function acquireLock(){
  const now=Date.now();
  try{
    const d=await chrome.storage.local.get(LOCK_KEY);const l=d[LOCK_KEY];
    if(l&&l.owner!==INSTANCE&&now-Number(l.at||0)<6000)return false;
    await chrome.storage.local.set({[LOCK_KEY]:{owner:INSTANCE,at:now}});
    const verify=(await chrome.storage.local.get(LOCK_KEY))[LOCK_KEY];
    return verify?.owner===INSTANCE;
  }catch{return true}
}
async function releaseLock(){
  try{const d=await chrome.storage.local.get(LOCK_KEY);if(d[LOCK_KEY]?.owner===INSTANCE)await chrome.storage.local.remove(LOCK_KEY)}catch{}
}

function findDialogFor(receipt){
  const selectors='[role="dialog"],dialog,.modal,.Modal,[class*="modal"],[class*="dialog"]';
  return [...document.querySelectorAll(selectors)].filter(el=>visible(el)&&!inOverlay(el)).find(el=>{
    const t=text(el);return /呼出|呼び出/.test(t)&&(t.includes(receipt)||t.includes(TEST_NAME)||t.length<260);
  })||null;
}
async function confirmIfNeeded(receipt){
  for(let i=0;i<8;i++){
    await sleep(180);
    const dlg=findDialogFor(receipt);if(!dlg)continue;
    const btn=buttonsIn(dlg).find(b=>/^(呼出|呼び出し|呼出する|呼び出す|確定|はい|OK|ＯＫ)$/.test(norm(text(b))));
    if(btn){btn.click();lastMessage=`${receipt}番 確認ダイアログを確定`;return true}
  }
  return false;
}
async function verifyCalled(receipt,beforeCount){
  const start=Date.now();
  while(Date.now()-start<VERIFY_TIMEOUT_MS){
    await sleep(450);
    const s=snapshot();lastSnapshot=s;
    if(s.calling.has(receipt)||s.calling.size>beforeCount)return true;
  }
  return false;
}
async function clickNext(s){
  if(!s.available.length)return false;
  const next=s.available[0];
  if(!visible(next.button))return false;
  if(Date.now()-lastActionAt<CLICK_GAP_MS)return false;
  if(!(await acquireLock()))return false;
  busy=true;
  try{
    const before=s.calling.size;
    lastActionAt=Date.now();
    lastMessage=`${next.receipt}番 を通常呼出操作中…`;
    renderOverlay();
    next.button.click();
    await confirmIfNeeded(next.receipt);
    const ok=await verifyCalled(next.receipt,before);
    if(!ok){
      await setAuto(false,`安全停止：${next.receipt}番の「呼出中」反映を確認できませんでした`);
      return false;
    }
    lastMessage=`✅ ${next.receipt}番 呼出中を確認`;
    return true;
  }catch(e){
    await setAuto(false,`安全停止：${String(e?.message||e)}`);
    return false;
  }finally{busy=false;await releaseLock();renderOverlay()}
}

function ensureOverlay(){
  if(overlay&&document.contains(overlay))return overlay;
  const host=document.createElement('div');host.id=PANEL_ID;
  host.style.cssText='position:fixed;right:14px;bottom:14px;z-index:2147483647;width:310px;background:#071820;color:#fff;border:2px solid #d5a84b;border-radius:16px;box-shadow:0 12px 35px rgba(0,0,0,.38);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;padding:12px;line-height:1.45';
  host.innerHTML=`<div style="font-size:11px;color:#e7c66f;font-weight:900">ASOBooN / AIRWAIT AUTO v${BUILD}</div><div id="asoAutoState" style="font-size:18px;font-weight:1000;margin-top:3px">--</div><div id="asoAutoMetrics" style="font-size:12px;color:#bed0d7;margin-top:5px">確認中…</div><div id="asoAutoMsg" style="font-size:11px;color:#dbe7eb;margin-top:7px;max-height:72px;overflow:auto"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px"><button id="asoAutoOn" style="min-height:38px;border:0;border-radius:10px;background:#2f6d4b;color:#fff;font-weight:900;cursor:pointer">▶ AUTO ON</button><button id="asoAutoOff" style="min-height:38px;border:0;border-radius:10px;background:#7d372f;color:#fff;font-weight:900;cursor:pointer">■ OFF</button></div><div style="font-size:10px;color:#8ea8b2;margin-top:7px">0042「テスト入場不可」限定 / 08:00–18:00 / 最大10組</div>`;
  document.documentElement.appendChild(host);overlay=host;
  host.querySelector('#asoAutoOn').onclick=()=>setAuto(true,'AUTO ON');
  host.querySelector('#asoAutoOff').onclick=()=>setAuto(false,'AUTO OFF');
  return host;
}
function renderOverlay(){
  const h=ensureOverlay();const s=lastSnapshot||snapshot();lastSnapshot=s;
  const state=h.querySelector('#asoAutoState'),metrics=h.querySelector('#asoAutoMetrics'),msg=h.querySelector('#asoAutoMsg');
  state.textContent=auto?'AUTO ON':'AUTO OFF';state.style.color=auto?'#75e49d':'#ff9c90';
  const hrs=inWindow()?'時間内':'時間外';
  metrics.textContent=`${hrs}｜呼出中 ${s.calling?.size||0}/${TARGET_POOL}｜候補 ${s.available?.length||0}`;
  msg.textContent=`${s.message||''}\n${lastMessage||''}`;
}

async function tick(){
  clearTimeout(timer);
  try{
    const s=snapshot();lastSnapshot=s;renderOverlay();
    if(auto&&!busy&&inWindow()&&s.root&&s.calling.size<TARGET_POOL&&s.available.length){
      await clickNext(s);
    }
  }catch(e){lastMessage=`監視エラー: ${String(e?.message||e)}`;renderOverlay()}
  finally{timer=setTimeout(tick,SCAN_MS)}
}

function startObserver(){
  if(observer)return;
  observer=new MutationObserver(records=>{
    const external=records.some(r=>{
      const t=r.target instanceof Element?r.target:r.target?.parentElement;
      return !t||!inOverlay(t);
    });
    if(!external)return;
    if(timer){clearTimeout(timer);timer=setTimeout(tick,350)}
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','aria-hidden','disabled']});
}

(async()=>{
  await loadAuto();ensureOverlay();startObserver();tick();
})();
})();
