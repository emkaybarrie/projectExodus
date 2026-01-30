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
// WO-STAGE-EPISODES-V1: Episode system imports
import { createStageSignals, createTransactionSignal } from '../systems/stageSignals.js';
import { createEpisodeRunner } from '../systems/episodeRunner.js';

// Create Hub controller for integrated systems (autobattler, vitals sim)
const hubController = createHubController({
  actionBus,
  onStateChange: (state) => {
    // Broadcast state changes for parts that listen
    actionBus.emit('hub:stateChange', state);
  },
});
hubController.init();

// WO-STAGE-EPISODES-V1: Create Episode system
const stageSignals = createStageSignals({
  actionBus,
  onSignal: (signal) => {
    console.log(`[App] Signal processed: ${signal.id} (${signal.kind})`);
  },
});
stageSignals.init();

const episodeRunner = createEpisodeRunner({
  actionBus,
  onPhaseChange: (phase, episode, incident) => {
    console.log(`[App] Episode phase: ${phase}`);
  },
  onEpisodeComplete: (episode, incident) => {
    console.log(`[App] Episode complete: ${episode.id}`);
    // Apply vitals delta from episode resolution
    if (episode.resolution?.vitalsDelta && hubController) {
      const delta = episode.resolution.vitalsDelta;
      actionBus.emit('vitals:delta', {
        source: 'episode',
        reason: `tagged_${episode.resolution.choiceId}`,
        deltas: delta,
      });
    }
  },
});
episodeRunner.init();

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
  // WO-STAGE-EPISODES-V1: Episode system
  stageSignals,
  episodeRunner,
  // Helper to emit a demo transaction signal
  // WO-STAGE-EPISODES-V1: Updated to randomly select episode type
  // Categories map to: discretionary→COMBAT(autobattler), subscription→SOCIAL(choice), essential→TRAVERSAL(autobattler)
  emitDemoSignal: (amount, merchant, category) => {
    // Random defaults for variety
    const DEMO_CATEGORIES = ['discretionary', 'discretionary', 'subscription', 'essential']; // 50% combat, 25% choice, 25% traversal
    const DEMO_MERCHANTS = ['Coffee Shop', 'Streaming Service', 'Grocery Store', 'Restaurant', 'Online Purchase'];
    const DEMO_AMOUNTS = [12.50, 25.00, 49.99, 85.00, 150.00];

    const finalCategory = category || DEMO_CATEGORIES[Math.floor(Math.random() * DEMO_CATEGORIES.length)];
    const finalMerchant = merchant || `Demo ${DEMO_MERCHANTS[Math.floor(Math.random() * DEMO_MERCHANTS.length)]}`;
    const finalAmount = amount ?? DEMO_AMOUNTS[Math.floor(Math.random() * DEMO_AMOUNTS.length)];

    const signal = createTransactionSignal({
      amount: finalAmount,
      merchant: finalMerchant,
      category: finalCategory,
      sourceRef: 'demo',
    });
    stageSignals.ingest(signal);
    const modeHint = finalCategory === 'subscription' ? 'CHOICE' : 'AUTOBATTLER';
    console.log(`[App] Demo signal emitted: $${finalAmount} at ${finalMerchant} (category: ${finalCategory} → ${modeHint})`);
    return signal;
  },
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
