(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const nativeFetch=window.fetch.bind(window);
const METHOD=String(C.normalCallingMethodType||'00');
const DUMMY='999999999999';
const STORE_NO='AKR2298124918';
const endpoints={plain:'https://cl.airwait.jp/WCLP/api/external/stateless/reserve/call',versioned:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call'};
let diagPromise=null,accepted=null;

function log(msg){const el=document.getElementById('log');if(el)el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}\n`+el.textContent}
function show(msg,cls=''){
  let el=document.getElementById('callDiag');
  if(!el){el=document.createElement('div');el.id='callDiag';const host=document.querySelector('.card:nth-of-type(3) .sub')?.parentElement||document.querySelector('.card');if(host)host.insertBefore(el,host.querySelector('.refresh')||host.firstChild)}
  if(el){el.className='notice '+cls;el.textContent=msg}
}
function parsed(body){if(body instanceof URLSearchParams)return new URLSearchParams(body);if(typeof body==='string')return new URLSearchParams(body);return new URLSearchParams()}
function summarize(d){
  const code=String(d?.resultCode?.code??'?'),msg=String(d?.resultCode?.defaultMessage||'');
  const vr=Array.isArray(d?.validationResults)?d.validationResults:[];
  return {code,msg,callingInvalid:vr.some(x=>String(x?.field)==='callingMethodType'),validation:vr};
}
async function probe({endpoint,auth,idMode}){
  const key=String(C.airwaitApiKey||'');
  const p=new URLSearchParams();
  p.set(idMode==='storeNo'?'storeNo':'storeId',idMode==='storeNo'?STORE_NO:String(C.airwaitStoreId||''));
  p.set('reserveId',DUMMY);p.set('callingMethodType',METHOD);p.set('counterId','001');
  let url=endpoints[endpoint];const headers={'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'};
  if(auth==='query')url+='?key='+encodeURIComponent(key);else headers.corWclpKeyCd=key;
  try{const r=await nativeFetch(url,{method:'POST',headers,body:p,cache:'no-store',credentials:'omit'});const d=await r.json();return {...summarize(d),endpoint,auth,idMode,http:r.status}}
  catch(e){return {code:'NETWORK',msg:e?.message||String(e),callingInvalid:false,endpoint,auth,idMode,http:0}}
}
function shapeAccepted(r){
  if(r.code==='NETWORK'||r.callingInvalid)return false;
  // ダミーreserveIdなので「予約なし」系エラーは入力形式が受理された証拠として扱う。
  return r.code==='3201'||(r.code!=='1000'&&r.code!=='3539');
}
async function diagnose(){
  if(diagPromise)return diagPromise;
  diagPromise=(async()=>{
    show(`通常呼出APIを安全診断中… callingMethodType=${METHOD}`,'');
    log(`AirWAIT公式回答を反映: 通常呼出 callingMethodType=${METHOD}`);
    const matrix=[
      {endpoint:'plain',auth:'query',idMode:'storeId'},
      {endpoint:'versioned',auth:'query',idMode:'storeId'},
      {endpoint:'plain',auth:'header',idMode:'storeId'},
      {endpoint:'versioned',auth:'header',idMode:'storeId'},
      {endpoint:'plain',auth:'query',idMode:'storeNo'},
      {endpoint:'versioned',auth:'query',idMode:'storeNo'}
    ];
    for(const m of matrix){
      const r=await probe(m);
      log(`診断 00 ${m.endpoint}/${m.auth}/${m.idMode} → ${r.code}${r.callingInvalid?' (callingMethodType拒否)':''}`);
      if(shapeAccepted(r)){accepted=m;break}
    }
    if(accepted){
      const label=`${accepted.endpoint}/${accepted.auth}/${accepted.idMode}`;
      show(`✓ 呼出API診断OK｜通常呼出 00｜${label}`,'green');
      log(`呼出API診断OK: callingMethodType=00 / ${label}`);
    }else{
      show('⚠️ 呼出API診断NG｜通常呼出 00 の接続方式を確定できません。安全のためAUTO呼出を停止します。','');
      log('呼出API診断NG: callingMethodType=00。実予約は呼び出していません');
    }
    return accepted;
  })();
  return diagPromise;
}

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  if(!url.includes('/external/stateless/reserve/call'))return nativeFetch(input,init);
  const body=parsed(init.body);const reserveId=String(body.get('reserveId')||'');
  if(reserveId===DUMMY)return nativeFetch(input,init);
  const mode=await diagnose();
  if(!mode){
    return new Response(JSON.stringify({resultCode:{code:'1000',defaultMessage:'呼出API診断NG。AUTO呼出を安全停止しました'},success:false}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  const key=String(C.airwaitApiKey||'');const nextBody=parsed(init.body);
  nextBody.delete('storeId');nextBody.delete('storeNo');
  nextBody.set(mode.idMode==='storeNo'?'storeNo':'storeId',mode.idMode==='storeNo'?STORE_NO:String(C.airwaitStoreId||''));
  nextBody.set('callingMethodType',METHOD);if(!nextBody.has('counterId'))nextBody.set('counterId','001');
  let nextUrl=endpoints[mode.endpoint];const headers=new Headers(init.headers||{});
  headers.set('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');headers.delete('corWclpKeyCd');
  if(mode.auth==='query')nextUrl+='?key='+encodeURIComponent(key);else headers.set('corWclpKeyCd',key);
  return nativeFetch(nextUrl,{...init,headers,body:nextBody});
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(diagnose,400),{once:true});else setTimeout(diagnose,400);
})();
