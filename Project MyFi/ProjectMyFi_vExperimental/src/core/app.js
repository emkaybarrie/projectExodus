import './firestore.js';  // ensures the singleton is initialized early
import { initChrome } from './chrome.js';
import { initRouter, registerScreens, navigate, setLayout } from './router.js';
import { setState } from './state.js';

import { auth } from './firestore.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import '../../src/screens/general/musicManager.js';

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

registerScreens([
  { id: 'start',    loader: () => import('../screens/start/index.js') },
  { id: 'auth',     loader: () => import('../screens/auth/index.js') },
  { id: 'hub',   loader: () => import('../screens/hub/index.js') },
  { id: 'quests',   loader: () => import('../screens/quests/manager.js') },
  { id: 'avatar',   loader: () => import('../screens/avatar/manager.js') },
  { id: 'myana',  loader: () => import('../screens/myana/manager.js') },
  { id: 'guidance', loader: () => import('../screens/guidance/manager.js') },
]);

// Dashboard star layout
setLayout({
  center:  'hub',
  left:    'quests',
  right:   'avatar',
  up:      'guidance',
  down:    'myana'
});

// Boot to Start
navigate('start');


