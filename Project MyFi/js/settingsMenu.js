// js/settingsMenu.js
// Standardised Settings menu (uses kit.js / MyFiUI).
// Exposes window.MyFiSettingsMenu with two entries: { profile, logout }.

import { auth, db, logoutUser } from './core/auth.js';
import {
  doc, getDoc, updateDoc,
  collection, query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

    // Profile reset (placeholder)
    const wipeWrap = document.createElement('div'); wipeWrap.className='field';
    const wipeLab  = document.createElement('label'); wipeLab.textContent = 'Reset Whole Profile';
    const wipeBtn  = document.createElement('button'); wipeBtn.type='button'; wipeBtn.className='btn';
    wipeBtn.id = 'btnResetProfile';
    wipeBtn.textContent = 'Factory Reset (Coming soon)';
    const wipeHelp = helper('Erase all player data and start over (placeholder – not active yet).');

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

    // Profile reset (placeholder)
    wipeBtn.addEventListener('click', async () => {
      const ok = confirm('This will eventually erase your profile and all data. This is a placeholder for now. Continue?');
      if (!ok) return;
      alert('Reset profile is not active yet. Coming soon.');
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
