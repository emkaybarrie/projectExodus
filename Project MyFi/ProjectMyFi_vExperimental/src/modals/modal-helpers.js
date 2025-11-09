// src/modules/modal-helpers.js

export function buildTabs(items, cfg = {}) {
  const active = { id: cfg.activeId || (items[0]?.id ?? '') };
  const bar = document.createElement('div');
  bar.className = `tabbar ${cfg.size ? `tabbar-${cfg.size}` : 'tabbar-md'}`;

  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.textContent = it.label;
    b.dataset.id = it.id;
    if (it.id === active.id) b.classList.add('active');
    b.addEventListener('click', () => {
      if (active.id === it.id) return;
      active.id = it.id;
      [...bar.children].forEach(x => x.classList.toggle('active', x.dataset.id === it.id));
      cfg.onChange?.(it.id);
    });
    bar.appendChild(b);
  }

  return {
    node: bar,
    setActive(id) {
      const btn = bar.querySelector(`[data-id="${id}"]`);
      if (!btn) return;
      active.id = id;
      [...bar.children].forEach(x => x.classList.toggle('active', x === btn));
      cfg.onChange?.(id);
    },
    getActive() { return active.id; }
  };
}

export function buildSubTabs(items, cfg = {}) {
  const t = buildTabs(items, { ...cfg, size: 'sm' });
  t.node.classList.add('subtabbar');
  return t;
}

export function buildPanels(contentList, cfg = {}) {
  const {
    direction = 'vertical',
    behavior  = 'smooth',      // informative; scroller sets scroll-behavior
    snap      = 'none',        // 'none' | 'mandatory' | 'proximity'
    fullWidthPanels = false,
  } = cfg;

  const wrap = document.createElement('div');
  wrap.className = 'panel-wrap';

  if (direction === 'horizontal') {
    wrap.style.display = 'grid';
    wrap.style.gridAutoFlow = 'column';
    wrap.style.gridAutoColumns = fullWidthPanels ? '100%' : 'minmax(260px, 1fr)';
    wrap.style.gap = '0';
  } else {
    wrap.style.display = 'grid';
    wrap.style.rowGap = '12px';
  }

  for (const make of contentList) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.append(normalizeContent(make));
    panel.style.scrollSnapAlign = (snap === 'none') ? 'none' : 'start';
    wrap.appendChild(panel);
  }

  return wrap;
}

function normalizeContent(val) {
  if (typeof val === 'function') return normalizeContent(val());
  if (typeof val === 'string') { const t = document.createElement('template'); t.innerHTML = val; return t.content; }
  return (val instanceof Node || val instanceof DocumentFragment) ? val : document.createTextNode('');
}
