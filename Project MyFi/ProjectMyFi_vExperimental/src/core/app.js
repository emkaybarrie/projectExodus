import './firestore.js';  // ensures the singleton is initialized early
import { initChrome } from './chrome.js';
import { initRouter, registerScreens, navigate, setLayout } from './router.js';
import { setState } from './state.js';

import { auth } from './firestore.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import '../screens/general/musicManager.js';

import { validateAll } from './validateContracts.js';

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

import '../ui/theme/applyTheme.js';



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


function kickMusicOnce() {
  try { window.MyFiMusic?.play?.(); } catch {}
}
window.addEventListener('pointerdown', kickMusicOnce, { once: true, capture: true });


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




