// incidentFactory.js — Converts Signals into Incidents
// Per STAGE_EPISODES_SPEC_V1.md
//
// Maps financial signals to narrative incidents with visual tokens and mechanics

import {
  SIGNAL_KINDS,
  INCIDENT_KINDS,
  MECHANIC_MODES,
  createIncident,
  createDioramaSpec,
  createActor,
  createEffect,
} from '../core/stageSchemas.js';

/**
 * Enemy definitions by category
 */
const ENEMY_CATALOG = {
  // Discretionary/impulse spending
  discretionary: [
    { kind: 'imp', label: 'Impulse Imp', icon: '&#128520;', baseDifficulty: 1 },
    { kind: 'gremlin', label: 'Spending Gremlin', icon: '&#128123;', baseDifficulty: 2 },
    { kind: 'dragon', label: 'Debt Dragon', icon: '&#128009;', baseDifficulty: 3 },
  ],
  // Essential/recurring spending
  essential: [
    { kind: 'golem', label: 'Utility Golem', icon: '&#129302;', baseDifficulty: 1 },
    { kind: 'sentinel', label: 'Bill Sentinel', icon: '&#128737;', baseDifficulty: 2 },
  ],
  // Subscription services
  subscription: [
    { kind: 'wraith', label: 'Subscription Wraith', icon: '&#128123;', baseDifficulty: 1 },
    { kind: 'phantom', label: 'Recurring Phantom', icon: '&#128123;', baseDifficulty: 2 },
  ],
  // Anomalies/unknown
  anomaly: [
    { kind: 'shadow', label: 'Mystery Shadow', icon: '&#128065;', baseDifficulty: 2 },
    { kind: 'void', label: 'Unknown Void', icon: '&#10067;', baseDifficulty: 3 },
  ],
};

/**
 * Tagging prompts by incident kind
 */
const TAGGING_PROMPTS = {
  combat: {
    question: 'What kind of spending was this?',
    options: [
      { id: 'health', label: 'Survival / Emergency', hint: 'Necessary for safety' },
      { id: 'mana', label: 'Power Move / Investment', hint: 'Intentional growth' },
      { id: 'stamina', label: 'Daily Needs', hint: 'Regular expenses' },
      { id: 'wardfire', label: 'Impulse / Fun', hint: 'Discretionary' },
      { id: 'unknown', label: 'Not Sure', hint: 'Review later' },
    ],
  },
  traversal: {
    question: 'How essential was this expense?',
    options: [
      { id: 'health', label: 'Critical', hint: 'Cannot skip' },
      { id: 'stamina', label: 'Important', hint: 'Should happen' },
      { id: 'mana', label: 'Optional', hint: 'Could wait' },
      { id: 'unknown', label: 'Unsure', hint: 'Review later' },
    ],
  },
  social: {
    question: 'What does this commitment represent?',
    options: [
      { id: 'mana', label: 'Growth Tool', hint: 'Helping me improve' },
      { id: 'stamina', label: 'Convenience', hint: 'Makes life easier' },
      { id: 'wardfire', label: 'Entertainment', hint: 'For enjoyment' },
      { id: 'unknown', label: 'Review', hint: 'Not sure yet' },
    ],
  },
  anomaly: {
    question: 'This looks unusual. What happened?',
    options: [
      { id: 'health', label: 'Expected', hint: 'I know what this is' },
      { id: 'unknown', label: 'Investigate', hint: 'Need to check' },
      { id: 'wardfire', label: 'Fraudulent?', hint: 'Might be wrong' },
    ],
  },
};

/**
 * WO-S3: Unified Overlay Configuration by incident kind
 * All incidents use the same overlay structure with mode-specific visuals
 */
const OVERLAY_CONFIG = {
  combat: {
    theme: 'combat',
    icon: '&#9876;', // Swords
    title: 'Encounter',
    subtitle: 'A challenger approaches',
    engageLabel: 'Engage',
    engageHint: 'Watch the battle',
    skipLabel: 'Auto-resolve',
    skipHint: 'Let autopilot handle it',
  },
  traversal: {
    theme: 'traversal',
    icon: '&#128099;', // Footprints
    title: 'Passage',
    subtitle: 'The path demands tribute',
    engageLabel: 'Review',
    engageHint: 'Tag this expense',
    skipLabel: 'Continue',
    skipHint: 'Mark as routine',
  },
  social: {
    theme: 'social',
    icon: '&#128176;', // Money bag
    title: 'Commitment',
    subtitle: 'A recurring pact',
    engageLabel: 'Evaluate',
    engageHint: 'Review this subscription',
    skipLabel: 'Accept',
    skipHint: 'Continue as-is',
  },
  anomaly: {
    theme: 'anomaly',
    icon: '&#10067;', // Question mark
    title: 'Anomaly',
    subtitle: 'Something unusual',
    engageLabel: 'Investigate',
    engageHint: 'Look closer',
    skipLabel: 'Dismiss',
    skipHint: 'Probably fine',
  },
};

