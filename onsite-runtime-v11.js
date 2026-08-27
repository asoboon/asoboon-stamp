(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const isAirWait=/airwait\.jp|cl\.airwait\.jp/i.test(url);
  const attempts=isAirWait?2:1;
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let abortForward;
    try{
      if(init.signal){
        if(init.signal.aborted) controller.abort();
        else {abortForward=()=>controller.abort();init.signal.addEventListener('abort',abortForward,{once:true});}
      }
      return await nativeFetch(input,{...init,signal:controller.signal});
    }catch(error){
      lastError=error;
      if(attempt<attempts) await new Promise(r=>setTimeout(r,700));
    }finally{
      clearTimeout(timer);
      if(init.signal&&abortForward) init.signal.removeEventListener('abort',abortForward);
    }
  }
  throw lastError||new Error('通信に失敗しました');
};
})();