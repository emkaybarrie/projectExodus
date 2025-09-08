// js/quickMenus.js
// Tap/click opens anchored (“sandwich”) quick menu next to the button.
// Navigation uses the official slide router (window.MyFiNav) — no fallback.

// --- General menu (right) ---
// Build *at click time* so we can omit the current screen and add Hub.
function buildGeneralMenu() {
  const active = document.querySelector('.screen.screen--active');
  const current = active?.dataset?.screen || 'vitals';

  // Full set with desired labels
  const all = [
    ['hub',      'Hub'],
    ['products', 'Resources'],
    ['myana',    'Badlands'],
    ['quests',   'Quests'],
    ['avatar',   'Avatar'],
    ['social',   'Social']
  ];

  // Map dataset.screen -> menu key
  const mapScreenToKey = {
    vitals: 'hub',
    products: 'products',
    myana: 'myana',
    quests: 'quests',
    avatar: 'avatar'
  };

  const currentKey = mapScreenToKey[current] || null;

  // Filter out the current screen from the menu
  const obj = {};
  for (const [key, label] of all) {
    if (key === currentKey) continue;
    obj[key] = { label };
  }
  return obj;
}

// -- navigation helper (via slide router) --
function navToScreen(targetKey) {
  // router layout (same as dashboard.js): hub <-> satellites only
  const active = document.querySelector('.screen.screen--active');
  const current = active?.dataset?.screen || 'vitals';
  const HUB = 'vitals';

  if (targetKey === 'social') {
    alert('Social (friends/invite) coming soon');
    return;
  }

  // Normalize “Hub” key -> vitals
  const targetScreen = (targetKey === 'hub') ? HUB : (
    targetKey === 'products' ? 'products' :
    targetKey === 'myana'    ? 'myana'    :
    targetKey === 'quests'   ? 'quests'   :
    targetKey === 'avatar'   ? 'avatar'   : HUB
  );

  if (targetScreen === current) return;

  // Directions from hub -> satellite
  const DIR_FROM_HUB = { products:'up', myana:'down', quests:'left', avatar:'right' };

  if (!window.MyFiNav) return;

  if (targetScreen === HUB) {
    window.MyFiNav.navigateToHub();
    return;
    }

  // If we’re already at hub, go directly
  if (current === HUB) {
    const dir = DIR_FROM_HUB[targetScreen];
    if (dir) window.MyFiNav.go(dir);
    return;
  }

  // Otherwise: go back to hub first, then to target
  const dir = DIR_FROM_HUB[targetScreen];
  if (!dir) return;

  const onHub = (e) => {
    const toId = e.detail?.toId || '';
    if (toId === 'vitals-root') {
      document.removeEventListener('myfi:navigate', onHub);
      requestAnimationFrame(() => window.MyFiNav.go(dir));
    }
  };
  document.addEventListener('myfi:navigate', onHub, { once: true });
  window.MyFiNav.navigateToHub();
}

// -- Helpers --
function pick(menuMap, keys){
  const out = {};
  keys.forEach(k => { if (menuMap && menuMap[k]) out[k] = menuMap[k]; });
  return out;
}


// ---- Menu opening ----
function openMenuFor(menuDefOrBuilder, opts = {}) {
  const def = (typeof menuDefOrBuilder === 'function') ? menuDefOrBuilder() : menuDefOrBuilder;
  const first = def && Object.values(def)[0];
  const isRich = first && (typeof first.render === 'function' || typeof first.footer === 'function' || typeof first.preview !== 'undefined');

  if (isRich) {
    window.MyFiModal.openMenu(def, {
      ...opts,
      variant: 'menu',
      menuTitle: opts.menuTitle || 'Actions',
      glass: true,
      compact: true
    });
    return;
  }

  // Fallback (e.g. General nav)
  window.MyFiModal.openMenu(def, {
    ...opts,
    variant: 'menu',
    menuTitle: opts.menuTitle || 'Actions',
    glass: true,
    compact: true,
    onSelect: opts.onSelect
  });
}

function attachQuickMenu(btnId, getMenuDef, extraOpts = {}) {
  const el = document.getElementById(btnId);
  if (!el) return;

  // Clean slate: avoid any old handlers triggering
  el.replaceWith(el.cloneNode(true));
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const menuDef = (typeof getMenuDef === 'function') ? getMenuDef() : getMenuDef;
    openMenuFor(menuDef, { anchor: btn, ...extraOpts });
  }, { passive: false });
}

// ---- Global helper to open a quick menu programmatically ----
// Example inside settingsMenu.js after a reset prompt (use the button as anchor if you like)
// window.MyFiOpenQuickMenu && window.MyFiOpenQuickMenu('finances', {});
// or: window.MyFiOpenQuickMenu('energy', { });
window.MyFiOpenQuickMenu = function(which, opts = {}) {
  // Reuse the same builders/defs used by attachQuickMenu
  const defFor = (key) => {
    if (key === 'finances' || key === 'energy') {
      // same grid used by the left button
      return pick(window.MyFiFinancesMenu, ['connectBank','income','expenses']);
    }
    if (key === 'essence') {
      return pick(window.MyFiEssenceMenu, ['contribute','purchase','empower']);
    }
    if (key === 'help') {
      return pick(window.MyFiHelpMenu, ['overview','vitals','quests','avatars','resources','badlands','faq','report']);
    }
    if (key === 'general') {
      return buildGeneralMenu();
    }
    // allow passing a prebuilt def object
    if (typeof key === 'object' && key) return key;
    return null;
  };

  const def = defFor(which);
  if (!def) { console.warn('[QuickMenu] No menu for key:', which); return false; }

  // Reuse the same presenter as the button-wired quick menus
  openMenuFor(def, {
    menuTitle: opts.menuTitle || (which === 'finances' || which === 'energy' ? 'Finances' : 'Actions'),
    anchor: opts.anchor || null,   // pass a button element if you want it “anchored”
    ...opts
  });
  return true;
};


// Help (top-centre right) → real Help menu 
attachQuickMenu('help-btn', () =>
  pick(window.MyFiHelpMenu, ['overview','vitals', 'quests', 'avatars', 'resources', 'badlands', 'faq','report'])
);

// Settings (top-right) → real Settings menu (show only Profile + Log Out)
attachQuickMenu('settings-btn', () =>
  pick(window.MyFiSettingsMenu, ['profile', 'app','logout'])
);

// Left (Energy) → real Finances menu items
attachQuickMenu('left-btn', () =>
  pick(window.MyFiFinancesMenu, ['connectBank','income','expenses'])
);

// Center (Essence) → real Essence menu items
attachQuickMenu('essence-btn', () =>
  pick(window.MyFiEssenceMenu, ['contribute', 'purchase', 'empower'])
);

// attachQuickMenu('right-btn', () =>
//   pick(window.MyFiSocialMenu, ['home'])
// );

// Right (General) → label-only grid used for navigation (not content)
// attachQuickMenu('right-btn', buildGeneralMenu, {
//   onSelect: navToScreen
// });

