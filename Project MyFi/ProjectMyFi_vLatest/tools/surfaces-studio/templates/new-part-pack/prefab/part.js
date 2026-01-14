// part.js (PREFAB stub, LOCKED wiring template)
import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

export async function <Kind>Part(host, { id, kind, props = {}, ctx = {} }){
  await ensureGlobalCSS(`prefab.<Kind>`, new URL('./uplift.css', import.meta.url).href);

  const root = document.createElement('div');
  root.className = `Part-<Kind>`;

  // Prefer uplift.html if present, else baseline.html
  const upliftUrl = new URL('./uplift.html', import.meta.url).href;
  const baseUrl = new URL('./baseline.html', import.meta.url).href;

  let html = '';
  try { html = await fetchText(upliftUrl); }
  catch { html = await fetchText(baseUrl); }

  root.innerHTML = html;
  host.appendChild(root);

  return { unmount(){ root.remove(); } };
}
