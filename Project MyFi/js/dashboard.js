// ===== PWA helper + iOS modal & pulse (TOP OF FILE) =====
let __deferredPrompt = null;
let __isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const __ua = navigator.userAgent.toLowerCase();
const __isIOS = /iphone|ipad|ipod/.test(__ua);
const __isSafari = __isIOS && !/crios|fxios|edgios/.test(__ua);

// expose a tiny API used by banner + settings
window.MyFiPWA = {
  platform: __isIOS ? 'ios' : 'other',
  isInstalled() { return __isStandalone; },
  canPrompt() { return !!__deferredPrompt; },
  async promptInstall() {
    if (!__deferredPrompt) return { ok:false, reason:'no-beforeinstallprompt' };
    __deferredPrompt.prompt();
    const choice = await __deferredPrompt.userChoice.catch(() => ({ outcome:'dismissed' }));
    __deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa:prompt-consumed', { detail: choice }));
    return { ok: choice?.outcome === 'accepted', outcome: choice?.outcome };
  }
};

window.addEventListener('beforeinstallprompt', (e) => {
  // not fired on iOS
  e.preventDefault();
  __deferredPrompt = e;
  window.dispatchEvent(new Event('pwa:can-install'));
});
window.addEventListener('appinstalled', () => {
  __isStandalone = true;
  window.dispatchEvent(new Event('pwa:installed'));
});
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', e => {
  __isStandalone = e.matches;
  if (__isStandalone) window.dispatchEvent(new Event('pwa:installed'));
});

// --- iOS install modal + pulsing hotspot utilities ---
(function injectIOSInstallStylesOnce(){
  if (document.getElementById('myfi-ios-install-styles')) return;
  const css = `
  .myfi-ios-modal__overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(10,10,14,.65);backdrop-filter:blur(6px);z-index:99997;padding:16px}
  .myfi-ios-modal__card{width:min(520px,92vw);max-height:88vh;overflow:auto;background:rgba(22,22,28,.95);border:1px solid var(--line,#333);border-radius:14px;padding:14px;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.35)}
  .myfi-ios-modal__title{margin:0 0 6px 0;font-weight:700}
  .myfi-ios-steps{list-style:none;padding:0;margin:.25rem 0}
  .myfi-ios-steps li{display:flex;align-items:center;gap:.45rem;margin:.2rem 0}
  .myfi-ios-hint{margin:.35rem 0 .5rem;opacity:.85}
  .myfi-ios-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem}
  .myfi-ios-btn{padding:.55rem .85rem;border-radius:10px;border:1px solid var(--line,#333);background:rgba(255,255,255,.07);color:#fff}
  .myfi-ios-btn--ghost{background:transparent}
  .myfi-ios-pulse{position:fixed;left:50%;transform:translateX(-50%);width:26px;height:26px;border-radius:999px;background:rgba(255,255,255,.18);box-shadow:0 0 0 0 rgba(50,200,255,.8);z-index:99998;pointer-events:none;animation:myfiPulse 1.6s ease-out infinite}
  .myfi-ios-pulse--bottom{bottom:8px}
  .myfi-ios-pulse--top{top:10px}
  @keyframes myfiPulse{0%{box-shadow:0 0 0 0 rgba(50,200,255,.8)}70%{box-shadow:0 0 0 22px rgba(50,200,255,0)}100%{box-shadow:0 0 0 0 rgba(50,200,255,0)}}
  `;
  const style = document.createElement('style');
  style.id = 'myfi-ios-install-styles';
  style.textContent = css;
  document.head.appendChild(style);
})();

function myfiCreatePulse(position /* 'bottom' | 'top' */) {
  myfiDestroyPulse();
  const d = document.createElement('div');
  d.className = 'myfi-ios-pulse ' + (position === 'top' ? 'myfi-ios-pulse--top' : 'myfi-ios-pulse--bottom');
  d.id = 'myfi-ios-pulse';
  document.body.appendChild(d);
}
function myfiDestroyPulse() {
  const ex = document.getElementById('myfi-ios-pulse');
  if (ex) ex.remove();
}

