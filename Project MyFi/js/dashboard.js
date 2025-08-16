import { auth, db, logoutUser } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js';

import "./core/truelayer.js";
import "./modal.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";

// Initialise app
const shouldShowSplash = sessionStorage.getItem('showSplashNext') === '1';
if (shouldShowSplash) sessionStorage.removeItem('showSplashNext');
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    // --- ULTRA-SIMPLE WELCOME (LOCAL ONLY) ----------------------------
    // --- FIRESTORE-GATED WELCOME OVERLAY (INLINE CSS, NO X BUTTON) -----
    async function showWelcomeFromFirestore(uid) {
      const userRef = doc(db, 'players', uid);
      const snap = await getDoc(userRef);
      const already = snap.exists() && !!snap.data()?.onboardedAt;

      const FORCE_SHOW_WELCOME = true; // ⬅ toggle to false later

      if (!FORCE_SHOW_WELCOME && already) return;

    // Create shell
    const shell = document.createElement('div');
    shell.className = 'wshell';
    shell.innerHTML = `
      <div class="wcard">
        <h1>Welcome to Project MyFi</h1>
        <p class="lead">Thanks for joining us early—your journey (and feedback) starts here!</p>
        <p class="lead">Here’s a quick guide to get going. Use “Learn More” for more detailed help.</p>
        <ol class="steps">
          <li>📜 Open <strong>Finances</strong> to set your income and core expenses—this powers your avatar.</li>
          <li>🌀 Track your <strong>Vitals</strong>: 
            Stamina (daily spend), Mana (intentional spend), Health (protected savings), and Essence (avatar growth).</li>
          <li>📜 Log spending in <strong>Finances</strong>—review them in the Update Log before they lock in after 1 hour.</li>
          <li>⚔️ Keep your avatar healthy and use Essence to prepare for <strong>The Badlands</strong> (coming soon!)—
            where you’ll battle, explore, and earn rewards for your progress.</li>
        </ol>
        <div class="actions">
          <button id="wo-primary" class="ws-btn ws-primary">Open Vitals</button>
          <button id="wo-secondary" class="ws-btn ws-ghost">Learn More</button>
        </div>
      </div>
      `;

      // Apply CSS from welcomeSplash.css inline
      Object.assign(shell.style, {
        position: 'fixed', inset: '0', display: 'grid', placeItems: 'center',
        padding: '16px', background: 'rgba(10,10,14,.65)', backdropFilter: 'blur(6px)',
        zIndex: '9999', margin: '0', width: '100%', maxWidth: '100%', overflowX: 'hidden',
        boxSizing: 'border-box'
      });

      const card = shell.querySelector('.wcard');
      Object.assign(card.style, {
        width: 'min(520px, 92vw)',
        maxHeight: '88vh', overflow: 'auto',
        background: 'rgba(22,22,28,.92)',
        border: '1px solid var(--line, #333)',
        borderRadius: '16px', padding: '16px 16px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,.35)',
        boxSizing: 'border-box'
      });

      const h1 = card.querySelector('h1');
      Object.assign(h1.style, {
        margin: '0 0 8px', fontSize: 'clamp(18px, 5vw, 24px)', lineHeight: '1.15'
      });

      const lead = card.querySelector('.lead');
      Object.assign(lead.style, {
        margin: '0 0 10px', opacity: '.9', fontSize: 'clamp(14px, 3.6vw, 16px)'
      });

      const steps = card.querySelector('.steps');
      Object.assign(steps.style, {
        margin: '0 0 12px 1.1rem', padding: '0',
        lineHeight: '1.35', fontSize: 'clamp(13px, 3.4vw, 15px)',
        overflowWrap: 'anywhere'
      });

      const actions = card.querySelector('.actions');
      Object.assign(actions.style, {
        display: 'flex', gap: '.6rem', flexWrap: 'wrap'
      });

      const btns = card.querySelectorAll('.ws-btn');
      btns.forEach(btn => {
        Object.assign(btn.style, {
          padding: '.6rem .9rem', borderRadius: '12px',
          border: '1px solid var(--line,#333)', background: 'rgba(255,255,255,.04)',
          cursor: 'pointer',
          color: '#fff' // ⬅ make text white
        });
        if (btn.classList.contains('ws-primary')) {
          btn.style.background = 'linear-gradient(180deg, rgba(90,180,255,.25), rgba(90,180,255,.12))';
        }
        if (btn.classList.contains('ws-ghost')) {
          btn.style.opacity = '.9';
        }
      });

      // Small-screen adjustments
      const applySmallScreen = () => {
        if (window.innerWidth <= 360) {
          shell.style.padding = '10px';
          card.style.width = '96vw';
          card.style.padding = '12px';
          card.style.borderRadius = '14px';
          actions.style.flexDirection = 'column';
          btns.forEach(btn => {
            btn.style.width = '100%';
            btn.style.textAlign = 'center';
          });
        } else {
          actions.style.flexDirection = 'row';
          btns.forEach(btn => {
            btn.style.width = '';
            btn.style.textAlign = '';
          });
        }
      };
      applySmallScreen();
      window.addEventListener('resize', applySmallScreen, { passive: true });

      // Write once, then close
      const completeAndClose = async (after) => {
        try {
          const payload = { onboardedAt: serverTimestamp() };
          if (snap.exists()) await updateDoc(userRef, payload);
          else await setDoc(userRef, payload, { merge: true });
        } catch (e) {
          console.warn('[Welcome] failed to set onboardedAt:', e);
        }
        shell.remove();
        window.removeEventListener('resize', applySmallScreen);
        if (typeof after === 'function') after();
      };

      // Click handling
      shell.addEventListener('click', (e) => {
        const btn = e.target.closest('#wo-primary,#wo-secondary');
        if (!btn) return;
        if (btn.id === 'wo-secondary') {
          completeAndClose(() => document.getElementById('help-btn')?.click());
        } else {
          completeAndClose();
        }
      });

      document.body.appendChild(shell);
    }
    // --------------------------------------------------------------------

    // call it here (after HUD init)
    await showWelcomeFromFirestore(user.uid);
    // -------------------------------------------------------------------

    window.localStorage.setItem('user', JSON.stringify(user));

    // Bundle your startup work into a single promise the splash can wait on.
    const vitalsPromise = (async () => {
      // Ensure player doc exists
      const userRef = doc(db, 'players', user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, { startDate: serverTimestamp }, { merge: true }); // Guard if startDate not present
      }

      // Load player data
      const playerData = await playerDataManager.init(user.uid).then((player) => {
        console.log("Player data loaded:", player.alias);
        return player;
      });

      // Portrait selection (kept as in your code)
      const portraitImage = document.querySelector(".portrait");
      let portraitKey = playerData.portraitKey || "default";

      if (playerData.firstName == "Emkay") {
        portraitKey = 'avatarEmkay';
      } else if (playerData.firstName == "Alie") {
        portraitKey = 'avatarAlie';
      } else if (playerData.firstName == "Richard") {
        portraitKey = 'avatarRichard';
      } else if (playerData.firstName == "Mohammed") {
        portraitKey = 'avatarMohammed';
      } else if (playerData.firstName == "Jane") {
        portraitKey = 'avatarJane';
      } else if (playerData.firstName == "Amandeep") {
        portraitKey = 'avatarAmandeep';
      } else if (playerData.firstName == "Matthew") {
        portraitKey = 'avatarMatthew';
      } else if (playerData.firstName == "Gerard") {
        portraitKey = 'avatarGerard';
      } else if (playerData.firstName == "Sammi") {
        portraitKey = 'avatarSammi';
      } else {
        portraitKey = 'default';
      }

      console.log("Using portrait key:", portraitKey);
      if (portraitImage) {
        portraitImage.src = `./assets/portraits/${portraitKey}.png`;
      }

      // Initialise Dashboard modules (await even if initHUD is not async — it's safe)
      await initHUD(user.uid);
    })();

    if (shouldShowSplash) {
      createSplash({
        minDuration: 2500,
        until: vitalsPromise,
        allowSkip: false
      });
    } else {
      document.querySelector('.app-root')?.classList.add('app-show');
      await vitalsPromise;
    }

    // Modal setup (unchanged)
    const essenceBtn = document.getElementById("essence-btn");
    if (essenceBtn) {
      essenceBtn.addEventListener("click", () => {
        alert("Essence interaction coming soon...");
      });
    }
  });
});

if ('serviceWorker' in navigator) {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isLocal) {
    navigator.serviceWorker.register('./serviceWorker.js');
  } else {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}

// PWA INstall
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'flex';
});

document.addEventListener('DOMContentLoaded', () => {
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
});

/* Scoped native context-menu & selection suppression for Vitals only */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('vitals-root');
  if (!root) return;

  const allow = (el) =>
    el.closest('input, textarea, [contenteditable="true"], .allow-select, [data-allow-context]');

  root.addEventListener('contextmenu', (e) => {
    if (!allow(e.target)) e.preventDefault();
  }, { capture: true });

  root.addEventListener('selectstart', (e) => {
    if (!allow(e.target)) e.preventDefault();
  }, { capture: true });
});
