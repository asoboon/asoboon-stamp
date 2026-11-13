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
export async function publishedStatus(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('action', 'waitTypes');
    url.searchParams.set('includePublicReception', '1');
    const response = await fetch(url, {cache:'no-store', credentials:'omit', signal:ctrl.signal});
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.ok !== true || !Array.isArray(data.waitTypes)) return null;
    return {waitTypes:data.waitTypes,
      publicReception:Object.hasOwn(data,'publicReception')?data.publicReception:null};
  } catch {return null}
  finally {clearTimeout(timer)}
}
export async function published(base) {
  return (await publishedStatus(base))?.waitTypes ?? null;
}
export async function check(base, onsite, online) {
  return allHidden(await published(base), onsite, online);
}
