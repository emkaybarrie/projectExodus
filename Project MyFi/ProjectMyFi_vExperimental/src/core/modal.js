const root = document.getElementById('modal-root');
let stack = []; // [{ id, owner, scope, node, abort, onCloseFns: [] }]
let seq = 1;

function ensureRoot() {
  if (!root) throw new Error('modal: #modal-root missing');
}
// function renderLayer(contentNode) {
//   const wrap = document.createElement('div');
//   wrap.className = 'modal-layer';

//   const overlay = document.createElement('div');
//   overlay.className = 'modal-overlay';
//   wrap.appendChild(overlay);

//   const card = document.createElement('div');
//   card.className = 'modal-card';
//   card.appendChild(contentNode);
//   wrap.appendChild(card);

//   const closeBtn = document.createElement('button');
//   closeBtn.className = 'modal-close-btn';
//   closeBtn.setAttribute('aria-label', 'Close modal');
//   closeBtn.textContent = '×';
//   card.appendChild(closeBtn);

//   return { wrap, overlay, card, closeBtn };
// }

function renderLayer(contentNode) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-layer';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  wrap.appendChild(overlay);

  const card = document.createElement('div');
  card.className = 'modal-card';

  // NEW: inner wrapper that applies responsive layout rules
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

  return { wrap, overlay, card, closeBtn, inner };
}


/**
 * Open a modal.
 * @param {Object} opts
 * @param {Node|DocumentFragment|string} opts.content
 * @param {string} [opts.owner='global'] who opened this (screen id)
 * @param {'screen'|'global'} [opts.scope='screen'] close on navigation?
 * @param {Function} [opts.onClose] callback after removal
 */
// export function open({ content, owner='global', scope='screen', onClose } = {}) {
//   ensureRoot();

//   // normalize content
//   let node = content;
//   if (typeof content === 'string') {
//     const tpl = document.createElement('template');
//     tpl.innerHTML = content;
//     node = tpl.content;
//   }
//   if (!(node instanceof Node) && !(node instanceof DocumentFragment))
//     throw new Error('modal.open: content must be Node/Fragment or HTML string');

//   const { wrap, overlay, card, closeBtn } = renderLayer(node);
//   root.appendChild(wrap);
//   root.classList.add('modal-open');

//   const abort = new AbortController();
//   const rec = { id: seq++, owner, scope, node: wrap, abort, onCloseFns: [] };
//   if (typeof onClose === 'function') rec.onCloseFns.push(onClose);
//   stack.push(rec);

//   const doClose = () => {
//     if (!stack.includes(rec)) return;
//     abort.abort();
//     wrap.remove();
//     stack = stack.filter(x => x !== rec);
//     if (!stack.length) root.classList.remove('modal-open');
//     rec.onCloseFns.forEach(fn => { try{ fn(); } catch{} });
//   };

//   overlay.addEventListener('click', doClose, { signal: abort.signal });
//   closeBtn.addEventListener('click', doClose, { signal: abort.signal });
//   window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') doClose(); }, { signal: abort.signal });

//   return {
//     id: rec.id, owner: rec.owner, scope: rec.scope,
//     close: doClose,
//     onClose(fn){ if (typeof fn==='function') rec.onCloseFns.push(fn); return this; },
//     get isOpen(){ return stack.includes(rec); }
//   };
// }

export function open({ content, owner='global', scope='screen', onClose } = {}) {
  ensureRoot();

  // normalize content
  let node = content;
  if (typeof content === 'string') {
    const tpl = document.createElement('template');
    tpl.innerHTML = content;
    node = tpl.content;
  }
  if (!(node instanceof Node) && !(node instanceof DocumentFragment))
    throw new Error('modal.open: content must be Node/Fragment or HTML string');

  const { wrap, overlay, card, closeBtn } = renderLayer(node);
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
    stack = stack.filter(x => x !== rec);
    if (!stack.length) root.classList.remove('modal-open');
    rec.onCloseFns.forEach(fn => { try{ fn(); } catch{} });
  };

  overlay.addEventListener('click', doClose, { signal: abort.signal });
  closeBtn.addEventListener('click', doClose, { signal: abort.signal });
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') doClose(); }, { signal: abort.signal });

  return {
    id: rec.id, owner: rec.owner, scope: rec.scope,
    close: doClose,
    onClose(fn){ if (typeof fn==='function') rec.onCloseFns.push(fn); return this; },
    get isOpen(){ return stack.includes(rec); }
  };
}


export function closeAll({ owner, scope } = {}) {
  [...stack].reverse().forEach(rec => {
    if (owner && rec.owner !== owner) return;
    if (scope && rec.scope !== scope) return;
    rec.abort.abort();
    rec.node.remove();
    rec.onCloseFns.forEach(fn => { try{ fn(); } catch{} });
    stack = stack.filter(x => x !== rec);
  });
  if (!stack.length) root.classList.remove('modal-open');
}

// helper for router: close everything opened by a screen
export function closeOwnedBy(owner) { closeAll({ owner }); }
