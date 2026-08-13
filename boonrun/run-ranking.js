(() => {
'use strict';
const API='https://script.google.com/macros/s/AKfycbzRloV2xRDDKtf2-0gbO6NuF3sFA-xyjCrP9ahknx2gBI9Rf8O3-hfVGq4msMu9kRsusQ/exec';
const EXPECTED_RUN_API='1.1.0';
const EXPECTED_RUN_DB='1y0WU_DB4huHELEtTbuoAjhZtomP7nd6af7LicNUF7ro';
const ID_KEY='boonjump_world_player_id_v1';
const NAME_KEY='boonjump_world_player_name_v1';
const TOKEN_KEY='boonjump_world_player_token_v1';
const CACHE_PREFIX='boonrun_rank_v134:';
const FRESH_MS=20_000;
const STALE_MS=7*24*60*60*1000;
const TIMEOUT=16_000;
const inFlight=new Map();
const safeGet=k=>{try{return localStorage.getItem(k)||''}catch{return''}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,String(v||''));return true}catch{return false}};
function id(prefix){let r='';try{r=[...crypto.getRandomValues(new Uint32Array(4))].map(v=>v.toString(36)).join('')}catch{r=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}return `${prefix}-${Date.now().toString(36)}-${r}`}
function playerId(){let v=safeGet(ID_KEY);if(!v){v=id('player');safeSet(ID_KEY,v)}return v}
function playerToken(){let v=safeGet(TOKEN_KEY);if(!v){v=id('token');safeSet(TOKEN_KEY,v)}return v}
function playerName(){return safeGet(NAME_KEY)}
function setPlayerName(v){safeSet(NAME_KEY,String(v||''))}
function validateName(v){const n=String(v||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g,'').trim();const l=[...n].length;if(l<2||l>12)throw new Error('ランキングネームは2〜12文字です。');if(/https?:\/\/|www\.|@/i.test(n))throw new Error('URLや連絡先は名前に使用できません。');return n}
function jsonp(params,timeout=TIMEOUT){return new Promise((resolve,reject)=>{const cb=`__boonrun_${Date.now()}_${Math.random().toString(36).slice(2)}`;const s=document.createElement('script');let done=false;const finish=(e,d)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch{};try{s.remove()}catch{};e?reject(e):resolve(d)};window[cb]=d=>d&&d.ok?finish(null,d):finish(new Error(d?.error||d?.reason||'ランキング通信に失敗しました。'));const q=new URLSearchParams({...params,callback:cb,_t:String(Date.now())});s.src=`${API}?${q}`;s.async=true;s.onerror=()=>finish(new Error('ランキングサーバーへ接続できませんでした。'));document.head.appendChild(s);const t=setTimeout(()=>finish(new Error('ランキング通信がタイムアウトしました。')),timeout)})}
function assertCompat(d){if(d?.api_version&&String(d.api_version)!==EXPECTED_RUN_API)throw new Error('ランキングGASのRUN APIが一致しません。');if(d?.run_db&&String(d.run_db)!==EXPECTED_RUN_DB)throw new Error('ランキング保存先が一致しません。');return d}
function health(){return jsonp({action:'run_health'}).then(assertCompat)}
function cacheKey(period,machineId,limit){return `${CACHE_PREFIX}${period}:${machineId||'overall'}:${limit}`}
function readCache(period,machineId,limit){try{const raw=localStorage.getItem(cacheKey(period,machineId,limit));if(!raw)return null;const x=JSON.parse(raw);if(!x?.data||!x.at||Date.now()-x.at>STALE_MS){localStorage.removeItem(cacheKey(period,machineId,limit));return null}return x}catch{return null}}
function writeCache(period,machineId,limit,data){try{localStorage.setItem(cacheKey(period,machineId,limit),JSON.stringify({at:Date.now(),data}));}catch{}}
function peekLeaderboard(period='all',machineId='',limit=100){return readCache(period,machineId,limit)?.data||null}
function invalidateRankingCaches(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(CACHE_PREFIX))localStorage.removeItem(k)}}catch{}}
function dedupe(key,fn){if(inFlight.has(key))return inFlight.get(key);const p=Promise.resolve().then(fn).finally(()=>inFlight.delete(key));inFlight.set(key,p);return p}
async function startSession(machineId,build,version){return dedupe(`start:${machineId}:${build}:${version}`,()=>jsonp({action:'run_start',player_id:playerId(),player_token:playerToken(),machine_id:machineId,source_build:build,client_version:version},18_000).then(assertCompat))}
async function dashboard(){return jsonp({action:'run_dashboard',player_id:playerId()},20_000).then(assertCompat)}
async function leaderboard(period='all',machineId='',limit=100,opts={}){
  period=String(period||'all');machineId=String(machineId||'');limit=Math.max(1,Math.min(100,Number(limit)||100));
  const cached=readCache(period,machineId,limit);
  if(!opts?.force&&cached&&Date.now()-cached.at<FRESH_MS)return cached.data;
  const key=`board:${period}:${machineId}:${limit}`;
  return dedupe(key,async()=>{const d=assertCompat(await jsonp({action:'run_leaderboard',period,machine_id:machineId,player_id:playerId(),limit},20_000));writeCache(period,machineId,limit,d);return d;});
}
async function submit(record,name){const display=validateName(name||playerName());setPlayerName(display);const d=assertCompat(await jsonp({action:'run_submit',request_id:id('runscore'),player_id:playerId(),player_token:playerToken(),display_name:display,...record},22_000));invalidateRankingCaches();return d}
function warmCore(){const work=()=>{leaderboard('all','',100).catch(()=>{});setTimeout(()=>leaderboard('today','',100).catch(()=>{}),500);setTimeout(()=>leaderboard('week','',100).catch(()=>{}),1100);};if('requestIdleCallback'in window)requestIdleCallback(work,{timeout:1800});else setTimeout(work,900)}
window.BOON_RUN_RANKING={health,startSession,dashboard,leaderboard,peekLeaderboard,invalidateRankingCaches,submit,warmCore,playerId,playerToken,playerName,setPlayerName,validateName};
})();
