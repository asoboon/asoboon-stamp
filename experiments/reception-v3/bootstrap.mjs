/**
 * Reception V3 read-only bootstrap experiment. NOT imported by Production.
 * No fetch, D1, LINE, AirWAIT, or reservation operations.
 *
 * The actual submit button MUST continue using the real receipt/ownership,
 * identity, availability and idempotency guards in shared/reception.js + Worker.
 */
const LANES=Object.freeze(['identity','businessDay','waitTypes','gateway']);
const pending=()=>({status:'pending'});
const rejected=()=>({status:'failed'});
const succeeded=value=>({status:'ready',value});

export function createReceptionBootstrap({
  getIdentity,getBusinessDay,getWaitTypes,getGateway,operationalDate,onSnapshot=()=>{},
}={}){
  const sources={identity:getIdentity,businessDay:getBusinessDay,waitTypes:getWaitTypes,gateway:getGateway};
  if(LANES.some(name=>typeof sources[name]!=='function')||typeof operationalDate!=='function')
    throw TypeError('All read-only bootstrap sources and operationalDate are required');
  let generation=0;
  let lanes=Object.fromEntries(LANES.map(name=>[name,pending()]));
  const identityOK=x=>Boolean(x?.liffReady===true&&x?.inClient===true&&x?.loggedIn===true);
  const dayOK=x=>Boolean(x?.ok===true&&x?.stale!==true&&x?.isClosed===false&&
    String(x?.operationalDate||'')===String(operationalDate()));
  const typesOK=x=>Boolean(x?.ok===true&&Array.isArray(x?.waitTypes)&&x.waitTypes.length>0);
  const gatewayOK=x=>Boolean(x?.ok===true&&x?.createEnabled===true&&x?.createRequiresVerifiedLiff===true);
  const validators={identity:identityOK,businessDay:dayOK,waitTypes:typesOK,gateway:gatewayOK};
  // The public snapshot contains statuses only, never credentials or identity.
  function snapshot(){
    const status=Object.fromEntries(LANES.map(name=>[name,lanes[name].status]));
    const verified=LANES.every(name=>lanes[name].status==='ready'&&validators[name](lanes[name].value));
    const dateMatches=lanes.businessDay.status==='ready'&&dayOK(lanes.businessDay.value);
    return Object.freeze({generation,lanes:Object.freeze(status),dateMatches,verificationComplete:verified});
  }
  function publish(){const next=snapshot();onSnapshot(next);return next}
  function invalidate(){generation++;lanes=Object.fromEntries(LANES.map(name=>[name,pending()]));return publish()}
  function begin(){
    invalidate();
    const run=generation;
    // All four lanes start in the same microtask turn: no Promise waterfall.
    for(const name of LANES){
      void Promise.resolve().then(()=>sources[name]())
        .then(value=>{
          if(generation!==run)return;
          lanes[name]=validators[name](value)?succeeded(value):rejected();
          publish();
        },()=>{
          if(generation!==run)return;
          lanes[name]=rejected();
          publish();
        });
    }
    return snapshot();
  }
  return Object.freeze({begin,invalidate,snapshot});
}
