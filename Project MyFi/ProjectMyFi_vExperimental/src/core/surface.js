// src/core/surface.js
// JSON-first UI surface loader + renderer (minimal v1)
//
// Design intent (fits the "UI DSL + renderer + prefab parts" direction):
// - A Surface JSON describes layout (slots) + which Parts to mount.
// - Parts own all DOM wiring and are the ONLY place behaviour exists.
// - Surfaces can safely be AI-uplifted because they are declarative.

const jsonCache = new Map(); // href -> parsed object

export async function loadJSON(urlLike) {
  const href = (typeof urlLike === 'string') ? urlLike : urlLike.toString();
  if (jsonCache.has(href)) return jsonCache.get(href);

  const res = await fetch(href, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`loadJSON: failed to fetch ${href} (${res.status})`);

  const obj = await res.json();
  jsonCache.set(href, obj);
  return obj;
}

// Surface schema (v1)
// {
//   id: "quests",
//   slots: [ { id:"root", class:"...", style:{...}, parent?:"<slotId>" }, ... ],
//   parts: [ { id:"board", kind:"QuestBoard", slot:"root", props:{...} }, ... ]
// }
function validateSurface(surface) {
  const problems = [];
  if (!surface || typeof surface !== 'object') problems.push('surface is not an object');
  if (!surface.id || typeof surface.id !== 'string') problems.push('missing string "id"');
  if (!Array.isArray(surface.slots) || surface.slots.length === 0) problems.push('missing non-empty "slots" array');
  if (!Array.isArray(surface.parts)) problems.push('missing "parts" array');
  return { ok: problems.length === 0, problems };
}

function el(tag, attrs = {}) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && v && typeof v === 'object') Object.assign(n.style, v);
    else if (v !== undefined && v !== null) n.setAttribute(k, String(v));
  });
  return n;
}

/**
 * Mounts a surface JSON into root.
 * @param {Element} root
 * @param {object} surface
 * @param {object} options
 * @param {function(string): any} options.resolvePart - resolves a part "kind" to a Part factory.
 * @param {object} options.ctx - passed through to parts (e.g., { navigate })
 * @returns {Promise<{ unmount: Function, slots: Map<string,Element> }>} 
 */
export async function mountSurface(root, surface, { resolvePart, ctx = {} } = {}) {
  if (!(root instanceof Element)) throw new Error('mountSurface: root must be a DOM Element');

  const vr = validateSurface(surface);
  if (!vr.ok) throw new Error(`mountSurface: invalid surface: ${vr.problems.join('; ')}`);
  if (typeof resolvePart !== 'function') throw new Error('mountSurface: resolvePart(kind) is required');

  // Build slots (supports simple nesting via `parent` slot id)
  root.innerHTML = '';
  const slots = new Map();
  // First pass: create all slot elements
  for (const s of surface.slots) {
    const id = s?.id;
    if (!id) continue;
    const slot = el('div', {
      id: `${surface.id}__slot__${id}`,
      class: s.class || 'slot',
      style: s.style || {}
    });
    slot.dataset.slotId = id;
    slots.set(id, slot);
  }
  // Second pass: append in declared order to either root or parent slot
  for (const s of surface.slots) {
    const id = s?.id;
    if (!id) continue;
    const slot = slots.get(id);
    if (!slot) continue;
    const parentId = s?.parent;
    const parentEl = parentId ? slots.get(parentId) : null;
    (parentEl || root).appendChild(slot);
  }

  // Mount parts
  const cleanups = [];
  for (const p of surface.parts) {
    if (!p || !p.kind || !p.slot) continue;
    const host = slots.get(p.slot);
    if (!host) throw new Error(`mountSurface: part "${p.id || p.kind}" targets missing slot "${p.slot}"`);

    const partFactory = await resolvePart(p.kind);
    if (typeof partFactory !== 'function') {
      throw new Error(`mountSurface: resolvePart("${p.kind}") did not return a function`);
    }

    const partRoot = el('div', { class: `part part-${p.kind}` });
    partRoot.dataset.partId = p.id || '';
    partRoot.dataset.partKind = p.kind;

    // IMPORTANT (nested slots):
    // Slots can contain child slot elements (declared via `parent`). We want parts
    // mounted into a slot to appear *before* its child slots, so header/tabs don't
    // get pushed below the nested content region.
    const firstChildSlot = Array.from(host.children).find(ch => ch?.dataset?.slotId);
    if (firstChildSlot) host.insertBefore(partRoot, firstChildSlot);
    else host.appendChild(partRoot);

    const api = await partFactory(partRoot, {
      id: p.id,
      kind: p.kind,
      props: p.props || {},
      ctx
    });

    if (api && typeof api.unmount === 'function') cleanups.push(() => api.unmount());
  }

  return {
    slots,
    unmount() {
      cleanups.forEach(fn => { try { fn(); } catch {} });
      root.innerHTML = '';
    }
  };
}
