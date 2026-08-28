(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const NORMAL=String(C.normalCallingMethodType||'00');
const originalFetch=window.fetch.bind(window);

window.fetch=(input,init={})=>{
  try{
    const url=typeof input==='string'?input:String(input?.url||'');
    if(url.includes('/external/stateless/reserve/call')){
      const next={...init};
      const body=next.body instanceof URLSearchParams
        ? new URLSearchParams(next.body)
        : typeof next.body==='string'
          ? new URLSearchParams(next.body)
          : new URLSearchParams();
      // AirWAIT公式回答: 00=通常呼出。旧KeyNORMALは送信しない。
      body.set('callingMethodType',NORMAL);
      if(!body.has('counterId')) body.set('counterId','001');
      next.body=body;
      return originalFetch(input,next);
    }
  }catch(error){
    console.warn('ASOBooN call v13 patch failed',error);
  }
  return originalFetch(input,init);
};

window.ASOBOON_CALL_METHOD=Object.freeze({normal:NORMAL,version:'13.0'});
})();
