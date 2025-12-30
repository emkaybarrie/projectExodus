import './firestore.js';  // ensures the singleton is initialized early
import { initChrome } from './chrome.js';
import { initRouter, registerScreens, navigate, setLayout } from './router.js';
import { setState } from './state.js';
import { setGlobalDataMode, setFeatureDataMode } from './dataMode.js';

import { auth } from './firestore.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import '../screens/general/musicManager.js';

import { validateAll } from './validateContracts.js';
import '../ui/theme/applyTheme.js';

import { partRegistry } from '../ui/parts/registry.js';
import { validatePartRegistry } from '../ui/parts/validateRegistry.js';

import { registerCoreFeatures } from '../features/registerCoreFeatures.js';
import authFeature from '../features/auth/feature.js';
import gatewayFeature from '../features/gateway/feature.js';
import vitalsFeature from '../features/vitals/feature.js';
import profileFeature from '../features/profile/feature.js';
import eventsFeature from '../features/events/feature.js';

import { registerCoreModals } from '../modals/registerCoreModals.js';

import { registerJourneyModals } from '../journeys/registerJourneyModals.js';
import { journeys } from '../journeys/catalog.js';
import { runJourney } from '../journeys/runner.js';

function installFatalOverlay() {
  // Toggle with localStorage to avoid shipping noisy overlays accidentally
  const enabled = (() => {
    try { return localStorage.getItem('MYFI_SHOW_FATAL') === '1'; } catch { return false; }
  })();
  if (!enabled) return;

  const show = (label, err) => {
    try {
      const msg = err?.stack || err?.message || String(err);
      let host = document.getElementById('myfi-fatal-overlay');
      if (!host) {
        host = document.createElement('div');
        host.id = 'myfi-fatal-overlay';
        host.style.cssText = `
          position:fixed; inset:0; z-index:999999;
          background:rgba(0,0,0,.88); color:#fff;
          padding:16px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
          overflow:auto;
        `;
        document.body.appendChild(host);
      }
      host.innerHTML = `
        <div style="font-weight:900; font-size:16px; margin-bottom:10px;">MyFi runtime error</div>
        <div style="opacity:.9; margin-bottom:8px;">${label}</div>
        <pre style="white-space:pre-wrap; font-size:12px; line-height:1.35; opacity:.9;">${escapeHtml(msg)}</pre>
        <div style="margin-top:10px; opacity:.7; font-size:12px;">
          (Disable by setting localStorage.MYFI_SHOW_FATAL = "0")
        </div>
      `;
    } catch {}
  };

  window.addEventListener('error', (e) => show('window.error', e.error || e.message || e));
  window.addEventListener('unhandledrejection', (e) => show('unhandledrejection', e.reason || e));

  // Also expose a quick compat dump
  window.__MYFI_COMPAT__ = () => ({
    ua: navigator.userAgent,
    replaceAll: !!String.prototype.replaceAll,
    randomUUID: !!(globalThis.crypto && crypto.randomUUID),
    structuredClone: typeof globalThis.structuredClone === 'function',
    esModules: true
  });
}

function escapeHtml(s) {
  const str = String(s ?? '');
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}


// Register screens (dynamic import loaders)
registerScreens([
  { id: 'start',    loader: () => import('../screens/start/index.js') },
  { id: 'auth',     loader: () => import('../screens/auth/index.js') },
  { id: 'hub',      loader: () => import('../screens/hub/index.js') },
  { id: 'quests',   loader: () => import('../screens/quests/index.js') },
  { id: 'avatar',   loader: () => import('../screens/avatar/index.js') },
  { id: 'guidance', loader: () => import('../screens/guidance/index.js') },
  { id: 'badlands',    loader: () => import('../screens/badlands/index.js') }
]);

registerCoreFeatures();
registerCoreModals();
registerJourneyModals();

// Dev-only parity checks (won't throw, only logs)
validateAll({
  screens: [
    { id: 'start',    loader: () => import('../screens/start/index.js') },
    { id: 'auth',     loader: () => import('../screens/auth/index.js') },
    { id: 'hub',      loader: () => import('../screens/hub/index.js') },
    { id: 'quests',   loader: () => import('../screens/quests/index.js') },
    { id: 'avatar',   loader: () => import('../screens/avatar/index.js') },
    { id: 'guidance', loader: () => import('../screens/guidance/index.js') },
    { id: 'badlands',    loader: () => import('../screens/badlands/index.js') }
  ],
  features: [
    { id: 'auth', feature: authFeature },
    { id: 'gateway', feature: gatewayFeature },
    { id: 'vitals', feature: vitalsFeature },
    { id: 'profile', feature: profileFeature },
    { id: 'events', feature: eventsFeature }
  ],
  journeys: journeys.map(j => ({ id: j.id, journey: j })),
});

try {
  const { ok, errors } = validatePartRegistry(partRegistry);
  if (!ok) console.warn('[ui] part registry issues:\n- ' + errors.join('\n- '));
} catch (e) {
  console.warn('[ui] part registry validator failed', e);
}

function kickMusicOnce() {
  try { window.MyFiMusic?.play?.(); } catch {}
}
window.addEventListener('pointerdown', kickMusicOnce, { once: true, capture: true });

installFatalOverlay();
initChrome();
initRouter({ stageEl: document.getElementById('stage') });

onAuthStateChanged(auth, (user) => {
  if (user) {
    // You could check lastBuildVariant if you want.
    navigate('hub');
  } else {
    navigate('start'); // ensure we leave protected screens when signed out
  }
});

// Dashboard star layout
setLayout({
  center:  'hub',
  left:    'quests',
  right:   'avatar',
  up:      'guidance',
  down:    'badlands'
});

// Dev helper: run journeys from console (no UI yet, just convenient)
window.MyFiJourneys = {
  list: () => journeys.map(j => ({ id: j.id, title: j.title })),
  run: async (id) => {
    const j = journeys.find(x => x.id === id);
    if (!j) throw new Error(`Unknown journey: ${id}`);
    return runJourney(j);
  }
};

// Dev helper: data mode toggles (safe in prod; just exposes helpers)
window.MyFiData = {
  setGlobal: (mode) => {
    const ok = setGlobalDataMode(mode);
    console.log('[MyFiData] setGlobal', mode, ok);
    return ok;
  },
  setFeature: (featureId, mode) => {
    const ok = setFeatureDataMode(featureId, mode);
    console.log('[MyFiData] setFeature', featureId, mode, ok);
    return ok;
  }
};





