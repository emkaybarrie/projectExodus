import { auth, db } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js';

import { updateIncome, updateCoreExpenses } from "./data/cashflowData.js";

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
    if (!user) { window.location.href = 'start_v5.html'; return; }

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

    async function showFirstRunSetup(uid) {
      const userRef = doc(db, 'players', uid);
      const snap = await getDoc(userRef);
      const alreadyOnboarded = snap.exists() && !!snap.data()?.onboardedAt;
      if (alreadyOnboarded) return;

      const shell = document.createElement('div');
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

      const title = document.createElement('h1'); title.textContent = 'Quick Setup'; title.style.marginTop = '0';
      const sub = helper('Fill in the below to bring your Avatar to life. You can edit them later in Finances/Settings menus.');

      const incomeAmt = input('Income Amount (£)', 'number', 'qsIncomeAmt', { min:'0', step:'0.01', placeholder:'e.g. 3200.00' });
      const incomeCad = select('Income Cadence', 'qsIncomeCad', [['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
      const expAmt    = input('Core Expenses Amount (£)', 'number', 'qsExpAmt', { min:'0', step:'0.01', placeholder:'e.g. 1800.00' });
      const expCad    = select('Core Expenses Cadence', 'qsExpCad', [['monthly','Monthly'],['weekly','Weekly'],['daily','Daily']]);
      const modeSel   = select('Start Mode', 'qsVitalsMode', [
        ['accelerated','Standard'], ['safe','Cautious'], ['manual','Manual'],
      ]);

      const manualWrap = document.createElement('div'); manualWrap.style.display = 'none';
      const manualInfo = helper('Optional: if you already spent this month before joining, enter a one‑number total and (optionally) split it between Stamina and Mana.');
      const preAmt   = input('Pre‑start spend this month (£)', 'number', 'qsPreAmt', { min:'0', step:'0.01', placeholder:'e.g. 350.00' });
      const preSplit = (()=>{ const box=document.createElement('div'); box.className='field';
        box.innerHTML = `
          <label>Split (optional)</label>
          <div class="row"><input id="qsPreStaminaPct" type="number" class="input" min="0" max="100" step="1" value="60" /><span class="helper">Stamina %</span></div>
          <div class="row" style="margin-top:.5rem;"><input id="qsPreManaPct" type="number" class="input" min="0" max="100" step="1" value="40" /><span class="helper">Mana %</span></div>`;
        return box; })();
      manualWrap.append(manualInfo, preAmt, preSplit);

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

      modeSel.querySelector('select').addEventListener('change', (e)=>{
        manualWrap.style.display = (String(e.target.value||'safe') === 'manual') ? '' : 'none';
      });
      incomeCad.querySelector('select').value = 'monthly';
      expCad.querySelector('select').value = 'monthly';
      modeSel.querySelector('select').value = 'safe';

      btnSave.addEventListener('click', async ()=>{
        btnSave.disabled = true;
        const showErr = (msg)=>{ errBox.textContent=msg; errBox.style.display='block'; };
        const clearErr= ()=>{ errBox.textContent=''; errBox.style.display='none'; };
        try{
          const userRef = doc(db, 'players', uid);
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

          await updateDoc(userRef, { onboardedAt: serverTimestamp() });
          shell.remove(); window.removeEventListener('resize', applySmall);
          await initHUD(uid);
        } catch(e){
          showErr('Something went wrong saving your setup. Please try again.');
          console.warn('[Quick Setup] save failed:', e);
          btnSave.disabled=false;
        }
      });

      btnSkip.addEventListener('click', async ()=>{
        try { await updateDoc(doc(db, 'players', uid), { onboardedAt: serverTimestamp() }); } catch(e){ console.warn('[Quick Setup] skip failed:', e); }
        shell.remove(); window.removeEventListener('resize', applySmall);
      });

      document.body.appendChild(shell);
    }

    async function showWelcomeThenMaybeSetup(uid) {
      const userRef = doc(db, 'players', uid);
      const snap = await getDoc(userRef);
      const already = snap.exists() && !!snap.data()?.onboardedAt;
      if (already) return;

      const INTRO_HTML = `
        <h1>Welcome to Project MyFi</h1>
        <p class="lead">Thanks for joining us in our goal to turn managing your finances into an enjoyable experience — we look forward to your feedback as the game continues to grow! 😊</p>
        <p class="lead">
          <strong>Project MyFi</strong> is a ever-evolving world, where your real-life spending habits power your in-game journey.<br><br>
          Reimagine budgeting and spending, seeing the impact of your day-to-day choices through the eyes of your <em>Avatar</em>:<br><br>
          • <strong>Progress</strong> - by rising to the challenge of <em>Quests</em> that promote saving.<br>
          • <strong>Customise</strong> - based on your own habits, goals and style.<br>
          • <strong>Empower</strong> -  and push deeper into <em>The Badlands</em>, earning rewards with real-world impact.<br><br> 
          Spend wisely, plan intentionally, and grow stronger over time, all whilst having fun with your friends.
        </p>
      `;
      const QUICKSTART_HTML = `
        <h1>Quick Start</h1>
        <p class="lead">Five key steps to get started.</p>
        <ol class="steps">
          <li>📜 Set your income and core (must-pay) expenses in the <strong>Finances</strong> menu.</li>
          <li>📜 Log transactions in the <strong>Finances</strong> menu—long-press to edit, before they lock after 1 hour.</li>
          <li>🌀 Manage <strong>Vitals</strong>: Stamina, Mana, Health, and Essence from a Daily, Weekly or Monthly view</li>
          <li>⚔️ Keep your avatar healthy and empowered for <strong>The Badlands</strong> (coming soon).</li>
          <li>❔ Check out the Help menu to learn more.</li>
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
        zIndex: '9999', width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box'
      });
      const card = shell.querySelector('.wcard');
      Object.assign(card.style, {
        width: 'min(520px, 92vw)', maxHeight: '88vh', overflow: 'auto',
        background: 'rgba(22,22,28,.92)', border: '1px solid var(--line, #333)',
        borderRadius: '16px', padding: '16px 16px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,.35)', boxSizing: 'border-box'
      });
      const content = shell.querySelector('.wcontent');
      const actions = card.querySelector('.actions');
      Object.assign(actions.style, { display: 'flex', gap: '.6rem', flexWrap: 'wrap' });

      const btns = card.querySelectorAll('.ws-btn');
      btns.forEach(btn => {
        Object.assign(btn.style, { padding: '.6rem .9rem', borderRadius: '12px',
          border: '1px solid var(--line,#333)', background: 'rgba(255,255,255,.04)',
          cursor: 'pointer', color: '#fff' });
        if (btn.classList.contains('ws-primary')) {
          btn.style.background = 'linear-gradient(180deg, rgba(90,180,255,.25), rgba(90,180,255,.12))';
        }
      });

      const applySmallScreen = () => {
        if (window.innerWidth <= 360) {
          shell.style.padding='10px'; card.style.width='96vw'; card.style.padding='12px'; card.style.borderRadius='14px';
          actions.style.flexDirection='column'; btns.forEach(b=>b.style.width='100%');
        } else {
          actions.style.flexDirection='row'; btns.forEach(b=>b.style.width='');
        }
        const s = content.querySelector('.steps'); if (s) Object.assign(s.style, {
          margin: '0 0 12px 1.1rem', padding: '0', lineHeight: '1.35', fontSize: 'clamp(13px, 3.4vw, 15px)', overflowWrap: 'anywhere'
        });
      };
      applySmallScreen(); window.addEventListener('resize', applySmallScreen, { passive: true });

      const closeAndStartSetup = async () => {
        shell.remove(); window.removeEventListener('resize', applySmallScreen);
        await showFirstRunSetup(uid);
      };

      let mode = 'intro';
      function render(next){ mode = next; content.innerHTML = (mode==='quick') ? QUICKSTART_HTML : INTRO_HTML;
        const qb = shell.querySelector('#wo-quickstart'); if (qb) qb.textContent = (mode==='quick') ? 'Welcome' : 'Quick Start';
        applySmallScreen();
      }
      shell.addEventListener('click', (e) => {
        const btn = e.target.closest('#wo-open,#wo-quickstart'); if (!btn) return;
        if (btn.id==='wo-open') { closeAndStartSetup(); return; }
        if (btn.id==='wo-quickstart') { render(mode==='quick' ? 'intro' : 'quick'); return; }
      });

      render('intro'); document.body.appendChild(shell);
    }

    /* ---------- Load player + HUD ---------- */
    const uid = user.uid;
    window.localStorage.setItem('user', JSON.stringify(user));

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

      // Gestures (touch + mouse for devtools)
      (function setupGestures(){
        let startX=0, startY=0, tracking=false;
        const MIN = 40;
        const onStart = (x,y)=>{ startX=x; startY=y; tracking=true; };
        const onEnd = (x,y)=>{
          if (!tracking) return; tracking=false;
          const dx=x-startX, dy=y-startY; const ax=Math.abs(dx), ay=Math.abs(dy);
          if (ax<MIN && ay<MIN) return;
          // Direct manipulation mapping: drag up => go to down neighbor, drag left => go to right neighbor
          const dir = ax > ay
            ? (dx < 0 ? 'right' : 'left')   // swipe left -> right neighbor, swipe right -> left neighbor
            : (dy < 0 ? 'down'  : 'up');    // swipe up   -> down neighbor,  swipe down  -> up neighbor
          slideTo(dir);
        };

        // Edge-intent reveal: if the user starts near edges, show arrows briefly
        const EDGE = 36; // px zone
        const maybeShowOnEdge = (x,y)=>{
          const w=window.innerWidth, h=window.innerHeight;
          if (x<EDGE || x>w-EDGE || y<EDGE || y>h-EDGE) showIndicators();
        };

        STAGE.addEventListener('touchstart',(e)=>{ const t=e.changedTouches[0]; maybeShowOnEdge(t.clientX,t.clientY); onStart(t.clientX,t.clientY); },{passive:true});
        STAGE.addEventListener('touchend',  (e)=>{ const t=e.changedTouches[0]; onEnd(t.clientX,t.clientY); },{passive:true});

        STAGE.addEventListener('mousedown',(e)=> { maybeShowOnEdge(e.clientX,e.clientY); onStart(e.clientX,e.clientY); });
        window.addEventListener('mouseup',  (e)=> onEnd(e.clientX,e.clientY));
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
});
