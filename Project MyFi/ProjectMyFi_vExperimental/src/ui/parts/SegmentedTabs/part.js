import { on } from '../_shared/dom.js';

const PART_ID = 'SegnentedTabs';

async function loadHTML() {
  const url = new URL('./baseline.html', import.meta.url);
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`[${PART_ID}] baseline.html failed to load (${res.status}):`, url.href);
    return `<div class="ui-btn">Missing baseline.html for ${PART_ID}</div>`;
  }

  const html = await res.text();

  // CONTRACT validation MUST come after this line
  if (!html.includes('CONTRACT:BEGIN') || !html.includes('CONTRACT:END')) {
    console.warn(`[${PART_ID}] baseline.html missing CONTRACT markers`);
  }

  return html;
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
