// src/screens/hub/index.js
import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle, setFooter, setHeaderExtras, openHeaderPopover, closeHeaderPopover } from '../../core/chrome.js';
import { injectView } from '../../core/view.js';

import { refreshAndGetGateway, watchGateway } from './modules/gateway.js';
import { buildHUDModel, ensureFocusCache  } from './modules/hub-vm.js';
import { renderBars, renderPortrait } from './modules/ui/vitals.js';

import { openFullMusicList } from '../../modals/musicPlayer.js';
import { openSettingsModal } from '../../modals/settings.js';
import { openHelpModal } from '../../modals/help.js';
import { openLogoutConfirmModal } from '../../modals/logout.js';
import { openSocialModal } from '../../modals/social.js';

import { openEnergyMenu }     from '../../modals/energyMenu/energy-menu.js';
import { openSpiritStoneModal } from '../../modals/spiritstone.js';
import { openSpiritMenu }     from '../../modals/spirit.js';
import { openExampleStandardModal }     from '../../modals/modal-template.js';

// NEW: card interaction modules
import { wireVitalsStatusToggle } from './modules/ui/status.js';
import { wireShieldBreakdown } from './modules/ui/shieldBreakdown.js';
import { setupViewModeSwitcher } from './modules/ui/viewMode.js';

let unstyle;
let cleanup = [];
let unwatch;

// session state
let latestGW = null;
let currentMode = 'core'; // 'core' | 'daily' | 'weekly'

async function bootVitals() {
  // 1) Force a recompute (idempotent) and paint once
  const first = await refreshAndGetGateway();
  latestGW = first;

  if (first) {
    await ensureFocusCache(currentMode);       // no-op for 'core'
    const vm = buildHUDModel(first, currentMode);
    renderPortrait(vm);
    renderBars(vm);
    window.dispatchEvent(new CustomEvent('vitals:updated', { detail: { vm, gw:first } }));
  }

  // 2) Live updates → VM → diff paint
  unwatch = await watchGateway(null, async (gw) => {
    if (!gw) return;
    latestGW = gw;
    await ensureFocusCache(currentMode);     // keep Focus numbers fresh
    const vm = buildHUDModel(gw, currentMode);
    renderBars(vm);
    window.dispatchEvent(new CustomEvent('vitals:updated', { detail: { vm, gw } }));
  });
}

function injectHeaderMenuOptions(){
  return [
    { key:'settings', label:'Settings', action: () => openSettingsModal('hub') },
    { key:'help',     label:'Help',     action: () => openHelpModal('hub') },
    { key:'logout',   label:'Sign out', action: () => openLogoutConfirmModal('hub') },
  ];
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
  const onClick = () => btn.classList.toggle('pulse'); // placeholder
  btn.addEventListener('click', onClick);
  return () => btn.removeEventListener('click', onClick);
}

export default {
  id: 'hub',
  route: 'hub',
  title: 'HUB',
  background: { key: 'panorama' },
  music: { mode: 'playAt', index: 0, scene: 'vitals' },
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
            const popEl = openHeaderPopover({ anchorEl, placement: 'bottom', content: buildHtml() }, 'panel');
            popEl.querySelector('[data-act="toggle"]')?.addEventListener('click', () => { window.MyFiMusic?.togglePlayPause?.(); closeHeaderPopover(); });
            popEl.querySelector('[data-act="prev"]')?.addEventListener('click', () => { window.MyFiMusic?.prev?.(); closeHeaderPopover(); });
            popEl.querySelector('[data-act="next"]')?.addEventListener('click', () => { window.MyFiMusic?.next?.(); closeHeaderPopover(); });
            popEl.querySelector('[data-act="list"]')?.addEventListener('click', () => { closeHeaderPopover(); openFullMusicList('hub'); });

            const onChange = () => { try { popEl.remove(); } catch {} openPanel(); };
            window.addEventListener('music:changed', onChange, { once: true });
            const mo = new MutationObserver(() => {
              if (!document.body.contains(popEl)) { window.removeEventListener('music:changed', onChange); mo.disconnect(); }
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
          openHeaderPopover({ anchorEl: ev.currentTarget, placement: 'bottom', content: injectHeaderMenuOptions() }, 'list');
        }
      },
    ],
    footer: {
      left:  { icon: '⚡', title: 'Energy', onClick(){ openEnergyMenu({ owner:'hub', mode:'auto' }); } },
      main:  { icon: '⦿', title: 'Essence', onClick(){ openSpiritStoneModal('hub'); } },
      right: { icon: '🧙', title: 'Spirit', onClick(){ openExampleStandardModal('hub'); } },
    }
  },

  async mount(root) {
    // 1) Scoped CSS
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

    // 2) Screen DOM
    await injectView(root, new URL('./view.html', import.meta.url));

    // 3) Initial vitals boot
    await bootVitals();

    // 4) Wire card interactions (return cleanups)
    cleanup.push(wireVitalsStatusToggle());
    cleanup.push(wireShieldBreakdown(() => latestGW));
    cleanup.push(setupViewModeSwitcher(async (mode) => {
      currentMode = mode;
      await ensureFocusCache(mode);            // fetch sums if toggled into Focus, or window rolled
      const vm = buildHUDModel(latestGW, currentMode);
      renderBars(vm);
      window.dispatchEvent(new CustomEvent('vitals:updated', { detail:{ vm, gw: latestGW } }));
    }));

    // Temp: pulse the main Essence btn
    const mainBtn = document.getElementById('main-btn');
    if (mainBtn) mainBtn.classList.add('pulse');
  },

  onShow() {
    setHeaderTitle('HUB');
    setHeaderExtras(this.chrome.headerExtras);
    setFooter(this.chrome.footer);

    try {
      const np = window.MyFiMusic?.getNowPlaying?.();
      const muted = window.MyFiMusic?.isMuted?.();
      if (np && !np.isPlaying && !muted) window.MyFiMusic.play();
    } catch {}

    cleanup.push(mountEssenceMini());
  },

  onHide() {
    const slot = document.getElementById('essence-mini');
    if (slot) slot.innerHTML = '';
  },

  unmount() {
    try { if (unwatch) unwatch(); } catch {}
    cleanup.forEach(fn => { try{ fn(); } catch{} });
    cleanup = [];
    if (unstyle) unstyle();
  }
};
