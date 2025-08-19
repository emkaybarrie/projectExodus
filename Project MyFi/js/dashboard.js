import { auth, db } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js';

// Reuse existing data updaters to avoid duplication
import { updateIncome, updateCoreExpenses } from "./data/cashflowData.js";

import "./core/truelayer.js";
import "./modal.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";

// Splash gate
const shouldShowSplash = sessionStorage.getItem('showSplashNext') === '1';
if (shouldShowSplash) sessionStorage.removeItem('showSplashNext');

// Promise helper
function waitForEvent(name) {
  return new Promise((resolve) => window.addEventListener(name, () => resolve(), { once: true }));
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Quick Setup overlay (Income, Expenses, Vitals Mode, Manual Opening)
    // Writes onboardedAt only when Save/Skip is pressed.
    // ─────────────────────────────────────────────────────────────────────────
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

    async function showFirstRunSetup(uid) {
      // Only show if not onboarded yet
      const userRef = doc(db, 'players', uid);
      const snap = await getDoc(userRef);
      const alreadyOnboarded = snap.exists() && !!snap.data()?.onboardedAt;
      if (alreadyOnboarded) return;

      // Default manual split from allocations (stamina vs mana)
      async function readDefaultManualSplit() {
        try {
          const allocSnap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
          if (!allocSnap.exists()) return { staminaPct: 60, manaPct: 40 };
          const d = allocSnap.data() || {};
          const s = Number(d.staminaAllocation ?? 0);
          const m = Number(d.manaAllocation ?? 0);
          const sum = s + m;
          if (sum > 0) {
            const spct = Math.round((s / sum) * 100);
            return { staminaPct: spct, manaPct: 100 - spct };
          }
        } catch { /* ignore */ }
        return { staminaPct: 60, manaPct: 40 };
      }

      const shell = document.createElement('div');
      Object.assign(shell.style, {
        position: 'fixed', inset: '0', display: 'grid', placeItems: 'center',
        padding: '16px', background: 'rgba(10,10,14,.65)', backdropFilter: 'blur(6px)',
        zIndex: '9999', width: '100%', maxWidth: '100%', overflowX: 'hidden',
        boxSizing: 'border-box'
      });

      const card = document.createElement('div');
      Object.assign(card.style, {
        width: 'min(560px, 94vw)',
        maxHeight: '90vh', overflow: 'auto',
        background: 'rgba(22,22,28,.96)',
        border: '1px solid var(--line, #333)',
        borderRadius: '16px', padding: '18px 16px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,.35)',
        boxSizing: 'border-box'
      });

      const title = document.createElement('h1');
      title.textContent = 'Quick Setup';
      title.style.marginTop = '0';
      const sub = helper('Set these once to seed your Vitals. You can edit them later in Finances/Settings.');

      // Fields
      const incomeAmt = input('Income Amount (£)', 'number', 'qsIncomeAmt', { min:'0', step:'0.01', placeholder:'e.g. 3200.00' });
      const incomeCad = select('Income Cadence', 'qsIncomeCad', [['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);

      const expAmt    = input('Core Expenses Amount (£)', 'number', 'qsExpAmt', { min:'0', step:'0.01', placeholder:'e.g. 1800.00' });
      const expCad    = select('Core Expenses Cadence', 'qsExpCad', [['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);

      const modeSel   = select('Vitals Mode', 'qsVitalsMode', [
        ['safe','Safe (Standard)'],
        ['accelerated','Accelerated'],
        ['manual','Manual'],
        // ['true','True (Bank Sync)'] // enable later
      ]);

      const manualWrap = document.createElement('div');
      manualWrap.style.display = 'none';
      const manualInfo = helper('Optional: if you already spent this month before joining, enter a one‑number total and (optionally) split it between Stamina and Mana. Defaults follow your pool allocations.');
      const preAmt   = input('Pre‑start spend this month (£)', 'number', 'qsPreAmt', { min:'0', step:'0.01', placeholder:'e.g. 350.00' });
      const preSplit = (()=>{
        const box = document.createElement('div'); box.className = 'field';
        box.innerHTML = `
          <label>Split (optional)</label>
          <div class="row">
            <input id="qsPreStaminaPct" type="number" class="input" min="0" max="100" step="1" value="60" />
            <span class="helper">Stamina %</span>
          </div>
          <div class="row" style="margin-top:.5rem;">
            <input id="qsPreManaPct" type="number" class="input" min="0" max="100" step="1" value="40" />
            <span class="helper">Mana %</span>
          </div>
        `;
        return box;
      })();
      manualWrap.append(manualInfo, preAmt, preSplit);

      // Inline error box (hidden by default)
      const errBox = document.createElement('div');
      errBox.id = 'qsError';
      errBox.className = 'helper';
      Object.assign(errBox.style, {
        display: 'none',
        color: '#ff6b6b',
        marginTop: '4px'
      });

      const actions = document.createElement('div');
      Object.assign(actions.style, { display:'flex', gap:'.6rem', flexWrap:'wrap', marginTop:'8px' });
      const btnSave = document.createElement('button');
      btnSave.className = 'ws-btn ws-primary';
      btnSave.textContent = 'Save & Continue';
      const btnSkip = document.createElement('button');
      btnSkip.className = 'ws-btn ws-ghost';
      btnSkip.textContent = 'Skip for now';

      [btnSave, btnSkip].forEach(btn=>{
        Object.assign(btn.style, {
          padding: '.6rem .9rem', borderRadius: '12px',
          border: '1px solid var(--line,#333)', background: 'rgba(255,255,255,.06)',
          cursor: 'pointer', color: '#fff'
        });
      });
      btnSave.style.background = 'linear-gradient(180deg, rgba(90,180,255,.25), rgba(90,180,255,.12))';

      card.append(title, sub, incomeAmt, incomeCad, expAmt, expCad, modeSel, manualWrap, errBox, actions);
      actions.append(btnSave, btnSkip);
      shell.append(card);

      const applySmall = () => {
        if (window.innerWidth <= 360) {
          shell.style.padding = '10px';
          card.style.width = '96vw';
          card.style.padding = '12px';
          card.style.borderRadius = '14px';
          actions.style.flexDirection = 'column';
          btnSave.style.width = btnSkip.style.width = '100%';
        } else {
          actions.style.flexDirection = 'row';
          btnSave.style.width = btnSkip.style.width = '';
        }
      };
      applySmall();
      window.addEventListener('resize', applySmall, { passive: true });

      // Prefill manual split from allocations
      (async ()=>{
        const { staminaPct, manaPct } = await readDefaultManualSplit();
        const sEl = manualWrap.querySelector('#qsPreStaminaPct');
        const mEl = manualWrap.querySelector('#qsPreManaPct');
        if (sEl) sEl.value = String(staminaPct);
        if (mEl) mEl.value = String(manaPct);
      })();

      // Show/hide manual section
      modeSel.querySelector('select').addEventListener('change', (e)=>{
        const v = String(e.target.value || 'safe');
        manualWrap.style.display = (v === 'manual') ? '' : 'none';
      });

      // Defaults
      incomeCad.querySelector('select').value = 'monthly';
      expCad.querySelector('select').value = 'monthly';
      modeSel.querySelector('select').value = 'safe';

      // Save handler (inline validation)
      btnSave.addEventListener('click', async ()=>{
        btnSave.disabled = true;

        // helpers for inline validation
        const showErr = (msg) => { errBox.textContent = msg; errBox.style.display = 'block'; };
        const clearErr = () => { errBox.textContent = ''; errBox.style.display = 'none'; };

        try {
          const userRef = doc(db, 'players', uid);
          const incomeAmount  = Math.max(0, Number(incomeAmt.querySelector('input').value || 0));
          const incomeCadence = String(incomeCad.querySelector('select').value || 'monthly');
          const expAmount     = Math.max(0, Number(expAmt.querySelector('input').value || 0));
          const expCadence    = String(expCad.querySelector('select').value || 'monthly');
          const vitalsMode    = String(modeSel.querySelector('select').value || 'safe');

          // --- Validation (inline) ---
          clearErr();
          if (incomeAmount <= 0) {
            showErr('Income must be greater than 0.');
            btnSave.disabled = false;
            incomeAmt.querySelector('input').focus();
            return;
          }
          if (expAmount >= incomeAmount) {
            showErr('Core expenses must be less than income.');
            btnSave.disabled = false;
            expAmt.querySelector('input').focus();
            return;
          }
          // ---------------------------

          // 1) Income & Expenses
          await updateIncome({ amount: incomeAmount, cadence: incomeCadence });
          await updateCoreExpenses({ amount: expAmount, cadence: expCadence });

          // 2) Vitals mode
          await updateDoc(userRef, { vitalsMode });

          // 3) Manual opening summary (optional)
          if (vitalsMode === 'manual') {
            const total = Math.max(0, Number(preAmt.querySelector('input')?.value || 0));
            let spct = Math.max(0, Math.min(100, Number(document.getElementById('qsPreStaminaPct')?.value || 0)));
            let mpct = Math.max(0, Math.min(100, Number(document.getElementById('qsPreManaPct')?.value || 0)));
            let sum = spct + mpct;

            if (sum <= 0.0001) {
              const def = await (async ()=>{ try {
                const allocSnap = await getDoc(doc(db, `players/${uid}/cashflowData/poolAllocations`));
                if (allocSnap.exists()) {
                  const d = allocSnap.data() || {};
                  const s = Number(d.staminaAllocation ?? 0);
                  const m = Number(d.manaAllocation ?? 0);
                  const ssum = s + m;
                  if (ssum > 0) return { staminaPct: Math.round((s/ssum)*100), manaPct: 100 - Math.round((s/ssum)*100) };
                }
              } catch(_){} return { staminaPct: 60, manaPct: 40 }; })();

              spct = def.staminaPct; mpct = def.manaPct; sum = spct + mpct;
            }
            spct = spct / sum; mpct = mpct / sum;

            // derive month window from startDate
            let startMs = Date.now();
            const pSnap = await getDoc(userRef);
            if (pSnap.exists()) {
              const raw = pSnap.data()?.startDate;
              if (raw?.toMillis) startMs = raw.toMillis();
              else if (raw instanceof Date) startMs = raw.getTime();
              else if (typeof raw === 'number') startMs = raw;
            }
            const d0 = new Date(startMs);
            const startMonthStartMs = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();

            await setDoc(doc(db, `players/${uid}/manualSeed/meta`), {
              startMonthStartMs, startDateMs: startMs, updatedAtMs: Date.now()
            }, { merge: true });

            if (total > 0) {
              await setDoc(doc(db, `players/${uid}/manualSeed/openingSummary`), {
                totalPrestartDiscretionary: total,
                split: { staminaPct: spct, manaPct: mpct },
                providedAtMs: Date.now()
              }, { merge: true });
            }
          }

          // 4) Mark onboarded and close
          await updateDoc(userRef, { onboardedAt: serverTimestamp() });

          shell.remove();
          window.removeEventListener('resize', applySmall);

          // Rebuild HUD with new baselines
          await initHUD(uid);
        } catch (e) {
          // show a general error inline (optional)
          showErr('Something went wrong saving your setup. Please try again.');
          console.warn('[Quick Setup] save failed:', e);
          btnSave.disabled = false;
        }
      });

      // Skip: still mark onboarded
      btnSkip.addEventListener('click', async ()=>{
        try {
          const userRef = doc(db, 'players', uid);
          await updateDoc(userRef, { onboardedAt: serverTimestamp() });
        } catch (e) {
          console.warn('[Quick Setup] skip failed:', e);
        }
        shell.remove();
        window.removeEventListener('resize', applySmall);
      });

      document.body.appendChild(shell);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Welcome overlay — shows first (if onboardedAt missing), then *only*
    // opens Quick Setup if the user clicks Open Vitals.
    // Quick Start toggles content; button text reflects the target state.
    // ─────────────────────────────────────────────────────────────────────────
    async function showWelcomeThenMaybeSetup(uid) {
      const userRef = doc(db, 'players', uid);
      const snap = await getDoc(userRef);
      const already = snap.exists() && !!snap.data()?.onboardedAt;
      if (already) return;

      const INTRO_HTML = `
        <h1>Welcome to Project MyFi</h1>
        <p class="lead">Thanks for joining us early—your journey to financial independence starts here, and we look forward to your feedback as the app continues to grow! 😊</p>
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
          <li>⚔️ Keep your avatar healthy and spend Essence to prepare for <strong>The Badlands</strong> (coming soon)—where you’ll battle, explore, and earn rewards for your progress.</li>
        </ol>
      `;

      const shell = document.createElement('div');
      shell.innerHTML = `
        <div class="wcard">
          <div class="wcontent">${INTRO_HTML}</div>
          <div class="actions">
            <button id="wo-quickstart" class="ws-btn ws-primary">Quick Start</button>
            <button id="wo-open" class="ws-btn ws-accent">Open Vitals</button>
          </div>
        </div>
      `;

      Object.assign(shell.style, {
        position: 'fixed', inset: '0', display: 'grid', placeItems: 'center',
        padding: '16px', background: 'rgba(10,10,14,.65)', backdropFilter: 'blur(6px)',
        zIndex: '9999', width: '100%', maxWidth: '100%', overflowX: 'hidden',
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
        const s = content.querySelector('.steps'); if (s) Object.assign(s.style, {
          margin: '0 0 12px 1.1rem', padding: '0',
          lineHeight: '1.35', fontSize: 'clamp(13px, 3.4vw, 15px)',
          overflowWrap: 'anywhere'
        });
      };
      applySmallScreen();
      window.addEventListener('resize', applySmallScreen, { passive: true });

      // Proceed to Quick Setup
      const closeAndStartSetup = async () => {
        shell.remove();
        window.removeEventListener('resize', applySmallScreen);
        await showFirstRunSetup(uid);
      };

      // Toggle content; button text reflects the target state
      let mode = 'intro';
      const quickBtn = () => shell.querySelector('#wo-quickstart');
      function render(nextState){
        mode = nextState;
        content.innerHTML = (mode === 'quick') ? QUICKSTART_HTML : INTRO_HTML;
        const qb = quickBtn();
        if (qb) qb.textContent = (mode === 'quick') ? 'Welcome' : 'Quick Start';
        applySmallScreen();
      }

      shell.addEventListener('click', (e) => {
        const btn = e.target.closest('#wo-open,#wo-quickstart');
        if (!btn) return;

        if (btn.id === 'wo-open') {
          closeAndStartSetup();
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

    // ─────────────────────────────────────────────────────────────────────────
    // Load player + HUD (unchanged)
    // ─────────────────────────────────────────────────────────────────────────
    window.localStorage.setItem('user', JSON.stringify(user));

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
        "Amandeep", "Matthew", "Gerard", "Sammi", "Kirsty"
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

    // Splash timing
    if (shouldShowSplash) {
      const splashMin = 2500;
      createSplash({
        minDuration: splashMin,
        until: vitalsPromise,
        allowSkip: false
      });
      await vitalsPromise;
      await waitForEvent('splash:done');
    } else {
      document.querySelector('.app-root')?.classList.add('app-show');
      await vitalsPromise;
    }

    // Show Welcome; only proceed to Setup if user clicks Open Vitals
    await showWelcomeThenMaybeSetup(user.uid);

    // (Any other dashboard wiring stays as-is)
  });
});
