(() => {
'use strict';
const API='https://script.google.com/macros/s/AKfycbzRloV2xRDDKtf2-0gbO6NuF3sFA-xyjCrP9ahknx2gBI9Rf8O3-hfVGq4msMu9kRsusQ/exec';
const EXPECTED_RUN_API='1.1.0';
const EXPECTED_RUN_DB='1y0WU_DB4huHELEtTbuoAjhZtomP7nd6af7LicNUF7ro';
const ID_KEY='boonjump_world_player_id_v1';
const NAME_KEY='boonjump_world_player_name_v1';
const TOKEN_KEY='boonjump_world_player_token_v1';
const RANK_CACHE_PREFIX='boonrun_rank_cache_v131:';
const HEALTH_CACHE_KEY='boonrun_rank_health_v131';
const HEALTH_FRESH_MS=60*60*1000;
const TIMEOUT=16000;
const FRESH_MS=45000;
const STALE_MS=15*60*1000;
const safeGet=k=>{try{return localStorage.getItem(k)||''}catch{return''}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,String(v||''));return true}catch{return false}};
function id(prefix){let r='';try{r=[...crypto.getRandomValues(new Uint32Array(4))].map(v=>v.toString(36)).join('')}catch{r=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}return `${prefix}-${Date.now().toString(36)}-${r}`}
function playerId(){let v=safeGet(ID_KEY);if(!v){v=id('player');safeSet(ID_KEY,v)}return v}
function playerToken(){let v=safeGet(TOKEN_KEY);if(!v){v=id('token');safeSet(TOKEN_KEY,v)}return v}
function playerName(){return safeGet(NAME_KEY)}
function setPlayerName(v){safeSet(NAME_KEY,String(v||''))}
function validateName(v){const n=String(v||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g,'').trim();const l=[...n].length;if(l<2||l>12)throw new Error('ランキングネームは2〜12文字です。');if(/https?:\/\/|www\.|@/i.test(n))throw new Error('URLや連絡先は名前に使用できません。');return n}
function jsonp(params,timeout=TIMEOUT){return new Promise((resolve,reject)=>{const cb=`__boonrun_${Date.now()}_${Math.random().toString(36).slice(2)}`;const s=document.createElement('script');let done=false;let t=0;const finish=(e,d)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch{};try{s.remove()}catch{};e?reject(e):resolve(d)};window[cb]=d=>d&&d.ok?finish(null,d):finish(new Error(d?.error||d?.reason||'ランキング通信に失敗しました。'));const q=new URLSearchParams({...params,callback:cb,_t:String(Date.now())});s.src=`${API}?${q}`;s.async=true;s.onerror=()=>finish(new Error('ランキングサーバーへ接続できませんでした。'));document.head.appendChild(s);t=setTimeout(()=>finish(new Error('ランキング通信がタイムアウトしました。')),timeout)})}
async function post(payload){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});if(!r.ok)throw new Error('ランキングサーバーへ接続できませんでした。');const d=await r.json();if(!d?.ok)throw new Error(d?.error||d?.reason||'ランキング通信に失敗しました。');return d}
function health(){return jsonp({action:'run_health'})}
let backendPromise=null;
function cachedHealth(){
  try{
    const x=JSON.parse(safeGet(HEALTH_CACHE_KEY)||'null');
    if(!x||!Number.isFinite(x.at)||Date.now()-x.at>HEALTH_FRESH_MS)return null;
    const h=x.data||{};
    if(String(h.api_version||'')!==EXPECTED_RUN_API||String(h.run_db||'')!==EXPECTED_RUN_DB)return null;
    return h;
  }catch{return null;}
}
function storeHealth(h){try{safeSet(HEALTH_CACHE_KEY,JSON.stringify({at:Date.now(),data:h}));}catch{}return h;}
function ensureBackend(force=false){
  if(!force){const cached=cachedHealth();if(cached)return Promise.resolve(Object.assign({},cached,{_client_health_cache:true}));}
  if(!backendPromise||force)backendPromise=health().then(h=>{
    if(String(h.api_version||'')!==EXPECTED_RUN_API||String(h.run_db||'')!==EXPECTED_RUN_DB){
      throw new Error('ランキングGASが旧版です。V2.6.0を再デプロイしてください。');
    }
    return storeHealth(h);
  }).catch(err=>{backendPromise=null;throw err;});
  return backendPromise;
}
function rankKey(period='all',machineId=''){return `${String(period||'all').toLowerCase()}|${String(machineId||'')}`}
const rankMemory=new Map();
const rankInflight=new Map();
function storageKey(key){return `${RANK_CACHE_PREFIX}${key}`}
function readStored(key){
  try{const raw=localStorage.getItem(storageKey(key));if(!raw)return null;const x=JSON.parse(raw);if(!x||!x.data||!Number.isFinite(x.at)||Date.now()-x.at>STALE_MS){localStorage.removeItem(storageKey(key));return null;}return x;}catch{return null}
}
function cacheEntry(key){
  const mem=rankMemory.get(key);if(mem&&Date.now()-mem.at<=STALE_MS)return mem;
  const stored=readStored(key);if(stored){rankMemory.set(key,stored);return stored;}
  return null;
}
function writeRankCache(period,machineId,data,limit){
  if(!data?.ok)return data;
  const key=rankKey(period,machineId),entry={at:Date.now(),limit:Math.max(1,Number(limit)||0),data};
  rankMemory.set(key,entry);
  try{localStorage.setItem(storageKey(key),JSON.stringify(entry))}catch{}
  return data;
}
function peekLeaderboard(period='all',machineId='',maxAge=STALE_MS){
  const entry=cacheEntry(rankKey(period,machineId));
  if(!entry||Date.now()-entry.at>maxAge)return null;
  return Object.assign({},entry.data,{_client_cache:true,_cache_age_ms:Date.now()-entry.at,_cache_limit:entry.limit});
}
function hasFreshEnough(period,machineId,limit){
  const entry=cacheEntry(rankKey(period,machineId));
  if(!entry||Date.now()-entry.at>FRESH_MS)return null;
  if(entry.limit<Math.max(1,Number(limit)||1))return null;
  return Object.assign({},entry.data,{_client_cache:true,_cache_age_ms:Date.now()-entry.at,_cache_limit:entry.limit});
}
async function startSession(machineId,build,version){await ensureBackend();return jsonp({action:'run_start',player_id:playerId(),player_token:playerToken(),machine_id:machineId,source_build:build,client_version:version},18000)}
function seedDashboard(d){
  if(!d?.ok)return d;
  const o=d.overview||{};
  ['today','week','all'].forEach(period=>{if(o[period]?.ok)writeRankCache(period,'',o[period],Math.max(10,(o[period].rows||[]).length));});
  (d.machines||[]).forEach(m=>{if(m?.board?.ok)writeRankCache('all',String(m.machine_id||''),m.board,Math.max(3,(m.board.rows||[]).length));});
  return d;
}
let dashboardPromise=null;
async function dashboard(force=false){
  if(!force&&dashboardPromise)return dashboardPromise;
  const p=(async()=>{await ensureBackend();return seedDashboard(await jsonp({action:'run_dashboard',player_id:playerId()},20000));})();
  dashboardPromise=p.catch(err=>{dashboardPromise=null;throw err;});
  return dashboardPromise;
}
async function prefetch(){
  // Warm only the default overall TOP100 board. The previous dashboard prefetch
  // expanded to 11 sheet reads on a cold GAS cache and could compete with the
  // very ranking request it was supposed to accelerate. leaderboard() shares
  // the same in-flight key as an actual screen open, so simultaneous calls are
  // automatically deduplicated.
  try{return await leaderboard('all','',100,false)}catch{return null}
}
async function leaderboard(period='all',machineId='',limit=100,force=false){
  period=String(period||'all').toLowerCase();machineId=String(machineId||'');limit=Math.max(1,Number(limit)||100);
  if(!force){const cached=hasFreshEnough(period,machineId,limit);if(cached)return cached;}
  const key=`${rankKey(period,machineId)}|${limit}`;
  if(rankInflight.has(key))return rankInflight.get(key);
  const request=(async()=>{await ensureBackend();const d=await jsonp({action:'run_leaderboard',period,machine_id:machineId,player_id:playerId(),limit},20000);return writeRankCache(period,machineId,d,limit)})().finally(()=>rankInflight.delete(key));
  rankInflight.set(key,request);return request;
}
function invalidateLeaderboard(period,machineId){
  if(period!=null){
    const k=rankKey(period,machineId||'');
    rankMemory.delete(k);try{localStorage.removeItem(storageKey(k))}catch{}
    return;
  }
  // Submission invalidates every cached board, including entries that only live
  // in localStorage and have not been touched in this page session yet.
  rankMemory.clear();
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i);if(k&&k.startsWith(RANK_CACHE_PREFIX))localStorage.removeItem(k);
    }
  }catch{}
}
async function submit(record,name){const display=validateName(name||playerName());setPlayerName(display);await ensureBackend();const d=await jsonp({action:'run_submit',request_id:id('runscore'),player_id:playerId(),player_token:playerToken(),display_name:display,...record},22000);invalidateLeaderboard();dashboardPromise=null;return d}
window.BOON_RUN_RANKING={health,startSession,dashboard,prefetch,leaderboard,peekLeaderboard,invalidateLeaderboard,submit,playerId,playerToken,playerName,setPlayerName,validateName};
})();
