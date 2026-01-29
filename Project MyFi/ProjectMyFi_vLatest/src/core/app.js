// app.js — Updated for HUB-04 Autobattler Integration
// Adds: Journey runner, modal manager, Hub controller with autobattler

import { createRouter } from './router.js';
import { createChrome } from './chrome.js';
import * as session from './session.js';
import { registerVMProvider } from './surfaceRuntime.js';
import { getHubDemoVM } from '../vm/hub-demo-vm.js';
import * as actionBus from './actionBus.js';
import * as modalManager from './modalManager.js';
import * as journeyRunner from '../journeys/journeyRunner.js';
import { createHubController } from '../systems/hubController.js';
import { createSwipeNav } from './swipeNav.js';
import { ensureGlobalCSS } from './styleLoader.js';

// Create Hub controller for integrated systems (autobattler, vitals sim)
const hubController = createHubController({
  actionBus,
  onStateChange: (state) => {
    // Broadcast state changes for parts that listen
    actionBus.emit('hub:stateChange', state);
  },
});
hubController.init();

// Register demo VM providers for surfaces
// Hub uses controller state if available, otherwise falls back to demo VM
registerVMProvider('hub', () => hubController.getState() || getHubDemoVM());

function ensureAppRoot(){
  const el = document.getElementById('app');
  if (!el) throw new Error('#app not found');
  return el;
}

const appRoot = ensureAppRoot();

// Create persistent chrome (header/footer + surface mount host + modal host)
const chrome = createChrome(appRoot);

// Initialize modal manager with chrome modal host
modalManager.init(chrome.modalHostEl);

// Decide initial surface before router boots
if (!location.hash) {
  location.hash = session.isAuthed() ? '#hub' : '#start';
}

const router = createRouter({
  hostEl: chrome.hostEl,
  defaultSurfaceId: session.isAuthed() ? 'hub' : 'start',
  ctx: {
    chrome,
    session,
  }
});

// Wire chrome footer nav to router
chrome.onNav((id) => router.navigate(id));

// Initialize swipe navigation for cross-screen gestures
ensureGlobalCSS('swipeNav', '../src/core/swipeNav.css');
const swipeNav = createSwipeNav(chrome.hostEl, {
  navigate: (surfaceId) => router.navigate(surfaceId),
  getCurrentRoute: () => location.hash.replace(/^#/, '') || 'hub'
});
console.log('[App] Swipe navigation initialized');

// Initialize journey runner with context
journeyRunner.init({
  router,
  modalManager,
  actionBus,
});

// Load journeys and bind triggers
journeyRunner.loadJourneys().then(() => {
  journeyRunner.bindTriggers();
  console.log('[App] Journey runner ready');
}).catch((e) => {
  console.error('[App] Failed to initialize journey runner:', e);
});

// Expose for debugging/testing BEFORE router starts
// (DevControlPanel needs this to be available at mount time)
window.__MYFI_DEBUG__ = {
  actionBus,
  modalManager,
  journeyRunner,
  router,
  hubController,
  swipeNav,
};

// HUB-D4: Enable DEV spawn button in chrome header
chrome.enableDevSpawn();

router.start();

// Start Hub controller when on hub surface
actionBus.subscribe('surface:mounted', ({ surfaceId }) => {
  if (surfaceId === 'hub') {
    hubController.start();
    console.log('[App] Hub controller started');
  }
});

actionBus.subscribe('surface:unmounted', ({ surfaceId }) => {
  if (surfaceId === 'hub') {
    hubController.stop();
    console.log('[App] Hub controller stopped');
  }
});
