// sceneBeatLog.js — Scene Beat Log for Recent Events (WO-S5)
//
// Converts resolved episodes into displayable Scene Beats.
// Each beat captures: time, location, incident type, resolution, and narrative.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { createWorldPosition, SECTORS, getRiskBandName } from '../core/worldTopology.js';

/**
 * Scene Beat schema
 *
 * @typedef {Object} SceneBeat
 * @property {string} id - Unique beat ID
 * @property {number} time - Timestamp (ms)
 * @property {Object} location - WorldPosition where beat occurred
 * @property {string} incidentType - Incident kind (combat, traversal, social, anomaly)
 * @property {string} resolvedBy - Resolution mode (player, auto, skip)
 * @property {Object} vitalsDelta - Vitals impact
 * @property {string} narrativeTag - Short narrative label
 * @property {Object} display - Pre-computed display data
 */

/**
 * Create a Scene Beat from a resolved episode
 *
 * @param {Object} episode - Resolved episode
 * @param {Object} incident - Associated incident
 * @param {Object} options - Additional options
 * @returns {Object} SceneBeat
 */
export function createSceneBeat(episode, incident, options = {}) {
  const { currentPosition = null } = options;

  // Determine location (use current position or derive from incident)
  const location = currentPosition || deriveLocationFromIncident(incident);

  // Determine resolution mode
  const resolvedBy = episode.resolution?.mode || 'auto';
  const choiceId = episode.resolution?.choiceId;

  // Get vitals delta
  const vitalsDelta = episode.resolution?.vitalsDelta || {};

  // Build narrative tag
  const narrativeTag = buildNarrativeTag(incident, resolvedBy, choiceId);

  // Build display data
  const display = buildDisplayData(incident, resolvedBy, choiceId, vitalsDelta, location);

  return {
    id: `beat-${episode.id}`,
    time: episode.resolvedAtMs || Date.now(),
    location,
    incidentType: incident.kind,
    resolvedBy,
    choiceId,
    vitalsDelta,
    narrativeTag,
    display,
    // Keep references for detailed view
    _episodeId: episode.id,
    _incidentId: incident.id,
  };
}

/**
 * Derive location from incident (fallback if no position tracking)
 */
function deriveLocationFromIncident(incident) {
  // Use render plan region if available
  const region = incident.renderPlan?.region;

  // Map region to sector
  const sectorMap = {
    center: SECTORS.CENTER,
    north: SECTORS.NORTH,
    south: SECTORS.SOUTH,
    east: SECTORS.EAST,
    west: SECTORS.WEST,
  };

  const sector = sectorMap[region] || SECTORS.CENTER;

  // Area index based on difficulty
  const difficulty = incident.mechanics?.difficulty || 1;
  const areaIndex = Math.min(difficulty, 4);

  return createWorldPosition({
    sector,
    areaIndex,
    zoneId: `${sector}-zone-${areaIndex}`,
  });
}

/**
 * Build narrative tag from incident and resolution
 */
function buildNarrativeTag(incident, resolvedBy, choiceId) {
  const kindLabels = {
    combat: 'encounter',
    traversal: 'passage',
    social: 'pact',
    anomaly: 'mystery',
  };

  const modeLabels = {
    player: 'engaged',
    auto: 'autopilot',
    skip: 'skipped',
  };

  const kindLabel = kindLabels[incident.kind] || 'event';
  const modeLabel = modeLabels[resolvedBy] || 'resolved';

  // Add choice context if player engaged
  if (resolvedBy === 'player' && choiceId && choiceId !== 'unknown') {
    return `${kindLabel}_${choiceId}`;
  }

  return `${kindLabel}_${modeLabel}`;
}

/**
 * Build pre-computed display data for UI
 */
