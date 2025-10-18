// src/screens/vitals/index.js
import { loadScopedCSS } from '../../core/cssScope.js';
import { setHeaderTitle, setFooter } from '../../core/chrome.js';
import { injectView } from '../../core/view.js';
import { navigate } from '../../core/router.js';

import { refreshAndGetGateway, watchGateway } from './modules/gateway.js';
import { buildHUDModel } from './modules/vitals-vm.js';
import { renderBars } from './modules/ui/bars.js'; // example: initial + incremental render

let unstyle;
let cleanup = [];
let unwatch;

async function bootVitals() {
  // 1) Force a recompute (idempotent) and paint once
  const first = await refreshAndGetGateway();
  if (first) {
    const vm = buildHUDModel(first, { primary: 'core', focus: 'daily' }); // or whatever mode defaults you use
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
  id: 'vitals',
  route: 'vitals',
  title: 'VITALS',
  background: { key: 'panorama' },
  chrome: {
    mode: 'full',
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

  },

  onShow() {
    setHeaderTitle('VITALS');

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
