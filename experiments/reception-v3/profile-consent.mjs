/**
 * LINE MINI App profile-permission consent controller, isolated proposal.
 * NOT imported by Production / GitHub Pages / Cloudflare Workers.
 *
 * The permission UI invokes requestFromTap() DIRECTLY from a real user tap.
 * This controller NEVER creates a reception, stores a token or trusts a userId.
 */
const STATES=new Set(['unknown','checking','granted','prompt','unavailable','unsupported','requesting','failed']);
export function createProfileConsentController({liff,onChange=()=>{}}={}){
  if(!liff||typeof onChange!=='function')throw TypeError('LIFF and onChange are required');
  let phase='unknown';let generation=0;let active=null;
  const get=()=>Object.freeze({phase,canRequest:phase==='prompt',hasProfilePermission:phase==='granted'});
  const change=value=>{if(!STATES.has(value))throw TypeError('invalid permission state');phase=value;onChange(get());return get()};
  async function query(g){
    if(typeof liff.permission?.query!=='function'){if(g===generation)change('unsupported');return get()}
    try{
      const x=await liff.permission.query('profile');
      const next=x?.state==='granted'?'granted':x?.state==='prompt'?'prompt':x?.state==='unavailable'?'unavailable':'failed';
      if(g===generation)change(next);
    }catch{if(g===generation)change('failed')}
    return get();
  }
  async function check(){
    if(phase==='requesting')return get();
    const g=++generation;change('checking');
    return query(g);
  }
  function requestFromTap(){
    // Call directly inside the click handler. Don't await anything before
    // requestAll: browser user-activation may be needed for the native dialog.
    if(phase!=='prompt'||active)return Promise.resolve(false);
    if(typeof liff.permission?.requestAll!=='function'){change('unsupported');return Promise.resolve(false)}
    const g=++generation;change('requesting');
    let result;
    try{result=liff.permission.requestAll()}catch{change('failed');return Promise.resolve(false)}
    active=Promise.resolve(result).then(async()=>{
      if(g!==generation)return false;
      await query(g); // requestAll resolution is not proof of scope grant.
      // On consent LINE refreshes the token; submit MUST get a FRESH
      // liff.getAccessToken() hereafter, not reuse an old token.
      return phase==='granted';
    },async()=>{
      if(g!==generation)return false;
      await query(g); // canceled consent stays prompt; never auto-resubmit.
      return false;
    }).finally(()=>{active=null});
    return active;
  }
  function invalidate(){generation++;active=null;return change('unknown')}
  return Object.freeze({check,requestFromTap,invalidate,snapshot:get});
}
