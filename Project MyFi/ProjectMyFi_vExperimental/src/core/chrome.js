let headerEl, footerEl, titleEl, extrasEl;
let currentMode = 'full';

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

export function applyChromeProfile(profile = {}) {
  currentMode = profile.mode ?? 'full';
  headerEl.style.display = (currentMode === 'none') ? 'none' : '';
  footerEl.style.display = (currentMode === 'full') ? '' : 'none';

  if (profile.title) setHeaderTitle(profile.title);
  if (profile.headerExtras) setHeaderExtras(profile.headerExtras);
  if (profile.footer) setFooter(profile.footer);

  measure();
}

export function setHeaderTitle(text) { if (titleEl) titleEl.textContent = text; }
export function setHeaderExtras(nodes = []) {
  extrasEl.replaceChildren(...nodes);
}
export function setFooter({ left, main, right } = {}) {
  const L = document.getElementById('left-btn');
  const M = document.getElementById('main-btn');
  const R = document.getElementById('right-btn');

  function wire(btn, cfg) {
    if (!btn || !cfg) return;
    btn.textContent = cfg.icon ?? btn.textContent;
    btn.title = cfg.title ?? '';
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
    if (cfg.onClick) clone.addEventListener('click', cfg.onClick);
  }
  wire(L, left); wire(M, main); wire(R, right);
}
