// hub-demo-vm.js — Demo view model providing contract-compliant mock data
// Part of I1-Hub-Phase1-Scaffold
//
// Data shapes conform to:
// - STATUSBAR_CONTRACT.md: StatusBarInput
// - VITALSHUD_CONTRACT.md: VitalsHUDInput
// - ENCOUNTERWINDOW_CONTRACT.md: EncounterWindowInput
// - PLAYERCORE_CONTRACT.md: PlayerCoreInput
// - WARDWATCH_CONTRACT.md: WardwatchInput

/**
 * Returns demo VM data for the Hub surface.
 * Keys match slot IDs in hub/surface.json.
 */
export function getHubDemoVM() {
  return {
    // StatusBar slot data (STATUSBAR_CONTRACT.md)
    statusBar: {
      mode: 'unverified', // 'verified' | 'unverified'
      payCycle: {
        dayOfCycle: 5,
        daysRemaining: 9,
        // label: 'Pay Cycle' // optional
      },
    },

    // PlayerCore slot data (PLAYERCORE_CONTRACT.md)
    // WO-S9: Updated with alias vs class distinction
    playerCore: {
      name: 'Azakai',  // Player alias (left side of header)
      title: 'of the Badlands',  // Guild flavour text
      // WO-S9: Class and archetype for colour coding
      // Archetypes map to dominant vital: health=warrior, mana=mage, stamina=rogue
      playerClass: 'WANDERER',
      archetype: 'earth',  // fire, water, earth, air, void (earth = balanced/neutral)
      guildText: 'of the Badlands',
      pressure: 'balanced', // 'ahead' | 'behind' | 'balanced'
      momentum: 'steady',   // 'rising' | 'falling' | 'steady'
      effects: [],
      // Asset path for illustrated portrait (relative to index.html in public/)
      portraitUrl: '../assets/art/portraits/player.png',
    },

    // Wardwatch slot data (WARDWATCH_CONTRACT.md)
    wardwatch: {
      avatarPosition: { x: 50, y: 60 },
      worldState: 'quiet', // 'quiet' | 'stirring' | 'active' | 'dangerous'
      timeOfDay: 'day',    // 'day' | 'dusk' | 'night'
      lastActivity: 'Watching the Badlands...',
      encounter: null,
    },

    // BadlandsStage slot data
    badlandsStage: {
      stageMode: 'world', // 'world' | 'encounter_autobattler'
      // Asset path for stage background (relative to index.html in public/)
      // Use different images for different states:
      //   - wardwatch-idle.png for peaceful state
      //   - wardwatch-combat.png for encounter state
      stageBgUrl: '../assets/art/stages/wardwatch-idle.png',
      currentEncounter: null,
    },

    // VitalsHUD slot data (VITALSHUD_CONTRACT.md)
    vitalsHud: {
      vitals: {
        health: {
          current: 450,
          max: 1000,
          delta: -50, // optional: change since last update
        },
        mana: {
          current: 200,
          max: 500,
          delta: 0,
        },
        stamina: {
          current: 320,
          max: 400,
          delta: -30,
        },
        essence: {
          current: 1250,
          softCap: 5000, // advisory display metadata
          accrual: 12.5, // optional: rate of accrual
        },
      },
      viewMode: 'daily', // 'daily' | 'weekly'
      payCycle: {
        anchor: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
        dayOfCycle: 5,
        daysRemaining: 9,
      },
    },

    // EncounterWindow slot data (ENCOUNTERWINDOW_CONTRACT.md)
    encounterWindow: {
      displayState: 'idle', // 'idle' | 'available' | 'observing'
      encounter: null, // EncounterStub | null
    },
  };
}

/**
 * Returns demo VM with an active encounter (for testing available/observing states)
 */
export function getHubDemoVMWithEncounter() {
  const base = getHubDemoVM();

  return {
    ...base,
    encounterWindow: {
      displayState: 'available',
      encounter: {
        id: 'demo-encounter-001',
        type: 'spending',
        summary: 'A wild subscription charge appears!',
        severity: 'moderate',
      },
    },
  };
}

/**
 * Returns demo VM with verified mode (for testing verified state)
 */
export function getHubDemoVMVerified() {
  const base = getHubDemoVM();

  return {
    ...base,
    statusBar: {
      ...base.statusBar,
      mode: 'verified',
    },
    vitalsHud: {
      ...base.vitalsHud,
      vitals: {
        health: { current: 850, max: 1000, delta: 25 },
        mana: { current: 400, max: 500, delta: 50 },
        stamina: { current: 380, max: 400, delta: 10 },
        essence: { current: 2500, softCap: 5000, accrual: 25 },
      },
    },
  };
}

