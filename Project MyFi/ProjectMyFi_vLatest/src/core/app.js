// app.js — Updated for HUB-04 Autobattler Integration
// Adds: Journey runner, modal manager, Hub controller with autobattler

import { createRouter } from './router.js';
import { createChrome } from './chrome.js';
import * as session from './session.js';
import { registerVMProvider } from './surfaceRuntime.js';
import { getHubDemoVM } from '../vm/hub-demo-vm.js';
import { getBadlandsDemoVM } from '../vm/badlands-demo-vm.js';
import * as actionBus from './actionBus.js';
import * as modalManager from './modalManager.js';
import * as journeyRunner from '../journeys/journeyRunner.js';
import { createHubController } from '../systems/hubController.js';
import { createSwipeNav } from './swipeNav.js';
import { ensureGlobalCSS } from './styleLoader.js';
// WO-STAGE-EPISODES-V1: Episode system imports
import { createStageSignals, createTransactionSignal } from '../systems/stageSignals.js';
import { createEpisodeRunner } from '../systems/episodeRunner.js';
// WO-S5: Scene Beat Log
import { createSceneBeatLog } from '../systems/sceneBeatLog.js';
// WO-BASELINE-COHERENCE: Distance driver and scene pacer
import { createDistanceDriver } from '../systems/distanceDriver.js';
import { createScenePacer } from '../systems/scenePacer.js';
// WO-WATCH-EPISODE-ROUTING: Episode clock and router
import { createEpisodeClock } from '../systems/episodeClock.js';
import { createEpisodeRouter } from '../systems/episodeRouter.js';
// WO-DEV-RENDER-BINDING: Dev render inspector
import { createDevRenderInspector } from '../systems/devRenderInspector.js';
// Keyboard navigation for cross-layout screens
import * as keyboardNav from './keyboardNav.js';
// WO-P0-A: First-run welcome overlay
import * as firstRun from './firstRun.js';

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

// WO-S5: Scene Beat Log for Recent Events
const sceneBeatLog = createSceneBeatLog({
  actionBus,
  maxBeats: 50,
});
sceneBeatLog.init();

// WO-BASELINE-COHERENCE: Distance driver for map progression
const distanceDriver = createDistanceDriver({
  actionBus,
  onDistanceChange: (distance01, details) => {
    console.log(`[App] Distance: ${(distance01 * 100).toFixed(1)}% (trajectory: ${(details.trajectory * 100).toFixed(1)}%, pressure: ${details.pressure.toFixed(2)})`);
  },
});
distanceDriver.init();

// WO-BASELINE-COHERENCE: Scene pacer for incident timing
const scenePacer = createScenePacer({
  actionBus,
  onReadyChange: (ready, reason) => {
    console.log(`[App] Scene pacer: ${ready ? 'ready' : 'blocked'} (${reason})`);
  },
});
scenePacer.init();

// WO-LIVE-TIME: Helper to get local time as dayT
function getLocalTimeDayT() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  return (hours * 3600 + minutes * 60 + seconds) / 86400;
}

// WO-WATCH-EPISODE-ROUTING: Episode clock (simulated time-of-day)
// WO-LIVE-TIME: Start at local time for live mode (default), 1x time scale
const episodeClock = createEpisodeClock({
  initialDayT: getLocalTimeDayT(), // Start at player's local time
  defaultTimeScale: 1, // REALTIME for live mode (default)
});

// WO-WATCH-EPISODE-ROUTING: Episode router (time→activity state mapping)
const episodeRouter = createEpisodeRouter({
  actionBus,
  episodeClock,
  onStateChange: (transition) => {
    console.log(`[App] Activity state: ${transition.to?.label || 'unknown'} (from ${transition.from?.label || 'none'})`);
  },
});
episodeRouter.init();

// WO-DEV-RENDER-BINDING: Dev render inspector (dev-only, gated by config)
const renderInspector = createDevRenderInspector({
  actionBus,
});
renderInspector.init();

// Register demo VM providers for surfaces
// Hub uses controller state if available, otherwise falls back to demo VM
registerVMProvider('hub', () => hubController.getState() || getHubDemoVM());
// Badlands entry screen VM
registerVMProvider('badlands', () => getBadlandsDemoVM());

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

// WO-S6: Always start on hub (demo mode - skip auth check)
if (!location.hash) {
  location.hash = '#hub';
}

const router = createRouter({
  hostEl: chrome.hostEl,
  defaultSurfaceId: 'hub', // WO-S6: Always default to hub (demo mode)
  ctx: {
    chrome,
    session,
  }
});

// Wire chrome footer nav to router
chrome.onNav((id) => router.navigate(id));