function MyFiShowIOSInstallModal(opts={}) {
  // opts: { autoPulse: boolean }
  const overlay = document.createElement('div');
  overlay.className = 'myfi-ios-modal__overlay';
  const card = document.createElement('div');
  card.className = 'myfi-ios-modal__card';

  const title = document.createElement('h3');
  title.className = 'myfi-ios-modal__title';
  title.textContent = 'Install on iPhone';

  const steps = document.createElement('ol');
  steps.className = 'myfi-ios-steps';
  steps.innerHTML = `
    <li>🡱 In <b>Safari</b>, tap <b>Share</b> (square with arrow)</li>
    <li>➕ Choose <b>Add to Home Screen</b></li>
    <li>✅ Tap <b>Add</b></li>
  `;

  const hint = document.createElement('p');
  hint.className = 'myfi-ios-hint';
  hint.textContent = __isSafari
    ? 'Tip: If your toolbar is at the bottom, the Share button is centered. If you moved it to the top, use the Top pulse.'
    : 'Open this page in Safari to install, then follow the steps.';

  const actions = document.createElement('div');
  actions.className = 'myfi-ios-actions';

  const btnPulseBottom = document.createElement('button');
  btnPulseBottom.className = 'myfi-ios-btn';
  btnPulseBottom.textContent = 'Show Bottom Pulse';
  const btnPulseTop = document.createElement('button');
  btnPulseTop.className = 'myfi-ios-btn';
  btnPulseTop.textContent = 'Show Top Pulse';

  const btnCopy = document.createElement('button');
  btnCopy.className = 'myfi-ios-btn';
  btnCopy.textContent = 'Copy Link';

  const btnDont = document.createElement('button');
  btnDont.className = 'myfi-ios-btn myfi-ios-btn--ghost';
  btnDont.textContent = 'Don’t show again';

  const btnClose = document.createElement('button');
  btnClose.className = 'myfi-ios-btn myfi-ios-btn--ghost';
  btnClose.textContent = 'Close';

  actions.append(btnPulseBottom, btnPulseTop, btnCopy, btnDont, btnClose);

  card.append(title, steps, hint, actions);
  overlay.append(card);
  document.body.appendChild(overlay);

  const closeAll = () => { overlay.remove(); myfiDestroyPulse(); };

  btnPulseBottom.addEventListener('click', () => myfiCreatePulse('bottom'));
  btnPulseTop.addEventListener('click', () => myfiCreatePulse('top'));
  btnCopy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); btnCopy.textContent = 'Copied'; setTimeout(()=>btnCopy.textContent='Copy Link', 1100); } catch {}
  });
  btnDont.addEventListener('click', () => { localStorage.setItem('myfi.ios.install.dismissed','1'); closeAll(); });
  btnClose.addEventListener('click', closeAll);
  overlay.addEventListener('click', (e)=>{ if (e.target === overlay) closeAll(); });

  if (opts.autoPulse !== false) myfiCreatePulse('bottom');
}

// Expose for settings menu usage
window.MyFiShowIOSInstallModal = MyFiShowIOSInstallModal;
// ===== END of PWA + iOS helpers =====


