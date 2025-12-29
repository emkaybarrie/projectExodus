import { on } from '../_shared/dom.js';
import { partRegistry } from '../registry.js';

async function loadHTML() {
  const res = await fetch(new URL('./baseline.html', import.meta.url));
  return res.text();
}

function sectionTitle(text) {
  const h = document.createElement('div');
  h.style.display = 'flex';
  h.style.alignItems = 'baseline';
  h.style.justifyContent = 'space-between';
  h.style.margin = '6px 0 10px 0';

  const t = document.createElement('div');
  t.textContent = text || '';
  t.style.fontWeight = '700';
  t.style.letterSpacing = '0.5px';

  h.appendChild(t);
  return h;
}

function sectionHint(text) {
  if (!text) return null;
  const p = document.createElement('div');
  p.textContent = text;
  p.style.color = 'var(--ui-muted)';
  p.style.fontSize = '12px';
  p.style.marginBottom = '10px';
  return p;
}

export default {
  id: 'List',
  variants: ['sections'],

  mount({ el, props, slice, emit }) {
    let cleanup = [];
    let childInstances = [];

    function clearChildren() {
      childInstances.forEach(inst => { try { inst.unmount?.(); } catch {} });
      childInstances = [];
      cleanup.forEach(fn => { try { fn(); } catch {} });
      cleanup = [];
    }

    function emitItem(eventName, item) {
      emit(`item.${eventName}`, { item });
    }

    function render() {
      clearChildren();

      const container = el.querySelector('[data-role="container"]') || el;
      container.replaceChildren();

      const order = props?.sectionOrder || ['active', 'available'];
      const renderItemPartId = props?.renderItemPartId || null;

      for (const key of order) {
        const sec = slice?.[key];
        if (!sec) continue;

        container.appendChild(sectionTitle(sec.title || key));

        const hint = sectionHint(sec.hint);
        if (hint) container.appendChild(hint);

        const items = Array.isArray(sec.items) ? sec.items : [];

        // Optional: enforce maxActive (for "active" section only)
        const limited = (key === 'active' && props?.maxActive)
          ? items.slice(0, Number(props.maxActive))
          : items;

        if (limited.length === 0) {
          const empty = document.createElement('div');
          empty.textContent = '—';
          empty.style.opacity = '0.6';
          empty.style.padding = '8px 0 14px 0';
          container.appendChild(empty);
          continue;
        }

        for (const item of limited) {
          const wrap = document.createElement('div');
          wrap.style.marginBottom = '10px';
          container.appendChild(wrap);

          const Part = (renderItemPartId && partRegistry[renderItemPartId]) ? partRegistry[renderItemPartId] : null;

          if (Part) {
            const inst = Part.mount({
              el: wrap,
              variant: 'default',
              props: { sectionKey: key },
              slice: item,
              tokens: null,
              emit: (name) => {
                if (name === 'primary') emitItem('primary', item);
                if (name === 'claim') emitItem('claim', item);
              }
            });
            childInstances.push(inst);
          } else {
            // ALWAYS keep a fallback so the screen never goes blank
            const btn = document.createElement('button');
            btn.className = 'ui-btn';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.textContent = item?.title || item?.id || 'Item';
            cleanup.push(on(btn, 'click', () => emitItem('primary', item)));
            wrap.appendChild(btn);
          }
        }
      }
    }

    loadHTML().then(html => {
      el.innerHTML = html;
      render();
    });

    return {
      update({ slice: nextSlice, props: nextProps }) {
        slice = nextSlice;
        props = nextProps;
        render();
      },
      unmount() {
        clearChildren();
      }
    };
  }
};
