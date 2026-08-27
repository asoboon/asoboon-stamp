(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const nativeFetch=window.fetch.bind(window);
const DUMMY='999999999999';
const STORE_NO='AKR2298124918';
const endpoints={
  plain:'https://cl.airwait.jp/WCLP/api/external/stateless/reserve/call',
  versioned:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call'
};
let diagPromise=null, accepted=null;

function log(msg){
  const el=document.getElementById('log');
  if(el) el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}\n`+el.textContent;
}
function show(msg, cls=''){
  let el=document.getElementById('callDiag');
  if(!el){
    el=document.createElement('div');
    el.id='callDiag';
    el.className='notice';
    const host=document.querySelector('.card:nth-of-type(3) .sub')?.parentElement || document.querySelector('.card');
    if(host) host.insertBefore(el, host.querySelector('.refresh')||host.firstChild);
  }
  el.className='notice '+cls;
  el.textContent=msg;
}
function parsed(body){
  if(body instanceof URLSearchParams) return new URLSearchParams(body);
  if(typeof body==='string') return new URLSearchParams(body);
  return new URLSearchParams();
}
function summarize(d){
  const code=String(d?.resultCode?.code??'?');
  const msg=String(d?.resultCode?.defaultMessage||'');
  const vr=Array.isArray(d?.validationResults)?d.validationResults:[];
  const cm=vr.find(x=>String(x?.field)==='callingMethodType');
  return {code,msg,callingInvalid:!!cm,validation:vr};
}
async function probe({endpoint,auth,idMode,method='KeyNORMAL'}){
  const key=String(C.airwaitApiKey||'');
  const p=new URLSearchParams();
  p.set(idMode==='storeNo'?'storeNo':'storeId', idMode==='storeNo'?STORE_NO:String(C.airwaitStoreId||''));
  p.set('reserveId',DUMMY);
  p.set('callingMethodType',method);
  p.set('counterId','001');
  let url=endpoints[endpoint];
  const headers={'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'};
  if(auth==='query') url += '?key='+encodeURIComponent(key);
  else headers.corWclpKeyCd=key;
  try{
    const r=await nativeFetch(url,{method:'POST',headers,body:p,cache:'no-store',credentials:'omit'});
    const d=await r.json();
    return {...summarize(d),endpoint,auth,idMode,method,http:r.status};
  }catch(e){
    return {code:'NETWORK',msg:e?.message||String(e),callingInvalid:false,endpoint,auth,idMode,method,http:0};
  }
}
async function diagnose(){
  if(diagPromise) return diagPromise;
  diagPromise=(async()=>{
    show('呼出APIを安全診断中…（ダミー予約IDを使用。208番には触れません）','');
    log('呼出API安全診断を開始（ダミー予約ID）');
    const matrix=[
      {endpoint:'plain',auth:'query',idMode:'storeId'},
      {endpoint:'versioned',auth:'query',idMode:'storeId'},
      {endpoint:'plain',auth:'header',idMode:'storeId'},
      {endpoint:'versioned',auth:'header',idMode:'storeId'},
      {endpoint:'plain',auth:'query',idMode:'storeNo'},
      {endpoint:'versioned',auth:'query',idMode:'storeNo'}
    ];
    const results=[];
    for(const m of matrix){
      const r=await probe(m); results.push(r);
      log(`診断 KeyNORMAL ${m.endpoint}/${m.auth}/${m.idMode} → ${r.code}${r.callingInvalid?' (callingMethodType拒否)':''}`);
      if(r.code==='3201' || (r.code!=='1000' && r.code!=='NETWORK' && r.code!=='3539')){accepted=m;break;}
    }
    if(!accepted){
      for(const method of ['KeyCOUNTER','KeyNORMAL_AND_COUNTER']){
        const r=await probe({endpoint:'plain',auth:'query',idMode:'storeId',method});results.push(r);
        log(`診断 ${method} plain/query/storeId → ${r.code}${r.callingInvalid?' (callingMethodType拒否)':''}`);
      }
    }
    if(accepted){
      const label=`${accepted.endpoint}/${accepted.auth}/${accepted.idMode}`;
      show(`✓ 通常呼出APIは利用可能です。受理された接続方式: ${label}`,'green');
      log(`診断結果: KeyNORMAL受理 / ${label}。以後のAUTO呼出に自動適用します`);
    }else{
      const enumAccepted=results.some(r=>['KeyCOUNTER','KeyNORMAL_AND_COUNTER'].includes(r.method)&&!r.callingInvalid&&r.code!=='NETWORK');
      if(enumAccepted){
        show('⚠️ 呼出API自体は応答しますが、この環境では通常呼出(KeyNORMAL)だけが拒否されています。AirWAIT側の店舗/APIキー設定確認が必要です。','');
        log('診断結果: KeyNORMALのみ受理されず。AirWAIT側設定/契約機能の確認が必要');
      }else{
        show('⚠️ 仕様書記載の呼出区分がすべて拒否されました。現行API仕様と店舗/APIキー設定の不一致が疑われます。208番は呼び出していません。','');
        log('診断結果: 仕様書記載の呼出区分が受理されず。208番は未操作');
      }
    }
    return accepted;
  })();
  return diagPromise;
}

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  if(!url.includes('/external/stateless/reserve/call')) return nativeFetch(input,init);
  const body=parsed(init.body);
  const reserveId=String(body.get('reserveId')||'');
  if(reserveId===DUMMY) return nativeFetch(input,init);
  const mode=await diagnose();
  if(!mode){
    const payload={resultCode:{code:'1000',defaultMessage:'呼出API診断でKeyNORMALが受理されませんでした'},validationResults:[{field:'callingMethodType',msg:'AirWAIT側設定またはAPI仕様の確認が必要です'}],success:false};
    return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
  }
  const key=String(C.airwaitApiKey||'');
  const nextBody=parsed(init.body);
  nextBody.delete('storeId'); nextBody.delete('storeNo');
  nextBody.set(mode.idMode==='storeNo'?'storeNo':'storeId',mode.idMode==='storeNo'?STORE_NO:String(C.airwaitStoreId||''));
  nextBody.set('callingMethodType','KeyNORMAL');
  nextBody.set('counterId','001');
  let nextUrl=endpoints[mode.endpoint];
  const headers=new Headers(init.headers||{});
  headers.set('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');
  headers.delete('corWclpKeyCd');
  if(mode.auth==='query') nextUrl += '?key='+encodeURIComponent(key);
  else headers.set('corWclpKeyCd',key);
  return nativeFetch(nextUrl,{...init,headers,body:nextBody});
};

document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>diagnose(),400)});
})();