/**
 * Map signal kind to incident kind
 */
function mapSignalToIncidentKind(signal) {
  const { kind, payload } = signal;

  switch (kind) {
    case SIGNAL_KINDS.TRANSACTION:
      // Categorize based on payload
      if (payload.category === 'subscription') return INCIDENT_KINDS.SOCIAL;
      if (payload.category === 'essential') return INCIDENT_KINDS.TRAVERSAL;
      if (payload.isAnomaly) return INCIDENT_KINDS.ANOMALY;
      return INCIDENT_KINDS.COMBAT;

    case SIGNAL_KINDS.ANOMALY:
      return INCIDENT_KINDS.ANOMALY;

    case SIGNAL_KINDS.THRESHOLD:
      return INCIDENT_KINDS.COMBAT;

    case SIGNAL_KINDS.SCHEDULE:
      return INCIDENT_KINDS.TRAVERSAL;

    case SIGNAL_KINDS.AMBIENT:
    default:
      return INCIDENT_KINDS.TRAVERSAL;
  }
}

/**
 * Select enemy based on signal characteristics
 */
function selectEnemy(signal, incidentKind) {
  const { payload } = signal;
  const amount = payload.amount || 0;

  // Determine enemy category
  let category = 'discretionary';
  if (payload.category === 'essential') category = 'essential';
  if (payload.category === 'subscription') category = 'subscription';
  if (incidentKind === INCIDENT_KINDS.ANOMALY) category = 'anomaly';

  const enemies = ENEMY_CATALOG[category] || ENEMY_CATALOG.discretionary;

  // Select based on amount (higher amount = harder enemy)
  let enemyIndex = 0;
  if (amount > 100) enemyIndex = Math.min(1, enemies.length - 1);
  if (amount > 500) enemyIndex = Math.min(2, enemies.length - 1);

  return enemies[enemyIndex];
}

/**
 * Calculate difficulty based on signal
 */
function calculateDifficulty(signal, enemy) {
  const { payload } = signal;
  const amount = payload.amount || 0;

  let difficulty = enemy.baseDifficulty;

  // Adjust by amount
  if (amount > 200) difficulty += 1;
  if (amount > 1000) difficulty += 1;

  // Cap at 5
  return Math.min(5, Math.max(1, difficulty));
}

/**
 * Determine mechanics mode
 */
function determineMechanics(incidentKind, difficulty) {
  // Most incidents use autobattler by default
  let mode = MECHANIC_MODES.AUTOBATTLER;
  let durationS = 30;

  // Higher difficulty = longer duration
  if (difficulty >= 3) durationS = 45;
  if (difficulty >= 4) durationS = 60;

  // Social incidents might use choice mode
  if (incidentKind === INCIDENT_KINDS.SOCIAL) {
    mode = MECHANIC_MODES.CHOICE;
    durationS = 20;
  }

  console.log(`[IncidentFactory] determineMechanics: incidentKind=${incidentKind}, mode=${mode}`);
  return { mode, difficulty, durationS };
}

/**
 * Determine tone based on incident kind and difficulty
 */
function determineTone(incidentKind, difficulty) {
  let mood = 'calm';
  if (difficulty >= 2) mood = 'tense';
  if (difficulty >= 4) mood = 'dire';

  return { mood, intensity: difficulty };
}

/**
 * Build render plan (DioramaSpec)
 */
function buildRenderPlan(signal, incidentKind, enemy, difficulty) {
  // Determine region based on incident kind
  const regionMap = {
    [INCIDENT_KINDS.COMBAT]: 'center',
    [INCIDENT_KINDS.TRAVERSAL]: 'south',
    [INCIDENT_KINDS.SOCIAL]: 'east',
    [INCIDENT_KINDS.ANOMALY]: 'north',
  };

  // Determine state based on mood
  const state = difficulty >= 3 ? 'explore' : 'patrol';

  // Time of day (could be derived from actual time)
  const hour = new Date().getHours();
  let timeOfDay = 'day';
  if (hour >= 17 || hour < 6) timeOfDay = 'night';
  if (hour >= 6 && hour < 9) timeOfDay = 'morning';
  if (hour >= 17 && hour < 20) timeOfDay = 'dusk';

  // Build actors
  const actors = [
    createActor({
      slot: 'player',
      kind: 'avatar',
      pose: 'battle',
      x: 25,
      y: 60,
      scale: 1,
      z: 1,
    }),
    createActor({
      slot: 'enemy',
      kind: enemy.kind,
      pose: 'idle',
      x: 75,
      y: 60,
      scale: 1,
      z: 1,
    }),
  ];

  // Build effects based on difficulty
  const effects = [];
  if (difficulty >= 2) {
    effects.push(createEffect({ kind: 'dust', intensity: 0.3 }));
  }
  if (difficulty >= 3) {
    effects.push(createEffect({ kind: 'embers', intensity: 0.5 }));
  }
  if (difficulty >= 4) {
    effects.push(createEffect({ kind: 'fog', intensity: 0.4 }));
  }

  return createDioramaSpec({
    seed: signal.id,
    region: regionMap[incidentKind] || 'center',
    state,
    timeOfDay,
    background: { id: state, variant: timeOfDay },
    actors,
    props: [],
    effects,
    camera: { zoom: 1, pan: difficulty >= 3 ? 'right' : 'none' },
  });
}

