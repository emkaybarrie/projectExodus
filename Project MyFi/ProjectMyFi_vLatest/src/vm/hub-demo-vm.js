// hub-demo-vm.js — Demo view model providing contract-compliant mock data
// Part of I1-Hub-Phase1-Scaffold
//
// Data shapes conform to:
// - STATUSBAR_CONTRACT.md: StatusBarInput
// - VITALSHUD_CONTRACT.md: VitalsHUDInput
// - ENCOUNTERWINDOW_CONTRACT.md: EncounterWindowInput

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

export default { getHubDemoVM, getHubDemoVMWithEncounter, getHubDemoVMVerified };
