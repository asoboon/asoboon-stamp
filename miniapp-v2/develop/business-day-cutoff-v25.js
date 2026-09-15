(()=>{'use strict';
const base=window.ASOBOON_V2_BUSINESS_DAY;
if(!base||typeof base.getByDate!=='function')return;
const TZ='Asia/Tokyo';
const CUTOFF_HOUR=19;
const MAX_FALLBACK_AGE=30*60*1000;
let lastGood=null,lastGoodAt=0;
const pad=v=>String(v).padStart(2,'0');
const timeout=ms=>new Promise((_,reject)=>setTimeout(()=>reject(Error('BUSINESS_DAY_REFRESH_TIMEOUT')),ms));
function operationalDate(epoch=Date.now()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
  const dt=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+(Number(p.hour)>=CUTOFF_HOUR?1:0),12));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
}
async function getCurrent(options={}){
  const date=operationalDate(),force=Boolean(options&&options.force);
  if(!force){
    const r=await base.getByDate(date,options);
    if(r?.ok){lastGood=r;lastGoodAt=Date.now()}
    return r;
  }
  try{
    const r=await Promise.race([base.getByDate(date,{force:true}),timeout(3500)]);
    if(r?.ok){lastGood=r;lastGoodAt=Date.now()}
    return r;
  }catch(err){
    if(lastGood?.ok&&String(lastGood.operationalDate||'')===date&&Date.now()-lastGoodAt<=MAX_FALLBACK_AGE)
      return Object.freeze({...lastGood,source:'develop-cutoff19-fallback'});
    try{
      const cached=await base.getByDate(date,{force:false});
      if(cached?.ok){lastGood=cached;lastGoodAt=Date.now();return Object.freeze({...cached,source:'develop-cutoff19-cache'})}
    }catch{}
    throw err;
  }
}
window.ASOBOON_V2_BUSINESS_DAY=Object.freeze({...base,version:String(base.version||'')+'+develop-cutoff19-v25',cutoffHour:CUTOFF_HOUR,operationalDate,getCurrent});
})();
