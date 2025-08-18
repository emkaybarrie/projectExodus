// js/splash.js
const DEFAULT_IMAGES = [
  './assets/splash/avatarEmkay.png',
  './assets/splash/avatarRichard.png',
  './assets/splash/avatarAlie.png',
  './assets/splash/avatarJane.png',
  './assets/splash/avatarSammi.png',
  './assets/splash/avatarAmandeep.png',
  './assets/splash/avatarMohammed.png',
  './assets/splash/avatarGerard.png',
  './assets/splash/avatarMatthew.png',
  // './assets/splash/avatarHaiyang.png',
  './assets/splash/splash_01.png',
  './assets/splash/splash_02.png',
  './assets/splash/splash_03.png'
];

const DEFAULT_TIPS = [
  'Tag big purchases to Mana to protect your Stamina.',
  'Running low on Stamina? Delay non-essentials to next week.',
  'Health is your last resort—keep it topped up.',
  'Essence fuels cosmetics and unlocks—save it for the cool stuff.',
  'Hold to confirm tags quickly in the Update Log.',
  'Daily/Weekly/Monthly changes scale, not regen rate.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function preload(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(src);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function ensureMarkup() {
  let root = document.getElementById('splash-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'splash-root';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="splash-bg">
        <img id="splash-image" alt="" />
        <div class="splash-vignette"></div>
      </div>
      <div class="splash-content">
        <div class="splash-logo">
          <span class="splash-title">Project MyFi</span>
          <span class="splash-subtitle">loading the realm…</span>
        </div>
        <div class="splash-tip">
          <span id="splash-tip-label">Tip:</span>
          <span id="splash-tip-text"></span>
        </div>
        <div class="splash-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="splash-progress-bar" id="splash-progress-bar"></div>
        </div>
        <button class="splash-skip" id="splash-skip" type="button" aria-label="Skip loading">Skip</button>
      </div>`;
    Object.assign(root.style, {
      position: 'fixed', inset: '0', zIndex: '9999',
      display: 'grid', placeItems: 'center',
      background: '#0b0b18', opacity: '1', visibility: 'visible'
    });
    document.body.appendChild(root);
  }
  return {
    root,
    imgEl: document.getElementById('splash-image'),
    tipEl: document.getElementById('splash-tip-text'),
    barEl: document.getElementById('splash-progress-bar'),
    progEl: root.querySelector('.splash-progress'),
    skipBtn: document.getElementById('splash-skip'),
  };
}

/**
 * @param {Object} opts
 * @param {string[]} [opts.images]
 * @param {string[]} [opts.tips]
 * @param {number}   [opts.minDuration=1000]
 * @param {Promise}  [opts.until]
 * @param {boolean}  [opts.allowSkip=true]
 * @param {number}   [opts.maxWait=12000]
 */
export function createSplash(opts = {}) {
  const images = opts.images?.length ? opts.images : DEFAULT_IMAGES;
  const tips = opts.tips?.length ? opts.tips : DEFAULT_TIPS;
  const minDuration = Number.isFinite(opts.minDuration) ? opts.minDuration : 1000;
  const maxWait = Number.isFinite(opts.maxWait) ? opts.maxWait : 12000;
  const allowSkip = opts.allowSkip !== false;

  const { root, imgEl, tipEl, barEl, progEl, skipBtn } = ensureMarkup();

  try { if (tipEl) tipEl.textContent = pick(tips); } catch {}
  preload(pick(images)).then((src) => { try { if (imgEl && src) imgEl.src = src; } catch {} });

  let progress = 0, externalDone = false, minElapsed = false, closed = false, rafId = 0, tipTimer;

  const setProgress = (val) => {
    progress = Math.max(0, Math.min(100, val));
    try { if (barEl) barEl.style.width = `${progress}%`; } catch {}
    try { if (progEl) progEl.setAttribute('aria-valuenow', String(Math.round(progress))); } catch {}
  };

  const reallyHide = () => {
    clearInterval(tipTimer);
    cancelAnimationFrame(rafId);

    const app = document.querySelector('.app-root');
    if (app) app.classList.add('app-show');

    try { root.classList.add('hidden'); } catch {}
    // Fade out + then signal done
    setTimeout(() => {
      root.style.opacity = '0';
      root.style.visibility = 'hidden';
      root.style.pointerEvents = 'none';
      // If you prefer, remove from DOM:
      // root.remove();

      // 🔔 Notify the app that splash is fully gone
      try { window.dispatchEvent(new CustomEvent('splash:done')); } catch {}
    }, 300);

    closed = true;
  };

  const loop = () => {
    if (closed) return;
    const cap = externalDone ? 100 : 92;
    const delta = externalDone ? 2.4 : (0.8 + Math.random() * 0.9);
    setProgress(Math.min(cap, progress + delta));
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  if (skipBtn) {
    skipBtn.disabled = true;
    if (!allowSkip) skipBtn.style.display = 'none';
    skipBtn.addEventListener('click', () => { if (!skipBtn.disabled) reallyHide(); });
  }

  const maybeComplete = () => {
    if (closed) return;
    const ready = externalDone && minElapsed;
    if (skipBtn) skipBtn.disabled = !ready;
    if (ready) {
      setProgress(100);
      setTimeout(reallyHide, 180);
    }
  };

  setTimeout(() => { minElapsed = true; maybeComplete(); }, Math.max(0, minDuration));
  const safety = setTimeout(() => { externalDone = true; minElapsed = true; maybeComplete(); }, maxWait);

  if (opts.until && typeof opts.until.finally === 'function') {
    opts.until.finally(() => { externalDone = true; clearTimeout(safety); maybeComplete(); });
  } else {
    externalDone = true; clearTimeout(safety); maybeComplete();
  }

  tipTimer = setInterval(() => { try { if (tipEl) tipEl.textContent = pick(tips); } catch {} }, 2600);

  return { setProgress, complete: () => { externalDone = true; maybeComplete(); }, hide: reallyHide };
}
