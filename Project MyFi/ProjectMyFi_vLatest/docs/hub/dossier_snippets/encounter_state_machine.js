// Excerpt from: src/systems/hubController.js (lines 15-47)
// HUB-15: Encounter State Machine + HUB-23: Stage Mode Derivation

export const ENCOUNTER_STATES = {
  IDLE: 'idle',
  ACTIVE_AUTOBATTLER: 'active_autobattler',
  ACTIVE_TURN_BASED: 'active_turn_based',
  RESOLVED: 'resolved',
};

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
