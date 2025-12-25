/**
 * HUB Screen Controller
 * Responsibility:
 * - Wire Hub UI -> Feature Pack APIs + UI renderers + modals/navigation (later)
 * - Manage subscriptions (gateway watch) and cleanup
 *
 * MUST:
 * - be the single place Hub DOM event wiring lives
 * - call Feature Pack APIs for data/model (gateway + vitals)
 *
 * MUST NOT:
 * - contain deep business logic (that belongs in Feature Packs)
 *
 * Phase 2B status:
 * - Uses Feature Pack wrappers around existing hub modules (no behaviour change)
 * - Keeps UI rendering in existing hub UI modules
 */

import { injectView } from '../../core/view.js';
import { loadScopedCSS } from '../../core/cssScope.js';

import { openModalById } from '../../modals/registry.js';
import { getFeature } from '../../features/registry.js';

// Hub UI modules (still local to Hub screen for now)
import { createHubUI } from './modules/ui/index.js';

import { setupViewModeSwitcher } from './modules/ui/viewMode.js';
import { wireVitalsStatusToggle } from './modules/ui/status.js';
import { wireShieldBreakdown } from './modules/ui/shieldBreakdown.js';


export function createHubController({ owner = 'hub' } = {}) {
  // Feature APIs (stable surfaces)
  const gateway = getFeature('gateway').api;
  const vitals  = getFeature('vitals').api;

  // Internal controller state
  let unstyle = null;
  let unwatch = null;
  let ui = null;
  let cleanup = [];

  // We keep the latest gateway doc in memory for UI helpers (shield breakdown etc.)
  let latestGatewayDoc = null;

  function getGatewayDoc() {
    return latestGatewayDoc;
  }

  async function renderFromGateway(mode) {
    if (!latestGatewayDoc) return;

    // For focus modes, ensure any cached aggregates exist (existing behaviour)
    try { await vitals.ensureFocusCache?.(mode); } catch {}

    // Build VM and render (existing UI modules expect this shape)
    const vm = await vitals.buildHUDModel(latestGatewayDoc, mode);
    ui?.render?.(vm);

  }

  async function mount(root) {
    // 1) Scoped CSS for hub
    unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

    // 2) Inject DOM
    await injectView(root, new URL('./view.html', import.meta.url));

    // 3) Render UI
    ui = createHubUI(root, { getGateway: () => latestGatewayDoc });
    cleanup.push(() => { try { ui?.destroy?.(); } catch {} ui = null; });


    // Profile
    // Portrait tap -> Profile modal (canonical)
    const portrait = document.getElementById('portrait-img');
    if (portrait) {
      const onTap = () => openModalById('profile', { owner: 'hub' });
      portrait.addEventListener('click', onTap, { passive: true });
      cleanup.push(() => portrait.removeEventListener('click', onTap));
    }

    // Intent bridge (modal emits hub:intent)
    const onIntent = (e) => {
      const t = e?.detail?.type;
      if (t === 'openSettings') openModalById('settings', { owner: 'hub' });
      if (t === 'openHelp') openModalById('help', { owner: 'hub' });
    };
    window.addEventListener('hub:intent', onIntent);
    cleanup.push(() => window.removeEventListener('hub:intent', onIntent));

    // 3) Initial load (refresh + get)
    latestGatewayDoc = await gateway.refreshAndGet();
    await renderFromGateway('core');

    // 4) Wire view mode switcher (Current/Core vs Focus modes)
    const unwireMode = setupViewModeSwitcher(async (mode) => {
      // mode is expected to be 'core' | 'daily' | 'weekly'
      await renderFromGateway(mode);
    });
    cleanup.push(unwireMode);

    // 5) Wire status toggle UI
    const unwireStatus = wireVitalsStatusToggle();
    cleanup.push(unwireStatus);

    // 6) Wire shield breakdown overlay using gateway state
    const unwireShield = wireShieldBreakdown(getGatewayDoc);
    cleanup.push(unwireShield);


    // 7) Watch gateway for updates -> rerender in current mode
    // We read current mode from the engrave element dataset (set by viewMode module)
    unwatch = await gateway.watch(async (doc) => {
      latestGatewayDoc = doc;
      const engrave = document.getElementById('mode-engrave');
      const mode = engrave?.dataset?.mode || 'core';
      await renderFromGateway(mode);
    });

    // Optional tiny flourish (keep if you already had it in index.js)
    const mainBtn = document.getElementById('main-btn');
    if (mainBtn) mainBtn.classList.add('pulse');
  }

  function onHide() {
    // Keep behaviour: clear any mini slots if present
    const slot = document.getElementById('essence-mini');
    if (slot) slot.innerHTML = '';
  }

  function unmount() {
    try { if (unwatch) unwatch(); } catch {}
    cleanup.forEach(fn => { try { fn(); } catch {} });
    cleanup = [];
    if (unstyle) unstyle();
    unwatch = null;
    unstyle = null;
    latestGatewayDoc = null;
  }

  return { mount, onHide, unmount, getGatewayDoc };
}
