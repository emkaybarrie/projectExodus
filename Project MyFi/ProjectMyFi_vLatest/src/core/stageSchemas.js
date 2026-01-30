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
