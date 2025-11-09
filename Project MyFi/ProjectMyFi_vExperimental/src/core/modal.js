// src/core/modal.js
// Lightweight modal stack + config-driven builder (with per-modal CSS injection)

const root = document.getElementById('modal-root');
let stack = []; // [{ id, owner, scope, node, abort, onCloseFns: [], styleEl? }]
let seq = 1;

function ensureRoot() {
  if (!root) throw new Error('modal: #modal-root missing');
}

function renderLayer(contentNode) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-layer';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  wrap.appendChild(overlay);

  const card = document.createElement('div');
  card.className = 'modal-card';

  const inner = document.createElement('div');
  inner.className = 'modal-inner';
  inner.appendChild(contentNode);
  card.appendChild(inner);

  wrap.appendChild(card);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close-btn';
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.textContent = '×';
  card.appendChild(closeBtn);

  return { wrap, overlay, card, inner, closeBtn };
}

/** Low-level modal open (unchanged behaviour). */
export function open({ content, owner = 'global', scope = 'screen', onClose } = {}) {
  ensureRoot();

  // normalize content
  let node = content;
  if (typeof content === 'string') {
    const tpl = document.createElement('template');
    tpl.innerHTML = content;
    node = tpl.content;
  }
  if (!(node instanceof Node) && !(node instanceof DocumentFragment)) {
    throw new Error('modal.open: content must be Node/Fragment or HTML string');
  }

  const { wrap, overlay, closeBtn } = renderLayer(node);
  root.appendChild(wrap);
  root.classList.add('modal-open');

  const abort = new AbortController();
  const rec = { id: seq++, owner, scope, node: wrap, abort, onCloseFns: [] };
  if (typeof onClose === 'function') rec.onCloseFns.push(onClose);
  stack.push(rec);

  const doClose = () => {
    if (!stack.includes(rec)) return;
    abort.abort();
    wrap.remove();
    // cleanup any per-modal injected styles
    if (rec.styleEl) { try { rec.styleEl.remove(); } catch {} }
    stack = stack.filter(x => x !== rec);
    if (!stack.length) root.classList.remove('modal-open');
    rec.onCloseFns.forEach(fn => { try { fn(); } catch {} });
  };

  overlay.addEventListener('click', doClose, { signal: abort.signal });
  closeBtn.addEventListener('click', doClose, { signal: abort.signal });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') doClose(); }, { signal: abort.signal });

  return {
    id: rec.id,
    owner: rec.owner,
    scope: rec.scope,
    node: wrap,
    close: doClose,
    onClose(fn) { if (typeof fn === 'function') rec.onCloseFns.push(fn); return this; },
    get isOpen() { return stack.includes(rec); }
  };
}

export function closeAll({ owner, scope } = {}) {
  [...stack].reverse().forEach(rec => {
    if (owner && rec.owner !== owner) return;
    if (scope && rec.scope !== scope) return;
    rec.abort.abort();
    // cleanup per-modal styles
    if (rec.styleEl) { try { rec.styleEl.remove(); } catch {} }
    rec.node.remove();
    rec.onCloseFns.forEach(fn => { try { fn(); } catch {} });
    stack = stack.filter(x => x !== rec);
  });
  if (!stack.length) root.classList.remove('modal-open');
}

export function closeOwnedBy(owner) { closeAll({ owner }); }

// ─────────────────────────────────────────────────────────────────────────────
// Config-driven builder with per-modal CSS injection

/** Auto-scope raw CSS so it only affects this modal instance. */
function scopeCss(rawCss, modalId) {
  const scopeSel = `.modal-inner[data-modal="${modalId}"]`;

  // stash @keyframes blocks so we don't try to prefix their selectors
  const keyframes = [];
  let css = String(rawCss || '');
  css = css.replace(/@keyframes[\s\S]*?\}\s*\}/g, (m) => {
    const token = `__KF__${keyframes.length}__`;
    keyframes.push(m);
    return token;
  });

  // prefix each top-level selector block (anything like "A, B, C { ... }")
  css = ('}' + css).replace(/\}\s*([^@{}][^{]*)\{/g, (_, sel) => {
    const parts = sel
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => (s.startsWith(scopeSel) ? s : `${scopeSel} ${s}`));
    return `}${parts.join(', ')}{`;
  }).slice(1);

  // restore keyframes
  keyframes.forEach((m, i) => { css = css.replace(`__KF__${i}__`, m); });
  return css;
}

