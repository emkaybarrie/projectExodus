let headerEl, footerEl, titleEl, extrasEl;
let currentMode = 'full';

// track current buttons so we can use mode-based visibility if needed
let lastHeaderExtrasConfig = [];

export function initChrome() {
  headerEl = document.getElementById('chrome-header');
  footerEl = document.getElementById('chrome-footer');
  titleEl  = document.getElementById('header-title');
  extrasEl = document.getElementById('header-extras');

  measure();
  window.addEventListener('resize', measure, { passive:true });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', measure, { passive:true });
  }
}

function measure() {
  const root = document.documentElement;
  const h = headerEl.querySelector('header')?.getBoundingClientRect().height || 0;
  const f = footerEl.querySelector('footer')?.getBoundingClientRect().height || 0;

  root.style.setProperty('--header-h', (currentMode === 'none' ? 0 : h) + 'px');
  root.style.setProperty('--footer-h', (currentMode === 'full' ? f : 0) + 'px');
}

/**
 * applyChromeProfile({
 *    mode: 'full' | 'solo' | 'none',
 *    title: 'HUB',
 *    headerExtras: [ { icon, label, badge, title, variant, onClick, hiddenOnModes }, ... ],
 *    footer: { left:{...}, main:{...}, right:{...} }
 * })
 */
export function applyChromeProfile(profile = {}) {
  currentMode = profile.mode ?? 'full';

  // header visible unless mode === 'none'
  headerEl.style.display = (currentMode === 'none') ? 'none' : '';
  // footer visible only in 'full'
  footerEl.style.display = (currentMode === 'full') ? '' : 'none';

  if ('title' in profile) {
    setHeaderTitle(profile.title);
  }

  // IMPORTANT:
  // If caller DID provide headerExtras (even empty array), use it.
  // If caller DID NOT provide headerExtras at all, default to clearing.
  if ('headerExtras' in profile) {
    setHeaderExtras(profile.headerExtras || []);
  } else {
    setHeaderExtras([]); // safest default to avoid button leakage between screens
  }

  if ('footer' in profile) {
    setFooter(profile.footer);
  } else {
    // you can choose to clear footer, but usually you WANT footer persistence
    // so we'll leave this one sticky unless explicitly changed.
  }

  measure();
}

// ──────────────────────────
// HEADER TITLE
// ──────────────────────────
export function setHeaderTitle(text) {
  if (titleEl) titleEl.textContent = text ?? '';
}

// ──────────────────────────
// HEADER EXTRAS
// ──────────────────────────
//
// Config format per button:
// {
//   icon: '☰' | Node,           // can be string or DOM Node (for SVGs)
//   label: 'Menu',              // optional
//   badge: 3 | '9+' | null,     // optional, renders top-right pill
//   title: 'Open menu',         // tooltip
//   variant: 'ghost'|'danger',  // optional visual style
//   hiddenOnModes: ['none'],    // optional array of chrome modes in which this button is hidden
//   onClick(){ ... }            // handler
// }
//
// Or you can pass actual Nodes instead of configs for full custom rendering.
//
export function setHeaderExtras(extras = []) {
  if (!extrasEl) return;

  lastHeaderExtrasConfig = extras;

  const nodes = extras.map(item => {
    if (item instanceof Node) return item;
    return buildHeaderButtonNode(item);
  });

  extrasEl.replaceChildren(...nodes);
}

function buildHeaderButtonNode(cfg = {}) {
  // outer button
  const btn = document.createElement('button');
  btn.className = 'chrome-header-btn';

  // variant class
  if (cfg.variant) {
    btn.classList.add(`variant-${cfg.variant}`);
  }

  // mode-based visibility
  if (cfg.hiddenOnModes && Array.isArray(cfg.hiddenOnModes)) {
    if (cfg.hiddenOnModes.includes(currentMode)) {
      btn.classList.add('is-hidden');
    }
  }

  // tooltip
  if (cfg.title) btn.title = cfg.title;

  // inner flex wrapper for icon+label
  const inner = document.createElement('span');
  inner.className = 'chrome-header-btn-inner';

  // icon
  if (cfg.icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'chrome-header-btn-icon';

    if (cfg.icon instanceof Node) {
      iconSpan.appendChild(cfg.icon); // SVG node, etc
    } else {
      iconSpan.textContent = cfg.icon; // emoji / text
    }

    inner.appendChild(iconSpan);
  }

  // label
  if (cfg.label) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'chrome-header-btn-label';
    labelSpan.textContent = cfg.label;
    inner.appendChild(labelSpan);
  }

  btn.appendChild(inner);

  // badge
  if (cfg.badge !== undefined && cfg.badge !== null && cfg.badge !== 0 && cfg.badge !== '0') {
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'chrome-header-badge';
    badgeSpan.textContent = String(cfg.badge);
    btn.appendChild(badgeSpan);
  }

  // click handler
  if (typeof cfg.onClick === 'function') {
    btn.addEventListener('click', cfg.onClick);
  }

  return btn;
}

// ──────────────────────────
// FOOTER (same pattern you had, with safety cloning)
// ──────────────────────────
export function setFooter({ left, main, right } = {}) {
  const L = document.getElementById('left-btn');
  const M = document.getElementById('main-btn');
  const R = document.getElementById('right-btn');

  function wire(btn, cfg) {
    if (!btn || !cfg) return;

    // clone to drop old listeners
    const clone = btn.cloneNode(true);

    // icon text (emoji, etc)
    clone.textContent = cfg.icon ?? clone.textContent ?? '';
    clone.title = cfg.title ?? '';

    btn.replaceWith(clone);

    if (cfg.onClick) {
      clone.addEventListener('click', cfg.onClick);
    }
  }

  wire(L, left);
  wire(M, main);
  wire(R, right);
}
