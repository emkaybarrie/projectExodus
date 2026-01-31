// assetRoutingSchema.js — Asset Folder Routing Configuration
// WO-ASSET-ROUTING: Maps beat types, activity phases, and regions to asset folders
// Provides fallback chain when specific combinations aren't available

/**
 * Beat types (incident kinds) - primary routing dimension
 */
export const BEAT_TYPES = {
  COMBAT: 'combat',
  TRAVERSAL: 'traversal',
  SOCIAL: 'social',
  ANOMALY: 'anomaly',
  IDLE: 'idle', // Default/ambient state
};

/**
 * Activity phases - secondary routing dimension
 */
export const ACTIVITY_PHASES = {
  WAKE: 'wake',
  EXPLORE: 'explore',
  FOCUS: 'focus',
  WIND_DOWN: 'wind_down',
  REST: 'rest',
};

/**
 * Regions/sectors - tertiary routing dimension
 */
export const REGIONS = {
  NORTH: 'north',
  EAST: 'east',
  SOUTH: 'south',
  WEST: 'west',
  CENTER: 'center',
};

/**
 * Asset base path (relative to import.meta.url or absolute)
 */
export const ASSET_BASE_PATH = '../../../assets/art/stages';

/**
 * Folder structure mapping
 *
 * Primary folder is by beat type, with optional subfolders for phase and region:
 *
 * /assets/art/stages/
 *   ├── combat/
 *   │   ├── manifest.json           # Fallback manifest for combat
 *   │   ├── focus/
 *   │   │   ├── manifest.json       # Combat + focus phase
 *   │   │   ├── center/
 *   │   │   │   └── manifest.json   # Combat + focus + center region
 *   │   │   └── north/
 *   │   │       └── manifest.json   # Combat + focus + north region
 *   │   └── explore/
 *   │       └── manifest.json       # Combat + explore phase
 *   ├── traversal/
 *   │   └── manifest.json
 *   ├── social/
 *   │   └── manifest.json
 *   ├── anomaly/
 *   │   └── manifest.json
 *   └── idle/
 *       ├── manifest.json           # Default ambient backgrounds
 *       ├── wake/
 *       ├── explore/
 *       ├── focus/
 *       ├── wind_down/
 *       └── rest/
 */

/**
 * Beat type to primary folder mapping
 */
export const BEAT_TYPE_FOLDERS = {
  [BEAT_TYPES.COMBAT]: 'combat',
  [BEAT_TYPES.TRAVERSAL]: 'traversal',
  [BEAT_TYPES.SOCIAL]: 'social',
  [BEAT_TYPES.ANOMALY]: 'anomaly',
  [BEAT_TYPES.IDLE]: 'idle',
};

/**
 * Activity phase subfolder names
 */
export const PHASE_SUBFOLDERS = {
  [ACTIVITY_PHASES.WAKE]: 'wake',
  [ACTIVITY_PHASES.EXPLORE]: 'explore',
  [ACTIVITY_PHASES.FOCUS]: 'focus',
  [ACTIVITY_PHASES.WIND_DOWN]: 'wind_down',
  [ACTIVITY_PHASES.REST]: 'rest',
};

/**
 * Region subfolder names
 */
export const REGION_SUBFOLDERS = {
  [REGIONS.NORTH]: 'north',
  [REGIONS.EAST]: 'east',
  [REGIONS.SOUTH]: 'south',
  [REGIONS.WEST]: 'west',
  [REGIONS.CENTER]: 'center',
};

/**
 * Legacy world state folder mapping (for backward compatibility)
 * These map to the existing folder structure
 */
export const LEGACY_STATE_FOLDERS = {
  combat: 'combat',
  rest: 'rest',
  patrol: 'patrol',
  explore: 'explore',
  return: 'return',
  city: 'city',
};

/**
 * Default fallback images per beat type (when no manifest found)
 */
export const BEAT_TYPE_FALLBACKS = {
  [BEAT_TYPES.COMBAT]: 'wardwatch-combat-01.png',
  [BEAT_TYPES.TRAVERSAL]: 'wardwatch-explore-01.png',
  [BEAT_TYPES.SOCIAL]: 'wardwatch-city-01.png',
  [BEAT_TYPES.ANOMALY]: 'wardwatch-explore-01.png',
  [BEAT_TYPES.IDLE]: 'wardwatch-patrol-01.png',
};

/**
 * Activity phase to beat type affinity (for idle state routing)
 * When in idle state, which beat type folder to prefer based on activity phase
 */
