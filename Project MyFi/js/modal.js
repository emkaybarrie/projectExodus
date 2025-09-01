// js/modal.js
(function () {
  const backdrop  = document.getElementById('appModalBackdrop');
  const titleEl   = document.getElementById('modalTitle');
  const contentEl = document.getElementById('modalContent');
  const footerEl  = document.getElementById('modalFooter');
  const shell     = document.querySelector('#appModalBackdrop .modal');

  if (!backdrop || !shell) { console.warn('Modal mount not found'); return; }

  // ---------------- state ----------------
  let lastOpenOpts = {};
  let lastFocused  = null;
  let currentKey   = null;
  let menuConfig   = {};
  let currentVariant = 'menu'; // only 'menu' (grid) or 'single'
  let menuTitleOverride = null;
  let lastSelectedKey = null; // (kept for compatibility; not used in this trimmed variant)
  let cameFromGrid = false;

  // NEW: cross-menu navigation stack
  let navStack = [];

  // -------------- sizing helpers --------------
  function numFromCSSVar(name, fallback = 0) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function measureDashChrome() {
    const topbar = document.querySelector('.topbar');
    const headerH = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
    const footerH = Math.max(0, numFromCSSVar('--hud-footer-h', 0));
    const vh = Math.max(window.innerHeight, numFromCSSVar('--app-vh', window.innerHeight));
    return { headerH, footerH, vh };
  }

  function recalcMaxHeight() {
    const { headerH, footerH, vh } = measureDashChrome();
    const pad = 12;
    const available = Math.max(260, vh - headerH - footerH - pad * 2);

    shell.style.maxHeight = `${Math.floor(available)}px`;

    const headH = shell.querySelector('.modal__header')?.getBoundingClientRect().height || 0;
    const footH = shell.querySelector('.modal__footer')?.getBoundingClientRect().height || 0;
    const contentMax = Math.max(120, available - headH - footH);
    contentEl.style.maxHeight = `${Math.floor(contentMax)}px`;
    contentEl.style.minHeight = '120px';
  }

  // Observe live changes inside the content to keep things compact
  const ro = new ResizeObserver(() => recalcMaxHeight());
  const mo = new MutationObserver(() => { requestAnimationFrame(recalcMaxHeight); });

  function attachObservers() {
    try { ro.observe(contentEl); } catch {}
    try { mo.observe(contentEl, { childList: true, subtree: true }); } catch {}
  }
  function detachObservers() {
    try { ro.disconnect(); } catch {}
    try { mo.disconnect(); } catch {}
  }

  // Recalc on viewport changes too
  ['resize','orientationchange'].forEach(evt =>
    window.addEventListener(evt, () => requestAnimationFrame(recalcMaxHeight), { passive: true })
  );
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => requestAnimationFrame(recalcMaxHeight), { passive: true });
    window.visualViewport.addEventListener('scroll', () => requestAnimationFrame(recalcMaxHeight), { passive: true });
  }

  // -------------- state snapshot/restore (for Back) --------------
  function snapshotState() {
    return {
      variant: currentVariant,             // 'menu' | 'single'
      menu: menuConfig,
      key: currentKey,                     // null if grid
      menuTitle: menuTitleOverride,
      scrollTop: contentEl.scrollTop,
      cameFromGrid,
      lastOpenOpts
    };
  }

  function renderState(state) {
    menuConfig = state.menu || {};
    menuTitleOverride = state.menuTitle || null;
    currentVariant = state.variant || 'menu';
    cameFromGrid = !!state.cameFromGrid;
    lastOpenOpts = state.lastOpenOpts || {};

    if (currentVariant === 'single' && state.key) {
      backdrop.classList.add('is-single');
      switchTo(state.key);
    } else {
      backdrop.classList.add('is-single');
      titleEl.textContent = menuTitleOverride || 'Actions';
      renderMenuGrid();
    }

    requestAnimationFrame(() => {
      contentEl.scrollTop = state.scrollTop || 0;
      recalcMaxHeight();
    });
  }

  // -------------- focus/escape --------------
  function trapTab(e) {
    if (e.key !== 'Tab') return;
    const focusables = backdrop.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function goBack() {
    // First step back within a menu: item → its grid
    if (cameFromGrid) {
      cameFromGrid = false;
      showGridScreen();
      // We've returned to the grid we had snapshotted; drop that snapshot now.
      if (navStack.length) navStack.pop();
      return;
    }
    // Cross-menu back: restore previous modal state
    if (navStack.length) {
      const prev = navStack.pop();
      renderState(prev);
      return;
    }
    // Nothing to go back to → close
    close();
  }

  function onKey(e) {
    if (e.key === 'Escape') goBack();
  }

  // -------------- core API --------------
  function open(defaultKey = null, opts = {}) {
    lastOpenOpts = opts || {};
    const v = (opts && opts.variant) || 'menu';
    currentVariant = (v === 'single') ? 'single' : 'menu';
    menuTitleOverride = (opts && typeof opts.menuTitle === 'string') ? opts.menuTitle : null;

    // reset per-open
    cameFromGrid = false;
    lastSelectedKey = null;
    backdrop.classList.remove('is-detail', 'is-single');

    // centered shell
    shell.classList.toggle('modal--glass', opts?.glass !== false);
    shell.classList.toggle('modal--compact', !!(opts?.compact || currentVariant === 'menu'));
    shell.style.left = shell.style.top = '';
    shell.style.width = '';
    shell.style.position = '';

    // show
    lastFocused = document.activeElement;
    backdrop.dataset.open = "true";
    backdrop.removeAttribute('aria-hidden');
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('keydown', trapTab);

    // initial layout and live observers
    recalcMaxHeight();
    attachObservers();

    // initial key
    const firstKey = Object.keys(menuConfig)[0] || null;
    const key = (defaultKey && menuConfig[defaultKey]) ? defaultKey : firstKey;

    if (currentVariant === 'single') {
      backdrop.classList.add('is-single');
      if (key) switchTo(key);
      else {
        contentEl.textContent = '';
        titleEl.textContent = menuTitleOverride || 'Menu';
      }
      setTimeout(() =>
        contentEl?.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')?.focus(), 0);
    } else {
      // Menu grid
      backdrop.classList.add('is-single'); // visually hide sidebar (single column)
      titleEl.textContent = menuTitleOverride || 'Actions';
      renderMenuGrid();
      setTimeout(() => contentEl?.querySelector('.menuGrid__btn')?.focus(), 0);
    }

    requestAnimationFrame(recalcMaxHeight);
  }

  function close() {
    backdrop.dataset.open = "false";
    backdrop.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey);
    backdrop.removeEventListener('keydown', trapTab);
    detachObservers();
    backdrop.classList.remove('is-detail', 'is-single');
    contentEl.style.maxHeight = '';
    shell.style.maxHeight = '';
    navStack = [];                 // clear stack on hard close
    cameFromGrid = false;
    if (lastFocused?.focus) lastFocused.focus();
  }

  function setMenu(config) { menuConfig = config || {}; }

  function switchTo(key) {
    const def = menuConfig[key]; if (!def) return;
    currentKey = key;
    titleEl.textContent = def.title || def.label || menuTitleOverride || 'Menu';

    const nodes = [].concat(def.render?.() || []);
    contentEl.replaceChildren(...nodes);
    const f = (def.footer?.() || defaultFooter());
    footerEl.replaceChildren(...withBack(f));

    contentEl.scrollTop = 0;

    setTimeout(() => {
      const first = contentEl.querySelector('input,select,textarea,button,[tabindex]:not([tabindex="-1"])');
      first?.focus();
    }, 0);

    requestAnimationFrame(recalcMaxHeight);
  }

  // -------------- chrome: menu + footer --------------
  function withBack(arr){
    if (!(cameFromGrid || navStack.length)) return arr;
    const back = document.createElement('button');
    back.className = 'btn btn--back';
    back.type = 'button';
    back.textContent = 'Back';
    back.addEventListener('click', goBack);
    return [back, ...arr];
  }

  function defaultFooter() {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.dataset.action = 'close';
    btn.textContent = 'Close';
    btn.addEventListener('click', close);
    return [btn];
  }

  // -------------- menu grid (quick menus) --------------
  function renderMenuGrid() {
    const grid = document.createElement('div');
    grid.className = 'modal__grid';
    contentEl.replaceChildren(grid);
    footerEl.replaceChildren(...withBack(defaultFooter()));

    Object.entries(menuConfig).forEach(([key, def]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menuGrid__btn';
      b.innerHTML = `<div class="menuGrid__title">${def.label || def.title || key}</div>`;
      b.addEventListener('click', () => {
        if (typeof lastOpenOpts?.onSelect === 'function') {
          lastOpenOpts.onSelect(key, def);
        } else {
          // push current grid so Back returns here first
          navStack.push(snapshotState());
          cameFromGrid = true;
          currentVariant = 'single';
          backdrop.classList.add('is-single');
          switchTo(key);
        }
      });
      grid.appendChild(b);
    });

    requestAnimationFrame(recalcMaxHeight);
  }

  // -------------- Return to Grid helper --------------
  function showGridScreen() {
    titleEl.textContent = menuTitleOverride || 'Actions';
    currentVariant = 'menu';
    backdrop.classList.add('is-single');
    renderMenuGrid();
    contentEl.scrollTop = 0;
    requestAnimationFrame(recalcMaxHeight);
  }

  // -------------- outside click closes --------------
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  // -------------- public API --------------
  window.MyFiModal = {
    open, close, setMenu, switchTo,
    el: { backdrop, titleEl, contentEl, footerEl },

    // Root open: clears stack and shows a grid
    openMenu(menu, opts = {}) {
      navStack = [];
      cameFromGrid = false;
      setMenu(menu);
      open(null, { variant: 'menu', ...opts });
    },

    // Child openers (stack-aware)
    openChildMenu(menu, opts = {}) {
      // If modal is closed, just behave like root open
      if (backdrop.dataset.open !== 'true') return this.openMenu(menu, opts);
      navStack.push(snapshotState());
      setMenu(menu);
      menuTitleOverride = opts.menuTitle || null;
      currentVariant = 'menu';
      lastOpenOpts = opts || {};
      cameFromGrid = false;
      showGridScreen();
    },

    openChildItem(menu, key, opts = {}) {
      // If modal is closed, open directly as single view
      if (backdrop.dataset.open !== 'true') {
        setMenu(menu);
        return open(key, { variant: 'single', ...opts });
      }
      navStack.push(snapshotState());
      setMenu(menu);
      menuTitleOverride = opts.menuTitle || null;
      currentVariant = 'single';
      lastOpenOpts = opts || {};
      cameFromGrid = false;
      switchTo(key);
    },

    // Programmatic back (same as Back button / Esc)
    back: goBack,

    // legacy no-op kept for compatibility with quickMenus that call it
    _adjustAnchored() { /* centered modal: nothing to do */ }
  };
})();