/**
 * Build narrative captions
 */
function buildNarrative(signal, enemy, incidentKind) {
  const { payload } = signal;
  const amount = payload.amount ? `$${payload.amount.toFixed(2)}` : '';
  const merchant = payload.merchant || 'Unknown';

  const captionTemplates = {
    [INCIDENT_KINDS.COMBAT]: {
      in: `A ${enemy.label} emerges! ${merchant} ${amount}`,
      out: `The encounter fades into memory...`,
    },
    [INCIDENT_KINDS.TRAVERSAL]: {
      in: `The path demands tribute. ${merchant} ${amount}`,
      out: `The journey continues.`,
    },
    [INCIDENT_KINDS.SOCIAL]: {
      in: `An agreement stirs. ${merchant} ${amount}`,
      out: `The pact is sealed.`,
    },
    [INCIDENT_KINDS.ANOMALY]: {
      in: `Something unusual... ${merchant} ${amount}`,
      out: `The mystery lingers.`,
    },
  };

  const templates = captionTemplates[incidentKind] || captionTemplates[INCIDENT_KINDS.COMBAT];
  return {
    captionIn: templates.in,
    captionOut: templates.out,
  };
}

/**
 * Create an Incident from a Signal
 * Main factory function
 *
 * @param {Object} signal - A valid Signal object
 * @returns {Object} Incident object ready for episode execution
 */
export function createIncidentFromSignal(signal) {
  if (!signal || !signal.id) {
    console.warn('[IncidentFactory] Invalid signal provided');
    return null;
  }

  // Determine incident kind
  const incidentKind = mapSignalToIncidentKind(signal);

  // Select enemy
  const enemy = selectEnemy(signal, incidentKind);

  // Calculate difficulty
  const difficulty = calculateDifficulty(signal, enemy);

  // Build components
  const mechanics = determineMechanics(incidentKind, difficulty);
  const tone = determineTone(incidentKind, difficulty);
  const renderPlan = buildRenderPlan(signal, incidentKind, enemy, difficulty);
  const narrative = buildNarrative(signal, enemy, incidentKind);
  const taggingPrompt = TAGGING_PROMPTS[incidentKind] || TAGGING_PROMPTS.combat;

  // Build required tokens
  const requiredTokens = [
    { type: 'enemy', kind: enemy.kind },
  ];

  // WO-S3: Get overlay config for this incident kind
  const overlayConfig = OVERLAY_CONFIG[incidentKind] || OVERLAY_CONFIG.combat;

  // Create the incident
  const incident = createIncident({
    id: `inc-${signal.id}`,
    atMs: signal.atMs,
    kind: incidentKind,
    requiredTokens,
    tone,
    mechanics,
    taggingPrompt,
    narrative,
    renderPlan,
  });

  // Attach enemy metadata for UI (non-canonical but useful)
  incident._enemy = enemy;
  incident._signal = signal;
  // WO-S3: Attach overlay config for unified overlay rendering
  incident._overlayConfig = overlayConfig;

  console.log(`[IncidentFactory] Created incident: ${incident.id} (${incidentKind}, difficulty ${difficulty}, mode: ${incident.mechanics?.mode})`);

  return incident;
}

/**
 * Create a demo incident for testing
 */
export function createDemoIncident(options = {}) {
  const { kind = INCIDENT_KINDS.COMBAT, difficulty = 1 } = options;

  const enemy = ENEMY_CATALOG.discretionary[Math.min(difficulty - 1, 2)];
  const taggingPrompt = TAGGING_PROMPTS[kind] || TAGGING_PROMPTS.combat;

  return createIncident({
    kind,
    requiredTokens: [{ type: 'enemy', kind: enemy.kind }],
    tone: determineTone(kind, difficulty),
    mechanics: determineMechanics(kind, difficulty),
    taggingPrompt,
    narrative: {
      captionIn: `A ${enemy.label} challenges you!`,
      captionOut: 'The dust settles...',
    },
    renderPlan: createDioramaSpec({
      state: 'patrol',
      timeOfDay: 'day',
      actors: [
        createActor({ slot: 'player', kind: 'avatar', pose: 'battle', x: 25, y: 60 }),
        createActor({ slot: 'enemy', kind: enemy.kind, pose: 'idle', x: 75, y: 60 }),
      ],
    }),
    _enemy: enemy,
  });
}

export { ENEMY_CATALOG, TAGGING_PROMPTS, OVERLAY_CONFIG };

export default {
  createIncidentFromSignal,
  createDemoIncident,
  ENEMY_CATALOG,
  TAGGING_PROMPTS,
  OVERLAY_CONFIG,
};
