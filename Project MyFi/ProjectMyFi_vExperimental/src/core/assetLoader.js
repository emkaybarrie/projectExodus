const _textCache = new Map();
const toHref = (u)=> (u instanceof URL)? u.href : String(u);

export async function loadTextOnce(key, url){
  if (_textCache.has(key)) return _textCache.get(key);
  const href = toHref(url);
  const p = fetch(href, { cache: 'no-cache' }).then(async (r)=>{
    if (!r.ok) throw new Error(`Failed to load text asset (${key}) from ${href}: ${r.status}`);
    return await r.text();
  });
  _textCache.set(key, p);
  return p;
}

export async function loadJSONOnce(key, url){
  const txt = await loadTextOnce(key, url);
  return JSON.parse(txt);
}
