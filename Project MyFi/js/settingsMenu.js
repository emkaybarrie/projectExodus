// js/settingsMenu.js
import { logoutUser } from './core/auth.js';

(function(){
  const { open, setMenu } = window.MyFiModal;

  const SettingsMenu = {
    logout: {
      label:'Log Out', title:'Log Out',
      render(){ return [ helper('<strong>Are you sure?</strong> You’ll be signed out from this device.') ]; },
      footer(){ return [ danger('Log Out',()=>emit('auth:logout')), cancel('Cancel') ]; }
    }
  };

  // helpers (unchanged) …
  function helper(html){ const d=document.createElement('div'); d.className='helper'; d.innerHTML=html; return d; }
  const cancel =(l='Close')=>btn(l,'',()=>window.MyFiModal.close());
  const danger =(l,f)=>btn(l,'',f);
  function btn(label,klass,fn){ const b=document.createElement('button'); b.type='button'; b.className=`btn ${klass||''}`; b.textContent=label; b.addEventListener('click',fn); return b; }
  function emit(type){
    const values={}; window.MyFiModal.el.contentEl.querySelectorAll('input,select,textarea').forEach(i=>values[i.id]=i.value);
    window.dispatchEvent(new CustomEvent(type,{detail:values}));
  }

  document.getElementById('left-btn')?.addEventListener('click', ()=>{
    setMenu(SettingsMenu);      // load settings menu items
    open('logout');              // open default to logout option
  });

  window.addEventListener('auth:logout', ()=>{ 
    console.log('Logout'); 
    window.MyFiModal.close(); 
    logoutUser(); 
  });
})();
