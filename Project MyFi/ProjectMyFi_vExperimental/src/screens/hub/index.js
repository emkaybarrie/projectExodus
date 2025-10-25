// src/screens/hub/index.js
import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle, setFooter, setHeaderExtras } from '../../core/chrome.js';
import { injectView } from '../../core/view.js';
import { navigate } from '../../core/router.js';

import { refreshAndGetGateway, watchGateway } from './modules/gateway.js';
import { buildHUDModel } from './modules/hub-vm.js';
import { renderBars, renderPortrait } from './modules/ui/vitals.js'; // example: initial + incremental render

import { logoutUser } from '../auth/modules/auth.js'

import { open as openModal } from '../../core/modal.js';

let unstyle;
let cleanup = [];
let unwatch;

async function bootVitals() {
  // 1) Force a recompute (idempotent) and paint once
  const first = await refreshAndGetGateway();
  if (first) {
    const vm = buildHUDModel(first, { primary: 'core', focus: 'daily' }); // or whatever mode defaults you use
    renderPortrait(vm)
    renderBars(vm);                    // initial paint (create DOM refs, set widths/texts)
  }

  // 2) Live updates → VM → diff paint
  unwatch = watchGateway(null, (gw) => {
    if (!gw) return;
    const vm = buildHUDModel(gw);
    renderBars(vm);                    // fast path (only set changed widths/texts)
    // Optional: fan out UI events so other widgets can react
    window.dispatchEvent(new CustomEvent('vitals:updated', { detail: { vm, gw } }));
  });
}

function openHubMenu() {
  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <div style="padding: 12px 12px 8px;">
      <h3 style="margin: 0 0 8px; font-family: Cinzel, serif; letter-spacing:.06em;">Menu</h3>
      <nav class="menu-list">
        <button data-go="settings" class="menu-item">Settings</button>
        <button data-go="social"   class="menu-item">Social</button>
        <button data-go="help"     class="menu-item">Help</button>
      </nav>
    </div>
    <style>
      .menu-list { display: grid; gap: 8px; }
      .menu-item {
        appearance: none; width: 100%;
        padding: 10px 12px; border-radius: 10px; cursor: pointer;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(35,30,55,.65); backdrop-filter: blur(6px);
        color: #eef2ff; text-align: left; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .menu-item:hover { transform: translateY(-1px); }
    </style>
  `;

  const modal = openModal({ content: tpl.content, owner: 'hub' });

  // single delegated click handler, closes modal then routes
  const card = document.querySelector('#modal-root .modal-card');
  const onClick = (ev) => {
    const btn = ev.target.closest('.menu-item'); if (!btn) return;
    const key = btn.dataset.go;
    modal.close();

    // route targets — adjust as your screens go live
    if (key === 'settings') navigate('guidance');
    if (key === 'social')   navigate('myana');
    if (key === 'help')     navigate('guidance');
  };
  card?.addEventListener('click', onClick, { once: true });
}


function mountEssenceMini() {
  const slot = document.getElementById('essence-mini');
  if (!slot) return () => {};
  slot.innerHTML = `
    <button class="ess-mini" id="ess-mini-btn" title="Essence">
      <div class="ring"></div>
      <div class="orb"></div>
    </button>
  `;
  const btn = slot.querySelector('#ess-mini-btn');
  const onClick = () => {
    // placeholder action; later hook to real Essence modal
    btn.classList.toggle('pulse');
  };
  btn.addEventListener('click', onClick);
  return () => btn.removeEventListener('click', onClick);
}

export default {
  id: 'hub',
  route: 'hub',
  title: 'HUB',
  background: { key: 'panorama' },
  chrome: {
    mode: 'full',
    headerExtras: [
      {
      icon: '☰',
      title: 'Menu',
      onClick () {openHubMenu(); }
      },
      {
      icon: '⏻',
      title: 'Sign Out',
      onClick () {logoutUser()}
      },
    ],
    footer: {
      left:  { icon: '⚡', title: 'Quests',  onClick(){ navigate('quests'); } },
      main:  { icon: '⦿', title: 'Essence', onClick(){ /* handled by essence-mini */ } },
      right: { icon: '🧙', title: 'Avatar',  onClick(){ navigate('avatar'); } },
    }
  },

  async mount(root) {
    // 1) Scoped CSS
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

    // 2) Screen body
    await injectView(root, new URL('./view.html', import.meta.url));

    // 3) Wire lightweight actions
    // const addBtn = root.querySelector('[data-act="add"]');
    // const filterBtn = root.querySelector('[data-act="filter"]');
    // const onAdd = () => alert('Add event (placeholder)');
    // const onFilter = () => alert('Filter (placeholder)');
    // addBtn.addEventListener('click', onAdd);
    // filterBtn.addEventListener('click', onFilter);
    // cleanup.push(() => { addBtn.removeEventListener('click', onAdd); filterBtn.removeEventListener('click', onFilter); });

    // 4) Initial Render
    await bootVitals();

    // Temp to test pulse effect
    const mainBtn = document.getElementById('main-btn');
    if (mainBtn)
    mainBtn.classList.add('pulse')

  },

  onShow() {
    setHeaderTitle('HUB');
    // Header buttons per-screen (keeps systemized approach)
    setHeaderExtras(this.chrome.headerExtras);

    // Footer buttons per-screen (keeps systemized approach)
    setFooter(this.chrome.footer);

    // Inject essence mini into the center footer slot
    cleanup.push(mountEssenceMini());
  },

  onHide() {
    // remove essence mini content but keep footer bar
    const slot = document.getElementById('essence-mini');
    if (slot) slot.innerHTML = '';
    // other per-screen listeners cleaned in unmount
  },

  unmount() {
    cleanup.forEach(fn => { try{ fn(); } catch{} });
    cleanup = [];
    if (unstyle) unstyle();
  }
};
