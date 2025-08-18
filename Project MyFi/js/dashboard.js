import { auth, db, logoutUser } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js'; // boot splash timing

import "./core/truelayer.js";
import "./modal.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";

// Initialise app
const shouldShowSplash = sessionStorage.getItem('showSplashNext') === '1';
if (shouldShowSplash) sessionStorage.removeItem('showSplashNext');

// Simple event waiter
function waitForEvent(name) {
  return new Promise((resolve) => window.addEventListener(name, () => resolve(), { once: true }));
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    // --- FIRESTORE-GATED WELCOME OVERLAY (Intro + Quick Start) ---------------- //
    async function showWelcomeFromFirestore(uid) {
      const userRef = doc(db, 'players', uid);
      const snap = await getDoc(userRef);
      const already = snap.exists() && !!snap.data()?.onboardedAt;

      const FORCE_SHOW_WELCOME = true;
      if (!FORCE_SHOW_WELCOME && already) return;

      const INTRO_HTML = `
        <h1>Welcome to Project MyFi</h1>
        <p class="lead">Thanks for joining us early—your journey to financial independence start here, and we look forward to your feedback as the app continues to grow! 😊</p>
        <p class="lead">
          Project MyFi is a living world where your real-life spending habits power your in-game journey.<br><br>
          Reimagine budgeting and spending as game-like <strong>Vitals</strong> resources, turn savings goals into <strong>Quests</strong>, and strengthen your <strong>Avatar</strong>
          to push deeper into <strong>The Badlands</strong> and earn rewards.<br><br> 
          Spend wisely, plan intentionally, and grow stronger over time, all whilst having fun with your friends.
        </p>
      `;

      const QUICKSTART_HTML = `
        <h1>Quick Start</h1>
        <p class="lead">Four fast steps to get rolling. You can switch back to the overview anytime.</p>
        <ol class="steps">
          <li>📜 Open <strong>Finances</strong> to set your income and core expenses—this powers your avatar's base vitals.</li>
          <li>🌀 Manage your <strong>Vitals</strong>:
            Stamina (daily/general spend), Mana (intentional/power spend), Health (protected savings), and Essence (avatar growth).</li>
          <li>📜 Log transactions in <strong>Finances</strong>—review them in the Update Log before they lock in after 1 hour.</li>
          <li>⚔️ Keep your avatar healthy and spend Essence to prepare for <strong>The Badlands</strong> (coming soon)—
            where you’ll battle, explore, and earn rewards for your progress.</li>
        </ol>
      `;

      const shell = document.createElement('div');
      shell.className = 'wshell';
      shell.innerHTML = `
        <div class="wcard">
          <div class="wcontent">${INTRO_HTML}</div>
          <div class="actions">
            <button id="wo-quickstart" class="ws-btn ws-accent">Quick Start</button>
            <button id="wo-primary" class="ws-btn ws-primary">Open Vitals</button>
            <button id="wo-secondary" class="ws-btn ws-ghost">Learn More</button>
          </div>
        </div>
      `;

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

      const content = shell.querySelector('.wcontent');
      const steps = () => content.querySelector('.steps');
      const actions = card.querySelector('.actions');

      Object.assign(actions.style, { display: 'flex', gap: '.6rem', flexWrap: 'wrap' });

      const btns = card.querySelectorAll('.ws-btn');
      btns.forEach(btn => {
        Object.assign(btn.style, {
          padding: '.6rem .9rem', borderRadius: '12px',
          border: '1px solid var(--line,#333)', background: 'rgba(255,255,255,.04)',
          cursor: 'pointer', color: '#fff'
        });
        if (btn.classList.contains('ws-primary')) {
          btn.style.background = 'linear-gradient(180deg, rgba(90,180,255,.25), rgba(90,180,255,.12))';
        }
        if (btn.classList.contains('ws-ghost')) {
          btn.style.opacity = '.9';
        }
      });

      const applySmallScreen = () => {
        if (window.innerWidth <= 360) {
          shell.style.padding = '10px';
          card.style.width = '96vw';
          card.style.padding = '12px';
          card.style.borderRadius = '14px';
          actions.style.flexDirection = 'column';
          btns.forEach(btn => { btn.style.width = '100%'; btn.style.textAlign = 'center'; });
        } else {
          actions.style.flexDirection = 'row';
          btns.forEach(btn => { btn.style.width = ''; btn.style.textAlign = ''; });
        }
        const s = steps(); if (s) Object.assign(s.style, {
          margin: '0 0 12px 1.1rem', padding: '0',
          lineHeight: '1.35', fontSize: 'clamp(13px, 3.4vw, 15px)',
          overflowWrap: 'anywhere'
        });
      };
      applySmallScreen();
      window.addEventListener('resize', applySmallScreen, { passive: true });

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

      let mode = 'intro';
      const btnQuick = shell.querySelector('#wo-quickstart');
      function render(state){
        mode = state;
        content.innerHTML = (state === 'quick') ? QUICKSTART_HTML : INTRO_HTML;
        btnQuick.classList.toggle('is-active', state === 'quick');
        applySmallScreen();
      }

      shell.addEventListener('click', (e) => {
        const btn = e.target.closest('#wo-primary,#wo-secondary,#wo-quickstart');
        if (!btn) return;

        if (btn.id === 'wo-secondary') {
          const after = () => {
            if (window.MyFiModal && window.MyFiHelpMenu) {
              window.MyFiModal.setMenu(window.MyFiHelpMenu);
              window.MyFiModal.open('overview');
            } else {
              document.getElementById('help-btn')?.click();
            }
          };
          completeAndClose(after);
          return;
        }

        if (btn.id === 'wo-primary') {
          completeAndClose();
          return;
        }

        if (btn.id === 'wo-quickstart') {
          render(mode === 'quick' ? 'intro' : 'quick');
          return;
        }
      });

      render('intro');
      document.body.appendChild(shell);
    }
    // ------------------------------------------------------------------------

    window.localStorage.setItem('user', JSON.stringify(user));

    // Bundle startup work the splash should wait on
    const vitalsPromise = (async () => {
      const userRef = doc(db, 'players', user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, { startDate: serverTimestamp }, { merge: true });
      }

      const playerData = await playerDataManager.init(user.uid).then((player) => {
        console.log("Player data loaded:", player.alias);
        return player;
      });

      const portraitImage = document.querySelector(".portrait");
      let portraitKey = playerData.portraitKey || "default";

      const isCartoonMode = Math.random() < 1.0;
      const portraitNames = [
        "Emkay", "Alie", "Richard", "Mohammed", "Jane",
        "Amandeep", "Matthew", "Gerard", "Sammi"
      ];

      if (portraitNames.includes(playerData.firstName)) {
        portraitKey = 'avatar' + playerData.firstName;
      } else {
        portraitKey = 'default';
      }

      if (!isCartoonMode) {
        portraitKey += '_v2';
      }

      console.log("Using portrait key:", portraitKey);
      if (portraitImage) {
        portraitImage.src = `./assets/portraits/${portraitKey}.png`;
      }

      await initHUD(user.uid);
    })();

    // Boot splash — now also wait for 'splash:done' event
    if (shouldShowSplash) {
      const splashMin = 2500;
      createSplash({
        minDuration: splashMin,
        until: vitalsPromise,
        allowSkip: false
      });
      await vitalsPromise;                 // data ready
      await waitForEvent('splash:done');   // splash fully gone (after fade)
    } else {
      document.querySelector('.app-root')?.classList.add('app-show');
      await vitalsPromise;
    }

    // Only now show the welcome overlay
    await showWelcomeFromFirestore(user.uid);

    // Modal setup (unchanged)
    const essenceBtn = document.getElementById("essence-btn");
    if (essenceBtn) {
      essenceBtn.addEventListener("click", () => {
        alert("Essence interaction coming soon...");
      });
    }
  });
});
