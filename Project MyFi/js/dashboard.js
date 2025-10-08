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



// ===== YOUR ORIGINAL FILE STARTS HERE =====
import { app, auth, db, fns as functions } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "../energy/energy-vitals.js";
import { createSplash } from './splash.js';

import { updateIncome, updateCoreExpenses } from "./data/cashflowData.js";
import { showWelcomeThenMaybeSetup } from './welcome.js';

import { createRouter } from './navigation.js';

// in dashboard.js (post onAuthStateChanged success)
import { initQuestEngine } from "../quests/questEngine.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { maybeOpenSmartReviewOnLoad } from '../energy/energy-verified.js'

import "../energy/truelayer.js";
import "./modal.js";
import "./ui/kit.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";
import "../energy/essenceMenu.js";
import "./socialMenu.js";
import "./quickMenus.js";
import "./musicManager.js"

import "../energy/energy-menu.js"

const shouldShowSplash = sessionStorage.getItem('showSplashNext') === '1';
if (shouldShowSplash) sessionStorage.removeItem('showSplashNext');

// expose splash state so HUD can defer wake animation
window.__MYFI_SPLASH_ACTIVE = !!shouldShowSplash;


// NEW: tell the music manager to defer playback until splash finishes
window.__MYFI_DEFER_MUSIC = shouldShowSplash;

function waitForEvent(name) {
  return new Promise((resolve) => window.addEventListener(name, () => resolve(), { once: true }));
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'start.html'; return; }

    // Ensure an ID token exists before any callables
    async function waitForValidIdToken() {
      try { await user.getIdToken(true); } catch (e) { console.warn("[auth] getIdToken failed", e); }
      await new Promise((resolve) => {
        const unsub = auth.onIdTokenChanged(() => { unsub(); resolve(); });
      });
    }
    await waitForValidIdToken();

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
      await initQuestEngine();  // calls seed via the same app/region-bound instance

      // Use the shared Functions instance (same app + region)
      async function ensureStarterQuest() {
        try {
          await httpsCallable(functions, "seedQuestCatalog")({});
          await httpsCallable(functions, "grantQuestIfEligible")({ questId: "starter-income-set" });
        } catch (e) {
          console.warn("[onboarding] ensureStarterQuest failed", e?.message || e);
        }
      }
      await ensureStarterQuest();


    })();

    if (shouldShowSplash) {
      createSplash({ minDuration: 2500, until: vitalsPromise, allowSkip: false });
      await vitalsPromise; await waitForEvent('splash:done');
      await waitForEvent('splash:done');
      // mark splash as finished so HUD wake tween can run now
      window.__MYFI_SPLASH_ACTIVE = false;

    } else {
      document.querySelector('.app-root')?.classList.add('app-show');
      await vitalsPromise;
      await waitForEvent('splash:done');
      // mark splash as finished so HUD wake tween can run now
      window.__MYFI_SPLASH_ACTIVE = false;
    }

    // ✅ Show welcome exactly once, after splash is done and HUD is ready
    await showWelcomeThenMaybeSetup(uid);

    // ✅ Auto-open iOS install modal (once), with pulsing hotspot
    if (__isIOS && !window.MyFiPWA.isInstalled() && localStorage.getItem('myfi.ios.install.dismissed') !== '1') {
      // small delay so it sits above your HUD nicely
      setTimeout(() => window.MyFiShowIOSInstallModal({ autoPulse: true }), 300);
    }

    maybeOpenSmartReviewOnLoad()

    /* ---------- SLIDE ROUTER (Vitals hub + satellites) ---------- */

    // after HUD is ready / welcome flow
    const router = createRouter({
      stage: document.getElementById('screen-stage'),
      hubId: 'vitals-root',
      layout: {
        up:    'screen-products',
        right: 'screen-avatar',
        down:  'screen-myana',
        left:  'screen-quests',
      },
      onNavigate: ({ fromId, toId }) => {
        // optionally announce
        document.dispatchEvent(new CustomEvent('myfi:navigate', { detail: { fromId, toId } }));
      }
    });

    // First paint (also makes glow visible immediately on hub)
    router.update();

    // Expose tiny helper if needed elsewhere
    window.MyFiRouter = {
      go: (dir)=> router.go(dir),
      setLayout: (next)=> router.setLayout(next),
      current: ()=> router.current(),
    };



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