export const PHASE_BEAT_AFFINITY = {
  [ACTIVITY_PHASES.WAKE]: BEAT_TYPES.IDLE,
  [ACTIVITY_PHASES.EXPLORE]: BEAT_TYPES.TRAVERSAL,
  [ACTIVITY_PHASES.FOCUS]: BEAT_TYPES.COMBAT,
  [ACTIVITY_PHASES.WIND_DOWN]: BEAT_TYPES.SOCIAL,
  [ACTIVITY_PHASES.REST]: BEAT_TYPES.IDLE,
};

/**
 * Build the folder path for a given routing context
 * Returns array of paths to try in order (most specific to least specific)
 *
 * @param {Object} context - Routing context
 * @param {string} context.beatType - Beat type (combat, traversal, etc.)
 * @param {string} context.activityPhase - Activity phase (wake, explore, etc.)
 * @param {string} context.region - Region (north, east, etc.)
 * @returns {string[]} Array of folder paths to try, in fallback order
 */
export function buildAssetPathChain(context) {
  const {
    beatType = BEAT_TYPES.IDLE,
    activityPhase = null,
    region = null,
  } = context;

  const paths = [];
  const baseFolder = BEAT_TYPE_FOLDERS[beatType] || BEAT_TYPE_FOLDERS[BEAT_TYPES.IDLE];
  const phaseFolder = activityPhase ? PHASE_SUBFOLDERS[activityPhase] : null;
  const regionFolder = region ? REGION_SUBFOLDERS[region] : null;

  // Most specific: beatType/phase/region
  if (phaseFolder && regionFolder) {
    paths.push(`${baseFolder}/${phaseFolder}/${regionFolder}`);
  }

  // Mid specific: beatType/phase
  if (phaseFolder) {
    paths.push(`${baseFolder}/${phaseFolder}`);
  }

  // Beat type only
  paths.push(baseFolder);

  // Ultimate fallback: idle folder
  if (baseFolder !== 'idle') {
    paths.push('idle');
  }

  return paths;
}

/**
 * Get the fallback image for a beat type
 *
 * @param {string} beatType - Beat type
 * @returns {string} Fallback image filename
 */
export function getFallbackImage(beatType) {
  return BEAT_TYPE_FALLBACKS[beatType] || BEAT_TYPE_FALLBACKS[BEAT_TYPES.IDLE];
}

/**
 * Map incident kind to beat type
 *
 * @param {string} incidentKind - Incident kind from incidentFactory
 * @returns {string} Beat type
 */
export function incidentKindToBeatType(incidentKind) {
  const mapping = {
    combat: BEAT_TYPES.COMBAT,
    traversal: BEAT_TYPES.TRAVERSAL,
    social: BEAT_TYPES.SOCIAL,
    anomaly: BEAT_TYPES.ANOMALY,
  };
  return mapping[incidentKind] || BEAT_TYPES.IDLE;
}

/**
 * Map activity state ID to activity phase
 *
 * @param {string} activityStateId - Activity state ID from episodeRouter
 * @returns {string} Activity phase
 */
export function activityStateToPase(activityStateId) {
  const mapping = {
    wake: ACTIVITY_PHASES.WAKE,
    explore: ACTIVITY_PHASES.EXPLORE,
    focus: ACTIVITY_PHASES.FOCUS,
    wind_down: ACTIVITY_PHASES.WIND_DOWN,
    rest: ACTIVITY_PHASES.REST,
  };
  return mapping[activityStateId] || ACTIVITY_PHASES.EXPLORE;
}

/**
 * Create a complete routing context from incident and system state
 *
 * @param {Object} options - Options
 * @param {Object} options.incident - Incident object with kind
 * @param {Object} options.activityState - Activity state from episodeRouter
 * @param {string} options.region - Region ID
 * @returns {Object} Routing context for buildAssetPathChain
 */
export function createRoutingContext(options) {
  const {
    incident = null,
    activityState = null,
    region = null,
  } = options;

  return {
    beatType: incident?.kind ? incidentKindToBeatType(incident.kind) : BEAT_TYPES.IDLE,
    activityPhase: activityState?.id ? activityStateToPase(activityState.id) : null,
    region: region || null,
  };
}

export default {
  BEAT_TYPES,
  ACTIVITY_PHASES,
  REGIONS,
  ASSET_BASE_PATH,
  BEAT_TYPE_FOLDERS,
  PHASE_SUBFOLDERS,
  REGION_SUBFOLDERS,
  LEGACY_STATE_FOLDERS,
  BEAT_TYPE_FALLBACKS,
  PHASE_BEAT_AFFINITY,
  buildAssetPathChain,
  getFallbackImage,
  incidentKindToBeatType,
  activityStateToPase,
  createRoutingContext,
};
