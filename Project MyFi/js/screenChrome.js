// js/screenChrome.js
// Persistent header/footer host + per-screen footer profiles

const REGISTRY = new Map();
let mounts = { header: null, footer: null };
let cloned = { header: null, footer: null };

function measureChromeHeights() {
  const root = document.documentElement;
  const header = mounts.header?.firstElementChild;
  const footer = mounts.footer?.firstElementChild;
  if (header) root.style.setProperty('--header-h', Math.ceil(header.getBoundingClientRect().height) + 'px');
  if (footer) root.style.setProperty('--hud-footer-h', Math.ceil(footer.getBoundingClientRect().height) + 'px');
}

function cloneOnceFromVitals() {
  if (cloned.header && cloned.footer) return;

  const vitals = document.getElementById('vitals-root');
  if (!vitals) return;

  // Take the first .topbar and .hud-footer we find inside vitals
  const headerSrc = vitals.querySelector('.topbar');
  const footerSrc = vitals.querySelector('.hud-footer');

  if (headerSrc && mounts.header && !cloned.header) {
    cloned.header = headerSrc.cloneNode(true);
    mounts.header.appendChild(cloned.header);
    // Hide original to avoid double focus / hit areas:
    headerSrc.style.display = 'none';
  }
  if (footerSrc && mounts.footer && !cloned.footer) {
    cloned.footer = footerSrc.cloneNode(true);
    mounts.footer.appendChild(cloned.footer);
    footerSrc.style.display = 'none';
  }

  measureChromeHeights();

  // Keep existing footer button IDs so your current auto-wirers still work:
  //  - #left-btn, #essence-btn, #right-btn
  //  - Essence mini bar (#vital-essence)
  // Your existing inline init calls will bind to these IDs as usual.
}

function setFooterIcons({ left, main, right } = {}) {
  const leftBtn  = mounts.footer?.querySelector('#left-btn');
  const mainBtn  = mounts.footer?.querySelector('#essence-btn');
  const rightBtn = mounts.footer?.querySelector('#right-btn');

  if (leftBtn && left?.icon)  leftBtn.textContent  = left.icon;
  if (leftBtn && left?.title) leftBtn.title = left.title;

  if (mainBtn && main?.icon)  mainBtn.textContent  = main.icon;
  if (mainBtn && main?.title) mainBtn.title = main.title;

  if (rightBtn && right?.icon)  rightBtn.textContent  = right.icon;
  if (rightBtn && right?.title) rightBtn.title = right.title;

  // (Re)bind handlers safely
  function rebind(btn, cfg) {
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true)); // remove old listeners
    const fresh = mounts.footer.querySelector('#' + btn.id);
    if (cfg?.onClick) fresh.addEventListener('click', cfg.onClick);
  }
  rebind(leftBtn, left);
  rebind(mainBtn, main);
  rebind(rightBtn, right);
}

export function registerScreenChrome(screenId, spec) {
  REGISTRY.set(screenId, spec || {});
}

export function applyChromeFor(screenId) {
  const spec = REGISTRY.get(screenId) || REGISTRY.get('default') || {};
  setFooterIcons(spec.footer);

  // Optional header title sync (keeps your existing <h1 id="header-title">)
  if (spec.title) {
    const h1 = mounts.header?.querySelector('#header-title');
    if (h1) h1.textContent = spec.title.toUpperCase();
  }
}

export function initScreenChrome() {
  mounts.header = document.getElementById('chromeHeaderMount');
  mounts.footer = document.getElementById('chromeFooterMount');

  cloneOnceFromVitals();
  measureChromeHeights();

  // Re-measure on resize/rotation/viewport changes
  window.addEventListener('resize', measureChromeHeights, { passive: true });
  window.addEventListener('orientationchange', measureChromeHeights, { passive: true });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', measureChromeHeights, { passive: true });
    visualViewport.addEventListener('scroll', measureChromeHeights, { passive: true });
  }

  // Provide a baseline ("default") profile (Vitals-like)
  registerScreenChrome('default', {
    title: 'VITALS',
    footer: {
      left:  { icon: '⚡', title: 'Energy'  /* clicking wired by your existing autoInitAddEnergyButton */ },
      main:  { title: 'Use Essence' /* main button keeps #essence-btn id; your menu wiring remains */ },
      right: { icon: '👥', title: 'Social'  /* wiring via your existing social init */ }
    }
  });
}
