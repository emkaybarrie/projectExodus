// js/settingsMenu.js
import { auth, db, logoutUser } from './core/auth.js';
import { getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function(){
  const { open, setMenu } = window.MyFiModal;

  const SettingsMenu = {
    vitalsMode: {
      label: 'Vitals Start Mode',
      title: 'Vitals Start Mode',
      render(){
        const wrap = document.createElement('div');

        // helper text
        wrap.appendChild(helper(`
          <p>Select how your avatar’s vitals are seeded when (re)initializing:</p>
          <ul>
            <li><strong>Safe</strong> – 1 day’s worth (conservative)</li>
            <li><strong>Accelerated</strong> – 1 day + % of accrued discretionary</li>
            <li><strong>Manual</strong> – quick self-calibration input</li>
            <li><strong>True</strong> – bank-connected (paid)</li>
          </ul>
        `));

        // field
        const field = document.createElement('div');
        field.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'vitalsMode';
        label.textContent = 'Vitals Mode';
        const select = document.createElement('select');
        select.id = 'vitalsMode';
        select.className = 'input';

        [
          { value: 'safe',        text: 'Safe (1 day)' },
          { value: 'accelerated', text: 'Accelerated (1 day + % accrual)' },
          { value: 'manual',      text: 'Manual (quick tweak)' },
          { value: 'true',        text: 'True (bank sync)' },
        ].forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value; o.textContent = opt.text;
          select.appendChild(o);
        });

        field.append(label, select);
        wrap.appendChild(field);

        // async: load current selection from Firestore
        (async () => {
          try {
            const uid = auth?.currentUser?.uid;
            if (!uid) return;
            const snap = await getDoc(doc(db, "players", uid));
            if (snap.exists()) {
              const mode = snap.data().vitalsMode;
              if (mode && select.querySelector(`option[value="${mode}"]`)) {
                select.value = mode;
              }
            }
          } catch (e) {
            console.warn('Failed to load vitalsMode:', e);
          }
        })();

        return [ wrap ];
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

  // helpers (unchanged style)
  function helper(html){ const d=document.createElement('div'); d.className='helper'; d.innerHTML=html; return d; }
  const cancel =(l='Close')=>btn(l,'',()=>window.MyFiModal.close());
  const primary=(l='Save',fn)=>btn(l,'btn-primary',fn);
  const danger =(l,fn)=>btn(l,'',fn);
  function btn(label,klass,fn){ const b=document.createElement('button'); b.type='button'; b.className=`btn ${klass||''}`; b.textContent=label; b.addEventListener('click',fn); return b; }

  function emit(type){
    const values={};
    window.MyFiModal.el.contentEl
      .querySelectorAll('input,select,textarea')
      .forEach(i=>values[i.id]=i.value);
    window.dispatchEvent(new CustomEvent(type,{detail:values}));
  }

  // Open Settings (default still opens to logout to avoid regressions)
  document.getElementById('settings-btn')?.addEventListener('click', ()=>{
    setMenu(SettingsMenu);
    open('logout');
  });

  // Save handler for vitals start mode
  window.addEventListener('settings:vitalsMode:save', async (ev)=>{
    const mode = ev.detail?.vitalsMode;
    const uid = auth?.currentUser?.uid;
    if (!uid || !mode) { window.MyFiModal.close(); return; }

    try {
      await updateDoc(doc(db, "players", uid), { vitalsMode: mode });
      // You can optionally toast here if you have a global toast system
    } catch (e) {
      console.warn('Failed to save vitalsMode:', e);
    } finally {
      window.MyFiModal.close();
    }
  });

  // Logout
  window.addEventListener('auth:logout', ()=>{
    console.log('Logout');
    window.MyFiModal.close();
    logoutUser();
  });
})();
