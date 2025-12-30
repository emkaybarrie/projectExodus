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

  root.style.setProperty('--chrome-header-h', getComputedStyle(root).getPropertyValue('--header-h').trim());
  root.style.setProperty('--chrome-footer-h', getComputedStyle(root).getPropertyValue('--footer-h').trim());

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

// ─────────────────────────────────────────────
// Header popover (anchored menu) for Hub, etc.
// ─────────────────────────────────────────────

let activeHeaderPopover = null;
let outsideClickHandler = null;
let escHandler = null;

export function closeHeaderPopover() {
  if (!activeHeaderPopover) return;
  window.removeEventListener('pointerdown', outsideClickHandler, true);
  window.removeEventListener('keydown', escHandler, true);
  activeHeaderPopover.remove();
  activeHeaderPopover = null;
  outsideClickHandler = null;
  escHandler = null;
}

/**
 * Unified anchored popover / panel
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.anchorEl  - element to anchor to (header btn, footer btn, etc)
 * @param {String} [opts.placement]    - 'auto' | 'top' | 'bottom'
 *                                       'auto' will choose below if there's more space below,
 *                                       otherwise above.
 *
 * LIST MODE:
 * @param {Array<{key:string,label:string,action:Function}>} opts.content
 * @param {String} [opts.title]        - heading text for list mode
 *
 * PANEL MODE:
 * @param {String|HTMLElement} opts.content
 *        raw HTML string OR an HTMLElement root. This gets injected directly.
 *
 * @param {"list"|"panel"} [mode="list"]
 *
 * @return {HTMLElement} popover element
 */
export function openHeaderPopover(opts, mode = 'list') {
  // close any currently open popover (acts as toggle)
  closeHeaderPopover();

  const { anchorEl } = opts;
  const placement = opts.placement || 'auto';
  if (!anchorEl) return;

  // build container
  const pop = document.createElement('div');
  pop.className = 'header-popover';

  // We'll track listItems only if mode === 'list' so we can run actions.
  let listItems = null;

  if (mode === 'list') {
    // expect opts.content to be an array
    listItems = Array.isArray(opts.content) ? opts.content : [];

    const titleText = opts.title ?? 'Menu';

    pop.innerHTML = `
      <h3 class="header-popover__title">${titleText}</h3>
      <div class="header-popover__list">
        ${listItems
          .map(i => `
            <button
              class="header-popover__item"
              data-action="${i.key}"
            >${i.label}</button>
          `)
          .join('')}
      </div>
    `;
  } else {
    // PANEL MODE:
    // free-form markup for richer previews (music, social, essence quick view, etc)
    const panelWrapper = document.createElement('div');
    panelWrapper.className = 'header-popover__panel';

    if (opts.content instanceof HTMLElement) {
      panelWrapper.appendChild(opts.content);
    } else {
      panelWrapper.innerHTML = String(opts.content || '');
    }

    pop.appendChild(panelWrapper);
  }

  // mount so we can measure size
  document.body.appendChild(pop);
  activeHeaderPopover = pop;

  // --- smart placement relative to anchor ---
  const rect = anchorEl.getBoundingClientRect();

  // 1. Decide whether to render above or below
  let wantBelow;
  if (placement === 'bottom') {
    wantBelow = true;
  } else if (placement === 'top') {
    wantBelow = false;
  } else {
    // auto
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    wantBelow = spaceBelow >= spaceAbove;
  }

  let topPx;
  if (wantBelow) {
    // classic header dropdown, below button
    topPx = rect.bottom + 6;
  } else {
    // footer-style pop-up above button
    topPx = rect.top - pop.offsetHeight - 6;
    if (topPx < 8) topPx = 8; // clamp to viewport
  }

  // 2. Horizontal alignment
  let leftPx = rect.right - pop.offsetWidth;

  // Clamp horizontal so it doesn't bleed off-screen
  if (leftPx < 8) leftPx = 8;
  if (leftPx + pop.offsetWidth > window.innerWidth - 8) {
    leftPx = window.innerWidth - pop.offsetWidth - 8;
  }

  pop.style.position = 'fixed';
  pop.style.top = `${Math.round(topPx)}px`;
  pop.style.left = `${Math.round(leftPx)}px`;
  pop.style.zIndex = '10000';

  // --- list-mode click delegation (fires action + closes) ---
  if (mode === 'list' && listItems && listItems.length) {
    pop.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.header-popover__item');
      if (!btn) return;
      const key = btn.dataset.action;
      const match = listItems.find(i => i.key === key);
      closeHeaderPopover();
      if (match && typeof match.action === 'function') {
        match.action();
      }
    });
  }

  // --- outside click & ESC close ---
  outsideClickHandler = (ev) => {
    if (!activeHeaderPopover) return;
    if (!pop.contains(ev.target) && !anchorEl.contains(ev.target)) {
      closeHeaderPopover();
    }
  };
  window.addEventListener('pointerdown', outsideClickHandler, true);

  escHandler = (ev) => {
    if (ev.key === 'Escape') {
      closeHeaderPopover();
    }
  };
  window.addEventListener('keydown', escHandler, true);

  return pop;
}

