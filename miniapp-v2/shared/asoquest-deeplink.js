/* ASOBooN LINE MINI App v2 / ASOQUEST deep link handoff
 *
 * Runs synchronously from <head>, BEFORE the first HOME paint and BEFORE liff.init().
 *
 * Why before liff.init(): when the page is opened with `liff.state`, the LIFF SDK's
 * init() does location.replace(endpoint + state) and then returns a Promise that never
 * resolves. Any code placed after `await liff.init()` therefore never runs in that case.
 * The raw `liff.state` is already in location.search at page load, so we read it here.
 *
 * Accepted entry forms (NFC / QR URLs use the first one):
 *   https://miniapp.line.me/{LIFF_ID}/?aq=engine&src=nfc          -> liff.state="?aq=engine&src=nfc"
 *   https://miniapp.line.me/{LIFF_ID}/asoquest/?part=engine&src=nfc  (legacy) -> liff.state="/asoquest/?part=..."
 *   {endpoint}?aq=engine&src=nfc                                  (second hop / direct)
 *
 * aq = engine | wheel | headlight | fin | grille | key | start   (start = ENGINE START)
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.ASOBOON_ASOQUEST_DEEPLINK=api;if(!root.ASOBOON_ASOQUEST_NO_BOOT)api.boot(root)}
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const PARTS=['engine','wheel','headlight','fin','grille','key'];
const ALIAS={light:'headlight'};
const LOG_KEY='asoquest:debuglog';

function decodeOnce(s){try{return decodeURIComponent(s)}catch{return s}}

/* liff.state value -> {path, params}. Tolerates a doubly-encoded value. */
function parseState(raw){
  let s=String(raw||'');
  if(/%2F|%3F|%3D|%26/i.test(s))s=decodeOnce(s);
  const h=s.indexOf('#');if(h>=0)s=s.slice(0,h);
  const q=s.indexOf('?');
  let path=q>=0?s.slice(0,q):s,qs=q>=0?s.slice(q+1):'';
  if(q<0&&path.includes('=')&&!path.includes('/')){qs=path;path=''}
  return{path:path.toLowerCase().replace(/^\/+|\/+$/g,''),params:new URLSearchParams(qs)};
}

function normPart(v){const p=String(v||'').toLowerCase();const a=ALIAS[p]||p;return PARTS.includes(a)?a:''}
function normSrc(v){const s=String(v||'').toLowerCase();return s==='nfc'||s==='qr'?s:''}

/* location.search -> deep link descriptor, or null when this is not an ASOQUEST entry. */
function parse(search){
  const direct=new URLSearchParams(String(search||''));
  const st=direct.get('liff.state');
  const inner=st?parseState(st):null;
  const get=k=>(inner&&inner.params.get(k))||direct.get(k)||'';
  const aqRaw=String(get('aq')).toLowerCase();
  const debug=get('debug')==='asoquest';
  let part='',station='';
  if(aqRaw==='start')station='engine';
  else if(aqRaw)part=normPart(aqRaw);
  if(!part&&!station){
    part=normPart(get('part'));
    if(!part&&String(get('station')).toLowerCase()==='engine')station='engine';
  }
  const viaPath=Boolean(inner&&inner.path==='asoquest');
  if(!part&&!station&&!aqRaw&&!viaPath)return null;
  return{kind:part?'part':station?'start':'top',part,station,src:normSrc(get('src')),debug,via:inner?'liff.state':'direct'};
}

/* descriptor -> ASOQUEST page URL (ASOQUEST itself reads part / station / src). */
function buildTarget(dl,targetBase){
  const u=new URL(targetBase);
  if(dl.part)u.searchParams.set('part',dl.part);
  else if(dl.station)u.searchParams.set('station',dl.station);
  if(dl.src)u.searchParams.set('src',dl.src);
  return u;
}

/* ASOQUEST lives at miniapp-v2/production/asoquest/ for BOTH environments, i.e. ../production/asoquest/
 * relative to this shared script (or to either endpoint). No dependency on env.js, so this can run first. */
function targetBaseFor(scriptSrc,env,loc){
  const base=scriptSrc||(env&&env.endpoint)||loc.href;
  return new URL(scriptSrc?'../production/asoquest/':'../production/asoquest/',base);
}
function safeTarget(url,loc){return url.origin===loc.origin&&/\/asoquest\/$/.test(url.pathname)}

const SENSITIVE=/^(code|access_token|id_token|refresh_token|state|liffoauth2error.*|error_description|liffclientid|liffredirecturi|liff\.referrer|context_token)$/i;
function maskParams(qs){
  const p=new URLSearchParams(String(qs||'').replace(/^\?/,''));
  for(const k of Array.from(p.keys()))if(SENSITIVE.test(k)&&k!=='liff.state')p.set(k,'***');
  return p.toString();
}
function maskState(raw){
  if(!raw)return raw;
  const s=parseState(raw);
  return(s.path?'/'+s.path+'/':'')+'?'+maskParams(s.params.toString());
}
function readLog(w){try{return JSON.parse(w.sessionStorage.getItem(LOG_KEY)||'[]')}catch{return[]}}
function writeLog(w,entry){
  try{const l=readLog(w);l.push(entry);w.sessionStorage.setItem(LOG_KEY,JSON.stringify(l.slice(-12)))}catch{}
}
/* Never records tokens: sensitive params are masked and the hash is reduced to its length. */
function snapshot(w,stage,extra){
  const l=w.location;
  const st=new URLSearchParams(l.search).get('liff.state');
  const search=l.search?'?'+maskParams(l.search.replace(/liff\.state=[^&]*/,'liff.state=_')):'';
  const liffState=st?maskState(st):null;
  return Object.assign({t:new Date().toISOString(),stage,origin:l.origin,pathname:l.pathname,search,liffState,hashLength:(l.hash||'').length,ua:(w.navigator&&w.navigator.userAgent||'').slice(0,80)},extra||{});
}

