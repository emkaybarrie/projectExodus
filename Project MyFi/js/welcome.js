// js/welcome.js
import { db } from './core/auth.js';
import {
  getDoc, doc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { updateIncome, updateCoreExpenses } from "./data/cashflowData.js";
import { initHUD } from "./hud/hud.js"; // same as your current flow

const WELCOME_LS_KEY = 'myfi.welcome.v1.done';
let WELCOME_OPEN = false; // re-entry guard

function dispatchWelcomeDone() {
  try { localStorage.setItem(WELCOME_LS_KEY, '1'); } catch {}
  try { window.dispatchEvent(new CustomEvent('welcome:done', { detail: { ts: Date.now() } })); } catch {}
  // Clear suppress flag so tours may run again
  try { window.__MYFI_TOUR_SUPPRESS = false; } catch {}
}

export async function markWelcomeDone(uid) {
  if (!uid) return;
  const userRef = doc(db, 'players', uid);
  // Align with "boolean + date" while preserving existing onboardedAt
    await setDoc(userRef, {
    onboarding: {
        welcomeDone: true,
        welcomeDoneAt: serverTimestamp()
    }
    }, { merge: true });

  dispatchWelcomeDone();
}

/** Quick Setup (carved out intact; only adds guard clearing on close) */
async function showFirstRunSetup(uid) {
  const userRef = doc(db, 'players', uid);

  const shell = document.createElement('div');
  shell.id = 'welcomeOverlay';
  Object.assign(shell.style, {
    position: 'fixed', inset: '0', display: 'grid', placeItems: 'center',
    padding: '16px', background: 'rgba(10,10,14,.65)', backdropFilter: 'blur(6px)',
    zIndex: '9999', width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(560px, 94vw)', maxHeight: '90vh', overflow: 'auto',
    background: 'rgba(22,22,28,.96)', border: '1px solid var(--line, #333)',
    borderRadius: '16px', padding: '18px 16px 12px',
    boxShadow: '0 18px 50px rgba(0,0,0,.35)', boxSizing: 'border-box'
  });

  const makeInput = (label, type, id, attrs = {}) => {
    const wrap = document.createElement('div'); wrap.className = 'field';
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const inp = document.createElement('input'); inp.id = id; inp.type = type; inp.className = 'input';
    Object.entries(attrs).forEach(([k,v]) => inp.setAttribute(k, v));
    wrap.append(lab, inp); return wrap;
  };
  const makeSelect = (label, id, opts) => {
    const wrap = document.createElement('div'); wrap.className = 'field';
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const sel = document.createElement('select'); sel.id = id; sel.className = 'input';
    opts.forEach(([val, txt]) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; sel.appendChild(o); });
    wrap.append(lab, sel); return wrap;
  };
  const helper = (html) => { const d = document.createElement('div'); d.className = 'helper'; d.innerHTML = html; return d; };

  const title = document.createElement('h1'); title.textContent = 'Quick Setup'; title.style.marginTop = '0';
  const sub = helper('Fill in the below to bring your Avatar to life. You can edit them later in Finances/Settings menus.');

  const incomeAmt = makeInput('Income Amount (£)', 'number', 'qsIncomeAmt', { min:'0', step:'0.01', placeholder:'e.g. 3200.00' });
  const incomeCad = makeSelect('Income Cadence', 'qsIncomeCad', [['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
  const expAmt    = makeInput('Core Expenses Amount (£)', 'number', 'qsExpAmt', { min:'0', step:'0.01', placeholder:'e.g. 1800.00' });
  const expCad    = makeSelect('Core Expenses Cadence', 'qsExpCad', [['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
  const modeSel   = makeSelect('Start Mode', 'qsVitalsMode', [
    ['accelerated','Standard'], ['safe','Cautious'], ['manual','Manual'],
  ]);

  const manualWrap = document.createElement('div'); manualWrap.style.display = 'none';
  const manualInfo = helper('Optional: if you already spent this month before joining, enter a one‑number total and (optionally) split it between Stamina and Mana.');
  const preAmt   = makeInput('Pre‑start spend this month (£)', 'number', 'qsPreAmt', { min:'0', step:'0.01', placeholder:'e.g. 350.00' });
  const splitBox = (()=>{ const box=document.createElement('div'); box.className='field';
    box.innerHTML = `
      <label>Split (optional)</label>
      <div class="row"><input id="qsPreStaminaPct" type="number" class="input" min="0" max="100" step="1" value="60" /><span class="helper">Stamina %</span></div>
      <div class="row" style="margin-top:.5rem;"><input id="qsPreManaPct" type="number" class="input" min="0" max="100" step="1" value="40" /><span class="helper">Mana %</span></div>`;
    return box; })();
  manualWrap.append(manualInfo, preAmt, splitBox);

  const errBox = document.createElement('div');
  errBox.id = 'qsError'; errBox.className = 'helper';
  Object.assign(errBox.style, { display: 'none', color: '#ff6b6b', marginTop: '4px' });

  const actions = document.createElement('div');
  Object.assign(actions.style, { display:'flex', gap:'.6rem', flexWrap:'wrap', marginTop:'8px' });
  const btnSave = document.createElement('button'); btnSave.className='ws-btn ws-primary'; btnSave.textContent='Save & Continue';
  const btnSkip = document.createElement('button'); btnSkip.className='ws-btn ws-ghost';   btnSkip.textContent='Skip for now';
  [btnSave, btnSkip].forEach(btn=>{
    Object.assign(btn.style, { padding: '.6rem .9rem', borderRadius: '12px',
      border: '1px solid var(--line,#333)', background: 'rgba(255,255,255,.06)', cursor: 'pointer', color: '#fff' });
  });
  btnSave.style.background = 'linear-gradient(180deg, rgba(90,180,255,.25), rgba(90,180,255,.12))';

  card.append(title, sub, incomeAmt, incomeCad, expAmt, expCad, modeSel, manualWrap, errBox, actions);
  actions.append(btnSave, btnSkip); shell.append(card);

  const applySmall = () => {
    if (window.innerWidth <= 360) {
      shell.style.padding='10px'; card.style.width='96vw'; card.style.padding='12px'; card.style.borderRadius='14px';
      actions.style.flexDirection='column'; btnSave.style.width=btnSkip.style.width='100%';
    } else {
      actions.style.flexDirection='row'; btnSave.style.width=btnSkip.style.width='';
    }
  };
  applySmall(); window.addEventListener('resize', applySmall, { passive: true });

  incomeCad.querySelector('select').value = 'monthly';
  expCad.querySelector('select').value = 'monthly';
  modeSel.querySelector('select').value = 'safe';
  modeSel.querySelector('select').addEventListener('change', (e) => {
    manualWrap.style.display = (String(e.target.value||'safe') === 'manual') ? '' : 'none';
  });

  const showErr = (msg)=>{ errBox.textContent=msg; errBox.style.display='block'; };
  const clearErr= ()=>{ errBox.textContent=''; errBox.style.display='none'; };

  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    try {
      const incomeAmount  = Math.max(0, Number(incomeAmt.querySelector('input').value || 0));
      const incomeCadence = String(incomeCad.querySelector('select').value || 'monthly');
      const expAmount     = Math.max(0, Number(expAmt.querySelector('input').value || 0));
      const expCadence    = String(expCad.querySelector('select').value || 'monthly');
      const vitalsMode    = String(modeSel.querySelector('select').value || 'accelerated');

      clearErr();
      if (incomeAmount <= 0) { showErr('Income must be greater than 0.'); btnSave.disabled=false; incomeAmt.querySelector('input').focus(); return; }
      if (expAmount >= incomeAmount) { showErr('Core expenses must be less than income.'); btnSave.disabled=false; expAmt.querySelector('input').focus(); return; }

      await updateIncome(incomeAmount, incomeCadence);
      await updateCoreExpenses(expAmount, expCadence);
      await updateDoc(userRef, { vitalsMode });

      if (vitalsMode === 'manual') {
        const total = Math.max(0, Number(preAmt.querySelector('input')?.value || 0));
        let spct = Math.max(0, Math.min(100, Number(document.getElementById('qsPreStaminaPct')?.value || 0)));
        let mpct = Math.max(0, Math.min(100, Number(document.getElementById('qsPreManaPct')?.value || 0)));
        let sum = spct + mpct; if (sum <= 0.0001) { spct = 60; mpct = 40; sum = 100; }
        spct = spct/sum; mpct = mpct/sum;

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

      // Single place to mark welcome done + timestamps
      await markWelcomeDone(uid);

      // Keep your existing behaviour: re-init HUD after saving
      await initHUD(uid);

      shell.remove(); window.removeEventListener('resize', applySmall);
      WELCOME_OPEN = false; // ✅ clear guard on close
    } catch (e) {
      showErr('Something went wrong saving your setup. Please try again.');
      console.warn('[Quick Setup] save failed:', e);
      btnSave.disabled = false;
    }
  });

  btnSkip.addEventListener('click', async () => {
    try { await markWelcomeDone(uid); } catch (e) { console.warn('[Quick Setup] skip failed:', e); }
    shell.remove(); window.removeEventListener('resize', applySmall);
    WELCOME_OPEN = false; // ✅ clear guard on close
  });

  document.body.appendChild(shell);
}

export async function showWelcomeThenMaybeSetup(uid) {
  if (!uid) return;

  // If LS says done or a Welcome is already open, bail.
  if (localStorage.getItem(WELCOME_LS_KEY) === '1' || WELCOME_OPEN) return;

  const userRef = doc(db, 'players', uid);
  const snap = await getDoc(userRef);
  const already = snap.exists() && !!(snap.data()?.onboarding?.welcomeDone);;
  if (already) return; // nothing to show

  // Set re-entry guard and suppress tours globally while welcome is up
  WELCOME_OPEN = true;
  try { window.__MYFI_TOUR_SUPPRESS = true; } catch {}

  const INTRO_HTML = `
    <h1>Welcome to Project MyFi</h1>
    <p class="lead">Thanks for joining us in our goal to turn managing your finances into an enjoyable experience — we look forward to your feedback as the game continues to grow! 😊</p>
    <p class="lead">
      <strong>Project MyFi</strong> is an ever‑evolving world, where your real-life spending habits power your in‑game journey.<br><br>
      • <strong>Progress</strong> via Quests that promote saving.<br>
      • <strong>Customise</strong> around your habits, goals and style.<br>
      • <strong>Empower</strong> your Avatar for <em>The Badlands</em> (coming soon).<br><br>
      Spend wisely, plan intentionally, and grow stronger over time.
    </p>
  `;
  const QUICKSTART_HTML = `
    <h1>Quick Start</h1>
    <p class="lead">Five key steps to get started.</p>
    <ol class="steps">
      <li>📜 Set income & core expenses in <strong>Finances</strong>.</li>
      <li>📜 Log transactions in <strong>Finances</strong> (long‑press to edit before lock).</li>
      <li>🌀 Manage <strong>Vitals</strong> views (Daily/Weekly/Monthly).</li>
      <li>⚔️ Prep your avatar for <strong>The Badlands</strong>.</li>
      <li>❔ See <strong>Help</strong> for details.</li>
    </ol>
  `;

  const shell = document.createElement('div');
  shell.innerHTML = `
    <div class="wcard">
      <div class="wcontent"></div>
      <div class="actions">
        <button id="wo-quickstart" class="ws-btn ws-primary">Quick Start</button>
        <button id="wo-open" class="ws-btn ws-accent">Open Vitals</button>
      </div>
    </div>
  `;
  Object.assign(shell.style, {
    position: 'fixed', inset: '0', display: 'grid', placeItems: 'center',
    padding: '16px', background: 'rgba(10,10,14,.65)', backdropFilter: 'blur(6px)',
    zIndex: '9999', width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box'
  });
  const card = shell.querySelector('.wcard');
  Object.assign(card.style, {
    width: 'min(520px, 92vw)', maxHeight: '88vh', overflow: 'auto',
    background: 'rgba(22,22,28,.92)', border: '1px solid var(--line, #333)',
    borderRadius: '16px', padding: '16px 16px 12px',
    boxShadow: '0 18px 50px rgba(0,0,0,.35)', boxSizing: 'border-box'
  });

  const content = card.querySelector('.wcontent');
  const actions = card.querySelector('.actions');
  Object.assign(actions.style, { display: 'flex', gap: '.6rem', flexWrap: 'wrap' });
  const btns = card.querySelectorAll('.ws-btn');
  btns.forEach(btn => {
    Object.assign(btn.style, { padding: '.6rem .9rem', borderRadius: '12px',
      border: '1px solid var(--line,#333)', background: 'rgba(255,255,255,.04)',
      cursor: 'pointer', color: '#fff' });
  });

  const applySmallScreen = () => {
    if (window.innerWidth <= 360) {
      shell.style.padding='10px'; card.style.width='96vw'; card.style.padding='12px'; card.style.borderRadius='14px';
      actions.style.flexDirection='column'; btns.forEach(b=>b.style.width='100%');
    } else {
      actions.style.flexDirection='row'; btns.forEach(b=>b.style.width='');
    }
    const s = content.querySelector('.steps'); if (s) Object.assign(s.style, {
      margin: '0 0 12px 1.1rem', padding: '0', lineHeight: '1.35',
      fontSize: 'clamp(13px, 3.4vw, 15px)', overflowWrap: 'anywhere'
    });
  };

  let mode = 'intro';
  function render(next) {
    mode = next;
    content.innerHTML = (mode === 'quick') ? QUICKSTART_HTML : INTRO_HTML;
    const qb = shell.querySelector('#wo-quickstart');
    if (qb) qb.textContent = (mode === 'quick') ? 'Welcome' : 'Quick Start';
    applySmallScreen();
  }

  shell.addEventListener('click', (e) => {
    const btn = e.target.closest('#wo-open,#wo-quickstart'); if (!btn) return;
    if (btn.id === 'wo-open') {
      // Close the intro card and proceed to Quick Setup
      shell.remove(); window.removeEventListener('resize', applySmallScreen);
      showFirstRunSetup(uid);
      return;
    }
    if (btn.id === 'wo-quickstart') {
      render(mode === 'quick' ? 'intro' : 'quick');
      return;
    }
  });

  render('intro');
  document.body.appendChild(shell);
  window.addEventListener('resize', applySmallScreen, { passive: true });
}
