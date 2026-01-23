// app.js — Updated for I2-JourneyRunner-Phase1
// Adds: Journey runner, modal manager integration

import { createRouter } from './router.js';
import { createChrome } from './chrome.js';
import * as session from './session.js';
import { registerVMProvider } from './surfaceRuntime.js';
import { getHubDemoVM } from '../vm/hub-demo-vm.js';
import * as actionBus from './actionBus.js';
import * as modalManager from './modalManager.js';
import * as journeyRunner from '../journeys/journeyRunner.js';

// Register demo VM providers for surfaces
registerVMProvider('hub', getHubDemoVM);

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

router.start();

// Expose for debugging/testing
window.__MYFI_DEBUG__ = {
  actionBus,
  modalManager,
  journeyRunner,
  router,
};
