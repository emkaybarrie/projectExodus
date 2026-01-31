// HubController — Orchestrates Hub systems
// Wires up: Autobattler, Vitals Simulation, Escalation (Turn-Based Battle)
//
// HUB-04: Integrates autobattler with vitals
// HUB-05: Adds escalation layer integration
// HUB-15: Adds formal encounter state machine
// HUB-B1: Removed deprecated Wardwatch/EscalationOverlay refs

import { createAutobattler } from './autobattler.js';
import { createVitalsSimulation } from '../vm/hub-demo-vm.js';

// HUB-B8/E5: Encounter timer constants (canonical source)
// HUB-E5: Reduced from 60s to 30s
const ENCOUNTER_DURATION_MS = 30000;

/**
 * HUB-15: Encounter State Machine
 * States: idle → active_autobattler → active_turn_based → resolved → idle
 */
export const ENCOUNTER_STATES = {
  IDLE: 'idle',
  ACTIVE_AUTOBATTLER: 'active_autobattler',
  ACTIVE_TURN_BASED: 'active_turn_based',
  RESOLVED: 'resolved',
};

/**
 * HUB-22/23: Stage Modes (derived from encounter state)
 * BadlandsStage uses these for visual presentation
 */
export const STAGE_MODES = {
  WORLD: 'world',
  ENCOUNTER_AUTOBATTLER: 'encounter_autobattler',
  BATTLE_TURN_BASED: 'battle_turn_based',
};

/**
 * HUB-23: Maps encounter state to stage mode
 */
function deriveStageMode(encounterState) {
  switch (encounterState) {
    case ENCOUNTER_STATES.IDLE:
    case ENCOUNTER_STATES.RESOLVED:
      return STAGE_MODES.WORLD;
    case ENCOUNTER_STATES.ACTIVE_AUTOBATTLER:
      return STAGE_MODES.ENCOUNTER_AUTOBATTLER;
    case ENCOUNTER_STATES.ACTIVE_TURN_BASED:
      return STAGE_MODES.BATTLE_TURN_BASED;
    default:
      return STAGE_MODES.WORLD;
  }
}

/**
 * Creates a HubController that orchestrates all Hub systems
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event dispatch
 * @param {Function} options.onStateChange - Callback when Hub state changes
 */
