(()=>{'use strict';
const base=window.ASOBOON_V2_BUSINESS_DAY;
if(!base||typeof base.getCurrent!=='function')return;
let lastGood=null,lastGoodAt=0;
const MAX_FALLBACK_AGE=30*60*1000;
const sleep=ms=>new Promise((_,reject)=>setTimeout(()=>reject(Error('BUSINESS_DAY_REFRESH_TIMEOUT')),ms));
async function getCurrent(options={}){
  const force=Boolean(options&&options.force);
  if(!force){
    const r=await base.getCurrent(options);
    if(r?.ok){lastGood=r;lastGoodAt=Date.now()}
    return r;
  }
  try{
    const r=await Promise.race([base.getCurrent({force:true}),sleep(3500)]);
    if(r?.ok){lastGood=r;lastGoodAt=Date.now()}
    return r;
  }catch(err){
    if(lastGood?.ok&&Date.now()-lastGoodAt<=MAX_FALLBACK_AGE)return Object.freeze({...lastGood,source:'develop-fallback'});
    try{
      const cached=await base.getCurrent({force:false});
      if(cached?.ok){lastGood=cached;lastGoodAt=Date.now();return Object.freeze({...cached,source:'develop-cache-fallback'})}
    }catch{}
    throw err;
  }
}
async function getByDate(value,options={}){
  const force=Boolean(options&&options.force);
  if(!force)return base.getByDate(value,options);
  try{return await Promise.race([base.getByDate(value,{force:true}),sleep(3500)])}
  catch(err){return base.getByDate(value,{force:false}).catch(()=>{throw err})}
}
window.ASOBOON_V2_BUSINESS_DAY=Object.freeze({...base,version:String(base.version||'')+'+develop-resilience-v23',getCurrent,getByDate});
})();