// ===== Edge Glow module (centralized) =====
(function initEdgeGlow(){
  const mount = document.getElementById('edgeGlowMount');
  if (!mount) return;

  const layer = document.createElement('div');
  layer.className = 'edge-glow';
  mount.appendChild(layer);

  const dirs = ['up','right','down','left'];
  const strips = new Map();
  dirs.forEach(dir => {
    const s = document.createElement('div');
    s.className = 'edge-glow__strip tone-default is-disabled';
    s.dataset.dir = dir;
    layer.appendChild(s);
    strips.set(dir, s);
  });

  // internal state
  const state = {
    available: { up:false, right:false, down:false, left:false },
    tones:     { up:'default', right:'default', down:'default', left:'default' },
  };

  function setAvailability(next = {}) {
    Object.assign(state.available, next);
    for (const d of dirs) {
      const el = strips.get(d);
      el.classList.toggle('is-disabled', !state.available[d]);
    }
  }

  function setTone(dir, tone = 'default') {
    const el = strips.get(dir);
    if (!el) return;
    state.tones[dir] = tone;
    el.classList.remove('tone-default','tone-notify','tone-alert','tone-okay');
    el.classList.add('tone-' + tone);
  }

  function clearTone(dir) { setTone(dir, 'default'); }

  function peek(dir, on = true) {
    const el = strips.get(dir);
    if (!el || !state.available[dir]) return;
    el.classList.toggle('is-peek', !!on);
    if (on) {
      // auto clear after a beat so it doesn't hang
      clearTimeout(el.__peekT);
      el.__peekT = setTimeout(() => el.classList.remove('is-peek'), 900);
    }
  }

  function drag(dir, on = true) {
    const el = strips.get(dir);
    if (!el || !state.available[dir]) return;
    el.classList.toggle('is-drag', !!on);
    if (on) {
      clearTimeout(el.__dragT);
      el.__dragT = setTimeout(() => el.classList.remove('is-drag'), 300);
    }
  }

  function pulse(dir, on = true) {
    const el = strips.get(dir);
    if (!el) return;
    el.classList.toggle('is-pulsing', !!on);
  }

  // public API
  window.MyFiEdgeGlow = {
    setAvailability,
    setTone, clearTone,
    peek, drag, pulse,
    // convenience: set multiple at once: { left:{tone:'notify', pulse:true}, up:{tone:'default'} }
    set(config = {}) {
      for (const [dir, v] of Object.entries(config)) {
        if (v.tone) setTone(dir, v.tone);
        if (typeof v.available === 'boolean') state.available[dir] = v.available;
        if (typeof v.pulse === 'boolean') pulse(dir, v.pulse);
        if (v.peek) peek(dir, true);
      }
      setAvailability(state.available);
    }
  };
})();


// ===== YOUR ORIGINAL FILE STARTS HERE =====
import { auth, db } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js';

import { updateIncome, updateCoreExpenses } from "./data/cashflowData.js";
import { showWelcomeThenMaybeSetup } from './welcome.js';

import "./core/truelayer.js";
import "./modal.js";
import "./ui/kit.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";
import "./essenceMenu.js";
import "./socialMenu.js";
import "./quickMenus.js";
import "./musicManager.js"

const shouldShowSplash = sessionStorage.getItem('showSplashNext') === '1';
if (shouldShowSplash) sessionStorage.removeItem('showSplashNext');

// NEW: tell the music manager to defer playback until splash finishes
window.__MYFI_DEFER_MUSIC = shouldShowSplash;

