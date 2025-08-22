// js/modal.js
(function(){
  const backdrop  = document.getElementById('appModalBackdrop');
  const titleEl   = document.getElementById('modalTitle');
  const contentEl = document.getElementById('modalContent');
  const footerEl  = document.getElementById('modalFooter');
  const menuEl    = document.getElementById('modalMenu');
  const backBtn   = document.querySelector('.modal__back');

  let lastFocused=null, currentKey=null, menuConfig={};
  let currentVariant = 'split'; // 'split' | 'drilldown' | 'single'
  let menuTitleOverride = null;
  let lastSelectedKey = null;

  function trap(e){
    if (e.key !== 'Tab') return;
    const focusables = backdrop.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first=list[0], last=list[list.length-1];
    if (e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
  function onKey(e){
    if (e.key==='Escape') {
      if (currentVariant==='drilldown' && backdrop.classList.contains('is-detail')) {
        showListScreen();
      } else {
        close();
      }
    }
  }

  function open(defaultKey = null, opts = {}) {
    // Decide variant
    const v = (opts && opts.variant) || 'split';
    currentVariant = (v === 'drilldown' || v === 'single') ? v : 'split';
    menuTitleOverride = (opts && typeof opts.menuTitle === 'string') ? opts.menuTitle : null;

    // Reset state & stale classes
    lastSelectedKey = null;
    backdrop.classList.remove('is-detail');
    backdrop.classList.remove('is-single');

    // Show modal
    lastFocused = document.activeElement;
    backdrop.dataset.open = "true";
    backdrop.removeAttribute('aria-hidden');
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('keydown', trap);

    // Initial key
    const firstKey = Object.keys(menuConfig)[0] || null;
    const key = (defaultKey && menuConfig[defaultKey]) ? defaultKey : firstKey;

    // Always render the menu fresh (sidebar will be empty for 'single' due to your Step B)
    renderMenu();

    if (currentVariant === 'drilldown') {
      setTitleForList();
      renderPreviewFor(key);
      highlightCurrent(null);
      backdrop.classList.remove('is-detail');
      setTimeout(() => menuEl?.querySelector('.menu__btn')?.focus(), 0);
    } else if (currentVariant === 'single') {
      // No sidebar; render content directly
      backdrop.classList.add('is-single');
      if (key) {
        switchTo(key); // this already sets the title
      } else {
        contentEl.textContent = '';
        titleEl.textContent = menuTitleOverride || 'Menu';
      }
      // Focus first focusable in content
      setTimeout(() => {
        const first = contentEl?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        first?.focus();
      }, 0);
    } else {
      // Standard split
      switchTo(key);
      setTimeout(() => menuEl?.querySelector('.menu__btn[aria-current="true"]')?.focus(), 0);
    }
  }

  function close(){
    backdrop.dataset.open = "false";
    backdrop.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', onKey);
    backdrop.removeEventListener('keydown', trap);
    backdrop.classList.remove('is-detail');
    backdrop.classList.remove('is-single'); // <-- add this
    if (lastFocused?.focus) lastFocused.focus();
  }


  function switchTo(key){
    const def = menuConfig[key]; if (!def) return;
    currentKey = key;
    titleEl.textContent = def.title || def.label || menuTitleOverride || 'Menu';

    const nodes = [].concat(def.render?.() || []);
    contentEl.replaceChildren(...nodes);
    footerEl.replaceChildren(...(def.footer?.() || defaultFooter()));

    contentEl.scrollTop = 0;
    highlightCurrent(key);

    setTimeout(()=>{
      const first = contentEl.querySelector('input,select,textarea,button,[tabindex]:not([tabindex="-1"])');
      first?.focus();
    },0);
  }

  function setMenu(config){ menuConfig=config; renderMenu(); highlightCurrent(currentKey); }

  function renderMenu(){
    menuEl.innerHTML = '';

    // ⬇️ New: if single, skip building the sidebar entirely
    if (currentVariant === 'single') {
      return;
    }

    Object.entries(menuConfig).forEach(([key, def])=>{
      const b = document.createElement('button');
      b.className='menu__btn'; b.type='button';
      b.textContent = def.label || key;
      b.dataset.key = key;

      if (currentVariant === 'drilldown') {
        b.addEventListener('click', ()=> {
          lastSelectedKey = key;
          renderPreviewFor(key);
          highlightCurrent(key);
        });
        b.addEventListener('dblclick', ()=> openDetailFromList(key));
        b.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailFromList(key); }
          if (e.key === 'ArrowRight') { e.preventDefault(); openDetailFromList(key); }
        });
      } else {
        b.addEventListener('click', ()=>switchTo(key));
      }

      menuEl.appendChild(b);
    });
  }

  function highlightCurrent(key){
    menuEl.querySelectorAll('.menu__btn').forEach(btn=>{
      btn.setAttribute('aria-current', btn.dataset.key === key ? 'true' : 'false');
    });
  }

  function defaultFooter(){
    const btn = document.createElement('button');
    btn.className='btn'; btn.type='button'; btn.dataset.action='close'; btn.textContent='Close';
    btn.addEventListener('click', close);
    return [btn];
  }

  // ───────────────────────── Drill‑down helpers ─────────────────────────
  function setTitleForList(){
    titleEl.textContent = menuTitleOverride || 'Actions';
  }

  function renderPreviewFor(key){
    const def = key ? menuConfig[key] : null;

    const wrap = document.createElement('div');
    wrap.className = 'modal__preview';
    wrap.tabIndex = 0;

    const h = document.createElement('h4');
    h.className = 'modal__previewTitle';
    h.textContent = def?.title || def?.label || 'Select an option…';

    const p = document.createElement('div');
    p.className = 'modal__previewBody';

    // preview can be string, Node, or function returning Node/array
    let previewContent = null;
    if (def?.preview instanceof Node) previewContent = def.preview;
    else if (typeof def?.preview === 'function') {
      const r = def.preview();
      previewContent = Array.isArray(r) ? r : [r];
    } else if (typeof def?.preview === 'string') {
      const d = document.createElement('p'); d.textContent = def.preview; previewContent = [d];
    } else {
      const d = document.createElement('p');
      d.textContent = 'Select an item from the left to see a description.';
      d.style.opacity = '0.7';
      previewContent = [d];
    }

    p.replaceChildren(...(Array.isArray(previewContent) ? previewContent : [previewContent]));

    // Tap‑friendly CTA
    const cta = document.createElement('button');
    cta.className = 'btn btn--accent modal__previewCTA';
    cta.type = 'button';
    cta.textContent = (def?.ctaLabel || 'Open');
    cta.addEventListener('click', () => openDetailFromList(key));

    // Also let the whole preview area open on tap (mobile friendly)
    wrap.addEventListener('click', (e) => {
      // avoid double-trigger if user actually tapped the CTA
      if (e.target === cta) return;
      if (def) openDetailFromList(key);
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (def) openDetailFromList(key); }
    });

    wrap.append(h, p, cta);

    contentEl.replaceChildren(wrap);
    footerEl.replaceChildren(...defaultFooter());
  }

  function openDetailFromList(key){
    if (!key) return;
    lastSelectedKey = key;
    backdrop.classList.add('is-detail');
    switchTo(key);
  }

  function showListScreen(){
    backdrop.classList.remove('is-detail');
    setTitleForList();
    renderMenu();
    renderPreviewFor(lastSelectedKey || Object.keys(menuConfig)[0] || null);
    highlightCurrent(lastSelectedKey || null);
    contentEl.scrollTop = 0;
    setTimeout(()=> menuEl?.querySelector('.menu__btn[aria-current="true"]')?.focus(), 0);
  }

  backBtn?.addEventListener('click', ()=>{
    if (currentVariant === 'drilldown' && backdrop.classList.contains('is-detail')) {
      showListScreen();
    } else {
      close();
    }
  });

  // click outside to close
  backdrop.addEventListener('click', (e)=>{ if (e.target===backdrop) close(); });

  // expose API
  window.MyFiModal = {
    open,
    close,
    setMenu,
    switchTo,
    el:{backdrop, titleEl, contentEl, footerEl, menuEl}
  };
})();
