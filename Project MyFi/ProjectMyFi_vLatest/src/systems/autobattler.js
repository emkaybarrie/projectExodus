// Autobattler System — First-Contact Encounter Resolution
// HUB-04: Autobattler — Encounter Resolution
//
// Handles automatic encounter spawning and resolution within Wardwatch.
// Encounters resolve automatically without player input.
// Outcomes affect vitals.

/**
 * Encounter types with spawn weights and resolution parameters
 */
const ENCOUNTER_TYPES = [
  {
    type: 'wraith',
    label: 'Restless Wraith',
    icon: '&#128128;', // Skull
    spawnWeight: 25,
    baseDifficulty: 1,
    rewards: { essence: 50, healthRegen: 10 },
    risks: { healthDrain: 20, manaDrain: 10 },
  },
  {
    type: 'wolf',
    label: 'Dire Wolf',
    icon: '&#128058;', // Wolf
    spawnWeight: 30,
    baseDifficulty: 2,
    rewards: { essence: 75, staminaRegen: 15 },
    risks: { healthDrain: 35, staminaDrain: 20 },
  },
  {
    type: 'cache',
    label: 'Ancient Treasure',
    icon: '&#128176;', // Money bag (treasure)
    spawnWeight: 12,
    baseDifficulty: 0,
    rewards: { essence: 100, manaRegen: 25 },
    risks: { healthDrain: 0, manaDrain: 0 },
  },
  {
    type: 'spider',
    label: 'Giant Spider',
    icon: '&#128375;', // Spider
    spawnWeight: 20,
    baseDifficulty: 2,
    rewards: { essence: 80, healthRegen: 0 },
    risks: { healthDrain: 40, staminaDrain: 15 },
  },
  {
    type: 'drake',
    label: 'Wyrm Drake',
    icon: '&#128009;', // Dragon
    spawnWeight: 8,
    baseDifficulty: 4,
    rewards: { essence: 200, healthRegen: 30 },
    risks: { healthDrain: 70, staminaDrain: 40 },
  },
  {
    type: 'ogre',
    label: 'Cave Ogre',
    icon: '&#128121;', // Ogre
    spawnWeight: 15,
    baseDifficulty: 3,
    rewards: { essence: 120, staminaRegen: 20 },
    risks: { healthDrain: 55, staminaDrain: 30 },
  },
  {
    type: 'anomaly',
    label: 'Arcane Rift',
    icon: '&#10024;', // Sparkles (magic)
    spawnWeight: 10,
    baseDifficulty: 2,
    rewards: { essence: 150, manaRegen: 50 },
    risks: { healthDrain: 15, manaDrain: 35 },
  },
];

/**
 * Creates an Autobattler instance
 * @param {Object} options - Configuration options
 * @param {Function} options.onEncounterSpawn - Callback when encounter spawns
 * @param {Function} options.onEncounterResolve - Callback when encounter resolves
 * @param {Function} options.onVitalsImpact - Callback with vitals changes
 * @param {Object} options.actionBus - Optional ActionBus for event dispatch
 */
