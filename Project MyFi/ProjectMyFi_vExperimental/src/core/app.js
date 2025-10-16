import { initChrome } from './chrome.js';
import { initRouter, registerScreens, navigate, setLayout } from './router.js';
import { setState } from './state.js';

initChrome();
initRouter({ stageEl: document.getElementById('stage') });

registerScreens([
  { id: 'start',    loader: () => import('../screens/start/manager.js') },
  { id: 'auth',     loader: () => import('../screens/auth/manager.js') },
  { id: 'vitals',   loader: () => import('../screens/vitals/manager.js') },
  { id: 'quests',   loader: () => import('../screens/quests/manager.js') },
  { id: 'avatar',   loader: () => import('../screens/avatar/manager.js') },
  { id: 'myana',  loader: () => import('../screens/myana/manager.js') },
  { id: 'guidance', loader: () => import('../screens/guidance/manager.js') },
]);

// Dashboard star layout
setLayout({
  center:  'vitals',
  left:    'quests',
  right:   'avatar',
  up:      'guidance',
  down:    'myana'
});

// Boot to Start
navigate('start');

// Demo auth bus: swap to vitals (dashboard mode)
window.addEventListener('demo:login', async () => {
  setState({ user: { uid: 'dev-user', alias: 'Emkay' } });
  navigate('vitals');
});
