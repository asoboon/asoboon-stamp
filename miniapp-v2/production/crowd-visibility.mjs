/**
 * Independently verify public AirWAIT slot visibility when quota values are
 * missing. Loaded ONLY on the empty/error path; normal HOME stays lightweight.
 * Never treats a failed waitTypes response or absent ID as a closed reception.
 */
export function allHidden(types, onsite, online) {
  if (!Array.isArray(types) || !Array.isArray(onsite) || !Array.isArray(online)) return null;
  const ids = [...onsite.map(x => String(x?.waitTypeId || '')), ...online.map(String)];
  if (!ids.length || ids.some(x => !x)) return null;
  const map = new Map(types.map(x => [String(x?.waitTypeId || ''), x]));
  if (!ids.every(id => map.has(id))) return null;
  return ids.every(id => map.get(id)?.dispFlg === false);
}
export async function check(base, onsite, online) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('action', 'waitTypes');
    const response = await fetch(url, {cache:'no-store', credentials:'omit', signal:ctrl.signal});
    if (!response.ok) return null;
    const data = await response.json();
    return data?.ok === true ? allHidden(data.waitTypes, onsite, online) : null;
  } catch {return null}
  finally {clearTimeout(timer)}
}
