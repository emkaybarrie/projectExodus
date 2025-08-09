// js/modal.js
(function(){
  const backdrop  = document.getElementById('appModalBackdrop');
  const titleEl   = document.getElementById('modalTitle');
  const contentEl = document.getElementById('modalContent');
  const footerEl  = document.getElementById('modalFooter');
  const menuEl    = document.getElementById('modalMenu');

  let lastFocused=null, currentKey=null, menuConfig={};

  function trap(e){
    if (e.key !== 'Tab') return;
    const focusables = backdrop.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first=list[0], last=list[list.length-1];
    if (e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
  function onKey(e){ if (e.key==='Escape') close(); }

  function open(defaultKey=null){
    lastFocused = document.activeElement;
    backdrop.dataset.open = "true";
    backdrop.removeAttribute('aria-hidden');
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('keydown', trap);

    const key = (defaultKey && menuConfig[defaultKey]) ? defaultKey : Object.keys(menuConfig)[0];
    switchTo(key);
    setTimeout(()=> menuEl?.querySelector('.menu__btn[aria-current="true"]')?.focus(), 0);
  }
  function close(){
    backdrop.dataset.open = "false";
    backdrop.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', onKey);
    backdrop.removeEventListener('keydown', trap);
    if (lastFocused?.focus) lastFocused.focus();
  }
  function switchTo(key){
    const def = menuConfig[key]; if (!def) return;
    currentKey = key;
    titleEl.textContent = def.title || def.label;
    contentEl.replaceChildren(...[].concat(def.render()));
    footerEl.replaceChildren(...(def.footer?.() || defaultFooter()));
    highlightCurrent();
    setTimeout(()=>{
      const first = contentEl.querySelector('input,select,textarea,button,[tabindex]:not([tabindex="-1"])');
      first?.focus();
    },0);
  }
  function setMenu(config){ menuConfig=config; renderMenu(); highlightCurrent(); }

  function renderMenu(){
    menuEl.innerHTML = '';
    Object.entries(menuConfig).forEach(([key, def])=>{
      const b = document.createElement('button');
      b.className='menu__btn'; b.type='button'; b.textContent=def.label; b.dataset.key=key;
      b.addEventListener('click', ()=>switchTo(key));
      menuEl.appendChild(b);
    });
  }
  function highlightCurrent(){
    menuEl.querySelectorAll('.menu__btn').forEach(btn=>{
      btn.setAttribute('aria-current', btn.dataset.key === currentKey ? 'true' : 'false');
    });
  }
  function defaultFooter(){
    const btn = document.createElement('button');
    btn.className='btn'; btn.type='button'; btn.dataset.action='close'; btn.textContent='Close';
    btn.addEventListener('click', close);
    return [btn];
  }

  // click outside
  backdrop.addEventListener('click', (e)=>{ if (e.target===backdrop) close(); });

  window.MyFiModal = { open, close, setMenu, switchTo, el:{backdrop, titleEl, contentEl, footerEl, menuEl} };
})();
