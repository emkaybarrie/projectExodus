// js/settingsMenu.js
// Standardised Settings menu. Uses MyFiUI + exposes window.MyFiSettingsMenu.

import { auth, db, logoutUser } from './core/auth.js';
import { getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initHUD } from './hud/hud.js';

(function(){
  const { helper, field, select, primary, cancel, danger, inlineError, setError } = window.MyFiUI;

  const SettingsMenu = {
    profile: {
      label: 'Vitals Start Mode',
      title: 'Vitals Start Mode',
      render(){
        const wrap = document.createElement('div');

        wrap.appendChild(helper(`
          <p>Select how your avatar’s vitals are calculated:</p>
          <ul>
            <li><strong>Relaxed</strong> — Start conservatively. Your avatar’s energy will regenerate slowly and steadily.</li>
            <li><strong>Standard</strong> — Seeded automatically based on when in the month you begin.</li>
            <li><strong>Focused</strong> — Start conservatively to promote reduced spending from Day 1.</li>
            <li><strong>True</strong> — Connect your bank (paid) for a live, fully automated start.</li>
          </ul>
        `));

        // select
        const selWrap = document.createElement('div'); selWrap.className='field';
        const lab = document.createElement('label'); lab.htmlFor='vitalsMode'; lab.textContent='Vitals Mode';
        const sel = document.createElement('select'); sel.id='vitalsMode'; sel.className='input';
        [
          ['relaxed','Relaxed'], ['standard','Standard'], ['focused','Focused'], ['true','True (bank sync)']
        ].forEach(([v,t])=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o); });
        selWrap.append(lab, sel);

        // load current
        (async () => {
          try {
            const uid = auth?.currentUser?.uid;
            if (!uid) return;
            const snap = await getDoc(doc(db, "players", uid));
            if (snap.exists()) {
              const mode = snap.data().vitalsMode;
              if (mode && sel.querySelector(`option[value="${mode}"]`)) sel.value = mode;
            }
          } catch (e) { console.warn('Failed to load vitalsMode:', e); }
        })();

        wrap.appendChild(selWrap);
        return [wrap];
      },
      footer(){
        return [
          primary('Save', ()=>emit('settings:vitalsMode:save')),
          cancel('Close')
        ];
      }
    },

    logout: {
      label:'Log Out', title:'Log Out',
      render(){ return [ helper('<strong>Are you sure?</strong> You’ll be signed out from this device.') ]; },
      footer(){ return [ danger('Log Out',()=>emit('auth:logout')), cancel('Cancel') ]; }
    }
  };

  window.MyFiSettingsMenu = SettingsMenu;

  function emit(type){
    const values={};
    window.MyFiModal.el.contentEl
      .querySelectorAll('input,select,textarea')
      .forEach(i=>values[i.id]=i.value);
    window.dispatchEvent(new CustomEvent(type,{detail:values}));
  }

  // Save handler
  window.addEventListener('settings:vitalsMode:save', async (ev)=>{
    const mode = ev.detail?.vitalsMode;
    const uid = auth?.currentUser?.uid;
    if (!uid || !mode) { window.MyFiModal.close(); return; }

    try {
      await updateDoc(doc(db, "players", uid), { vitalsMode: mode });
    } catch (e) {
      console.warn('Failed to save vitalsMode:', e);
    } finally {
      window.MyFiModal.close();
      await initHUD();
    }
  });

  // Logout
  window.addEventListener('auth:logout', ()=>{
    window.MyFiModal.close();
    logoutUser();
  });
})();
