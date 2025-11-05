// viewMode.js — Current vs Focus (Daily/Weekly) toggle wiring
export function setupViewModeSwitcher(onModeChange){
  // session-only state (default Core)
  let mode = 'core';           // 'core' | 'daily' | 'weekly'

  const coreBtn  = document.getElementById('engrave-core');
  const focusBtn = document.getElementById('engrave-focus');
  const engrave  = document.getElementById('mode-engrave');

  if (!coreBtn || !focusBtn || !engrave) return () => {};

  function reflect(){
    coreBtn.classList.toggle('is-active', mode === 'core');
    focusBtn.classList.toggle('is-active', mode !== 'core');
    focusBtn.textContent = (mode === 'daily') ? 'Focus: Today'
                         : (mode === 'weekly') ? 'Focus: This Week'
                         : 'Focus: Today';
    engrave.dataset.mode = (mode === 'core') ? 'Current' : (mode === 'daily' ? 'Today' : 'This Week');
    window.dispatchEvent(new CustomEvent('vitals:viewmode', { detail:{ mode } }));
    onModeChange?.(mode);
  }

  const onCore = () => { if (mode !== 'core') { mode = 'core'; reflect(); } };
  const onFocus = () => {
    mode = (mode === 'daily') ? 'weekly' : (mode === 'weekly') ? 'daily' : 'daily';
    reflect();
  };

  coreBtn.addEventListener('click', onCore, { passive:true });
  focusBtn.addEventListener('click', onFocus, { passive:true });

  // initial paint
  reflect();

  return () => {
    try{
      coreBtn.removeEventListener('click', onCore);
      focusBtn.removeEventListener('click', onFocus);
    }catch{}
  };
}
