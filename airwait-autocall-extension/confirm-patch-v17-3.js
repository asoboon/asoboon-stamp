(()=>{
'use strict';
if(window.top!==window)return;

const AUTO_KEY='asoboon_aw_auto_enabled_v172';
const TEST_NAME='テスト入場不可';
const PANEL_ID='asoboon-airwait-auto-v17';
const POLL_MS=120;

const norm=v=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
function visible(el){
  if(!el||!(el instanceof Element))return false;
  const s=getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0;
}
function label(el){return norm(el?.innerText||el?.textContent||el?.value||'')}
function inPanel(el){return !!(el instanceof Element&&el.closest(`#${PANEL_ID}`))}

async function autoEnabled(){
  try{
    const d=await chrome.storage.local.get(AUTO_KEY);
    return d[AUTO_KEY]===true;
  }catch{return false}
}

function confirmationRoot(okButton){
  let cur=okButton;
  for(let i=0;i<14&&cur&&cur!==document.documentElement;i++,cur=cur.parentElement){
    if(inPanel(cur))return null;
    const t=label(cur);
    if(t.includes('呼出の確認')&&t.includes(TEST_NAME)&&/受付番号\s*\d{1,6}/.test(t))return cur;
  }
  return null;
}

function findSafeOkButton(){
  const nodes=[...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')];
  for(const el of nodes){
    if(!visible(el)||inPanel(el))continue;
    if(!/^(OK|ＯＫ)$/i.test(label(el)))continue;
    const root=confirmationRoot(el);
    if(root)return{button:el,root};
  }
  return null;
}

let clicking=false;
async function tick(){
  if(clicking)return;
  if(!(await autoEnabled()))return;
  const hit=findSafeOkButton();
  if(!hit)return;
  if(hit.button.dataset.asoboonAutoConfirmed==='1')return;
  hit.button.dataset.asoboonAutoConfirmed='1';
  clicking=true;
  try{
    hit.button.click();
  }finally{
    setTimeout(()=>{clicking=false},500);
  }
}

setInterval(tick,POLL_MS);
})();