function buildDisplayData(incident, resolvedBy, choiceId, vitalsDelta, location) {
  // Icon based on incident kind
  const iconMap = {
    combat: '&#9876;', // Crossed swords
    traversal: '&#128099;', // Footprints
    social: '&#128176;', // Money bag
    anomaly: '&#10067;', // Question mark
  };

  // Result badge
  const resultBadgeMap = {
    player: { label: 'Engaged', class: 'engaged' },
    auto: { label: 'Auto', class: 'auto' },
    skip: { label: 'Skipped', class: 'skipped' },
  };

  // Choice label if player tagged
  const choiceLabels = {
    health: 'Survival',
    mana: 'Growth',
    stamina: 'Daily',
    wardfire: 'Impulse',
    unknown: 'Unknown',
    combat_victory: 'Victory',
    combat_defeat: 'Defeat',
  };

  // Vitals impact summary
  const vitalsImpact = formatVitalsImpact(vitalsDelta);

  // Location label
  const riskBand = getRiskBandName(location.areaIndex);
  const locationLabel = `${capitalize(location.sector)} • ${riskBand}`;

  return {
    icon: incident._enemy?.icon || iconMap[incident.kind] || '&#10067;',
    title: incident._enemy?.label || incident.narrative?.captionIn || 'Event',
    subtitle: incident.narrative?.captionOut || 'Resolved',
    resultBadge: resultBadgeMap[resolvedBy] || resultBadgeMap.auto,
    choiceLabel: choiceId ? (choiceLabels[choiceId] || choiceId) : null,
    vitalsImpact,
    locationLabel,
    timeAgo: '', // Will be computed at render time
  };
}

/**
 * Format vitals delta for display
 */
function formatVitalsImpact(vitalsDelta) {
  if (!vitalsDelta || Object.keys(vitalsDelta).length === 0) {
    return null;
  }

  const impacts = [];
  const vitalIcons = {
    health: '&#10084;', // Heart
    mana: '&#10024;', // Sparkles
    stamina: '&#9889;', // Lightning
    essence: '&#10022;', // Star
  };

  for (const [vital, delta] of Object.entries(vitalsDelta)) {
    if (delta !== 0) {
      const sign = delta > 0 ? '+' : '';
      const icon = vitalIcons[vital] || '';
      impacts.push({
        vital,
        delta,
        label: `${icon}${sign}${delta}`,
        isPositive: delta > 0,
      });
    }
  }

  return impacts.length > 0 ? impacts : null;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Scene Beat Log manager
 * Maintains a rolling log of scene beats (max 50)
 */
export function createSceneBeatLog(options = {}) {
  const { maxBeats = 50, actionBus = null } = options;

  const beats = [];

  /**
   * Add a beat to the log
   */
  function addBeat(beat) {
    beats.unshift(beat);
    if (beats.length > maxBeats) {
      beats.pop();
    }

    // Emit event for UI updates
    if (actionBus) {
      actionBus.emit('sceneBeat:added', { beat, total: beats.length });
    }
  }

  /**
   * Create and add a beat from episode resolution
   */
  function logEpisodeResolution(episode, incident, options = {}) {
    const beat = createSceneBeat(episode, incident, options);
    addBeat(beat);
    return beat;
  }

  /**
   * Get all beats
   */
  function getBeats() {
    return [...beats];
  }

  /**
   * Get recent beats (last N)
   */
  function getRecentBeats(count = 10) {
    return beats.slice(0, count);
  }

  /**
   * Clear all beats
   */
  function clear() {
    beats.length = 0;
    if (actionBus) {
      actionBus.emit('sceneBeat:cleared');
    }
  }

  /**
   * Subscribe to episode:resolved events
   */
  function init() {
    if (actionBus && actionBus.subscribe) {
      actionBus.subscribe('episode:resolved', (data) => {
        if (data.episode && data.incident) {
          logEpisodeResolution(data.episode, data.incident);
        }
      }, 'sceneBeatLog', { persistent: true });
    }
  }

  return {
    init,
    addBeat,
    logEpisodeResolution,
    getBeats,
    getRecentBeats,
    clear,
    get count() {
      return beats.length;
    },
  };
}

export default {
  createSceneBeat,
  createSceneBeatLog,
};