export function createAutobattler(options = {}) {
  const {
    onEncounterSpawn,
    onEncounterResolve,
    onVitalsImpact,
    actionBus,
  } = options;

  let currentEncounter = null;
  let encounterCount = 0;
  let unsubscribeSpawn = null;
  let unsubscribeResolve = null;

  // WO-STAGE-EPISODES-V1: Subscribe to autobattler:spawn from Episode system
  // This allows the Episode system to trigger combat encounters
  // WO-HUB-02: Mark as persistent (system-level subscriptions, not cleaned up per-surface)
  if (actionBus && actionBus.subscribe) {
    unsubscribeSpawn = actionBus.subscribe('autobattler:spawn', (encounter) => {
      // Only accept if we don't have an active encounter
      // and this wasn't spawned by us (check for _episodeId marker)
      if (!currentEncounter && encounter._episodeId) {
        console.log(`[Autobattler] Received encounter from Episode system: ${encounter.id}`);
        encounterCount++;
        currentEncounter = {
          ...encounter,
          spawnedAt: Date.now(),
          resolved: false,
          _fromEpisode: true, // Mark as Episode-sourced for proper cleanup
        };
        if (onEncounterSpawn) {
          onEncounterSpawn(currentEncounter);
        }
      }
    }, 'autobattler', { persistent: true });

    // WO-STAGE-EPISODES-V1: Listen for autobattler:resolve to clear Episode-sourced encounters immediately
    // This prevents race conditions with stageSignals queue resumption
    unsubscribeResolve = actionBus.subscribe('autobattler:resolve', (outcome) => {
      if (currentEncounter && currentEncounter._fromEpisode) {
        console.log(`[Autobattler] Episode encounter resolved, clearing immediately`);
        currentEncounter = null;
      }
    }, 'autobattler', { persistent: true });
  }

  // WO-NARRATIVE-CONSOLIDATION: Removed legacy random spawn loop
  // Autobattler no longer spawns encounters directly - it only RESPONDS to
  // autobattler:spawn events from the Episode system.
  //
  // Event emission sources (consolidated):
  // - Live mode: Player via Transaction Modal, Bank via TrueLayer integration
  // - Demo mode: Narrative Engine (chrome.js auto-transaction loop)
  //
  // Flow: Transaction → stageSignals.ingest() → Incident Factory → Episode Runner
  //       → autobattler:spawn event → Autobattler responds

  /**
   * Spawns a random encounter based on weighted types
   */
  function spawnEncounter() {
    const totalWeight = ENCOUNTER_TYPES.reduce((sum, e) => sum + e.spawnWeight, 0);
    let roll = Math.random() * totalWeight;

    let selectedType = ENCOUNTER_TYPES[0];
    for (const type of ENCOUNTER_TYPES) {
      roll -= type.spawnWeight;
      if (roll <= 0) {
        selectedType = type;
        break;
      }
    }

    encounterCount++;
    currentEncounter = {
      id: `encounter-${Date.now()}-${encounterCount}`,
      ...selectedType,
      spawnedAt: Date.now(),
      resolved: false,
    };

    // Notify spawn
    if (onEncounterSpawn) {
      onEncounterSpawn(currentEncounter);
    }
    if (actionBus) {
      actionBus.emit('autobattler:spawn', currentEncounter);
    }

    // NOTE: Auto-resolution is handled by BadlandsStage's 60s timer
    // The stage calls forceResolve() when timer expires and player is in autobattler mode
    // This ensures turn-based mode is respected (timer paused during battle)
  }

  /**
   * Resolves the current encounter automatically
   */
  function resolveEncounter() {
    if (!currentEncounter) return;

    const encounter = currentEncounter;

    // Calculate outcome based on difficulty (simplified)
    // Higher difficulty = more variance in outcome
    const successRoll = Math.random();
    const successThreshold = 0.3 + (0.1 * encounter.baseDifficulty);
    const isVictory = successRoll > successThreshold;

    // Calculate vitals impact
    const vitalsImpact = calculateVitalsImpact(encounter, isVictory);

    const outcome = {
      encounterId: encounter.id,
      encounterType: encounter.type,
      encounterLabel: encounter.label,
      isVictory,
      summary: isVictory
        ? `Overcame ${encounter.label}!`
        : `Survived ${encounter.label}...`,
      vitalsImpact,
      timestamp: Date.now(),
    };

    encounter.resolved = true;

    // Notify resolution
    if (onEncounterResolve) {
      onEncounterResolve(outcome);
    }
    if (onVitalsImpact) {
      onVitalsImpact(vitalsImpact);
    }
    if (actionBus) {
      actionBus.emit('autobattler:resolve', outcome);
    }

    // Clear encounter after brief delay
    setTimeout(() => {
      currentEncounter = null;
    }, 1000);

    return outcome;
  }

  /**
   * Calculates vitals impact based on encounter and outcome
   * WO-STAGE-EPISODES-V1: Added null checks for Episode system encounters
   */
  function calculateVitalsImpact(encounter, isVictory) {
    const impact = {
      health: 0,
      mana: 0,
      stamina: 0,
      essence: 0,
    };

    // Episode system encounters may not have rewards/risks - use defaults based on difficulty
    const rewards = encounter.rewards || {
      essence: 50 + (encounter.baseDifficulty || 1) * 25,
      healthRegen: 10,
      manaRegen: 10,
      staminaRegen: 10,
    };
    const risks = encounter.risks || {
      healthDrain: 15 + (encounter.baseDifficulty || 1) * 10,
      manaDrain: 10,
      staminaDrain: 15,
    };

    if (isVictory) {
      // Apply rewards
      impact.essence = rewards.essence || 0;
      impact.health = rewards.healthRegen || 0;
      impact.mana = rewards.manaRegen || 0;
      impact.stamina = rewards.staminaRegen || 0;
    } else {
      // Apply reduced rewards but also risks
      impact.essence = Math.floor((rewards.essence || 0) * 0.3);
      impact.health = -(risks.healthDrain || 0);
      impact.mana = -(risks.manaDrain || 0);
      impact.stamina = -(risks.staminaDrain || 0);
    }

    return impact;
  }

  /**
   * Force spawn an encounter (for testing/escalation)
   */
  function forceSpawn(typeOverride = null) {
    if (currentEncounter) {
      resolveEncounter(); // Resolve current first
    }

    if (typeOverride) {
      const type = ENCOUNTER_TYPES.find(t => t.type === typeOverride);
      if (type) {
        encounterCount++;
        currentEncounter = {
          id: `encounter-${Date.now()}-${encounterCount}`,
          ...type,
          spawnedAt: Date.now(),
          resolved: false,
        };

        if (onEncounterSpawn) onEncounterSpawn(currentEncounter);
        if (actionBus) actionBus.emit('autobattler:spawn', currentEncounter);

        // Auto-resolution handled by BadlandsStage timer
        return currentEncounter;
      }
    }

    spawnEncounter();
    return currentEncounter;
  }

  return {
    /**
     * Start the autobattler (subscribes to Episode system events)
     * WO-NARRATIVE-CONSOLIDATION: No longer runs spawn loop - only responds to events
     */
    start() {
      // No-op: Subscriptions are set up in constructor
      // Autobattler responds to autobattler:spawn events from Episode system
      console.log('[Autobattler] Started (event-driven mode)');
    },

    /**
     * Stop the autobattler
     */
    stop() {
      // WO-STAGE-EPISODES-V1: Cleanup subscriptions
      if (unsubscribeSpawn) {
        unsubscribeSpawn();
        unsubscribeSpawn = null;
      }
      if (unsubscribeResolve) {
        unsubscribeResolve();
        unsubscribeResolve = null;
      }
      console.log('[Autobattler] Stopped');
    },

    /**
     * Get current encounter if any
     */
    getCurrentEncounter() {
      return currentEncounter;
    },

    /**
     * Force spawn an encounter
     */
    forceSpawn,

    /**
     * Force resolve current encounter
     */
    forceResolve() {
      return resolveEncounter();
    },

    /**
     * Get encounter count
     */
    getEncounterCount() {
      return encounterCount;
    },

    /**
     * Get available encounter types
     */
    getEncounterTypes() {
      return ENCOUNTER_TYPES.map(t => ({ type: t.type, label: t.label, icon: t.icon }));
    },
  };
}

export default { createAutobattler };
