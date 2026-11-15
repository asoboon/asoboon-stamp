/** AirWAIT public visibility is NOT the same as currently selectable slots.
 * The optional publicReception field is independently verified against the
 * customer-facing AirWAIT page. A failed read must not be treated as open.
 */
export function allHidden(types, onsite, online) {
  if (!Array.isArray(types) || !Array.isArray(onsite) || !Array.isArray(online)) return null;
  const ids = [...onsite.map(x => String(x?.waitTypeId || '')), ...online.map(String)];
  if (!ids.length || ids.some(x => !x)) return null;
  const map = new Map(types.map(x => [String(x?.waitTypeId || ''), x]));
  if (!ids.every(id => map.has(id))) return null;
  return ids.every(id => map.get(id)?.dispFlg === false);
}
// An unsuccessful HTTP read can briefly happen during AirWAIT updates.
// Recover once on the read path, without treating a failed request as a closed slot.
// 429 is intentionally not retried immediately to respect API throttling.
async function readPublic(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:') return {value:null,retry:false};
    url.searchParams.set('action', 'waitTypes');
    url.searchParams.set('includePublicReception', '1');
    const response = await fetch(url, {cache:'no-store',credentials:'omit',signal:ctrl.signal});
    if (!response.ok) return {value:null,retry:response.status!==429};
    const data = await response.json();
    if (data?.ok !== true || !Array.isArray(data.waitTypes)) return {value:null,retry:true};
    return {value:{waitTypes:data.waitTypes,
      publicReception:Object.hasOwn(data,'publicReception')?data.publicReception:null},
      retry:data.publicReception?.verified===false};
  } catch {return {value:null,retry:true}}
  finally {clearTimeout(timer)}
}
export async function publishedStatus(base) {
  const first=await readPublic(base);
  if(!first.retry)return first.value;
  // The production worker caches an unverified AirWAIT snapshot for 5s
  // (20s memo TTL, inserted with a 15s age). Do not retry it too early.
  const delay=first.value?.publicReception?.verified===false?5500:1200;
  await new Promise(resolve=>setTimeout(resolve,delay));
  return (await readPublic(base)).value??first.value;
}
// Grace period only for a prior verified, same-day response when the HTTP
// request itself failed. Explicit hidden/unverified AirWAIT results always win.
export function freshPublicOnFailure(previous,reply,day,today) {
  if(reply||previous?.verified!==true||previous?.source!=='AirWAIT-public-page'||day!==today)return null;
  const at=Date.parse(String(previous.fetchedAt||''));
  const age=Date.now()-at;
  if(!Number.isFinite(age)||age<0||age>45000)return null;
  // Also reject a 23:59 snapshot when the date rolls over after midnight.
  const captured=new Date(at+9*60*60*1000).toISOString().slice(0,10);
  return captured===today?previous:null;
}
export async function published(base) {
  return (await publishedStatus(base))?.waitTypes ?? null;
}
export async function check(base, onsite, online) {
  return allHidden(await published(base), onsite, online);
}
