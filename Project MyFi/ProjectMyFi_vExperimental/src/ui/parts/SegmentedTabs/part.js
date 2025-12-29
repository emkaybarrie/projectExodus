import { on } from '../_shared/dom.js';

async function loadHTML() {
  const res = await fetch(new URL('./baseline.html', import.meta.url));
  return res.text();
}

export default {
  id: 'SegmentedTabs',
  variants: ['default'],

  mount({ el, props, slice, emit }) {
    let cleanup = [];
    let state = {
      activeTabId: slice?.activeTabId || null,
      tabs: slice?.tabs || []
    };

    function clear() {
      cleanup.forEach(fn => { try { fn(); } catch {} });
      cleanup = [];
    }

    function render() {
      clear();

      // Keep baseline template present for uplift later, but we render our row contents
      const row = el.querySelector('[data-role="row"]') || el;

      // If baseline.html hasn’t loaded yet, row might be el; safe either way
      row.replaceChildren?.();

      for (const t of (state.tabs || [])) {
        const btn = document.createElement('button');
        btn.className = 'ui-btn';
        btn.style.borderRadius = '999px';
        btn.style.padding = '10px 12px';
        btn.style.marginRight = '8px';
        btn.textContent = t.label || t.id;

        if (t.id === state.activeTabId) {
          btn.style.borderColor = 'var(--ui-accent)';
          btn.style.background = 'var(--ui-surface-2)';
        }

        cleanup.push(on(btn, 'click', () => {
          if (t.id === state.activeTabId) return;
          state.activeTabId = t.id;
          emit('change', { tabId: t.id });
          render();
        }));

        row.appendChild(btn);
      }
    }

    // Load baseline skeleton then render
    loadHTML().then(html => {
      el.innerHTML = html;
      render();
    });

    return {
      update({ slice: nextSlice }) {
        state.activeTabId = nextSlice?.activeTabId ?? state.activeTabId;
        state.tabs = nextSlice?.tabs || [];
        render();
      },
      unmount() {
        clear();
      }
    };
  }
};
