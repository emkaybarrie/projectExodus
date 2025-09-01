// js/settingsMenu.js
// Standardised Settings menu (uses kit.js / MyFiUI).
// Exposes window.MyFiSettingsMenu with two entries: { profile, logout }.

import { auth, db, logoutUser } from './core/auth.js';
import {
  doc, getDoc, updateDoc,
  collection, query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { resetVitalsToNow } from './data/maintenance.js';
import { initHUD } from './hud/hud.js';

(function(){
  const { helper, field, select, primary, cancel, danger, btnOpenItem, btnOpenMenu } = window.MyFiUI;
  const { el } = window.MyFiUI; // modal el helpers if needed

  // ───────────────────────── utilities ─────────────────────────
  const debounce = (fn, ms=300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  function lsClearOnboardingFlags() {
    try {
      // Clear any keys related to onboarding/welcome we might use
      const keys = [];
      for (let i=0; i<localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(k => {
        if (/onboard|welcome|tour|intro/i.test(k)) localStorage.removeItem(k);
      });
      // Explicit clears (if you have known keys, keep them here too)
      localStorage.removeItem('myfi:welcomeShown');
      localStorage.removeItem('myfi:onboardingComplete');
      localStorage.removeItem('myfi:tour.vitals.v1.done');
    } catch {}
  }

  async function aliasTaken(rawAlias, uidSelf) {
    const alias    = String(rawAlias || '').trim();
    const aliasLow = alias.toLowerCase();
    if (!alias) return false;

    // Prefer case-insensitive check (aliasLower). If a doc doesn't have it, fallback to direct alias equality.
    // 1) aliasLower
    try {
      const q1 = query(collection(db, 'players'), where('aliasLower', '==', aliasLow), limit(1));
      const s1 = await getDocs(q1);
      if (!s1.empty) {
        const hit = s1.docs[0];
        if (hit.id !== uidSelf) return true;
      }
    } catch {}

    // 2) Fallback exact alias (case-sensitive)
    try {
      const q2 = query(collection(db, 'players'), where('alias', '==', alias), limit(1));
      const s2 = await getDocs(q2);
      if (!s2.empty) {
        const hit = s2.docs[0];
        if (hit.id !== uidSelf) return true;
      }
    } catch {}

    return false;
  }

  function validateAlias(raw) {
    const a = String(raw || '').trim();
    if (a.length < 3)  return 'Alias must be at least 3 characters.';
    if (a.length > 20) return 'Alias must be 20 characters or fewer.';
    if (!/^[a-z0-9_]+$/i.test(a)) return 'Use letters, numbers, or underscores only.';
    return '';
  }

  // ───────────────────────── open Energy (income/expenses) grid ─────────────────────────
  function openEnergyMenuGrid() {
    try {
      //
      window.MyFiOpenQuickMenu && window.MyFiOpenQuickMenu('finances');
      // // Preferred: open a child inside Finances if present
      // if (window.MyFiModal?.openChildItem && window.MyFiFinancesMenu) {
      //   const keys = ['income','energy','energySources','incomeAndExpenses','cashflow','setup']; // try in order
      //   const hit = keys.find(k => window.MyFiFinancesMenu[k]);
      //   if (hit) {
      //     window.MyFiModal.openChildItem(window.MyFiFinancesMenu, hit, { menuTitle: 'Energy Sources' });
      //     return true;
      //   }
      // }
      // // Fallback: open Finances root
      // if (window.MyFiModal?.setMenu && window.MyFiFinancesMenu) {
      //   window.MyFiModal.setMenu(window.MyFiFinancesMenu);
      //   window.MyFiModal.open('finances', { variant: 'single', menuTitle: 'Finances' });
      //   return true;
      // }
    } catch (e) {
      console.warn('[Settings] Could not open Energy grid:', e);
    }
    return false;
  }


  // ───────────────────────── date helpers for reset dialog ─────────────────────────
  function yyyy_mm_dd_local(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function midnightMsFromInput(val /* 'YYYY-MM-DD' */) {
    if (!val) return null;
    const ms = new Date(`${val}T00:00:00`).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  /** Opens a tiny overlay asking for Last Pay Day (past 31 days).
   *  Returns { anchorDateMs|null } or null if cancelled. */
  async function openResetDialog(uid) {
    // SAFETY: choose fallback if no prior date and user leaves blank
    const DEFAULT_FALLBACK = 'today'; // <-- set to 'first' if you prefer 1st-of-month default

    // fetch saved last pay to show as default hint
    let savedLastPayMs = null;
    try {
      const p = await getDoc(doc(db, 'players', uid));
      savedLastPayMs = p.exists() ? p.data()?.incomeMeta?.lastPayDateMs ?? null : null;
    } catch {}

    const today = new Date();
    const max = yyyy_mm_dd_local(today);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstStr = yyyy_mm_dd_local(firstOfMonth);
    const min = (() => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      d.setDate(d.getDate() - 31);
      return yyyy_mm_dd_local(d);
    })();

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', display:'grid', placeItems:'center',
      background:'rgba(10,10,14,.65)', backdropFilter:'blur(6px)', zIndex:'99999',
      padding:'16px', boxSizing:'border-box'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width:'min(460px, 92vw)', maxHeight:'88vh', overflow:'auto',
      background:'rgba(22,22,28,.95)', border:'1px solid var(--line, #333)',
      borderRadius:'14px', padding:'14px 14px 10px', color:'#fff',
      boxShadow:'0 18px 50px rgba(0,0,0,.35)'
    });

    const title = document.createElement('h2');
    title.textContent = 'Reset Vitals';
    title.style.margin = '0 0 6px 0';

    const desc = document.createElement('p');
    desc.style.margin = '0 0 10px 0';
    const savedText = savedLastPayMs
      ? `If you leave this blank, we’ll use your saved Last Pay Day: <strong>${yyyy_mm_dd_local(new Date(savedLastPayMs))}</strong>.`
      : `If you leave this blank and there’s no saved date, we’ll use <strong>${DEFAULT_FALLBACK === 'today' ? 'Today' : 'the 1st of this month'}</strong>.`;
    desc.innerHTML = `Choose your <strong>Last Pay Day</strong> for this reset (limited to the past 31 days).<br>${savedText}`;

    const fieldWrap = document.createElement('div');
    fieldWrap.className = 'field';
    const lab = document.createElement('label');
    lab.htmlFor = 'resetLastPay';
    lab.textContent = 'Last Pay Day (past 31 days)';
    const input = document.createElement('input');
    input.id = 'resetLastPay';
    input.type = 'date';
    input.className = 'input';
    input.min = min;
    input.max = max;
    input.value = ''; // user may pick a date
    fieldWrap.append(lab, input);

    // Quick picks (Today / 1st of month)
    const picks = document.createElement('div');
    picks.className = 'helper';
    picks.style.marginTop = '6px';
    picks.innerHTML = `
      Quick pick:
      <button type="button" class="qp-btn" data-pick="today">Today</button>
      <button type="button" class="qp-btn" data-pick="first">1st of this month</button>
    `;
    picks.querySelectorAll('.qp-btn').forEach(b=>{
      Object.assign(b.style,{ marginLeft:'.4rem', padding:'.25rem .5rem', borderRadius:'8px',
        border:'1px solid var(--line,#333)', background:'rgba(255,255,255,.07)', color:'#fff', cursor:'pointer' });
    });
    picks.addEventListener('click', (e)=>{
      const btn = e.target.closest('.qp-btn'); if (!btn) return;
      const pick = btn.dataset.pick;
      input.value = (pick === 'today') ? max : firstStr;
    });

    const hint = document.createElement('div');
    hint.className = 'helper';
    hint.textContent = savedLastPayMs
      ? 'Tip: you can leave this blank to use your saved Last Pay Day.'
      : `Tip: leave blank to use ${DEFAULT_FALLBACK === 'today' ? 'Today' : 'the 1st of this month'}.`;

    const row = document.createElement('div');
    Object.assign(row.style, { display:'flex', gap:'.5rem', marginTop:'12px', flexWrap:'wrap' });
    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'ws-btn ws-primary';
    btnConfirm.textContent = 'Reset now';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'ws-btn ws-ghost';
    btnCancel.textContent = 'Cancel';
    [btnConfirm, btnCancel].forEach(b => Object.assign(b.style, {
      padding:'.55rem .85rem', borderRadius:'10px', border:'1px solid var(--line,#333)', cursor:'pointer', color:'#fff'
    }));
    btnConfirm.style.background = 'linear-gradient(180deg, rgba(90,180,255,.25), rgba(90,180,255,.12))';
    row.append(btnConfirm, btnCancel);

    card.append(title, desc, fieldWrap, picks, hint, row);
    overlay.append(card);
    document.body.appendChild(overlay);

    return new Promise((resolve) => {
      const cleanup = (val) => { overlay.remove(); resolve(val); };

      btnCancel.addEventListener('click', () => cleanup(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });

      btnConfirm.addEventListener('click', () => {
        const val = String(input.value || '').trim();
        if (val) {
          const ms = midnightMsFromInput(val);
          const minMs = midnightMsFromInput(min);
          const maxMs = midnightMsFromInput(max);
          if (!Number.isFinite(ms) || ms < minMs || ms > maxMs) {
            alert('Please choose a date within the last 31 days.'); return;
          }
          cleanup({ anchorDateMs: ms });
          return;
        }

        // No explicit pick:
        if (Number.isFinite(savedLastPayMs)) {
          // use saved
          cleanup({ anchorDateMs: null }); // caller keeps stored date
        } else {
          // no saved → fall back per policy
          const fallbackStr = (DEFAULT_FALLBACK === 'today') ? max : firstStr;
          cleanup({ anchorDateMs: midnightMsFromInput(fallbackStr) });
        }
      });
    });
  }


  // ───────────────────────── Profile View builder ─────────────────────────
  function buildProfileView(){
    const root = document.createElement('div');

    // Fields
    const aliasField = field('Alias', 'text', 'profileAlias', { placeholder: 'Your public handle (e.g. Nightfox)' });
    const aliasHelp  = helper('Your alias is visible to others. It must be unique.');
    const aliasError = document.createElement('p');
    aliasError.className = 'form-error';
    aliasError.id = 'aliasError';
    aliasError.setAttribute('role','alert');
    aliasError.setAttribute('aria-live','polite');

    const firstName  = field('First Name', 'text', 'profileFirst', { placeholder: 'e.g. Alex' });
    const lastName   = field('Last Name', 'text', 'profileLast', { placeholder: 'e.g. Morgan' });

    // Vitals Mode
    const vmWrap = document.createElement('div'); vmWrap.className='field';
    const vmLab  = document.createElement('label'); vmLab.htmlFor='vitalsMode'; vmLab.textContent='Vitals Start Mode';
    const vmSel  = document.createElement('select'); vmSel.id='vitalsMode'; vmSel.className='input';
    [
      ['relaxed','Relaxed'], ['standard','Standard'], ['focused','Focused'], ['true','True (bank sync)']
    ].forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; vmSel.appendChild(o); });
    vmWrap.append(vmLab, vmSel);
    const vmHelp = helper(`
      <ul>
        <li><strong>Relaxed</strong> — conservative regen.</li>
        <li><strong>Standard</strong> — auto-seed based on when you start.</li>
        <li><strong>Focused</strong> — designed to encourage reduced spending from Day 1.</li>
        <li><strong>True</strong> — connect your bank (paid) for fully live automation.</li>
      </ul>
    `);

    // Onboarding reset
    const obxWrap = document.createElement('div'); obxWrap.className='field';
    const obxLab  = document.createElement('label'); obxLab.textContent = 'Welcome & Onboarding';
    const obxBtn  = document.createElement('button'); obxBtn.type='button'; obxBtn.className='btn';
    obxBtn.id = 'btnResetOnboarding';
    const obxHelp = helper('Reset the welcome page and onboarding steps. If they are already reset, this will let you reload and start again.');
    obxWrap.append(obxLab, obxBtn);

    // Reset Vitals
    const wipeWrap = document.createElement('div'); wipeWrap.className='field';
    const wipeLab  = document.createElement('label'); wipeLab.textContent = 'Reset Vitals';
    const wipeBtn  = document.createElement('button'); wipeBtn.type='button'; wipeBtn.className='btn btn--danger';
    wipeBtn.id = 'btnResetProfile';
    wipeBtn.textContent = 'Reset Vitals (start new cycle)';
    const wipeHelp = helper('Resets vitals to a fresh pay-cycle anchor. Keeps your profile, alias, and settings intact.');

    wipeWrap.append(wipeLab, wipeBtn);

    // Pack content
    root.append(
      aliasField, aliasHelp, aliasError,
      firstName, lastName,
      vmWrap, vmHelp,
      obxWrap, obxHelp,
      wipeWrap, wipeHelp
    );

    // Prefill + onboarding button mode
    (async () => {
      try {
        const uid = auth?.currentUser?.uid; if (!uid) return;
        const snap = await getDoc(doc(db, "players", uid));
        if (snap.exists()) {
          const d = snap.data() || {};
          root.querySelector('#profileAlias').value = d.alias || '';
          root.querySelector('#profileFirst').value = d.firstName || '';
          root.querySelector('#profileLast').value  = d.lastName  || '';
          if (d.vitalsMode && vmSel.querySelector(`option[value="${d.vitalsMode}"]`)) vmSel.value = d.vitalsMode;

          const bothFalse = (d.welcomePage === false) && (d.onboarding === false);
          setOnboardingButtonMode(obxBtn, bothFalse ? 'reload' : 'reset');
        } else {
          setOnboardingButtonMode(obxBtn, 'reset');
        }
      } catch(e) {
        console.warn('[Settings] Prefill failed', e);
        setOnboardingButtonMode(obxBtn, 'reset');
      }
    })();

    // Onboarding reset / reload handler
    obxBtn.addEventListener('click', async () => {
      const mode = obxBtn.dataset.mode;
      if (mode === 'reload') {
        window.location.reload();
        return;
      }
      // reset mode: set both flags false and clear localStorage
      try {
        const uid = auth?.currentUser?.uid; if (!uid) return;
        await updateDoc(doc(db, "players", uid), { tutorialFlags: false, onboarding: false });
        lsClearOnboardingFlags();
        setOnboardingButtonMode(obxBtn, 'reload');
      } catch (e) {
        console.warn('[Settings] Failed to reset onboarding', e);
        alert('Could not reset onboarding right now. Please try again.');
      }
    });

    // NEW: Reset Vitals with date prompt (past 31 days)
    wipeBtn.addEventListener('click', async () => {
      const uid = auth?.currentUser?.uid;
      if (!uid) return;

      const choice = await openResetDialog(uid);
      if (!choice) return; // cancelled

      // simple inline progress UI
      const prev = wipeBtn.textContent;
      wipeBtn.disabled = true;
      wipeBtn.textContent = 'Resetting…';

      try {
        // If user picked a date, pass anchorDateMs; otherwise keep stored date (setAnchorToToday=false)
        await resetVitalsToNow({
          uid,
          anchorDateMs: choice.anchorDateMs ?? null,
          setAnchorToToday: false
        });

        // Pull a fresh HUD snapshot after reset
        await initHUD(uid);

        // Offer to update income/expenses now
        const goNow = confirm('Vitals reset complete. Do you want to update your Income/Core Expenses now?');
        if (goNow) {
          try { window.MyFiModal.close(); } catch {}
          setTimeout(() => { openEnergyMenuGrid(); }, 60);
        } else {
          alert('All set! You can update your Energy later from Finances.');
        }

        alert('Vitals reset complete. Your HUD has been refreshed.');
      } catch (e) {
        console.warn('[Settings] Vitals reset failed:', e);
        alert('Vitals reset failed. Please try again or check console for details.');
      } finally {
        wipeBtn.disabled = false;
        wipeBtn.textContent = prev;
      }
    });

    // Alias: validation + availability check
    const aliasInput = root.querySelector('#profileAlias');
    const showAliasError = (msg) => { aliasError.textContent = msg || ''; aliasInput.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
    const runAliasCheck = debounce(async () => {
      const uid = auth?.currentUser?.uid || null;
      const raw = aliasInput.value;
      const v = validateAlias(raw);
      if (v) { showAliasError(v); return; }
      const taken = await aliasTaken(raw, uid);
      showAliasError(taken ? 'Sorry, that alias is taken.' : '');
    }, 350);

    aliasInput.addEventListener('input', runAliasCheck);
    aliasInput.addEventListener('blur', runAliasCheck);

    // Save routine
    async function onSave() {
      const uid = auth?.currentUser?.uid;
      if (!uid) { window.MyFiModal.close(); return; }

      const alias    = String(root.querySelector('#profileAlias')?.value || '').trim();
      const first    = String(root.querySelector('#profileFirst')?.value || '').trim();
      const last     = String(root.querySelector('#profileLast')?.value  || '').trim();
      const vitals   = root.querySelector('#vitalsMode')?.value || 'standard';

      // Validate alias (required + rules)
      const vMsg = validateAlias(alias);
      if (vMsg) { showAliasError(vMsg); return; }
      const taken = await aliasTaken(alias, uid);
      if (taken) { showAliasError('Sorry, that alias is taken.'); return; }
      showAliasError('');

      try {
        await updateDoc(doc(db, "players", uid), {
          alias,
          aliasLower: alias.toLowerCase(),
          firstName: first,
          lastName:  last,
          vitalsMode: vitals
        });
      } catch (e) {
        console.warn('[Settings] Failed to save profile', e);
        alert('Could not save your profile right now. Please try again.');
        return;
      }

      // If vitals mode changed, refresh HUD
      try { await initHUD(); } catch {}

      window.MyFiModal.close();
    }

    function setOnboardingButtonMode(btn, mode) {
      // mode ∈ {'reset','reload'}
      btn.dataset.mode = mode;
      if (mode === 'reload') {
        btn.className = 'btn btn--accent';
        btn.textContent = 'Reload to start onboarding';
      } else {
        btn.className = 'btn';
        btn.textContent = 'Reset welcome & onboarding';
      }
    }

    return {
      nodes: [root],
      onSave
    };
  }

  // ───────────────────────── Menu map ─────────────────────────
  const SettingsMenu = {
    profile: {
      label: 'Profile',
      title: 'Profile',
      render() {
        if (!this._view) this._view = buildProfileView();
        return this._view.nodes;
      },
      footer() {
        return [
          primary('Save', () => this._view?.onSave?.()),
          cancel('Close')
        ];
      }
    },

    logout: {
      label: 'Log Out',
      title: 'Log Out',
      preview: 'Sign out from this device.',
      render(){ return [ helper('<strong>Are you sure?</strong> You’ll be signed out from this device.') ]; },
      footer(){ return [ danger('Log Out',()=>window.dispatchEvent(new CustomEvent('auth:logout'))), cancel('Cancel') ]; }
    }
  };

  // Expose for quick menus / openers
  window.MyFiSettingsMenu = SettingsMenu;

  // Logout action
  window.addEventListener('auth:logout', ()=>{
    window.MyFiModal.close();
    logoutUser();
  });

})();