function waitForEvent(name) {
  return new Promise((resolve) => window.addEventListener(name, () => resolve(), { once: true }));
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'start.html'; return; }

    
    /* ---------- Load player + HUD ---------- */
    const uid = user.uid;
    window.localStorage.setItem('user', JSON.stringify(user));

    // After: const uid = user.uid;
    const userRef = doc(db, 'players', uid);

    // Decide early if Welcome needs to show
    let needsWelcome = false;
    try {
      const snap = await getDoc(userRef);
      const welcomeDoneLocal  = localStorage.getItem('myfi.welcome.v1.done') === '1';
      const welcomeDoneServer = snap.exists() && !!snap.data()?.onboarding?.welcomeDone;
      needsWelcome = !(welcomeDoneLocal || welcomeDoneServer);
    } catch (_) { /* if uncertain, default to not suppressing */ }

    // If Welcome will show, suppress tours *before* HUD (and thus before Vitals tour tries to start)
    if (needsWelcome) {
      window.__MYFI_TOUR_SUPPRESS = true;
    }
    

    const vitalsPromise = (async () => {
      const userRef = doc(db, 'players', uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) { await setDoc(userRef, { startDate: serverTimestamp() }, { merge: true }); }

      const playerData = await playerDataManager.init(uid).then((p) => { console.log("Player data loaded:", p.alias); return p; });
      console.log("Player data ready:", playerData);
      let avatarKey = playerData.avatarKey || "default";
 
      const avatarsSource = ["Azakai","Maestro", "Lola", "Umee", "Plutus", "Gina" ,"Kirsty", "Richard","Mohammed","Amandeep","Matthew","Gerard","Sammi"];

     if (avatarKey === 'default' || avatarKey === '' || avatarsSource.includes(playerData.alias) || avatarsSource.includes(playerData.firstName)){

        if (avatarsSource.includes(playerData.alias)){
          avatarKey = avatarsSource.includes(playerData.alias) ? (playerData.alias) : 'default';
        } else {
          avatarKey = avatarsSource.includes(playerData.firstName) ? (playerData.firstName) : 'default';
        }       
        // Update avatarKey in player doc 
          try { await setDoc(userRef, { avatarKey: avatarKey }, { merge: true }); } catch (e) { console.warn("Failed to update avatarKey:", e); }
      }

      const portraitImage = document.querySelector(".portrait");
      if (portraitImage) portraitImage.src = `./assets/portraits/${avatarKey}.png`;

      await initHUD(uid);
    })();

    if (shouldShowSplash) {
      createSplash({ minDuration: 2500, until: vitalsPromise, allowSkip: false });
      await vitalsPromise; await waitForEvent('splash:done');

    } else {
      document.querySelector('.app-root')?.classList.add('app-show');
      await vitalsPromise;
    }

    // ✅ Show welcome exactly once, after splash is done and HUD is ready
    await showWelcomeThenMaybeSetup(uid);

    // ✅ Auto-open iOS install modal (once), with pulsing hotspot
    if (__isIOS && !window.MyFiPWA.isInstalled() && localStorage.getItem('myfi.ios.install.dismissed') !== '1') {
      // small delay so it sits above your HUD nicely
      setTimeout(() => window.MyFiShowIOSInstallModal({ autoPulse: true }), 300);
    }


    /* ---------- SLIDE ROUTER (Vitals hub + satellites) ---------- */
    (function setupSlideRouter(){
      const STAGE = document.getElementById('screen-stage');
      const HUB_ID = 'vitals-root';

      // Map neighbors from Vitals
      const layout = {
        down:  'screen-myana',
        up:    'screen-products',
        left:  'screen-quests',
        right: 'screen-avatar',
      };
      const reverseDir = d => ({up:'down',down:'up',left:'right',right:'left'})[d] || null;
      const backDirByScreen = Object.fromEntries(
        Object.entries(layout).filter(([,id])=>id).map(([dir,id])=>[id, reverseDir(dir)])
      );

      let currentId = (document.querySelector('.screen.screen--active')?.id) || HUB_ID;
      let animating = false;

      const byId = id => document.getElementById(id);
      const canGo = (dir) => (currentId === HUB_ID) ? !!layout[dir] : backDirByScreen[currentId] === dir;
      const targetFor = (dir) => (currentId === HUB_ID) ? (layout[dir] || null) : (canGo(dir) ? HUB_ID : null);

      function slideTo(dir){
        if (!canGo(dir) || animating) return;
        const toId = targetFor(dir);
        const fromEl = byId(currentId);
        const toEl   = byId(toId);
        if (!toEl || !fromEl) return;

        animating = true;

        const enterClass = ({up:'from-up', down:'from-down', left:'from-left', right:'from-right'})[dir];
        // EXIT is the opposite direction so the current screen moves away correctly
        const exitClass  = ({up:'to-down', down:'to-up', left:'to-right', right:'to-left'})[dir];

        toEl.classList.add('screen--active', enterClass);
        fromEl.classList.add('animating');
        toEl.classList.add('animating');

        requestAnimationFrame(() => {
          fromEl.classList.add(exitClass);
          toEl.classList.remove(enterClass);

          const onDone = () => {
            fromEl.classList.remove('screen--active','animating','to-up','to-down','to-left','to-right');
            toEl.classList.remove('animating','from-up','from-down','from-left','from-right');
            fromEl.setAttribute('aria-hidden','true');
            toEl.removeAttribute('aria-hidden');

            currentId = toId; animating = false; renderIndicators();
            document.dispatchEvent(new CustomEvent('myfi:navigate', { detail: { fromId: fromEl.id, toId }}));
          };

          let ended = 0;
          const doneOnce = () => { if (++ended >= 2) onDone(); };
          fromEl.addEventListener('transitionend', doneOnce, { once:true });
          toEl.addEventListener('transitionend',   doneOnce, { once:true });
        });
      }

      // Gestures (touch + mouse for devtools) — SIMPLE GUARD:
      // If the gesture started inside a .scrollable element, never navigate.
      (function setupGestures(){
        const MIN = 40; // same threshold you had
        let startX = 0, startY = 0, tracking = false;
        let startedInScrollable = false;

        const onStart = (x, y, target) => {
          startX = x; startY = y; tracking = true;
          // hard stop: if we began in a scrollable region, this gesture will never navigate
          startedInScrollable = !!(target && target.closest('.scrollable'));
        };

        const onEnd = (x, y) => {
          if (!tracking) return;
          tracking = false;

          // If the gesture started in a scrollable area, swallow it.
          if (startedInScrollable) { startedInScrollable = false; return; }

        const dx = x - startX, dy = y - startY;
          const ax = Math.abs(dx), ay = Math.abs(dy);
          if (ax < MIN && ay < MIN) return;

          // Direct mapping: swipe up => go "down", swipe left => go "right"
          const dir = ax > ay
            ? (dx < 0 ? 'right' : 'left')
            : (dy < 0 ? 'down'  : 'up');

          // 🔵 NEW: flare that edge briefly as we commit
          window.MyFiEdgeGlow?.drag(dir, true);
          
          slideTo(dir);
        };

        // Edge-intent reveal (unchanged)
        const EDGE = 36;
        const maybeShowOnEdge = (x,y)=>{
          const w=window.innerWidth, h=window.innerHeight;
          if (x < EDGE) { showIndicators(); window.MyFiEdgeGlow?.peek('left', true);  }
          else if (x > w - EDGE) { showIndicators(); window.MyFiEdgeGlow?.peek('right', true); }
          if (y < EDGE) { showIndicators(); window.MyFiEdgeGlow?.peek('up', true);   }
          else if (y > h - EDGE) { showIndicators(); window.MyFiEdgeGlow?.peek('down', true); }
        };


        // Touch
        STAGE.addEventListener('touchstart',(e)=>{
          const t = e.changedTouches[0];
          maybeShowOnEdge(t.clientX, t.clientY);
          onStart(t.clientX, t.clientY, e.target);
        }, { passive: true });

        STAGE.addEventListener('touchend',(e)=>{
          const t = e.changedTouches[0];
          onEnd(t.clientX, t.clientY);
        }, { passive: true });

        // Mouse (devtools)
        STAGE.addEventListener('mousedown',(e)=>{
          maybeShowOnEdge(e.clientX, e.clientY);
          onStart(e.clientX, e.clientY, e.target);
        });
        window.addEventListener('mouseup',(e)=> onEnd(e.clientX, e.clientY));
      })();



      // Keyboard
      (function setupKeys(){
        document.addEventListener('keydown',(e)=>{
          if (!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)) return;
          const tag = (document.activeElement?.tagName||'').toLowerCase();
          if (tag==='input'||tag==='textarea'||document.activeElement?.isContentEditable) return;
          e.preventDefault();
          showIndicators();
          const map = { ArrowUp:'up', ArrowRight:'right', ArrowDown:'down', ArrowLeft:'left' };
          slideTo(map[e.key]);
        }, { capture:true });
      })();

      // Minimal edge arrows
      const mount = document.getElementById('myfiNavMount');
      const layer = document.createElement('div');
      layer.className = 'myfi-nav myfi-nav--edge nav-hidden'; // start hidden

      ['up','right','down','left'].forEach(dir=>{
        const b=document.createElement('button');
        b.className='myfi-nav-btn'; b.type='button'; b.dataset.dir=dir; b.setAttribute('aria-label',`Navigate ${dir}`);
        b.addEventListener('click',()=> slideTo(dir));
        layer.appendChild(b);
      });
      mount.appendChild(layer);

      // Show/hide helpers
      let hideTimer = null;
      function showIndicators() {
        layer.classList.remove('nav-hidden');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(()=>{ layer.classList.add('nav-hidden'); }, 1400);
      }

      function renderIndicators(){
        layer.querySelectorAll('.myfi-nav-btn').forEach(btn=>{
          const dir = btn.dataset.dir;
          if (canGo(dir)) btn.classList.remove('myfi-hidden'); else btn.classList.add('myfi-hidden');
        });
        // show briefly on initial render / after a move
        showIndicators();

        // 🔵 NEW: update edge glow availability to mirror nav possibilities
        if (window.MyFiEdgeGlow) {
          window.MyFiEdgeGlow.setAvailability({
            up:    canGo('up'),
            right: canGo('right'),
            down:  canGo('down'),
            left:  canGo('left'),
          });
        }
      }
      renderIndicators();

      // Expose tiny API (optional)
      window.MyFiNav = {
        go: (dir)=> slideTo(dir),
        navigateToHub: ()=>{ if (currentId!==HUB_ID) slideTo(backDirByScreen[currentId]); },
        setLayout: (next)=>{
          Object.assign(layout, next||{});
          Object.keys(backDirByScreen).forEach(k=>delete backDirByScreen[k]);
          Object.entries(layout).filter(([,id])=>id).forEach(([d,id])=> backDirByScreen[id]=reverseDir(d));
          renderIndicators();
        }
      };
    })();

      /* ---------- Music player ---------- */
      // Header button click -> toggle mute (counts as a user gesture)
      document.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-action="toggle-music"]');
        if (!btn) return;
        // Make sure audio exists and attempt (re)start on first gesture
        if (window.MyFiMusic) {
          // If currently muted, unmute will also start+fade up
          window.MyFiMusic.toggleMuted();
        }
      });

  });


  // PWA INstall
  // PWA Install — register SW from root so it can control all pages