export function openConfiguredModal(cfg = {}) {
  ensureRoot();

  const {
    owner = 'global',
    scope = 'screen',
    title = '',
    header = null,                 // Node | string | () => Node|string
    sections = [],                 // [{ id?, content, scroll? }, ...]
    footer = { buttons: [] },      // { buttons: [{ label, variant?, onClick?(api,ev) }] }

    // NEW: per-modal CSS
    modalId = '',                  // used as data attribute + scoping root
    styles = '',                   // raw CSS to inject (auto-scoped to modalId)
    scopeStyles = true,            // prefix styles with [data-modal="..."] automatically

    // scrolling defaults (body level)
    scroll = {
      direction: 'vertical',       // 'vertical' | 'horizontal'
      behavior: 'smooth',          // 'smooth' | 'auto'
      snap: 'none'                 // 'none' | 'mandatory' | 'proximity'
    },

    onClose
  } = cfg;

  // Build skeleton
  const frag = document.createDocumentFragment();
  const rootNode = document.createElement('div');
  rootNode.className = 'modal-inner';
  if (modalId) rootNode.dataset.modal = modalId;

  // Header (sticky)
  const head = document.createElement('div');
  head.className = 'modal-head';

  const titleEl = document.createElement('div');
  titleEl.className = 'modal-head-title';
  titleEl.textContent = String(title || '');
  head.appendChild(titleEl);

  if (header) head.appendChild(normalizeContent(header));

  // Body (scrollable)
  const body = document.createElement('div');
  body.className = 'modal-body';
  applyScrollConfig(body, scroll);

  // Sections
  sections.forEach((sec, idx) => {
    const wrap = document.createElement('section');
    wrap.className = 'modal-section';
    wrap.dataset.sectionId = sec.id ?? String(idx);
    if (sec.scroll) applyScrollConfig(wrap, sec.scroll, true);
    wrap.append(normalizeContent(sec.content));
    body.append(wrap);
  });

  // Footer (sticky)
  const foot = document.createElement('div');
  foot.className = 'modal-footer';
  (footer?.buttons || []).forEach(btnCfg => {
    const b = document.createElement('button');
    b.className = `modal-btn${btnCfg.variant ? ` modal-btn-${btnCfg.variant}` : ''}`;
    b.textContent = btnCfg.label ?? 'OK';
    b.addEventListener('click', (e) => btnCfg.onClick?.(api, e));
    foot.appendChild(b);
  });

  rootNode.append(head, body, foot);
  frag.append(rootNode);

  // Inject modal-scoped CSS (auto-removed on close)
  let injectedStyle = null;
  if (styles) {
    injectedStyle = document.createElement('style');
    injectedStyle.setAttribute('data-modal-style', modalId || 'anonymous');
    injectedStyle.textContent = (modalId && scopeStyles) ? scopeCss(styles, modalId) : styles;
    document.head.appendChild(injectedStyle);
  }

  const h = open({ content: frag, owner, scope, onClose });

  // attach styleEl to record for cleanup
  const rec = stack.find(r => r.id === h.id);
  if (rec && injectedStyle) rec.styleEl = injectedStyle;

  // Public API
  const api = {
    owner, scope,
    close: h.close,
    isOpen: () => h.isOpen,
    head, body, foot,
    setBodyScroll(sc) { applyScrollConfig(body, sc); },
    setSectionScroll(sectionId, sc) {
      const el = body.querySelector(`.modal-section[data-section-id="${sectionId}"]`);
      if (el) applyScrollConfig(el, sc, true);
    }
  };

  // Allow children to close via event
  rootNode.addEventListener('requestClose', () => h.close());

  return api;

  // helpers
  function normalizeContent(val) {
    if (typeof val === 'function') return normalizeContent(val());
    if (typeof val === 'string')  { const t = document.createElement('template'); t.innerHTML = val; return t.content; }
    return (val instanceof Node || val instanceof DocumentFragment) ? val : document.createTextNode('');
  }

  function applyScrollConfig(target, sc, isSection = false) {
    const dir = (sc?.direction || 'vertical').toLowerCase();
    const beh = (sc?.behavior || 'smooth').toLowerCase();
    const snap = (sc?.snap || 'none').toLowerCase();

    target.classList.remove('is-vertical', 'is-horizontal', 'scroll-snap-y', 'scroll-snap-x');
    target.style.scrollBehavior = (beh === 'smooth' ? 'smooth' : 'auto');
    target.style.scrollSnapType = 'none';

    if (dir === 'horizontal') {
      target.classList.add('is-horizontal');
      if (snap === 'mandatory' || snap === 'proximity') {
        target.classList.add('scroll-snap-x');
        target.style.scrollSnapType = `x ${snap}`;
      }
    } else {
      target.classList.add('is-vertical');
      if (snap === 'mandatory' || snap === 'proximity') {
        target.classList.add('scroll-snap-y');
        target.style.scrollSnapType = `y ${snap}`;
      }
    }

    // Sections act as snap targets when snap != none
    if (isSection) {
      target.style.scrollSnapAlign = (snap === 'none') ? 'none' : 'start';
    }
  }
}