/* Debug mode only (?debug=asoquest): show what the page actually received. Never shown to normal users. */
function mountPanel(w,dl,target){
  const d=w.document;
  const build=()=>{
    const box=d.createElement('div');
    box.id='aqDebugPanel';
    box.style.cssText='position:fixed;left:0;right:0;bottom:0;max-height:70vh;overflow:auto;z-index:99999;background:#111c25;color:#cdf;font:11px/1.4 monospace;padding:8px;border-top:2px solid #f90;white-space:pre-wrap;word-break:break-all';
    const render=()=>{box.textContent='[ASOQUEST DEBUG] 自動遷移は停止中\n'+JSON.stringify({deepLink:dl,target:target&&target.href},null,1)+'\n--- log ---\n'+readLog(w).map(e=>JSON.stringify(e)).join('\n')};
    const mk=(label,fn)=>{const b=d.createElement('button');b.textContent=label;b.style.cssText='margin:4px 6px 4px 0;padding:6px 10px';b.addEventListener('click',fn);return b};
    const bar=d.createElement('div');
    bar.append(
      mk('ASOQUESTへ遷移',()=>{if(target)w.location.replace(target.href)}),
      mk('liff.init()を試す',async()=>{
        writeLog(w,snapshot(w,'before liff.init'));render();
        try{
          if(!w.liff)throw Error('no liff sdk');
          const E=w.ASOBOON_V2_ENV||{};
          await Promise.race([w.liff.init({liffId:E.liffId}),new Promise((_,j)=>setTimeout(()=>j(Error('init timeout 8s (unresolved)')),8000))]);
          writeLog(w,snapshot(w,'after liff.init resolved'));
        }catch(e){writeLog(w,snapshot(w,'liff.init failed',{error:String(e&&e.message||e)}))}
        render();
      }),
      mk('ログ消去',()=>{try{w.sessionStorage.removeItem(LOG_KEY)}catch{}render()})
    );
    writeLog(w,snapshot(w,'page load (no liff.init yet)',{deepLink:dl}));
    render();
    box.prepend(bar);
    d.body.appendChild(box);
  };
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',build);else build();
}

function showStuck(w,target,homeUrl){
  const d=w.document;
  try{
    const box=d.createElement('div');
    box.style.cssText='position:fixed;inset:0;z-index:100000;display:grid;place-content:center;gap:14px;text-align:center;padding:24px;background:#111c25;color:#fff;font:700 16px system-ui,sans-serif';
    const msg=d.createElement('div');msg.textContent='通信に時間がかかっています';
    const retry=d.createElement('button');retry.textContent='もう一度ためす';
    retry.style.cssText='padding:12px 20px;font:700 16px system-ui;border:0;border-radius:12px;background:#ffb703;color:#111';
    retry.addEventListener('click',()=>w.location.replace(target.href));
    const home=d.createElement('a');home.textContent='HOMEへ';home.href=homeUrl;home.style.cssText='color:#9cf;font-weight:400';
    box.append(msg,retry,home);
    d.documentElement.appendChild(box);
  }catch{}
}

function boot(w){
  let dl=null;
  try{dl=parse(w.location.search)}catch{dl=null}
  if(!dl)return null;
  const scriptSrc=(w.document&&w.document.currentScript&&w.document.currentScript.src)||'';
  const target=(()=>{try{const t=buildTarget(dl,targetBaseFor(scriptSrc,w.ASOBOON_V2_ENV,w.location));return safeTarget(t,w.location)?t:null}catch{return null}})();
  if(dl.debug){
    w.ASOBOON_ASOQUEST_HANDOFF='hold';
    mountPanel(w,dl,target);
    return dl;
  }
  if(!target)return dl;
  w.ASOBOON_ASOQUEST_HANDOFF='redirect';
  /* Keep HOME invisible while navigating (no HOME flash). HOME is never revealed by this script. */
  try{
    const d=w.document,s=d.createElement('style');
    s.textContent='html.aq-go,html.aq-go body{background:#111c25!important}html.aq-go body>*{visibility:hidden!important}html.aq-go::before{content:"ASOQUEST 起動中…";position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:700 18px system-ui,sans-serif;z-index:99999}';
    d.head.appendChild(s);d.documentElement.classList.add('aq-go');
    /* Slow network: after 8s offer retry / HOME instead of exposing a half-initialised HOME. */
    const home=new URL(w.location.pathname.includes('/develop/')?'../../develop/':'../',target).href; /* target = miniapp-v2/production/asoquest/ */
    w.setTimeout(()=>showStuck(w,target,home),8000);
  }catch{}
  w.location.replace(target.href);
  return dl;
}

return{parse,parseState,buildTarget,targetBaseFor,safeTarget,snapshot,maskState,boot,PARTS};
});
