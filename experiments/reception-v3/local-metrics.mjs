/**
 * Local-only performance timeline design; NOT imported by Production.
 * Never accept identifiers, URLs, access tokens, GPS or arbitrary labels.
 */
export const MARKS=Object.freeze([
  'navigationStart','homeVisible','receptionTapped',
  'receptionShellVisible','businessDayVerified','waitTypesVerified',
  'lineVerified','submitReady'
]);
const markSet=new Set(MARKS);
const PAIRS=Object.freeze({
  homeVisible:['navigationStart','homeVisible'],
  receptionShell:['receptionTapped','receptionShellVisible'],
  businessDay:['receptionTapped','businessDayVerified'],
  slots:['receptionTapped','waitTypesVerified'],
  line:['navigationStart','lineVerified'],
  submit:['receptionTapped','submitReady'],
});
export function createLocalTimeline({clock=()=>performance.now()}={}){
  const entries=new Map();
  function mark(name){
    if(!markSet.has(name))throw TypeError('UNKNOWN_PUBLIC_TIMING_MARK');
    const time=Number(clock());
    if(!Number.isFinite(time)||time<0)throw TypeError('INVALID_TIMING');
    if(!entries.has(name))entries.set(name,time);
  }
  function report(){
    const durations={};
    for(const [key,[start,end]] of Object.entries(PAIRS)){
      const a=entries.get(start),b=entries.get(end);
      if(a!==undefined&&b!==undefined&&b>=a)
        durations[key]=Math.round((b-a)*10)/10;
    }
    // No timestamps, identifiers, or arbitrary input are emitted.
    return Object.freeze({durations:Object.freeze(durations)});
  }
  return Object.freeze({mark,report});
}
export function percentile(values,p){
  if(!Array.isArray(values)||values.length===0)return null;
  const x=values.map(Number).filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  if(!x.length)return null;
  const idx=Math.min(x.length-1,Math.max(0,Math.ceil((p/100)*x.length)-1));
  return x[idx];
}
