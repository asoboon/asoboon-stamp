(()=>{
'use strict';
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init={})=>{
  try{
    const url=typeof input==='string'?input:String(input?.url||'');
    if(url.includes('/external/stateless/reserve/call')){
      const next={...init};
      let body=next.body;
      if(body instanceof URLSearchParams){
        body=new URLSearchParams(body);
        if(!body.has('counterId'))body.set('counterId','001');
        next.body=body;
      }else if(typeof body==='string'){
        const p=new URLSearchParams(body);
        if(!p.has('counterId'))p.set('counterId','001');
        next.body=p;
      }
      return originalFetch(input,next);
    }
  }catch(_){ }
  return originalFetch(input,init);
};
})();
