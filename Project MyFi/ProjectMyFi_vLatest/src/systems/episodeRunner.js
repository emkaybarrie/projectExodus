// episodeRunner.js — Episode lifecycle management
// Per STAGE_EPISODES_SPEC_V1.md
//
// Manages: Setup → Active Incident → Resolution → Aftermath
// Handles slow-time overlay and autopilot resolution

import {
  createEpisode,
  createResolution,
  EPISODE_PHASES,
  MECHANIC_MODES,
} from '../core/stageSchemas.js';
import { createIncidentFromSignal } from './incidentFactory.js';

/**
 * Default timing constants
 */
const DEFAULTS = {
  SETUP_DURATION_MS: 1000,        // Time for setup phase
  AUTOPILOT_TIMEOUT_MS: 30000,    // Time before auto-resolve (30s)
  RESOLUTION_DURATION_MS: 2000,   // Time for resolution display
  AFTERMATH_DURATION_MS: 1500,    // Time for aftermath fade
};

/**
 * Create an Episode Runner
 *
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event dispatch
 * @param {Function} options.onPhaseChange - Callback when phase changes
 * @param {Function} options.onEpisodeComplete - Callback when episode completes
 * @param {Object} options.timing - Override timing constants
 * @returns {Object} Episode runner interface
 */