/**
 * Creates a simulation loop that updates vitals over time.
 * Satisfies HUB-02 acceptance criteria: "Vitals visibly change over time"
 * WO-HUB-01: Added pause/resume for encounter combat authority
 * @param {Function} onUpdate - Callback with updated VM snapshot
 * @param {number} intervalMs - Update interval in ms (default 3000)
 * @returns {{ start: Function, stop: Function, pause: Function, resume: Function, isPaused: Function, getState: Function }}
 */
export function createVitalsSimulation(onUpdate, intervalMs = 3000) {
  let state = getHubDemoVM();
  let timerId = null;
  let tickCount = 0;
  let isPaused = false;

  function tick() {
    // WO-HUB-01: Skip tick if paused (during encounter, combat is authority)
    if (isPaused) return;

    tickCount++;
    const vitals = state.vitalsHud.vitals;

    // Simulate regen/decay cycles
    const healthDelta = Math.floor(Math.random() * 40) - 20; // -20 to +20
    const manaDelta = Math.floor(Math.random() * 30) - 10;   // -10 to +20
    const staminaDelta = Math.floor(Math.random() * 20) - 5; // -5 to +15
    const essenceAccrual = 10 + Math.random() * 10;

    // Apply changes with bounds
    const newHealth = Math.max(0, Math.min(vitals.health.max, vitals.health.current + healthDelta));
    const newMana = Math.max(0, Math.min(vitals.mana.max, vitals.mana.current + manaDelta));
    const newStamina = Math.max(0, Math.min(vitals.stamina.max, vitals.stamina.current + staminaDelta));
    const newEssence = vitals.essence.current + essenceAccrual;

    // Derive pressure and momentum from vitals state
    const totalPercent = (newHealth / vitals.health.max + newMana / vitals.mana.max + newStamina / vitals.stamina.max) / 3;
    const pressure = totalPercent > 0.6 ? 'ahead' : totalPercent < 0.4 ? 'behind' : 'balanced';
    const netDelta = healthDelta + manaDelta + staminaDelta;
    const momentum = netDelta > 10 ? 'rising' : netDelta < -10 ? 'falling' : 'steady';

    // Apply status effects based on state
    const effects = [];
    if (newHealth < vitals.health.max * 0.3) {
      effects.push({ icon: '&#9888;', label: 'Low Health' });
    }
    if (newMana < vitals.mana.max * 0.2) {
      effects.push({ icon: '&#10024;', label: 'Mana Drain' });
    }
    if (tickCount % 5 === 0) {
      effects.push({ icon: '&#128260;', label: 'Regen Pulse' });
    }

    state = {
      ...state,
      playerCore: {
        ...state.playerCore,
        pressure,
        momentum,
        effects,
        // WO-S9: Preserve static fields
        portraitUrl: state.playerCore.portraitUrl,
        playerClass: state.playerCore.playerClass,
        archetype: state.playerCore.archetype,
        guildText: state.playerCore.guildText,
      },
      vitalsHud: {
        ...state.vitalsHud,
        vitals: {
          health: { current: newHealth, max: vitals.health.max, delta: healthDelta },
          mana: { current: newMana, max: vitals.mana.max, delta: manaDelta },
          stamina: { current: newStamina, max: vitals.stamina.max, delta: staminaDelta },
          essence: { current: newEssence, softCap: vitals.essence.softCap, accrual: essenceAccrual },
        },
      },
    };

    if (onUpdate) onUpdate(state);
  }

  return {
    start() {
      if (timerId) return;
      timerId = setInterval(tick, intervalMs);
      tick(); // Initial tick
    },
    stop() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },
    /**
     * WO-HUB-01: Pause simulation (during encounters, combat is vitals authority)
     */
    pause() {
      isPaused = true;
      console.log('[VitalsSimulation] Paused - combat is now vitals authority');
    },
    /**
     * WO-HUB-01: Resume simulation (after encounter resolution)
     */
    resume() {
      isPaused = false;
      console.log('[VitalsSimulation] Resumed - ambient simulation active');
    },
    /**
     * WO-HUB-01: Check if simulation is paused
     */
    isPaused() {
      return isPaused;
    },
    getState() {
      return state;
    },
  };
}

export default { getHubDemoVM, getHubDemoVMWithEncounter, getHubDemoVMVerified, createVitalsSimulation };
