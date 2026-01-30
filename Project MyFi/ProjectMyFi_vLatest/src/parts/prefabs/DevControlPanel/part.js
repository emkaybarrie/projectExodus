// DevControlPanel Part — HUB-14: DEV-only Hub Flow Control
// Provides deterministic encounter flow testing from the Hub UI
// VISIBLE ONLY IN DEV MODE (window.__MYFI_DEBUG__)

import { ensureGlobalCSS } from '../../../core/styleLoader.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

/**
 * HUB-15: Encounter state machine states
 */
const ENCOUNTER_STATES = {
  IDLE: 'idle',
  ACTIVE_AUTOBATTLER: 'active_autobattler',
  ACTIVE_TURN_BASED: 'active_turn_based',
  RESOLVED: 'resolved',
};

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // DEV-only gate: don't mount if not in dev mode
  if (typeof window === 'undefined' || !window.__MYFI_DEBUG__) {
    return {
      unmount() {},
      update() {},
    };
  }

  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.DevControlPanel', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-DevControlPanel DevControlPanel';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // HUB-15: Internal encounter state tracking
  const state = {
    encounterState: ENCOUNTER_STATES.IDLE,
    currentEncounter: null,
    autobattlerRunning: false,
  };

  // Bind button actions
  bindActions(root, state, ctx);

  // Subscribe to state changes from ActionBus
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:spawn', (encounter) => {
        state.encounterState = ENCOUNTER_STATES.ACTIVE_AUTOBATTLER;
        state.currentEncounter = encounter;
        render(root, state);
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', () => {
        state.encounterState = ENCOUNTER_STATES.RESOLVED;
        render(root, state);
        // Auto-transition to idle after brief delay
        setTimeout(() => {
          if (state.encounterState === ENCOUNTER_STATES.RESOLVED) {
            state.encounterState = ENCOUNTER_STATES.IDLE;
            state.currentEncounter = null;
            render(root, state);
          }
        }, 1500);
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:escalated', () => {
        state.encounterState = ENCOUNTER_STATES.ACTIVE_TURN_BASED;
        render(root, state);
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:deescalated', () => {
        // Return to autobattler if encounter still active
        if (state.currentEncounter) {
          state.encounterState = ENCOUNTER_STATES.ACTIVE_AUTOBATTLER;
        } else {
          state.encounterState = ENCOUNTER_STATES.IDLE;
        }
        render(root, state);
      })
    );
    unsubscribers.push(
      ctx.actionBus.subscribe('escalation:exit', () => {
        if (state.currentEncounter) {
          state.encounterState = ENCOUNTER_STATES.ACTIVE_AUTOBATTLER;
        } else {
          state.encounterState = ENCOUNTER_STATES.IDLE;
        }
        render(root, state);
      })
    );
    // HUB-15: Listen for clear from hubController
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:encounterCleared', () => {
        state.encounterState = ENCOUNTER_STATES.IDLE;
        state.currentEncounter = null;
        render(root, state);
      })
    );
  }

  // Initial render
  render(root, state);

  return {
    unmount() {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      Object.assign(state, newData);
      render(root, state);
    },
    // HUB-15: Expose state for debugging
    getEncounterState() {
      return state.encounterState;
    },
    getCurrentEncounter() {
      return state.currentEncounter;
    },
  };
}

function bindActions(root, state, ctx) {
  const buttons = root.querySelectorAll('[data-action]');

  buttons.forEach(btn => {
    const action = btn.dataset.action;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeAction(action, root, state, ctx);
    });
  });
}

function executeAction(action, root, state, ctx) {
  const hubController = window.__MYFI_DEBUG__?.hubController;
  const actionBus = ctx.actionBus || window.__MYFI_DEBUG__?.actionBus;

  if (!hubController) {
    console.warn('[DevControlPanel] hubController not available');
    return;
  }

  switch (action) {
    case 'spawn':
      // WO-STAGE-EPISODES-V1: Use Episode system for spawning (supports any episode type)
      const emitDemoSignal = window.__MYFI_DEBUG__?.emitDemoSignal;
      if (emitDemoSignal) {
        emitDemoSignal();
        console.log('[DevControlPanel] Spawned episode via Episode system');
      } else {
        // Fallback to legacy
        hubController.forceEncounter();
        console.log('[DevControlPanel] Spawned test encounter (legacy)');
      }
      break;

    case 'escalate':
      if (state.encounterState === ENCOUNTER_STATES.ACTIVE_AUTOBATTLER && state.currentEncounter) {
        if (actionBus) {
          actionBus.emit('encounter:escalate', {
            encounterId: state.currentEncounter.id,
            encounter: state.currentEncounter,
          }, 'DevControlPanel');
        }
        console.log('[DevControlPanel] Escalated to turn-based');
      } else {
        console.warn('[DevControlPanel] Cannot escalate: no active autobattler encounter');
      }
      break;

    case 'resolve':
      const autobattler = hubController.getAutobattler();
      if (autobattler && autobattler.forceResolve) {
        autobattler.forceResolve();
        console.log('[DevControlPanel] Force resolved encounter');
      }
      break;

    case 'clear':
      if (hubController.clearEncounter) {
        hubController.clearEncounter();
      }
      console.log('[DevControlPanel] Cleared to idle');
      break;

    case 'startAutobattler':
      hubController.start();
      state.autobattlerRunning = true;
      render(root, state);
      console.log('[DevControlPanel] Autobattler started');
      break;

    case 'stopAutobattler':
      hubController.stop();
      state.autobattlerRunning = false;
      render(root, state);
      console.log('[DevControlPanel] Autobattler stopped');
      break;

    case 'setWorldQuiet':
      if (actionBus) {
        actionBus.emit('dev:setWorldState', { worldState: 'quiet' }, 'DevControlPanel');
      }
      console.log('[DevControlPanel] World state: quiet');
      break;

    case 'setWorldPressure':
      if (actionBus) {
        actionBus.emit('dev:setWorldState', { worldState: 'pressure' }, 'DevControlPanel');
      }
      console.log('[DevControlPanel] World state: pressure');
      break;

    default:
      console.warn(`[DevControlPanel] Unknown action: ${action}`);
  }
}

function render(root, state) {
  // Update state indicator
  const stateEl = root.querySelector('[data-bind="encounterState"]');
  if (stateEl) {
    stateEl.textContent = state.encounterState.replace('_', ' ');
    stateEl.dataset.state = state.encounterState;
  }

  // Update info display
  const infoEl = root.querySelector('[data-bind="currentInfo"]');
  if (infoEl) {
    if (state.currentEncounter) {
      infoEl.textContent = state.currentEncounter.label || state.currentEncounter.type;
    } else {
      infoEl.textContent = 'No active encounter';
    }
  }

  // Simplified: Only spawn button, disabled when encounter active
  const spawnBtn = root.querySelector('[data-action="spawn"]');
  if (spawnBtn) {
    spawnBtn.disabled = state.encounterState !== ENCOUNTER_STATES.IDLE;
  }
}
