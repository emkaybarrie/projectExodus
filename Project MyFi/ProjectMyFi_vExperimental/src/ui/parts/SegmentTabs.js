// src/ui/parts/SegmentTabs.js
// A small, reusable primitive for segmented tab buttons.
//
// Design goals:
// - Styling comes from baseline tokens/base classes or caller-provided classes.
// - Behaviour is simple: render buttons, manage active state, invoke onSelect.
// - No knowledge of screens/router; caller decides what onSelect does.

/**
 * @typedef {{ key: string, label: string }} SegmentTabItem
 */

/**
 * Mount a segmented tab group into `host`.
 *
 * @param {HTMLElement} host
 * @param {{
 *   items: SegmentTabItem[],
 *   initialKey?: string,
 *   buttonClass?: string,
 *   activeClass?: string,
 *   ariaLabel?: string,
 *   onSelect: (key:string) => void,
 * }} opts
 */
export function mountSegmentTabs(host, opts){
  const {
    items = [],
    initialKey = items[0]?.key,
    buttonClass = 'qbTab',
    activeClass = 'is-active',
    ariaLabel = 'Tabs',
    onSelect,
  } = opts || {};

  const state = { activeKey: initialKey };
  const cleanup = [];

  host.setAttribute('role', 'tablist');
  host.setAttribute('aria-label', ariaLabel);
  host.innerHTML = '';

  function setActive(key){
    state.activeKey = key;
    const btns = host.querySelectorAll('button[data-tab]');
    btns.forEach(b => b.classList.toggle(activeClass, b.dataset.tab === key));
  }

  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = buttonClass;
    b.dataset.tab = it.key;
    b.textContent = it.label;

    const handler = () => {
      setActive(it.key);
      try { onSelect?.(it.key); } catch(e) { /* swallow */ }
    };
    b.addEventListener('click', handler);
    cleanup.push(() => b.removeEventListener('click', handler));

    host.appendChild(b);
  }

  // initial
  setActive(state.activeKey);

  return {
    setActive,
    getActive(){ return state.activeKey; },
    unmount(){ cleanup.forEach(fn => { try { fn(); } catch {} }); },
  };
}
