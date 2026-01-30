// worldTopologyAdapter.js — World Topology Adapter (WO-S2)
// FEATURE-FLAGGED: Only active when __MYFI_DEV_CONFIG__.enableWorldTopologyV2 === true
//
// When enabled: Can derive a WorldPos from existing location data
// When disabled: All functions return null/no-op (completely inert)
//
// Per STAGE-S2-WORLD-TOPOLOGY-V2 guardrails:
// - Does NOT modify existing location systems
// - Provides read-only derivation from existing state
// - Default path equals current behaviour (no topology)

import { createWorldPos, SECTORS, REGIONS, AREA_BANDS } from './worldTopologyRegistry.js';

/**
 * Check if V2 topology is enabled
 * @returns {boolean}
 */
function isEnabled() {
  const config = typeof window !== 'undefined' ? window.__MYFI_DEV_CONFIG__ : null;
  return config?.enableWorldTopologyV2 === true;
}

/**
 * Derive a WorldPos from existing location data
 *
 * This is a READ-ONLY adapter that maps legacy location state
 * to the new topology model WITHOUT modifying anything.
 *
 * When feature flag is OFF, returns null.
 *
 * @param {Object} locationState - Existing location state from locationController
 * @returns {Object|null} WorldPos or null if disabled/invalid
 */
export function deriveWorldPosFromLocation(locationState) {
  if (!isEnabled()) {
    return null; // Feature disabled - inert
  }

  if (!locationState) {
    return null;
  }

  // Map legacy location fields to topology
  // This is a best-effort derivation based on existing data shape
  const {
    currentRegion = 'center',
    distance = 0,
    riskLevel = 0,
    zoneId = null,
  } = locationState;

  // Derive sector from risk level
  const sectorId = deriveSectorFromRisk(riskLevel);

  // Derive area band from distance
  const areaIndex = deriveAreaIndexFromDistance(distance);

  // Normalize distance within area band
  const distance01 = normalizeDistanceInBand(distance, areaIndex);

  return createWorldPos({
    sectorId,
    regionId: currentRegion,
    areaIndex,
    zoneId,
    distance01,
  });
}

/**
 * Derive sector ID from legacy risk level (0-3+)
 * @param {number} riskLevel
 * @returns {string} Sector ID
 */
function deriveSectorFromRisk(riskLevel) {
  const level = Math.max(0, Math.min(3, Math.floor(riskLevel)));
  const sectorMap = ['haven', 'frontier', 'badlands', 'void'];
  return sectorMap[level] || 'haven';
}

/**
 * Derive area band index from distance (assumes 0-100 scale)
 * @param {number} distance
 * @returns {number} Area band index (0-3)
 */
function deriveAreaIndexFromDistance(distance) {
  const normalized = Math.max(0, Math.min(100, distance)) / 100;
  if (normalized < 0.2) return 0; // core
  if (normalized < 0.5) return 1; // inner
  if (normalized < 0.8) return 2; // outer
  return 3; // fringe
}

/**
 * Normalize distance within area band to 0-1
 * @param {number} distance
 * @param {number} areaIndex
 * @returns {number}
 */
function normalizeDistanceInBand(distance, areaIndex) {
  const bands = Object.values(AREA_BANDS);
  const band = bands[areaIndex] || bands[0];
  const [min, max] = band.distanceRange;
  const range = max - min;
  const normalized = (distance / 100 - min) / range;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Get current topology state (if enabled)
 *
 * This provides a unified read of the derived topology state.
 * Does NOT modify any existing systems.
 *
 * @param {Object} existingState - State object containing location data
 * @returns {Object|null} Topology state or null if disabled
 */
export function getTopologyState(existingState) {
  if (!isEnabled()) {
    return null;
  }

  const locationState = existingState?.location || existingState;
  const worldPos = deriveWorldPosFromLocation(locationState);

  if (!worldPos) {
    return null;
  }

  return {
    enabled: true,
    worldPos,
    sector: worldPos.sector,
    region: worldPos.region,
    areaBand: worldPos.areaBand,
    riskLevel: worldPos.riskLevel,
  };
}

/**
 * Check adapter status
 * @returns {Object} Status object
 */
export function getAdapterStatus() {
  return {
    enabled: isEnabled(),
    version: 'v2',
    featureFlag: 'enableWorldTopologyV2',
    note: 'V2 topology is parallel and not active by default',
  };
}

export default {
  isEnabled,
  deriveWorldPosFromLocation,
  getTopologyState,
  getAdapterStatus,
};