export function createHubController(options = {}) {
  const { actionBus, onStateChange } = options;

  let vitalsSimulation = null;
  let autobattler = null;
  let currentState = null;
  let isEscalated = false;

  // HUB-15: Formal encounter state machine
  let encounterState = ENCOUNTER_STATES.IDLE;
  let currentEncounter = null;

  // HUB-23: Track previous stage mode for change detection
  let previousStageMode = STAGE_MODES.WORLD;

  // HUB-B8: Encounter timer state (canonical source)
  let encounterTimerId = null;
  let encounterStartedAt = null;

  // WO-HUB-01: VitalsLedger - persistent revision tracking for animation triggering
  let vitalsRevision = 0;
  let lastVitalsChangeMs = Date.now();

  // ─────────────────────────────────────────────────────────────────────────
  // HUB-B8: Encounter Timer Management
  // ─────────────────────────────────────────────────────────────────────────
  // AUTHORITY: hubController owns encounter timer.
  // BadlandsStage receives hub:timerTick events for display only.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * HUB-B8: Start encounter timer
   */
  function startEncounterTimer() {
    if (encounterTimerId) clearInterval(encounterTimerId);
    encounterStartedAt = Date.now();

    encounterTimerId = setInterval(() => {
      if (!encounterStartedAt || encounterState === ENCOUNTER_STATES.IDLE) {
        stopEncounterTimer();
        return;
      }

      const elapsed = Date.now() - encounterStartedAt;
      const remainingMs = Math.max(0, ENCOUNTER_DURATION_MS - elapsed);

      // Emit timer tick for UI updates
      if (actionBus) {
        actionBus.emit('hub:timerTick', {
          remainingMs,
          totalMs: ENCOUNTER_DURATION_MS,
          percent: (remainingMs / ENCOUNTER_DURATION_MS) * 100,
        });

        // C1-FIX/HUB-E5/E6: Emit autobattler tick for real-time combat simulation
        // Simulates ongoing combat during autobattler phase
        // HUB-E6: Enemy HP updates follow same pattern as player vitals (per-tick deltas)
        if (encounterState === ENCOUNTER_STATES.ACTIVE_AUTOBATTLER && currentEncounter) {
          const tickProgress = elapsed / ENCOUNTER_DURATION_MS;
          const baseDifficulty = currentEncounter.baseDifficulty || 1;

          // Enemy max health: 100 + difficulty * 30 (from BadlandsStage)
          const enemyMaxHealth = 100 + baseDifficulty * 30;

          // HUB-E5: With 30s (30 ticks), damage ~3-4% per tick to drain ~90-100% over encounter
          // Higher difficulty enemies take slightly less damage per tick
          const damagePercent = (3 + Math.random() * 1.5) / (1 + baseDifficulty * 0.15);
          const enemyDamage = Math.max(1, Math.floor(enemyMaxHealth * damagePercent / 100));

          // HUB-E6: Player damage follows same delta pattern as vitals
          // Damage varies: some ticks deal damage, some ticks heal/regen
          const playerDamageBase = 8 + baseDifficulty * 10;
          const roll = Math.random();
          let playerDelta = 0;

          if (roll > 0.65) {
            // ~35% chance: take damage
            playerDelta = -Math.floor(Math.random() * playerDamageBase);
          } else if (roll > 0.45) {
            // ~20% chance: small regen
            playerDelta = Math.floor(Math.random() * 5);
          }
          // ~45% chance: no change (stable combat)

          actionBus.emit('autobattler:tick', {
            tickProgress,
            remainingMs,
            enemyDamage, // Absolute HP damage dealt to enemy
            enemyDelta: -enemyDamage, // Delta format (matches vitals pattern)
            playerDelta, // Delta format (matches vitals pattern)
            encounter: currentEncounter,
          });

          // Apply player delta to vitals
          if (playerDelta !== 0) {
            handleVitalsImpact({ health: playerDelta, mana: 0, stamina: 0, essence: 0 });
          }
        }
      }

      // Auto-resolve at 0 (only in autobattler mode)
      if (remainingMs <= 0 && encounterState === ENCOUNTER_STATES.ACTIVE_AUTOBATTLER) {
        stopEncounterTimer();
        if (autobattler && autobattler.forceResolve) {
          autobattler.forceResolve();
        }
      }
    }, 1000);

    // Emit initial tick
    if (actionBus) {
      actionBus.emit('hub:timerTick', {
        remainingMs: ENCOUNTER_DURATION_MS,
        totalMs: ENCOUNTER_DURATION_MS,
        percent: 100,
      });
    }
  }

  /**
   * HUB-B8: Stop encounter timer
   */
  function stopEncounterTimer() {
    if (encounterTimerId) {
      clearInterval(encounterTimerId);
      encounterTimerId = null;
    }
    encounterStartedAt = null;
  }

  /**
   * HUB-23: Emit stage mode change if mode has changed
   */
  function emitStageModeChangeIfNeeded() {
    const newMode = deriveStageMode(encounterState);
    if (newMode !== previousStageMode) {
      previousStageMode = newMode;
      if (actionBus) {
        actionBus.emit('hub:stageModeChanged', {
          stageMode: newMode,
          previousMode: previousStageMode,
          encounter: currentEncounter,
          vitals: currentState?.vitalsHud?.vitals,
        });
      }
      console.log(`[HubController] Stage mode changed: ${newMode}`);
    }
  }

  /**
   * Initialize Hub systems
   */
  function init() {
    // Create vitals simulation
    vitalsSimulation = createVitalsSimulation((state) => {
      currentState = state;
      if (onStateChange) onStateChange(state);
      // HUB-25: Emit state change for real-time vitals binding across all parts
      if (actionBus) {
        actionBus.emit('hub:stateChange', state);
      }
    });

    // Create autobattler with integration callbacks
    autobattler = createAutobattler({
      actionBus,
      onEncounterSpawn: handleEncounterSpawn,
      onEncounterResolve: handleEncounterResolve,
      onVitalsImpact: handleVitalsImpact,
    });

    // Listen for events (actionBus uses 'subscribe' not 'on')
    // WO-HUB-02: Mark as persistent (controller-level subscriptions, not cleaned up per-surface)
    if (actionBus && actionBus.subscribe) {
      actionBus.subscribe('wardwatch:tick', handleWardwatchTick, 'hubController', { persistent: true });
      // HUB-05: Escalation events
      actionBus.subscribe('encounter:escalate', handleEscalate, 'hubController', { persistent: true });
      actionBus.subscribe('escalation:exit', handleDeescalate, 'hubController', { persistent: true });
      actionBus.subscribe('escalation:victory', handleEscalationVictory, 'hubController', { persistent: true });
      actionBus.subscribe('escalation:action', handleEscalationAction, 'hubController', { persistent: true });
      // HUB-F4/F5: Vitals regen and death reset events
      actionBus.subscribe('vitals:regen', handleVitalsRegen, 'hubController', { persistent: true });
      actionBus.subscribe('player:reset', handlePlayerReset, 'hubController', { persistent: true });
      // Combat tick events from BadlandsStage autobattler simulation
      actionBus.subscribe('combat:tick', handleCombatTick, 'hubController', { persistent: true });
    }
  }

  /**
   * WO-HUB-01: Handle combat tick from BadlandsStage autobattler simulation
   * Applies vitals impact (damage taken, skill costs) during active encounter
   * Uses explicit delta payload for proper tracking
   */
  function handleCombatTick(data) {
    if (encounterState !== ENCOUNTER_STATES.ACTIVE_AUTOBATTLER) return;

    const { vitalsImpact, actor, reason } = data;
    if (vitalsImpact) {
      applyVitalsDelta({
        source: 'combat',
        healthDelta: vitalsImpact.health || 0,
        manaDelta: vitalsImpact.mana || 0,
        staminaDelta: vitalsImpact.stamina || 0,
        essenceDelta: vitalsImpact.essence || 0,
        reason: reason || (actor === 'enemy' ? 'enemy_attack' : 'player_action'),
      });
    }
  }

  /**
   * Handle escalation request (HUB-05)
   * HUB-15: State transition: active_autobattler → active_turn_based
   */
  function handleEscalate(data) {
    // HUB-15: Only allow escalation from autobattler state
    if (encounterState !== ENCOUNTER_STATES.ACTIVE_AUTOBATTLER) {
      console.warn('[HubController] Cannot escalate: not in active_autobattler state');
      return;
    }

    console.log('[HubController] Escalating encounter:', data.encounter);

    isEscalated = true;
    encounterState = ENCOUNTER_STATES.ACTIVE_TURN_BASED;

    // Pause autobattler during escalation
    if (autobattler) {
      autobattler.stop();
    }

    // Get current encounter from autobattler or use provided
    const encounter = currentEncounter || autobattler?.getCurrentEncounter() || data.encounter;

    // HUB-24: EscalationOverlay visual usage deprecated — battle UI is now inline in BadlandsStage
    // The stage mode change (emitted below) will switch BadlandsStage to battle_turn_based mode
    // Legacy escalationOverlayRef call removed

    // Emit for UI coordination
    if (actionBus) {
      actionBus.emit('hub:escalated', { encounter, encounterState });
    }

    // HUB-23: Emit stage mode change
    emitStageModeChangeIfNeeded();
  }

  /**
   * Handle de-escalation (HUB-05)
   * HUB-15: State transition: active_turn_based → active_autobattler
   */
  function handleDeescalate(data) {
    console.log('[HubController] De-escalating, resuming autobattler');

    isEscalated = false;

    // HUB-15: Return to autobattler state if encounter still active
    if (currentEncounter) {
      encounterState = ENCOUNTER_STATES.ACTIVE_AUTOBATTLER;
    } else {
      encounterState = ENCOUNTER_STATES.IDLE;
    }

    // Resume autobattler
    if (autobattler) {
      autobattler.start();
    }

    // Emit for UI coordination
    if (actionBus) {
      actionBus.emit('hub:deescalated', { encounterState });
    }

    // HUB-23: Emit stage mode change
    emitStageModeChangeIfNeeded();
  }

  /**
   * Handle escalation victory (HUB-05)
   */
  function handleEscalationVictory(data) {
    console.log('[HubController] Escalation victory:', data);

    // Apply bonus rewards for manual victory
    const bonusImpact = {
      health: 20,
      mana: 30,
      stamina: 25,
      essence: 150,
    };

    handleVitalsImpact(bonusImpact);

    // Resolve the current encounter in autobattler
    if (autobattler) {
      autobattler.forceResolve();
    }
  }

  /**
   * Handle escalation action (HUB-05/HUB-25) - apply vitals cost and damage
   * HUB-25: Now also handles health damage from enemy counter-attacks
   */
  function handleEscalationAction(data) {
    if (!data.vitalsImpact) return;

    const impact = {
      health: data.vitalsImpact.health || 0, // HUB-25: Include enemy damage
      mana: -(data.vitalsImpact.mana || 0),
      stamina: -(data.vitalsImpact.stamina || 0),
      essence: 0,
    };

    handleVitalsImpact(impact);
  }

  /**
   * Handle encounter spawn from autobattler
   * HUB-15: State transition: idle → active_autobattler
   * HUB-B8: Start canonical timer
   * WO-HUB-01: Pause ambient vitals simulation (combat is now authority)
   */
  function handleEncounterSpawn(encounter) {
    console.log('[HubController] Encounter spawned:', encounter.label);

    // WO-HUB-01: Pause ambient vitals simulation - combat is now authority
    if (vitalsSimulation && vitalsSimulation.pause) {
      vitalsSimulation.pause();
    }

    // HUB-15: Update encounter state machine
    encounterState = ENCOUNTER_STATES.ACTIVE_AUTOBATTLER;
    currentEncounter = encounter;

    // HUB-B8: Start canonical timer
    startEncounterTimer();

    // Update encounter window state
    if (currentState) {
      currentState = {
        ...currentState,
        encounterWindow: {
          displayState: 'available',
          encounter: {
            id: encounter.id,
            type: encounter.type,
            summary: `${encounter.label} appears!`,
            severity: getSeverity(encounter.baseDifficulty),
          },
        },
        // HUB-15: Include encounter state in hub state
        encounterState,
      };
      if (onStateChange) onStateChange(currentState);
    }

    // HUB-23: Emit stage mode change
    emitStageModeChangeIfNeeded();
  }

  /**
   * Handle encounter resolution from autobattler
   * HUB-15: State transition: active_* → resolved → idle
   * HUB-B8: Stop canonical timer
   * WO-HUB-01: Resume ambient vitals simulation
   */
  function handleEncounterResolve(outcome) {
    console.log('[HubController] Encounter resolved:', outcome.summary);

    // HUB-B8: Stop canonical timer
    stopEncounterTimer();

    // WO-HUB-01: Resume ambient vitals simulation
    if (vitalsSimulation && vitalsSimulation.resume) {
      vitalsSimulation.resume();
    }

    // HUB-15: Transition to resolved state
    encounterState = ENCOUNTER_STATES.RESOLVED;

    // Update encounter window back to idle
    if (currentState) {
      currentState = {
        ...currentState,
        encounterWindow: {
          displayState: 'idle',
          encounter: null,
        },
        encounterState,
      };
      if (onStateChange) onStateChange(currentState);
    }

    // HUB-23: Emit stage mode change (resolved → world)
    emitStageModeChangeIfNeeded();

    // HUB-15: Auto-transition to idle after brief delay
    setTimeout(() => {
      if (encounterState === ENCOUNTER_STATES.RESOLVED) {
        encounterState = ENCOUNTER_STATES.IDLE;
        currentEncounter = null;
        if (currentState) {
          currentState = { ...currentState, encounterState };
          if (onStateChange) onStateChange(currentState);
        }
        if (actionBus) {
          actionBus.emit('hub:encounterCleared', { encounterState });
        }
        // HUB-23: Emit stage mode change (idle)
        emitStageModeChangeIfNeeded();
      }
    }, 1500);
  }

  /**
   * WO-HUB-01: VitalsLedger - Canonical apply function for all vital changes
   * @param {Object} params
   * @param {string} params.source - 'combat' | 'ambient' | 'reward' | 'regen'
   * @param {number} params.healthDelta - Health change
   * @param {number} params.staminaDelta - Stamina change
   * @param {number} params.manaDelta - Mana change
   * @param {number} params.essenceDelta - Essence change
   * @param {string} params.reason - Descriptive reason for the change
   */
  function applyVitalsDelta({ source, healthDelta = 0, staminaDelta = 0, manaDelta = 0, essenceDelta = 0, reason = '' }) {
    if (!currentState || !currentState.vitalsHud) return;

    const vitals = currentState.vitalsHud.vitals;
    const now = Date.now();

    // Track previous values for ghost animation
    const prevHealth = vitals.health.current;
    const prevMana = vitals.mana.current;
    const prevStamina = vitals.stamina.current;
    const prevEssence = vitals.essence.current;

    // Apply changes with bounds
    const newVitals = {
      health: {
        ...vitals.health,
        current: Math.max(0, Math.min(vitals.health.max, vitals.health.current + healthDelta)),
        delta: healthDelta,
        prevValue: prevHealth, // WO-HUB-01: For ghost animation
      },
      mana: {
        ...vitals.mana,
        current: Math.max(0, Math.min(vitals.mana.max, vitals.mana.current + manaDelta)),
        delta: manaDelta,
        prevValue: prevMana,
      },
      stamina: {
        ...vitals.stamina,
        current: Math.max(0, Math.min(vitals.stamina.max, vitals.stamina.current + staminaDelta)),
        delta: staminaDelta,
        prevValue: prevStamina,
      },
      essence: {
        ...vitals.essence,
        current: vitals.essence.current + essenceDelta,
        accrual: essenceDelta,
        prevValue: prevEssence,
      },
    };

    // Increment revision for animation triggering
    vitalsRevision++;
    lastVitalsChangeMs = now;

    currentState = {
      ...currentState,
      vitalsHud: {
        ...currentState.vitalsHud,
        vitals: newVitals,
        vitalsRevision, // WO-HUB-01: Persistent revision for animation sync
        lastChangeMs: now,
        lastChangeSource: source,
        lastChangeReason: reason,
      },
    };

    if (onStateChange) onStateChange(currentState);

    // Emit state change with vitals delta event for animation
    if (actionBus) {
      actionBus.emit('hub:stateChange', currentState);
      // WO-HUB-01: Emit dedicated vitals delta event for ghost animation
      actionBus.emit('vitals:delta', {
        source,
        reason,
        revision: vitalsRevision,
        atMs: now,
        deltas: { health: healthDelta, mana: manaDelta, stamina: staminaDelta, essence: essenceDelta },
        previous: { health: prevHealth, mana: prevMana, stamina: prevStamina, essence: prevEssence },
        current: {
          health: newVitals.health.current,
          mana: newVitals.mana.current,
          stamina: newVitals.stamina.current,
          essence: newVitals.essence.current,
        },
      });
    }

    console.log(`[HubController] Vitals delta applied (rev ${vitalsRevision}):`, { source, reason, healthDelta, manaDelta, staminaDelta, essenceDelta });
  }

  /**
   * Handle vitals impact from autobattler (legacy wrapper using new VitalsLedger)
   */
  function handleVitalsImpact(impact, source = 'combat', reason = 'encounter') {
    applyVitalsDelta({
      source,
      healthDelta: impact.health || 0,
      manaDelta: impact.mana || 0,
      staminaDelta: impact.stamina || 0,
      essenceDelta: impact.essence || 0,
      reason,
    });
  }

  /**
   * Handle wardwatch tick events
   */
  function handleWardwatchTick(data) {
    // Could use this to adjust autobattler behavior based on world state
    // e.g., more spawns at night, during dangerous states
  }

  /**
   * HUB-F4: Handle vitals regen from BadlandsStage
   * Updates canonical vitals state to match regen applied in world mode
   */
  function handleVitalsRegen(data) {
    if (!currentState || !currentState.vitalsHud) return;

    const vitals = currentState.vitalsHud.vitals;

    // Only apply regen if we're in idle state (world mode)
    if (encounterState !== ENCOUNTER_STATES.IDLE) {
      console.log('[HubController] Ignoring regen: not in idle state');
      return;
    }

    const newVitals = {
      health: {
        ...vitals.health,
        current: Math.min(vitals.health.max, data.health || vitals.health.current),
        delta: 0,
      },
      mana: {
        ...vitals.mana,
        current: Math.min(vitals.mana.max, data.mana || vitals.mana.current),
        delta: 0,
      },
      stamina: {
        ...vitals.stamina,
        current: Math.min(vitals.stamina.max, data.stamina || vitals.stamina.current),
        delta: 0,
      },
      // HUB-F4: Essence does NOT regenerate
      essence: vitals.essence,
    };

    currentState = {
      ...currentState,
      vitalsHud: {
        ...currentState.vitalsHud,
        vitals: newVitals,
      },
    };

    if (onStateChange) onStateChange(currentState);
  }

  /**
   * HUB-F5: Handle player reset (death and return to city)
   * Resets vitals to full and clears any active encounter
   */
  function handlePlayerReset(data) {
    console.log('[HubController] Player reset requested');

    // Stop any active encounter timer
    stopEncounterTimer();

    // Reset encounter state
    encounterState = ENCOUNTER_STATES.IDLE;
    currentEncounter = null;
    isEscalated = false;

    // Reset vitals to full (except essence which doesn't change per HUB-F4)
    if (currentState && currentState.vitalsHud) {
      const vitals = currentState.vitalsHud.vitals;

      const newVitals = {
        health: {
          ...vitals.health,
          current: vitals.health.max,
          delta: 0,
        },
        mana: {
          ...vitals.mana,
          current: vitals.mana.max,
          delta: 0,
        },
        stamina: {
          ...vitals.stamina,
          current: vitals.stamina.max,
          delta: 0,
        },
        // HUB-F4: Essence doesn't change on reset
        essence: vitals.essence,
      };

      currentState = {
        ...currentState,
        vitalsHud: {
          ...currentState.vitalsHud,
          vitals: newVitals,
        },
        encounterWindow: {
          displayState: 'idle',
          encounter: null,
        },
        encounterState,
      };

      if (onStateChange) onStateChange(currentState);
      if (actionBus) {
        actionBus.emit('hub:stateChange', currentState);
        actionBus.emit('hub:encounterCleared', { encounterState });
        // Emit stage mode change to world
        emitStageModeChangeIfNeeded();
      }
    }

    // Resume autobattler if it was stopped
    if (autobattler) {
      autobattler.start();
    }
  }

  /**
   * Map difficulty to severity
   */
  function getSeverity(difficulty) {
    if (difficulty === 0) return 'trivial';
    if (difficulty === 1) return 'minor';
    if (difficulty === 2) return 'moderate';
    return 'severe';
  }

  return {
    /**
     * Initialize the controller
     */
    init,

    /**
     * Start all Hub systems
     */
    start() {
      if (vitalsSimulation) vitalsSimulation.start();
      if (autobattler) autobattler.start();
    },

    /**
     * Stop all Hub systems
     */
    stop() {
      if (vitalsSimulation) vitalsSimulation.stop();
      if (autobattler) autobattler.stop();
    },

    /**
     * Check if currently escalated (HUB-05)
     */
    isEscalated() {
      return isEscalated;
    },

    /**
     * Get current state
     */
    getState() {
      return currentState;
    },

    /**
     * Get autobattler instance
     */
    getAutobattler() {
      return autobattler;
    },

    /**
     * Get vitals simulation instance
     */
    getVitalsSimulation() {
      return vitalsSimulation;
    },

    /**
     * Force spawn an encounter (for testing)
     */
    forceEncounter(type) {
      if (autobattler) {
        return autobattler.forceSpawn(type);
      }
    },

    /**
     * HUB-15: Get current encounter state machine state
     */
    getEncounterState() {
      return encounterState;
    },

    /**
     * HUB-15: Get current encounter object
     */
    getCurrentEncounter() {
      return currentEncounter;
    },

    /**
     * HUB-15: Force clear encounter (return to idle)
     */
    clearEncounter() {
      encounterState = ENCOUNTER_STATES.IDLE;
      currentEncounter = null;
      isEscalated = false;

      if (currentState) {
        currentState = {
          ...currentState,
          encounterWindow: {
            displayState: 'idle',
            encounter: null,
          },
          encounterState,
        };
        if (onStateChange) onStateChange(currentState);
      }

      if (actionBus) {
        actionBus.emit('hub:encounterCleared', { encounterState });
      }

      // HUB-23: Emit stage mode change
      emitStageModeChangeIfNeeded();

      console.log('[HubController] Encounter cleared, returned to idle');
    },

    /**
     * HUB-23: Get current stage mode (derived from encounter state)
     */
    getStageMode() {
      return deriveStageMode(encounterState);
    },

    /**
     * HUB-15: Get full encounter state for debugging
     */
    getEncounterDebugState() {
      return {
        encounterState,
        currentEncounter,
        isEscalated,
        autobattlerRunning: autobattler ? !!autobattler._timerId : false,
      };
    },
  };
}

export default { createHubController, ENCOUNTER_STATES, STAGE_MODES };
