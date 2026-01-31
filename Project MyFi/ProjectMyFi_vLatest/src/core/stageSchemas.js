// stageSchemas.js — Canonical data schemas for Stage Episode system
// Per STAGE_EPISODES_SPEC_V1.md
//
// Exports: createSignal, createIncident, createEpisode, createDioramaSpec
// Plus validation helpers

/**
 * Signal kinds
 */
export const SIGNAL_KINDS = {
  TRANSACTION: 'transaction',
  ANOMALY: 'anomaly',
  SCHEDULE: 'schedule',
  THRESHOLD: 'threshold',
  AMBIENT: 'ambient',
};

/**
 * Incident kinds (taxonomy)
 */
export const INCIDENT_KINDS = {
  COMBAT: 'combat',
  TRAVERSAL: 'traversal',
  SOCIAL: 'social',
  ANOMALY: 'anomaly',
};

/**
 * Episode phases
 */
export const EPISODE_PHASES = {
  SETUP: 'setup',
  ACTIVE: 'active',
  RESOLVING: 'resolving',
  AFTER: 'after',
};

/**
 * Mechanic modes
 */
export const MECHANIC_MODES = {
  AUTOBATTLER: 'autobattler',
  TURN: 'turn',
  CHOICE: 'choice',
  TIMING: 'timing',
};

/**
 * Tagging options (vitals mapping)
 */
export const TAGGING_OPTIONS = {
  HEALTH: 'health',
  MANA: 'mana',
  STAMINA: 'stamina',
  WARDFIRE: 'wardfire',
  UNKNOWN: 'unknown',
};

/**
 * WO-S1: Stage Modes (READ-ONLY / DERIVED STATE)
 *
 * These modes describe what the Stage is currently SHOWING, not a state machine.
 * The Stage derives its mode from episode/encounter state - it does NOT control behavior.
 *
 * Flow: IDLE_TRAVEL → (signal) → INCIDENT_OVERLAY → (engage) → COMBAT_ACTIVE → (resolve) → IDLE_TRAVEL
 *
 * - IDLE_TRAVEL: Avatar wandering, world state cycling (rest/patrol/explore/return/city)
 * - INCIDENT_OVERLAY: Signal received, slow-time overlay visible, awaiting player tag or autopilot
 * - COMBAT_ACTIVE: Autobattler running, enemy sprite visible, damage ticks occurring
 * - RESOLUTION: Brief display of outcome before returning to idle
 */
export const STAGE_MODES = {
  IDLE_TRAVEL: 'idle_travel',
  INCIDENT_OVERLAY: 'incident_overlay',
  COMBAT_ACTIVE: 'combat_active',
  RESOLUTION: 'resolution',
};

/**
 * Derive current Stage mode from episode/encounter state
 * @param {Object} state - Stage internal state
 * @returns {string} Current STAGE_MODES value
 */
export function deriveStageMode(state) {
  // Combat takes priority
  if (state.stageMode === 'encounter_autobattler' && state.currentEncounter) {
    return STAGE_MODES.COMBAT_ACTIVE;
  }

  // Episode overlay (tagging/choice mode)
  if (state.episodeActive && state.episodePhase === 'active') {
    return STAGE_MODES.INCIDENT_OVERLAY;
  }

  // Resolution phase
  if (state.episodeActive && (state.episodePhase === 'resolving' || state.episodePhase === 'after')) {
    return STAGE_MODES.RESOLUTION;
  }

  // Default: idle travel
  return STAGE_MODES.IDLE_TRAVEL;
}

/**
 * Create a Signal object
 * @param {Object} params
 * @returns {Object} Signal
 */
export function createSignal({
  id = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind = SIGNAL_KINDS.AMBIENT,
  atMs = Date.now(),
  sourceRef = '',
  payload = {},
} = {}) {
  return {
    id,
    kind,
    atMs,
    sourceRef,
    payload,
  };
}

/**
 * Create an Incident object
 * @param {Object} params
 * @returns {Object} Incident
 */
