// js/ui/kit.js
// Tiny micro-UI helpers used by every menu. Keeps menus consistent & tiny.
//
// Exposes: window.MyFiUI
//  - el(tag, attrs, ...children)
//  - helper(html)
//  - field(label, type, id, attrs)
//  - select(label, id, options)
//  - currentRow(label, valueId)
//  - inlineError(id) -> <p class="form-error" role="alert" aria-live="polite">
//  - setError(errorEl, msg, [inputEl]) -> sets text + aria-invalid on input
//  - btn(label, [variant], [onClick]) | primary(label, onClick) | danger(label, onClick) | cancel([label])
//  - btnOpenMenu(label, menuObj, opts) | btnOpenItem(label, menuObj, key, opts)
//
// Notes:
//  - Use btnOpenMenu / btnOpenItem for cross-menu navigation (stack-aware).
//  - Use inlineError + setError for consistent inline validation messaging.

(function () {
  function el(tag, attrs = {}, ...kids) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    kids.flat().forEach(k => {
      if (k == null) return;
      node.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return node;
  }

  // Basic blocks
  const helper = (html) => { const d = el('div', { class: 'helper' }); d.innerHTML = html; return d; };

  const field = (label, type, id, attrs = {}) => {
    const wrap = el('div', { class: 'field' });
    const lab  = el('label', { for: id }, label);
    const inp  = (type === 'textarea')
      ? el('textarea', { id, class: 'input', rows: attrs.rows || 5, ...attrs })
      : el('input',    { id, class: 'input', type, ...attrs });
    wrap.append(lab, inp);
    return wrap;
  };

  const select = (label, id, options) => {
    const wrap = el('div', { class: 'field' });
    const lab  = el('label', { for: id }, label);
    const sel  = el('select', { id, class: 'input' },
      options.map(([val, text]) => el('option', { value: val }, text)));
    wrap.append(lab, sel);
    return wrap;
  };

  const currentRow = (label, id) => {
    const wrap = el('div', { class: 'field' });
    wrap.innerHTML = `
      <div class="current-row">
        <label>${label}</label>
        <div id="${id}" class="current-value">—</div>
      </div>`;
    return wrap;
  };

  // Inline errors
  const inlineError = (id) => el('p', {
    id, class: 'form-error', role: 'alert', 'aria-live': 'polite'
  });

  function setError(errorEl, msg, inputEl) {
    if (!errorEl) return false;
    const txt = String(msg || '');
    errorEl.textContent = txt;
    if (inputEl) {
      if (txt) inputEl.setAttribute('aria-invalid', 'true');
      else     inputEl.removeAttribute('aria-invalid');
    }
    return !txt;
  }

  // Buttons
  function btn(label, variant = 'secondary', onClick = null) {
    const cls =
      variant === 'accent' ? 'btn btn--accent' :
      // keep danger simple; if you later style .btn--danger, switch here
      variant === 'danger' ? 'btn' : 
      'btn';
    const b = el('button', { type: 'button', class: cls }, label);
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  const primary = (label, fn) => btn(label, 'accent', fn);
  const danger  = (label, fn) => btn(label, 'danger', fn);
  const cancel  = (label = 'Close') => btn(label, 'secondary', () => window.MyFiModal.close());

  // Cross-menu launchers (stack-aware)
  const btnOpenMenu = (label, menu, opts = {}) =>
    btn(label, 'accent', () => window.MyFiModal.openChildMenu(menu, opts));

  const btnOpenItem = (label, menu, key, opts = {}) =>
    btn(label, 'accent', () => window.MyFiModal.openChildItem(menu, key, opts));

  window.MyFiUI = {
    el, helper, field, select, currentRow,
    inlineError, setError,
    btn, primary, danger, cancel,
    btnOpenMenu, btnOpenItem,
  };
})();