export function createEpisodeRunner(options = {}) {
  const { actionBus, onPhaseChange, onEpisodeComplete, timing = {} } = options;

  // Merge timing with defaults
  const config = { ...DEFAULTS, ...timing };

  // Current state
  let currentEpisode = null;
  let currentIncident = null;
  let autopilotTimerId = null;
  let phaseTimerId = null;
  let isSlowTimeActive = false;

  // Timeline of resolved episodes
  const timeline = [];

  /**
   * Start a new episode from a signal
   */
  function startFromSignal(signal) {
    if (currentEpisode) {
      console.warn('[EpisodeRunner] Episode already active, queueing signal');
      return null;
    }

    // Create incident from signal
    const incident = createIncidentFromSignal(signal);
    if (!incident) {
      console.error('[EpisodeRunner] Failed to create incident from signal');
      return null;
    }

    return startFromIncident(incident);
  }

  /**
   * Start a new episode from an incident
   */
  function startFromIncident(incident) {
    if (currentEpisode) {
      console.warn('[EpisodeRunner] Episode already active');
      return null;
    }

    currentIncident = incident;
    currentEpisode = createEpisode({
      incidentId: incident.id,
      phase: EPISODE_PHASES.SETUP,
    });

    console.log(`[EpisodeRunner] Starting episode: ${currentEpisode.id}`);

    // Emit episode started
    emit('episode:started', {
      episode: currentEpisode,
      incident: currentIncident,
    });

    // Transition through phases
    transitionToPhase(EPISODE_PHASES.SETUP);

    return currentEpisode;
  }

  /**
   * Transition to a new phase
   */
  function transitionToPhase(phase) {
    if (!currentEpisode) return;

    clearTimers();

    const previousPhase = currentEpisode.phase;
    currentEpisode.phase = phase;

    console.log(`[EpisodeRunner] Phase: ${previousPhase} → ${phase}`);

    // Emit phase change
    emit('episode:phaseChange', {
      episode: currentEpisode,
      incident: currentIncident,
      previousPhase,
      newPhase: phase,
    });

    if (onPhaseChange) {
      onPhaseChange(phase, currentEpisode, currentIncident);
    }

    // Handle phase-specific logic
    console.log(`[EpisodeRunner] Switch phase: ${phase}, ACTIVE=${EPISODE_PHASES.ACTIVE}, match=${phase === EPISODE_PHASES.ACTIVE}`);
    switch (phase) {
      case EPISODE_PHASES.SETUP:
        handleSetup();
        break;
      case EPISODE_PHASES.ACTIVE:
        console.log('[EpisodeRunner] Entering handleActive case');
        handleActive();
        break;
      case EPISODE_PHASES.RESOLVING:
        handleResolving();
        break;
      case EPISODE_PHASES.AFTER:
        handleAftermath();
        break;
    }
  }

  /**
   * Setup phase: Show incident entry, prepare visuals
   */
  function handleSetup() {
    emit('episode:setup', {
      episode: currentEpisode,
      incident: currentIncident,
      narrative: currentIncident.narrative,
    });

    // Transition to active after setup duration
    phaseTimerId = setTimeout(() => {
      transitionToPhase(EPISODE_PHASES.ACTIVE);
    }, config.SETUP_DURATION_MS);
  }

  /**
   * Active phase: Enable slow-time, start autopilot timer
   * For autobattler mode: triggers combat via autobattler:spawn
   * For choice mode: shows tagging overlay with timer
   */
  function handleActive() {
    const mechanicsMode = currentIncident.mechanics?.mode || MECHANIC_MODES.CHOICE;
    const isAutobattler = mechanicsMode === MECHANIC_MODES.AUTOBATTLER;

    console.log(`[EpisodeRunner] handleActive: mechanicsMode=${mechanicsMode}, isAutobattler=${isAutobattler}, MECHANIC_MODES.AUTOBATTLER=${MECHANIC_MODES.AUTOBATTLER}`);

    // For choice/tagging episodes, enable slow-time
    // For autobattler, combat handles the flow
    isSlowTimeActive = !isAutobattler;

    emit('episode:active', {
      episode: currentEpisode,
      incident: currentIncident,
      taggingPrompt: currentIncident.taggingPrompt,
      slowTimeActive: isSlowTimeActive,
      mechanicsMode,
    });

    if (isAutobattler) {
      // Combat episode: trigger autobattler spawn
      // Autobattler handles combat simulation and timer
      // Episode resolves when autobattler:resolve is received
      const encounter = {
        id: currentIncident.id,
        type: currentIncident.kind,
        label: currentIncident._enemy?.label || 'Encounter',
        icon: currentIncident._enemy?.icon || '&#128058;',
        baseDifficulty: currentIncident.mechanics?.difficulty || 1,
        // Pass incident reference for episode resolution
        _incidentId: currentIncident.id,
        _episodeId: currentEpisode.id,
      };

      console.log(`[EpisodeRunner] Combat episode - triggering autobattler:spawn`);
      emit('autobattler:spawn', encounter);

    } else {
      // Choice/tagging episode: start autopilot timer
      const duration = (currentIncident.mechanics.durationS || 30) * 1000;
      autopilotTimerId = setTimeout(() => {
        if (currentEpisode && currentEpisode.phase === EPISODE_PHASES.ACTIVE) {
          console.log('[EpisodeRunner] Autopilot timeout - auto-resolving');
          resolveWithAutopilot();
        }
      }, duration);

      // Emit timer updates for tagging overlay
      startTimerUpdates(duration);
    }
  }

  /**
   * Start emitting timer tick updates
   */
  function startTimerUpdates(totalDuration) {
    const startTime = Date.now();
    const tickInterval = setInterval(() => {
      if (!currentEpisode || currentEpisode.phase !== EPISODE_PHASES.ACTIVE) {
        clearInterval(tickInterval);
        return;
      }

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalDuration - elapsed);

      emit('episode:timerTick', {
        remainingMs: remaining,
        totalMs: totalDuration,
        percent: (remaining / totalDuration) * 100,
      });

      if (remaining <= 0) {
        clearInterval(tickInterval);
      }
    }, 1000);
  }

  /**
   * Resolving phase: Show resolution, calculate vitals delta
   */
  function handleResolving() {
    isSlowTimeActive = false;

    emit('episode:resolving', {
      episode: currentEpisode,
      incident: currentIncident,
      resolution: currentEpisode.resolution,
    });

    // Transition to aftermath after resolution duration
    phaseTimerId = setTimeout(() => {
      transitionToPhase(EPISODE_PHASES.AFTER);
    }, config.RESOLUTION_DURATION_MS);
  }

  /**
   * Aftermath phase: Show outcome, clean up
   */
  function handleAftermath() {
    currentEpisode.resolvedAtMs = Date.now();

    emit('episode:aftermath', {
      episode: currentEpisode,
      incident: currentIncident,
      narrative: currentIncident.narrative,
    });

    // Complete episode after aftermath duration
    phaseTimerId = setTimeout(() => {
      completeEpisode();
    }, config.AFTERMATH_DURATION_MS);
  }

  /**
   * Complete the current episode
   */
  function completeEpisode() {
    if (!currentEpisode) return;

    const completedEpisode = { ...currentEpisode };
    const completedIncident = { ...currentIncident };

    // Add to timeline
    timeline.push({
      episode: completedEpisode,
      incident: completedIncident,
      completedAt: Date.now(),
    });

    // Keep timeline to last 50 entries
    if (timeline.length > 50) {
      timeline.shift();
    }

    console.log(`[EpisodeRunner] Episode completed: ${completedEpisode.id}`);

    // Emit resolved event
    emit('episode:resolved', {
      episode: completedEpisode,
      incident: completedIncident,
      resolution: completedEpisode.resolution,
      vitalsDelta: completedEpisode.resolution?.vitalsDelta,
      choiceId: completedEpisode.resolution?.choiceId,
    });

    if (onEpisodeComplete) {
      onEpisodeComplete(completedEpisode, completedIncident);
    }

    // Clear state
    clearTimers();
    currentEpisode = null;
    currentIncident = null;
    isSlowTimeActive = false;
  }

  /**
   * Player makes a choice (tagging)
   */
  function playerChoice(choiceId) {
    if (!currentEpisode || currentEpisode.phase !== EPISODE_PHASES.ACTIVE) {
      console.warn('[EpisodeRunner] Cannot make choice - not in active phase');
      return;
    }

    console.log(`[EpisodeRunner] Player choice: ${choiceId}`);

    // Calculate vitals delta based on choice
    const vitalsDelta = calculateVitalsDelta(currentIncident, choiceId);

    // Create resolution
    currentEpisode.resolution = createResolution({
      mode: 'player',
      choiceId,
      confidence: 1,
      vitalsDelta,
      notes: `Player tagged as: ${choiceId}`,
    });

    emit('episode:playerChoice', {
      episode: currentEpisode,
      incident: currentIncident,
      choiceId,
      vitalsDelta,
    });

    // Transition to resolving
    transitionToPhase(EPISODE_PHASES.RESOLVING);
  }

  /**
   * Autopilot resolution (player didn't intervene)
   */
  function resolveWithAutopilot() {
    if (!currentEpisode || currentEpisode.phase !== EPISODE_PHASES.ACTIVE) {
      return;
    }

    console.log('[EpisodeRunner] Autopilot resolution');

    // Auto-select based on signal category or default to unknown
    const autoChoice = currentIncident._signal?.payload?.category || 'unknown';
    const vitalsDelta = calculateVitalsDelta(currentIncident, autoChoice);

    // Create resolution
    currentEpisode.resolution = createResolution({
      mode: 'auto',
      choiceId: autoChoice,
      confidence: 0.6,
      vitalsDelta,
      notes: 'Auto-resolved by autopilot',
    });

    // Transition to resolving
    transitionToPhase(EPISODE_PHASES.RESOLVING);
  }

  /**
   * Calculate vitals delta based on incident and choice
   */
  function calculateVitalsDelta(incident, choiceId) {
    const difficulty = incident.mechanics?.difficulty || 1;
    const amount = incident._signal?.payload?.amount || 10;

    // Base damage scales with difficulty and amount
    const baseDamage = Math.floor(5 + difficulty * 3 + amount * 0.05);

    // Map choice to vitals impact
    const deltaMap = {
      health: { health: -baseDamage, stamina: 0, mana: 0, essence: 5 },
      mana: { health: 0, stamina: -Math.floor(baseDamage * 0.5), mana: -baseDamage, essence: 10 },
      stamina: { health: 0, stamina: -baseDamage, mana: 0, essence: 5 },
      wardfire: { health: -Math.floor(baseDamage * 0.3), stamina: -Math.floor(baseDamage * 0.5), mana: 0, essence: 2 },
      unknown: { health: -Math.floor(baseDamage * 0.5), stamina: -Math.floor(baseDamage * 0.5), mana: 0, essence: 3 },
    };

    return deltaMap[choiceId] || deltaMap.unknown;
  }

  /**
   * Force resolve the current episode
   */
  function forceResolve() {
    if (!currentEpisode) return;

    if (currentEpisode.phase === EPISODE_PHASES.ACTIVE) {
      resolveWithAutopilot();
    }
  }

  /**
   * Cancel the current episode
   */
  function cancel() {
    if (!currentEpisode) return;

    console.log(`[EpisodeRunner] Episode cancelled: ${currentEpisode.id}`);

    emit('episode:cancelled', {
      episode: currentEpisode,
      incident: currentIncident,
    });

    clearTimers();
    currentEpisode = null;
    currentIncident = null;
    isSlowTimeActive = false;
  }

  /**
   * Clear all timers
   */
  function clearTimers() {
    if (autopilotTimerId) {
      clearTimeout(autopilotTimerId);
      autopilotTimerId = null;
    }
    if (phaseTimerId) {
      clearTimeout(phaseTimerId);
      phaseTimerId = null;
    }
  }

  /**
   * Emit event via actionBus
   */
  function emit(event, data) {
    if (actionBus) {
      actionBus.emit(event, data);
    }
  }

  /**
   * Subscribe to stage:signal events
   * WO-HUB-02: Mark as persistent (runner-level subscriptions, not cleaned up per-surface)
   */
  function init() {
    if (actionBus && actionBus.subscribe) {
      actionBus.subscribe('stage:signal', (signal) => {
        startFromSignal(signal);
      }, 'episodeRunner', { persistent: true });

      // Allow external choice submission
      actionBus.subscribe('episode:submitChoice', (data) => {
        playerChoice(data.choiceId);
      }, 'episodeRunner', { persistent: true });

      // Listen for autobattler resolution to complete combat episodes
      actionBus.subscribe('autobattler:resolve', (result) => {
        if (!currentEpisode || !currentIncident) return;

        // Only handle if this is a combat episode
        const mechanicsMode = currentIncident.mechanics?.mode;
        if (mechanicsMode !== MECHANIC_MODES.AUTOBATTLER) return;

        console.log('[EpisodeRunner] Autobattler resolved - completing combat episode');

        // Create resolution from combat outcome
        currentEpisode.resolution = createResolution({
          mode: 'auto',
          choiceId: result?.isVictory ? 'combat_victory' : 'combat_defeat',
          confidence: 1,
          vitalsDelta: null, // Vitals already applied during combat
          notes: result?.summary || 'Combat resolved',
        });

        // Transition to resolving phase
        transitionToPhase(EPISODE_PHASES.RESOLVING);
      }, 'episodeRunner', { persistent: true });
    }
  }

  return {
    init,
    startFromSignal,
    startFromIncident,
    playerChoice,
    forceResolve,
    cancel,

    // Getters
    getCurrentEpisode: () => currentEpisode,
    getCurrentIncident: () => currentIncident,
    isActive: () => currentEpisode !== null,
    isSlowTimeActive: () => isSlowTimeActive,
    getTimeline: () => [...timeline],
    getPhase: () => currentEpisode?.phase || null,
  };
}

export default { createEpisodeRunner };
