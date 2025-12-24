import './firestore.js';  // ensures the singleton is initialized early
import { initChrome } from './chrome.js';
import { initRouter, registerScreens, navigate, setLayout } from './router.js';
import { setState } from './state.js';

import { auth } from './firestore.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import '../../src/screens/general/musicManager.js';

import { validateAll } from './validateContracts.js';

import { registerCoreFeatures } from '../../src/features/registerCoreFeatures.js';
import gatewayFeature from '../../src/features/gateway/feature.js';
import vitalsFeature from '../../src/features/vitals/feature.js';
import profileFeature from '../../src/features/profile/feature.js';
import activityFeature from '../../src/features/activity/feature.js';

import { registerCoreModals } from '../../src/modals/registerCoreModals.js';

import { registerJourneyModals } from '../../src/journeys/registerJourneyModals.js';
import { journeys } from '../../src/journeys/catalog.js';
import { runJourney } from '../../src/journeys/runner.js';


// Register screens (dynamic import loaders)
registerScreens([
  { id: 'start',    loader: () => import('../../src/screens/start/index.js') },
  { id: 'auth',     loader: () => import('../../src/screens/auth/index.js') },
  { id: 'hub',      loader: () => import('../../src/screens/hub/index.js') },
  { id: 'quests',   loader: () => import('../../src/screens/quests/manager.js') },
  { id: 'avatar',   loader: () => import('../../src/screens/avatar/manager.js') },
  { id: 'guidance', loader: () => import('../../src/screens/guidance/manager.js') },
  { id: 'myana',    loader: () => import('../../src/screens/myana/manager.js') }
]);

registerCoreFeatures();
registerCoreModals();
registerJourneyModals();

// Dev-only parity checks (won't throw, only logs)
validateAll({
  screens: [
    { id: 'start',    loader: () => import('../../src/screens/start/index.js') },
    { id: 'auth',     loader: () => import('../../src/screens/auth/index.js') },
    { id: 'hub',      loader: () => import('../../src/screens/hub/index.js') },
    { id: 'quests',   loader: () => import('../../src/screens/quests/manager.js') },
    { id: 'avatar',   loader: () => import('../../src/screens/avatar/manager.js') },
    { id: 'guidance', loader: () => import('../../src/screens/guidance/manager.js') },
    { id: 'myana',    loader: () => import('../../src/screens/myana/manager.js') }
  ],
  features: [
    { id: 'gateway', feature: gatewayFeature },
    { id: 'vitals', feature: vitalsFeature },
    { id: 'profile', feature: profileFeature },
    { id: 'activity', feature: activityFeature }
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
  down:    'myana'
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




