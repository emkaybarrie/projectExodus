import { auth, db } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js';

import { updateIncome, updateCoreExpenses } from "./data/cashflowData.js";
import { showWelcomeThenMaybeSetup } from './welcome.js';

import "./core/truelayer.js";
import "./modal.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";
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

    /* ---------- Quick Setup (unchanged core logic) ---------- */
    function input(label, type, id, attrs = {}) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lab = document.createElement('label');
      lab.htmlFor = id; lab.textContent = label;
      const inp = document.createElement('input');
      inp.id = id; inp.type = type; inp.className = 'input';
      Object.entries(attrs).forEach(([k,v]) => inp.setAttribute(k, v));
      wrap.append(lab, inp);
      return wrap;
    }
    function select(label, id, opts) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lab = document.createElement('label');
      lab.htmlFor = id; lab.textContent = label;
      const sel = document.createElement('select');
      sel.id = id; sel.className = 'input';
      opts.forEach(([val, txt]) => {
        const o = document.createElement('option');
        o.value = val; o.textContent = txt; sel.appendChild(o);
      });
      wrap.append(lab, sel);
      return wrap;
    }
    function helper(html) {
      const d = document.createElement('div');
      d.className = 'helper';
      d.innerHTML = html;
      return d;
    }

    
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

      const portraitImage = document.querySelector(".portrait");
      let portraitKey = playerData.portraitKey || "default";
      const portraitNames = ["Emkay","Alie","Richard","Mohammed","Jane","Amandeep","Matthew","Gerard","Sammi","Kirsty"];
      portraitKey = portraitNames.includes(playerData.firstName) ? ('avatar' + playerData.firstName) : 'default';
      if (portraitImage) portraitImage.src = `./assets/portraits/${portraitKey}.png`;

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

          slideTo(dir);
        };

        // Edge-intent reveal (unchanged)
        const EDGE = 36;
        const maybeShowOnEdge = (x,y)=>{
          const w=window.innerWidth, h=window.innerHeight;
          if (x<EDGE || x>w-EDGE || y<EDGE || y>h-EDGE) showIndicators();
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./js/core/serviceWorker.js')
      .then(reg => console.log("SW registered", reg))
      .catch(err => console.error("SW failed", err));
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'flex';
  });

  // document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('installBtn');
    const dismissBtn = document.getElementById('dismissInstall');
    const banner = document.getElementById('installBanner');

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const result = await deferredPrompt.userChoice;
          console.log("User choice:", result.outcome);
          deferredPrompt = null;
          if (banner) banner.style.display = 'none';
        }
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (banner) banner.style.display = 'none';
      });
    }
  // });

});
