// stageModeSystem.js — Stage Mode Derivation (WO-S3)
// FEATURE-FLAGGED: __MYFI_DEV_CONFIG__.enableStageModes
//
// Makes Stage rendering modes EXPLICIT but DERIVED (not authoritative).
// This is a clarification layer, NOT a rewrite.
//
// Per STAGE-S3-STAGE-MODES-V2 guardrails:
// - Existing incident spawn logic UNCHANGED
// - Existing overlay rendering UNCHANGED
// - Existing CTA behaviour UNCHANGED
// - Existing vitals ticking UNCHANGED
// - Combat/incident overlays work exactly as before
//
// Combat encounters are the canonical reference model for all non-engaged incidents.
// This system generalizes that model — does NOT reinterpret or replace it.

import { EPISODE_PHASES, MECHANIC_MODES } from '../core/stageSchemas.js';

/**
 * Stage Mode enum — read-only reflection of derived state
 *
 * CRITICAL: These modes are DERIVED, NOT CONTROLLING.
 * They reflect existing state but do NOT drive transitions.
 */
export const STAGE_MODES = {
  // Default: No incident, avatar is traveling/exploring
  TRAVEL: 'travel',

  // Incident active, overlay shown, auto-resolve in progress
  // Player may be passively watching or choose to intervene
  INCIDENT_OVERLAY: 'incident_overlay',

  // Player has engaged with an incident (manual control)
  INTERACTIVE: 'interactive',
};

/**
 * Check if stage modes feature is enabled
 * @returns {boolean}
 */
function isEnabled() {
  const config = typeof window !== 'undefined' ? window.__MYFI_DEV_CONFIG__ : null;
  return config?.enableStageModes === true;
}

/**
 * Derive the current stage mode from existing state
 *
 * This is a PURE FUNCTION with NO SIDE EFFECTS.
 * It reads existing state and returns a mode.
 * It does NOT trigger transitions or modify anything.
 *
 * Per WO-S3 guardrails:
 * - STAGE_MODE is a read-only reflection of existing state
 * - It must never drive transitions on its own
 * - It must never gate rendering or logic
 *
 * @param {Object} state - Current state to derive from
 * @param {boolean} state.hasActiveScene - Is there an active scene/episode?
 * @param {boolean} state.isPlayerEngaged - Has player taken manual control?
 * @param {string|null} state.episodePhase - Current episode phase (if any)
 * @param {string|null} state.mechanicsMode - Episode mechanics mode (if any)
 * @returns {string} Stage mode (from STAGE_MODES enum)
 */
export function deriveStageMode({
  hasActiveScene = false,
  isPlayerEngaged = false,
  episodePhase = null,
  mechanicsMode = null,
} = {}) {
  // No active scene = travel mode
  if (!hasActiveScene) {
    return STAGE_MODES.TRAVEL;
  }

  // Player has engaged = interactive mode
  if (isPlayerEngaged) {
    return STAGE_MODES.INTERACTIVE;
  }

  // Active scene but not engaged = incident overlay (auto-resolve running)
  // This covers both AUTOBATTLER (combat) and CHOICE (tagging) mechanics
  // Both use the same overlay paradigm with timer
  return STAGE_MODES.INCIDENT_OVERLAY;
}

/**
 * Get stage mode state object (if feature enabled)
 *
 * Returns current mode plus metadata for debugging/display.
 * When feature disabled, returns null.
 *
 * @param {Object} episodeRunner - Episode runner instance
 * @param {Object} additionalState - Additional state (e.g., player engagement)
 * @returns {Object|null} Stage mode state or null if disabled
 */
export function getStageModeState(episodeRunner, additionalState = {}) {
  if (!isEnabled()) {
    return null;
  }

  const hasActiveScene = episodeRunner?.isActive?.() || false;
  const episodePhase = episodeRunner?.getPhase?.() || null;
  const currentEpisode = episodeRunner?.getCurrentEpisode?.() || null;
  const currentIncident = episodeRunner?.getCurrentIncident?.() || null;
  const mechanicsMode = currentIncident?.mechanics?.mode || null;

  // Derive player engagement from episode state
  // Player is "engaged" if they've submitted a choice during active phase
  const isPlayerEngaged = additionalState.isPlayerEngaged || false;

  const mode = deriveStageMode({
    hasActiveScene,
    isPlayerEngaged,
    episodePhase,
    mechanicsMode,
  });

  return {
    enabled: true,
    mode,
    modeLabel: getModeLabel(mode),
    hasActiveScene,
    isPlayerEngaged,
    episodePhase,
    mechanicsMode,
    // Reference info (for debugging)
    episodeId: currentEpisode?.id || null,
    incidentId: currentIncident?.id || null,
  };
}

/**
 * Get human-readable label for a stage mode
 * @param {string} mode - Stage mode
 * @returns {string} Human-readable label
 */
export function getModeLabel(mode) {
  const labels = {
    [STAGE_MODES.TRAVEL]: 'Traveling',
    [STAGE_MODES.INCIDENT_OVERLAY]: 'Incident Active',
    [STAGE_MODES.INTERACTIVE]: 'Player Engaged',
  };
  return labels[mode] || 'Unknown';
}

/**
 * Check if a mode indicates an active incident
 * Helper for feature-flagged rendering decisions.
 *
 * @param {string} mode - Stage mode
 * @returns {boolean}
 */
export function isIncidentMode(mode) {
  return mode === STAGE_MODES.INCIDENT_OVERLAY || mode === STAGE_MODES.INTERACTIVE;
}

/**
 * Check if a mode indicates player control
 * Helper for feature-flagged rendering decisions.
 *
 * @param {string} mode - Stage mode
 * @returns {boolean}
 */
export function isPlayerControlMode(mode) {
  return mode === STAGE_MODES.INTERACTIVE;
}

/**
 * Get system status
 * @returns {Object} Status object
 */
export function getSystemStatus() {
  return {
    enabled: isEnabled(),
    version: 'v2',
    featureFlag: 'enableStageModes',
    note: 'Stage modes are derived, not authoritative. Combat encounters remain the canonical auto-resolve model.',
  };
}

/**
 * CANONICAL AUTO-RESOLVE INCIDENT MODEL REFERENCE
 *
 * Combat encounters define the baseline incident lifecycle.
 * All non-engaged incidents must conform to this model.
 * Future systems must extend, not replace, this model.
 *
 * Auto-resolve incident lifecycle:
 * 1. Incident is active on Stage
 * 2. Visibly ticks toward resolution (timer/progress)
 * 3. Vitals update during resolution
 * 4. Does not require player input
 * 5. Player MAY ignore (auto-resolve completes) OR engage at any time
 *
 * Engagement transitions to INTERACTIVE mode but:
 * - Does NOT create a new incident
 * - Does NOT reset timing (unless explicitly designed to)
 * - Simply transitions rendering + input handling
 *
 * This model is implemented in episodeRunner.js and must not be duplicated.
 */

export default {
  STAGE_MODES,
  deriveStageMode,
  getStageModeState,
  getModeLabel,
  isIncidentMode,
  isPlayerControlMode,
  getSystemStatus,
  isEnabled,
};
