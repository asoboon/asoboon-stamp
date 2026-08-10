(() => {
'use strict';
const API='https://script.google.com/macros/s/AKfycbzRloV2xRDDKtf2-0gbO6NuF3sFA-xyjCrP9ahknx2gBI9Rf8O3-hfVGq4msMu9kRsusQ/exec';
const EXPECTED_RUN_API='1.1.0';
const EXPECTED_RUN_DB='1y0WU_DB4huHELEtTbuoAjhZtomP7nd6af7LicNUF7ro';
const ID_KEY='boonjump_world_player_id_v1';
const NAME_KEY='boonjump_world_player_name_v1';
const TOKEN_KEY='boonjump_world_player_token_v1';
const TIMEOUT=16000;
const safeGet=k=>{try{return localStorage.getItem(k)||''}catch{return''}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,String(v||''));return true}catch{return false}};
function id(prefix){let r='';try{r=[...crypto.getRandomValues(new Uint32Array(4))].map(v=>v.toString(36)).join('')}catch{r=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}return `${prefix}-${Date.now().toString(36)}-${r}`}
function playerId(){let v=safeGet(ID_KEY);if(!v){v=id('player');safeSet(ID_KEY,v)}return v}
function playerToken(){let v=safeGet(TOKEN_KEY);if(!v){v=id('token');safeSet(TOKEN_KEY,v)}return v}
function playerName(){return safeGet(NAME_KEY)}
function setPlayerName(v){safeSet(NAME_KEY,String(v||''))}
function validateName(v){const n=String(v||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g,'').trim();const l=[...n].length;if(l<2||l>12)throw new Error('ランキングネームは2〜12文字です。');if(/https?:\/\/|www\.|@/i.test(n))throw new Error('URLや連絡先は名前に使用できません。');return n}
function jsonp(params,timeout=TIMEOUT){return new Promise((resolve,reject)=>{const cb=`__boonrun_${Date.now()}_${Math.random().toString(36).slice(2)}`;const s=document.createElement('script');let done=false;const finish=(e,d)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch{};try{s.remove()}catch{};e?reject(e):resolve(d)};window[cb]=d=>d&&d.ok?finish(null,d):finish(new Error(d?.error||d?.reason||'ランキング通信に失敗しました。'));const q=new URLSearchParams({...params,callback:cb,_t:String(Date.now())});s.src=`${API}?${q}`;s.async=true;s.onerror=()=>finish(new Error('ランキングサーバーへ接続できませんでした。'));document.head.appendChild(s);const t=setTimeout(()=>finish(new Error('ランキング通信がタイムアウトしました。')),timeout)})}
async function post(payload){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});if(!r.ok)throw new Error('ランキングサーバーへ接続できませんでした。');const d=await r.json();if(!d?.ok)throw new Error(d?.error||d?.reason||'ランキング通信に失敗しました。');return d}
function health(){return jsonp({action:'run_health'})}
let backendPromise=null;
function ensureBackend(){
  if(!backendPromise)backendPromise=health().then(h=>{
    if(String(h.api_version||'')!==EXPECTED_RUN_API||String(h.run_db||'')!==EXPECTED_RUN_DB){
      throw new Error('ランキングGASが旧版です。V2.6.0を再デプロイしてください。');
    }
    return h;
  }).catch(err=>{backendPromise=null;throw err;});
  return backendPromise;
}
async function startSession(machineId,build,version){await ensureBackend();return jsonp({action:'run_start',player_id:playerId(),player_token:playerToken(),machine_id:machineId,source_build:build,client_version:version},18000)}
async function dashboard(){await ensureBackend();return jsonp({action:'run_dashboard',player_id:playerId()},20000)}
async function leaderboard(period='all',machineId='',limit=100){await ensureBackend();return jsonp({action:'run_leaderboard',period,machine_id:machineId,player_id:playerId(),limit},20000)}
async function submit(record,name){await ensureBackend();const display=validateName(name||playerName());setPlayerName(display);return jsonp({action:'run_submit',request_id:id('runscore'),player_id:playerId(),player_token:playerToken(),display_name:display,...record},22000)}
window.BOON_RUN_RANKING={health,startSession,dashboard,leaderboard,submit,playerId,playerToken,playerName,setPlayerName,validateName};
})();
