// src/screens/hub/index.js
import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle, setFooter, setHeaderExtras } from '../../core/chrome.js';
import { injectView } from '../../core/view.js';
import { navigate } from '../../core/router.js';

import { refreshAndGetGateway, watchGateway } from './modules/gateway.js';
import { buildHUDModel } from './modules/hub-vm.js';
import { renderBars, renderPortrait } from './modules/ui/vitals.js'; // example: initial + incremental render

import { logoutUser } from '../auth/modules/auth.js'

import { openHeaderPopover, closeHeaderPopover } from '../../core/chrome.js';

import { openFullMusicList } from '../../modals/musicPlayer.js';
import { openSettingsModal } from '../../modals/settings/settings.js'
import { openHelpModal } from '../../modals/help/help.js'
import { openLogoutConfirmModal } from '../../modals/logout/logout.js'
import { openSocialModal } from '../../modals/social/social.js'

import { openSpiritStoneModal } from '../../modals/spiritstone/spiritstone.js';

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

function injectHeaderMenuOptions(){
   const menuOptions = 
            [{
              key: 'settings',
              label: 'Settings',
              action: () => { openSettingsModal('hub'); }
            },
            {
              key: 'help',
              label: 'Help',
              action: () => { openHelpModal('hub'); }
            },
            {
              key: 'logout',
              label: 'Sign out',
              action: () => { openLogoutConfirmModal('hub'); }
            }]

    return menuOptions
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
        icon: '🎵',
        title: 'Music',
        onClick(ev) {
        const anchorEl = ev.currentTarget;

        const buildHtml = () => {
          const np = window.MyFiMusic?.getNowPlaying?.() || {};
          return `
            <h3 style="margin:0 0 6px 0;">Music</h3>
            <div style="font-size:14px;line-height:1.4;margin-bottom:8px;">
              <div style="font-weight:600;">${np.title ?? 'Unknown Track'}</div>
              <div style="opacity:.8;">${np.artist ?? ''}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button data-act="prev">Prev</button>
              <button data-act="toggle">${np.isPlaying ? 'Pause' : 'Play'}</button>
              <button data-act="next">Next</button>
              <button data-act="list">Open full list</button>
            </div>
          `;
        };

        const openPanel = () => {
          // open new panel
          const popEl = openHeaderPopover({
            anchorEl,
            placement: 'bottom',
            content: buildHtml()
          }, 'panel');

          // wire actions
          popEl.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
            window.MyFiMusic?.togglePlayPause?.();
            closeHeaderPopover();
          });
          popEl.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
            window.MyFiMusic?.prev?.();
            closeHeaderPopover();
          });
          popEl.querySelector('[data-act="next"]')?.addEventListener('click', () => {
            window.MyFiMusic?.next?.();
            closeHeaderPopover();
          });
          popEl.querySelector('[data-act="list"]')?.addEventListener('click', () => {
            closeHeaderPopover();
            openFullMusicList('hub');
          });

          // if state changes while open, rebuild once
          const onChange = () => {
            try { popEl.remove(); } catch {}
            openPanel();
          };
          window.addEventListener('music:changed', onChange, { once: true });

          // remove listener when panel closes (outside click handler will remove DOM)
          const cleanup = () => window.removeEventListener('music:changed', onChange);
          // observe removal
          const mo = new MutationObserver(() => {
            if (!document.body.contains(popEl)) { cleanup(); mo.disconnect(); }
          });
          mo.observe(document.body, { childList: true, subtree: true });

          return popEl;
        };

        openPanel();
      }
      },
      {
        icon: '☰',
        title: 'Menu',
        onClick (ev) {
          // ev.currentTarget should be the header button element created by chrome.js
          openHeaderPopover({
            anchorEl: ev.currentTarget,
            placement: 'bottom',
            content: injectHeaderMenuOptions(),
          }, 'list');
        }
      },
    ],
    footer: {
      left:  { icon: '⚡', title: 'Quests',  onClick(){/* Add Energy Menu */ } },
      main:  { icon: '⦿', title: 'Essence', onClick(){ openSpiritStoneModal('hub') } },
      right: { icon: '🧙', title: 'Avatar',  onClick(){ /* Add Spirit Menu */} },
    }
  },

  async mount(root) {
    // 1) Scoped CSS
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

    // 2) Screen body
    await injectView(root, new URL('./view.html', import.meta.url));

    // 3) Wire lightweight actions
    // const addBtn = root.querySelector('[data-act="add"]');
    // const onAdd = () => alert('Add event (placeholder)');
     // addBtn.addEventListener('click', onAdd);
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

    // Start music when arriving on hub (if allowed)
    try {
      const np = window.MyFiMusic?.getNowPlaying?.();
      const muted = window.MyFiMusic?.isMuted?.();
      if (np && !np.isPlaying && !muted) {
        window.MyFiMusic.play();
      }
    } catch {}

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