// WO-S6: Sync current route with chrome for compass highlighting
window.addEventListener('hashchange', () => {
  const route = location.hash.replace(/^#/, '') || 'hub';
  chrome.setCurrentRoute(route);
});
// Set initial route
chrome.setCurrentRoute(location.hash.replace(/^#/, '') || 'hub');

// WO-S6: Swipe navigation DISABLED - navigation via modal only
// ensureGlobalCSS('swipeNav', '../src/core/swipeNav.css');
// const swipeNav = createSwipeNav(chrome.hostEl, {
//   navigate: (surfaceId) => router.navigate(surfaceId),
//   getCurrentRoute: () => location.hash.replace(/^#/, '') || 'hub'
// });
// console.log('[App] Swipe navigation initialized');
console.log('[App] WO-S6: Swipe navigation disabled - use compass modal for navigation');

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

// Initialize keyboard navigation (arrow keys for cross-layout navigation)
keyboardNav.init({ actionBus });
console.log('[App] Keyboard navigation initialized - use arrow keys to navigate');

// Expose for debugging/testing BEFORE router starts
// (DevControlPanel needs this to be available at mount time)
window.__MYFI_DEBUG__ = {
  actionBus,
  modalManager,
  journeyRunner,
  router,
  hubController,
  // WO-P0-A: First-run state (use firstRun.resetFirstRun() to test again)
  firstRun,
  // WO-S6: swipeNav disabled - navigation via modal only
  swipeNav: null,
  // Keyboard navigation controller
  keyboardNav,
  // WO-STAGE-EPISODES-V1: Episode system
  stageSignals,
  episodeRunner,
  // WO-S5: Scene Beat Log
  sceneBeatLog,
  // WO-BASELINE-COHERENCE: Distance driver and scene pacer
  distanceDriver,
  scenePacer,
  // WO-WATCH-EPISODE-ROUTING: Episode clock and router
  episodeClock,
  episodeRouter,
  // WO-DEV-RENDER-BINDING: Render inspector
  renderInspector,
  // WO-LIVE-DEMO: Game mode accessor (getter returns current mode from chrome)
  get gameMode() { return chrome.getGameMode(); },
  setGameMode: (mode) => chrome.setGameMode(mode),
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

// HUB-G5: Enable DEV config button in chrome header
chrome.enableDevButtons();

// WO-TRANSACTION-MODAL-V1: Transaction modal setup
// Lazy-load TransactionModal when first opened
let transactionModalInstance = null;
let transactionModalHost = null;

async function showTransactionModal() {
  // Create host element if needed
  if (!transactionModalHost) {
    transactionModalHost = document.createElement('div');
    transactionModalHost.id = 'transaction-modal-host';
    document.body.appendChild(transactionModalHost);
  }

  // Lazy-load and mount modal if not already mounted
  if (!transactionModalInstance) {
    try {
      const module = await import('../parts/prefabs/TransactionModal/part.js');
      const mount = module.default;
      transactionModalInstance = await mount(transactionModalHost, {
        id: 'transactionModal',
        data: {},
        ctx: { emitter: actionBus },
      });
      console.log('[App] WO-TRANSACTION-MODAL-V1: Transaction modal mounted');
    } catch (e) {
      console.error('[App] Failed to load TransactionModal:', e);
      return;
    }
  }

  // Show the modal
  if (transactionModalInstance && transactionModalInstance.show) {
    transactionModalInstance.show();
  }
}

// Register the modal handler with chrome
chrome.setTransactionModalHandler(showTransactionModal);
console.log('[App] WO-TRANSACTION-MODAL-V1: Transaction modal handler registered');

router.start();

// WO-P0-A: First-run welcome overlay
// Shows once on first load, skippable, frames player as patron/influence
if (!firstRun.hasCompletedFirstRun()) {
  // Dynamically import and mount welcome overlay
  import('../parts/prefabs/WelcomeOverlay/part.js').then(async (module) => {
    const mount = module.default;
    const welcomeHost = document.createElement('div');
    welcomeHost.id = 'welcome-overlay-host';
    document.body.appendChild(welcomeHost);

    const welcomeOverlay = await mount(welcomeHost, {
      id: 'welcome',
      data: { autoShow: true },
      ctx: { emitter: actionBus },
    });

    // Clean up after dismiss
    const unsub = actionBus.subscribe('welcome:complete', () => {
      unsub();
      setTimeout(() => {
        welcomeOverlay.unmount();
        welcomeHost.remove();
      }, 500);
    }, 'app');

    console.log('[App] WO-P0-A: First-run welcome overlay mounted');
  }).catch((e) => {
    console.warn('[App] Failed to load welcome overlay:', e);
  });
}

// Start Hub controller when on hub surface
// WO-HUB-02: Mark as persistent (app-level subscriptions, not cleaned up per-surface)

// WO-WATCH-EPISODE-ROUTING: Episode clock update loop
let episodeClockIntervalId = null;
const EPISODE_CLOCK_TICK_MS = 100; // Update every 100ms for smooth time progression

function startEpisodeClock() {
  if (episodeClockIntervalId) return;

  let lastTime = Date.now();
  episodeClockIntervalId = setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000; // Convert to seconds
    lastTime = now;
    episodeClock.update(dt);
  }, EPISODE_CLOCK_TICK_MS);

  episodeRouter.start();
  console.log('[App] WO-WATCH: Episode clock and router started');
}

function stopEpisodeClock() {
  if (episodeClockIntervalId) {
    clearInterval(episodeClockIntervalId);
    episodeClockIntervalId = null;
  }
  episodeRouter.stop();
  console.log('[App] WO-WATCH: Episode clock and router stopped');
}

actionBus.subscribe('surface:mounted', ({ surfaceId }) => {
  if (surfaceId === 'hub') {
    hubController.start();
    // WO-BASELINE-COHERENCE: Start distance driver and scene pacer
    distanceDriver.start();
    scenePacer.start();
    // WO-WATCH-EPISODE-ROUTING: Start episode clock
    startEpisodeClock();
    console.log('[App] Hub controller started');
    console.log('[App] WO-BASELINE: Distance driver and scene pacer started');
  }
}, 'app', { persistent: true });

actionBus.subscribe('surface:unmounted', ({ surfaceId }) => {
  if (surfaceId === 'hub') {
    hubController.stop();
    // WO-BASELINE-COHERENCE: Stop distance driver and scene pacer
    distanceDriver.stop();
    scenePacer.stop();
    // WO-WATCH-EPISODE-ROUTING: Stop episode clock
    stopEpisodeClock();
    console.log('[App] Hub controller stopped');
    console.log('[App] WO-BASELINE: Distance driver and scene pacer stopped');
  }
}, 'app', { persistent: true });