export function createIncident({
  id = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  atMs = Date.now(),
  kind = INCIDENT_KINDS.COMBAT,
  requiredTokens = [],
  tone = { mood: 'calm', intensity: 1 },
  mechanics = { mode: MECHANIC_MODES.AUTOBATTLER, difficulty: 1, durationS: 30 },
  taggingPrompt = null,
  narrative = {},
  renderPlan = null,
} = {}) {
  return {
    id,
    atMs,
    kind,
    requiredTokens,
    tone,
    mechanics,
    taggingPrompt,
    narrative,
    renderPlan,
  };
}

/**
 * Create a DioramaSpec object
 * @param {Object} params
 * @param {Object} params.assetRouting - WO-ASSET-ROUTING: Routing context for asset selection
 * @returns {Object} DioramaSpec
 */
export function createDioramaSpec({
  seed = `dio-${Date.now()}`,
  region = 'center',
  state = 'patrol',
  timeOfDay = 'day',
  background = { id: 'default', variant: null },
  actors = [],
  props = [],
  effects = [],
  camera = { zoom: 1, pan: 'none' },
  assetRouting = null, // WO-ASSET-ROUTING: { beatType, activityPhase, region, pathChain, legacyState }
} = {}) {
  return {
    seed,
    region,
    state,
    timeOfDay,
    background,
    actors,
    props,
    effects,
    camera,
    assetRouting,
  };
}

/**
 * Create an Episode object
 * @param {Object} params
 * @returns {Object} Episode
 */
export function createEpisode({
  id = `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  incidentId,
  phase = EPISODE_PHASES.SETUP,
  startedAtMs = Date.now(),
  resolvedAtMs = null,
  resolution = null,
} = {}) {
  return {
    id,
    incidentId,
    phase,
    startedAtMs,
    resolvedAtMs,
    resolution,
  };
}

/**
 * Create a Resolution object
 * @param {Object} params
 * @returns {Object} Resolution
 */
export function createResolution({
  mode = 'auto',
  choiceId = null,
  confidence = 1,
  vitalsDelta = null,
  notes = '',
} = {}) {
  return {
    mode,
    choiceId,
    confidence,
    vitalsDelta,
    notes,
  };
}

/**
 * Create an Actor for DioramaSpec
 * @param {Object} params
 * @returns {Object} Actor
 */
export function createActor({
  slot = 'enemy',
  kind = 'goblin',
  pose = 'idle',
  emotion = null,
  x = 50,
  y = 50,
  scale = 1,
  z = 1,
} = {}) {
  return { slot, kind, pose, emotion, x, y, scale, z };
}

/**
 * Create a Prop for DioramaSpec
 * @param {Object} params
 * @returns {Object} Prop
 */
export function createProp({
  kind = 'rock',
  x = 50,
  y = 80,
  scale = 1,
  z = 0,
} = {}) {
  return { kind, x, y, scale, z };
}

/**
 * Create an Effect for DioramaSpec
 * @param {Object} params
 * @returns {Object} Effect
 */
export function createEffect({
  kind = 'fog',
  intensity = 0.5,
} = {}) {
  return { kind, intensity };
}

/**
 * Validate a Signal object
 * @param {Object} signal
 * @returns {boolean}
 */
export function isValidSignal(signal) {
  return (
    signal &&
    typeof signal.id === 'string' &&
    Object.values(SIGNAL_KINDS).includes(signal.kind) &&
    typeof signal.atMs === 'number'
  );
}

/**
 * Validate an Incident object
 * @param {Object} incident
 * @returns {boolean}
 */
export function isValidIncident(incident) {
  return (
    incident &&
    typeof incident.id === 'string' &&
    Object.values(INCIDENT_KINDS).includes(incident.kind) &&
    typeof incident.atMs === 'number'
  );
}

export default {
  SIGNAL_KINDS,
  INCIDENT_KINDS,
  EPISODE_PHASES,
  MECHANIC_MODES,
  TAGGING_OPTIONS,
  // WO-S1: Stage modes (derived state)
  STAGE_MODES,
  deriveStageMode,
  createSignal,
  createIncident,
  createDioramaSpec,
  createEpisode,
  createResolution,
  createActor,
  createProp,
  createEffect,
  isValidSignal,
  isValidIncident,
};