// PWA Install — register SW from root so it can control all pages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./serviceWorker.js', { scope: './' })
    .then(reg => {
      console.log('[SW] registered', reg);

      // optional: force update check on load
      reg.update?.();

      // auto-activate new SWs without requiring a manual reload
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // when controller changes (new SW active), reload once to get fresh files
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // avoid reload loop
        if (!window.__reloadedForSW) {
          window.__reloadedForSW = true;
          location.reload();
        }
      });
    })
    .catch(err => console.error('[SW] failed', err));
}


  // === Android/Desktop install banner (iOS uses modal instead) ===
  (function setupInstallBanner(){
    if (__isIOS) return; // iOS handled by modal
    const banner   = document.getElementById('installBanner');
    const installBtn  = document.getElementById('installBtn');
    const dismissBtn  = document.getElementById('dismissInstall');

    function syncBanner() {
      if (!banner) return;
      if (window.MyFiPWA.isInstalled()) { banner.style.display = 'none'; return; }
      banner.style.display = window.MyFiPWA.canPrompt() ? 'flex' : 'none';
    }

    window.addEventListener('pwa:can-install',   syncBanner);
    window.addEventListener('pwa:installed',     syncBanner);
    window.addEventListener('pwa:prompt-consumed', syncBanner);
    document.addEventListener('DOMContentLoaded', syncBanner);

    installBtn?.addEventListener('click', async () => {
      const res = await window.MyFiPWA.promptInstall();
      console.log('Install outcome:', res);
      syncBanner();
    });
    dismissBtn?.addEventListener('click', () => { if (banner) banner.style.display = 'none'; });
  })();


});
