// worldTopologyRegistry.js — World Topology Data Model (WO-S2)
// ADDITIVE ONLY: This registry is parallel to existing location systems
// Does NOT replace or modify locationRegistry or locationController
//
// V2 topology is parallel and not active by default.
// Feature flag: __MYFI_DEV_CONFIG__.enableWorldTopologyV2
//
// Per STAGE-S2-WORLD-TOPOLOGY-V2 guardrails:
// - Pure data definitions, no side effects
// - Does not connect to any existing systems unless explicitly opted in

/**
 * Sector definitions — 4 risk bands from safe to dangerous
 * Sectors represent overall danger level / progression tier
 */
export const SECTORS = {
  HAVEN: {
    id: 'haven',
    label: 'Haven',
    description: 'Protected starting areas, minimal risk',
    riskBand: 0,
    color: '#4CAF50', // green
  },
  FRONTIER: {
    id: 'frontier',
    label: 'Frontier',
    description: 'Settled but contested areas, moderate risk',
    riskBand: 1,
    color: '#FF9800', // orange
  },
  BADLANDS: {
    id: 'badlands',
    label: 'Badlands',
    description: 'Harsh wilderness, high risk and reward',
    riskBand: 2,
    color: '#f44336', // red
  },
  VOID: {
    id: 'void',
    label: 'The Void',
    description: 'Unknown territory, extreme danger',
    riskBand: 3,
    color: '#9C27B0', // purple
  },
};

/**
 * Region definitions — cardinal directions within sectors
 */
export const REGIONS = {
  NORTH: { id: 'north', label: 'North', bearing: 0 },
  EAST: { id: 'east', label: 'East', bearing: 90 },
  SOUTH: { id: 'south', label: 'South', bearing: 180 },
  WEST: { id: 'west', label: 'West', bearing: 270 },
  CENTER: { id: 'center', label: 'Center', bearing: null },
};

/**
 * Area definitions — distance bands from region center (0-1 normalized)
 * Used for procedural positioning within a region
 */
export const AREA_BANDS = {
  CORE: { id: 'core', label: 'Core', distanceRange: [0, 0.2] },
  INNER: { id: 'inner', label: 'Inner', distanceRange: [0.2, 0.5] },
  OUTER: { id: 'outer', label: 'Outer', distanceRange: [0.5, 0.8] },
  FRINGE: { id: 'fringe', label: 'Fringe', distanceRange: [0.8, 1.0] },
};

/**
 * Zone types — optional landmark/POI categories
 * Zones are specific named locations within areas
 */
export const ZONE_TYPES = {
  SETTLEMENT: { id: 'settlement', label: 'Settlement', icon: '🏘️' },
  OUTPOST: { id: 'outpost', label: 'Outpost', icon: '🏕️' },
  RUIN: { id: 'ruin', label: 'Ruin', icon: '🏚️' },
  SHRINE: { id: 'shrine', label: 'Shrine', icon: '⛩️' },
  DUNGEON: { id: 'dungeon', label: 'Dungeon', icon: '🕳️' },
  WAYPOINT: { id: 'waypoint', label: 'Waypoint', icon: '🗼' },
  WILD: { id: 'wild', label: 'Wild', icon: '🌲' },
};

/**
 * Full topology schema for reference
 * This defines the data structure, not runtime state
 */
export const WORLD_TOPOLOGY = {
  sectors: SECTORS,
  regions: REGIONS,
  areaBands: AREA_BANDS,
  zoneTypes: ZONE_TYPES,
};

/**
 * Create a WorldPosition object (pure data factory)
 *
 * This is a coordinate within the world topology.
 * Does NOT trigger movement or connect to existing location systems.
 *
 * @param {Object} params
 * @param {string} params.sectorId - Sector identifier (haven, frontier, badlands, void)
 * @param {string} params.regionId - Region identifier (north, east, south, west, center)
 * @param {number} params.areaIndex - Area band index (0=core, 1=inner, 2=outer, 3=fringe)
 * @param {string|null} params.zoneId - Optional specific zone identifier
 * @param {number} params.distance01 - Normalized distance within area band (0-1)
 * @returns {Object} WorldPosition
 */
export function createWorldPos({
  sectorId = 'haven',
  regionId = 'center',
  areaIndex = 0,
  zoneId = null,
  distance01 = 0,
} = {}) {
  return {
    sectorId,
    regionId,
    areaIndex,
    zoneId,
    distance01,
    // Computed helpers (read-only)
    get sector() {
      return Object.values(SECTORS).find(s => s.id === sectorId) || SECTORS.HAVEN;
    },
    get region() {
      return Object.values(REGIONS).find(r => r.id === regionId) || REGIONS.CENTER;
    },
    get areaBand() {
      const bands = Object.values(AREA_BANDS);
      return bands[areaIndex] || bands[0];
    },
    get riskLevel() {
      const sector = Object.values(SECTORS).find(s => s.id === sectorId);
      return sector?.riskBand ?? 0;
    },
  };
}

/**
 * Validate a WorldPosition object
 * @param {Object} pos - WorldPosition to validate
 * @returns {boolean} True if valid
 */
export function isValidWorldPos(pos) {
  if (!pos || typeof pos !== 'object') return false;

  const validSector = Object.values(SECTORS).some(s => s.id === pos.sectorId);
  const validRegion = Object.values(REGIONS).some(r => r.id === pos.regionId);
  const validAreaIndex = typeof pos.areaIndex === 'number' && pos.areaIndex >= 0 && pos.areaIndex <= 3;
  const validDistance = typeof pos.distance01 === 'number' && pos.distance01 >= 0 && pos.distance01 <= 1;

  return validSector && validRegion && validAreaIndex && validDistance;
}

/**
 * Get sector by ID
 * @param {string} id - Sector ID
 * @returns {Object|null} Sector definition or null
 */
export function getSectorById(id) {
  return Object.values(SECTORS).find(s => s.id === id) || null;
}

/**
 * Get region by ID
 * @param {string} id - Region ID
 * @returns {Object|null} Region definition or null
 */
export function getRegionById(id) {
  return Object.values(REGIONS).find(r => r.id === id) || null;
}

/**
 * Get all sectors as array
 * @returns {Array} Array of sector definitions
 */
export function getAllSectors() {
  return Object.values(SECTORS);
}

/**
 * Get all regions as array
 * @returns {Array} Array of region definitions
 */
export function getAllRegions() {
  return Object.values(REGIONS);
}

export default {
  WORLD_TOPOLOGY,
  SECTORS,
  REGIONS,
  AREA_BANDS,
  ZONE_TYPES,
  createWorldPos,
  isValidWorldPos,
  getSectorById,
  getRegionById,
  getAllSectors,
  getAllRegions,
};
