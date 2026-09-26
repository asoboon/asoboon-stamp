(()=>{'use strict';

const BASE='./assets/';
const FAMILIES=Object.freeze({
  cracks:Object.freeze({url:BASE+'fw-cracks-atlas.webp?v=1',prefix:'crack',count:12,cols:4,rows:3,cellW:512,cellH:384}),
  frames:Object.freeze({url:BASE+'fw-frames-atlas.webp?v=1',prefix:'frame',count:12,cols:4,rows:3,cellW:384,cellH:512}),
  shards:Object.freeze({url:BASE+'fw-shards-atlas.webp?v=1',prefix:'shard',count:20,cols:5,rows:4,cellW:256,cellH:320}),
  impacts:Object.freeze({url:BASE+'fw-impacts-atlas.webp?v=1',prefix:'impact',count:24,cols:6,rows:4,cellW:256,cellH:320}),
  pompon:Object.freeze({url:BASE+'fw-pompon-atlas.webp?v=1',prefix:'pompon',count:6,cols:3,rows:2,cellW:640,cellH:480}),
  duo:Object.freeze({url:BASE+'fw-duo-atlas.webp?v=1',prefix:'duo',count:6,cols:3,rows:2,cellW:640,cellH:480}),
});
const loaded=new Map();
const errors=new Map();

function normalizeId(family,id){
  const spec=FAMILIES[family];if(!spec)return'';
  if(typeof id==='number')return spec.prefix+'_'+String(id).padStart(3,'0');
  const s=String(id||'').trim();
  const m=s.match(/(\d{1,3})$/);if(!m)return'';
  const n=Math.max(1,Math.min(spec.count,Number(m[1])||1));
  return spec.prefix+'_'+String(n).padStart(3,'0');
}
function numberFor(id){const m=String(id||'').match(/(\d{1,3})$/);return m?Number(m[1]):0}
function preloadFamily(family){
  const spec=FAMILIES[family];if(!spec)return Promise.resolve(false);
  if(loaded.get(family)===true)return Promise.resolve(true);
  if(loaded.get(family)?.then)return loaded.get(family);
  const p=new Promise(resolve=>{
    const img=new Image();img.decoding='async';let settled=false;
    const done=ok=>{if(settled)return;settled=true;loaded.set(family,Boolean(ok));if(!ok)errors.set(family,(errors.get(family)||0)+1);resolve(Boolean(ok))};
    img.onload=()=>done(true);img.onerror=()=>done(false);img.src=spec.url;
    if(img.complete&&img.naturalWidth>0)done(true);
  });
  loaded.set(family,p);return p;
}
function preloadFamilies(list=[]){return Promise.all([...new Set(list)].map(preloadFamily))}
function create(family,id,className=''){
  const spec=FAMILIES[family];if(!spec)return null;
  const key=normalizeId(family,id),n=numberFor(key);if(!n)return null;
  const idx=n-1,col=idx%spec.cols,row=Math.floor(idx/spec.cols);
  const el=document.createElement('div');
  el.className='fw-sprite fw-'+family+' '+className;
  el.dataset.fwFamily=family;el.dataset.fwAsset=key;el.dataset.fwW=String(spec.cellW);el.dataset.fwH=String(spec.cellH);
  el.style.width=spec.cellW+'px';el.style.height=spec.cellH+'px';
  el.style.backgroundImage='url("'+spec.url+'")';
  el.style.backgroundSize=(spec.cellW*spec.cols)+'px '+(spec.cellH*spec.rows)+'px';
  el.style.backgroundPosition=(-col*spec.cellW)+'px '+(-row*spec.cellH)+'px';
  return el;
}
function ids(family){
  const spec=FAMILIES[family];if(!spec)return[];
  return Array.from({length:spec.count},(_,i)=>spec.prefix+'_'+String(i+1).padStart(3,'0'));
}
function diagnostics(){
  const state={};for(const key of Object.keys(FAMILIES))state[key]={loaded:loaded.get(key)===true,errors:errors.get(key)||0,count:FAMILIES[key].count};
  return{version:'1.0.0',families:state,totalImplementationAssets:Object.values(FAMILIES).reduce((n,x)=>n+x.count,0),source:'fourth_wall_implementation_pack_v1'};
}
window.ASOBOON_BOARD_FOURTH_WALL_ASSETS=Object.freeze({version:'1.0.0',FAMILIES,preloadFamily,preloadFamilies,create,ids,diagnostics});
})();