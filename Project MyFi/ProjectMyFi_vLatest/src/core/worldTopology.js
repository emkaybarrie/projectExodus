// worldTopology.js — WO-S2: World Position Schema & Geography
//
// Defines the world structure: Hub City → Sectors → Areas → Zones
// Used for avatar position tracking, map zoom, and endless runner coordinates.
//
// ═══════════════════════════════════════════════════════════════════════════════
// WORLD STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════
//
//                     ┌─────────┐
//                     │  NORTH  │
//                     │ Sector  │
//                     └────┬────┘
//                          │
//       ┌──────────────────┼──────────────────┐
//       │                  │                  │
// ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐
// │   WEST    │      │  HUB CITY │      │   EAST    │
// │  Sector   │◄────►│  (center) │◄────►│  Sector   │
// └───────────┘      └─────┬─────┘      └───────────┘
//                          │
//                     ┌────┴────┐
//                     │  SOUTH  │
//                     │ Sector  │
//                     └─────────┘
//
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sector identifiers
 */
export const SECTORS = {
  CENTER: 'center',
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west',
};

/**
 * Risk bands by area index
 */
export const RISK_BANDS = {
  SAFE: 0,        // City center
  LOW: 1,         // City edge
  MEDIUM: 2,      // Frontier
  HIGH: 3,        // Badlands
  EXTREME: 4,     // Deep Badlands / Void
};

/**
 * Map zoom levels derived from area index
 */
export const MAP_ZOOM = {
  DETAIL: 'detail',   // areaIndex 0-1: City-level detail
  REGION: 'region',   // areaIndex 2-3: Regional overview
  WORLD: 'world',     // areaIndex 4+: Full world map
};

/**
 * Sector theme data
 */
export const SECTOR_THEMES = {
  [SECTORS.CENTER]: {
    name: 'Hub City',
    theme: 'urban',
    aesthetic: 'Safe haven, markets, guilds',
  },
  [SECTORS.NORTH]: {
    name: 'Frozen Wastes',
    theme: 'frozen',
    aesthetic: 'Ice, snow, cold',
  },
  [SECTORS.SOUTH]: {
    name: 'Volcanic Reaches',
    theme: 'volcanic',
    aesthetic: 'Lava, heat, ash',
  },
  [SECTORS.EAST]: {
    name: 'Corrupted Lands',
    theme: 'corrupted',
    aesthetic: 'Void, decay, shadow',
  },
  [SECTORS.WEST]: {
    name: 'Overgrown Wilds',
    theme: 'overgrown',
    aesthetic: 'Jungle, nature, beasts',
  },
};

/**
 * Create a WorldPosition object
 * @param {Object} params
 * @returns {Object} WorldPosition
 */
export function createWorldPosition({
  sector = SECTORS.CENTER,
  areaIndex = 0,
  zoneId = 'hub-plaza',
} = {}) {
  return {
    sector,
    areaIndex,
    zoneId,
  };
}

/**
 * Get the default starting position (Hub City center)
 * @returns {Object} WorldPosition
 */
export function getDefaultPosition() {
  return createWorldPosition({
    sector: SECTORS.CENTER,
    areaIndex: 0,
    zoneId: 'hub-plaza',
  });
}

/**
 * Derive map zoom level from position
 * @param {Object} position - WorldPosition
 * @returns {string} MAP_ZOOM value
 */
export function deriveMapZoom(position) {
  const { areaIndex } = position;

  if (areaIndex <= 1) return MAP_ZOOM.DETAIL;
  if (areaIndex <= 3) return MAP_ZOOM.REGION;
  return MAP_ZOOM.WORLD;
}

/**
 * Get risk band name for area index
 * @param {number} areaIndex
 * @returns {string} Risk band name
 */
export function getRiskBandName(areaIndex) {
  const names = ['Safe', 'Low', 'Medium', 'High', 'Extreme'];
  return names[Math.min(areaIndex, 4)] || 'Unknown';
}

/**
 * Check if position is in city (safe zone)
 * @param {Object} position - WorldPosition
 * @returns {boolean}
 */
export function isInCity(position) {
  return position.sector === SECTORS.CENTER && position.areaIndex === 0;
}

/**
 * Check if position is in the Badlands (high risk)
 * @param {Object} position - WorldPosition
 * @returns {boolean}
 */
export function isInBadlands(position) {
  return position.areaIndex >= RISK_BANDS.HIGH;
}

/**
 * Convert position to endless runner coordinates
 * For future Badland_P integration
 * @param {Object} position - WorldPosition
 * @returns {Object} { distance, angle, region }
 */
export function positionToRunnerCoords(position) {
  const { areaIndex, sector } = position;

  // Distance from center in game units (1000 units per area)
  const distance = areaIndex * 1000;

  // Sector offset (cosmetic, affects parallax)
  const sectorAngles = {
    [SECTORS.NORTH]: 0,
    [SECTORS.EAST]: 90,
    [SECTORS.SOUTH]: 180,
    [SECTORS.WEST]: 270,
    [SECTORS.CENTER]: null,
  };

  return {
    distance,
    angle: sectorAngles[sector],
    region: SECTOR_THEMES[sector]?.theme || 'unknown',
  };
}

/**
 * Calculate weighted zone selection
 * Influences: player preferences, financial pressure, randomness
 * @param {Object} options
 * @returns {Object} Selected zone info
 */
export function selectNextZone({
  currentPosition,
  preferredRegions = [],
  financialStress = 0,
  availableZones = [],
} = {}) {
  if (availableZones.length === 0) {
    // Return current position if no zones available
    return currentPosition;
  }

  // Weight each zone
  const weightedZones = availableZones.map(zone => {
    let weight = 1;

    // Player preference boost
    if (preferredRegions.includes(zone.sector)) {
      weight *= 1.5;
    }

    // Financial pressure: high stress → stay safe
    if (financialStress > 0.7 && zone.areaIndex > 2) {
      weight *= 0.3;
    } else if (financialStress > 0.5 && zone.areaIndex > 3) {
      weight *= 0.5;
    }

    // Randomness factor (±50%)
    weight *= 0.5 + Math.random();

    return { zone, weight };
  });

  // Weighted random selection
  const totalWeight = weightedZones.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (const { zone, weight } of weightedZones) {
    random -= weight;
    if (random <= 0) {
      return zone;
    }
  }

  // Fallback to first zone
  return availableZones[0];
}

/**
 * Get adjacent zones from current position
 * @param {Object} position - WorldPosition
 * @returns {Array} List of adjacent zone positions
 */
export function getAdjacentZones(position) {
  const { sector, areaIndex } = position;
  const adjacent = [];

  // Same sector, different area indices
  if (areaIndex > 0) {
    adjacent.push(createWorldPosition({
      sector,
      areaIndex: areaIndex - 1,
      zoneId: `${sector}-area-${areaIndex - 1}`,
    }));
  }
  if (areaIndex < 5) {
    adjacent.push(createWorldPosition({
      sector,
      areaIndex: areaIndex + 1,
      zoneId: `${sector}-area-${areaIndex + 1}`,
    }));
  }

  // From center, can go to any sector
  if (sector === SECTORS.CENTER) {
    [SECTORS.NORTH, SECTORS.SOUTH, SECTORS.EAST, SECTORS.WEST].forEach(s => {
      adjacent.push(createWorldPosition({
        sector: s,
        areaIndex: 1,
        zoneId: `${s}-gate`,
      }));
    });
  }

  // From sector edge (areaIndex 1), can return to center
  if (sector !== SECTORS.CENTER && areaIndex === 1) {
    adjacent.push(createWorldPosition({
      sector: SECTORS.CENTER,
      areaIndex: 0,
      zoneId: 'hub-plaza',
    }));
  }

  return adjacent;
}

/**
 * Validate a WorldPosition object
 * @param {Object} position
 * @returns {boolean}
 */
export function isValidPosition(position) {
  return (
    position &&
    Object.values(SECTORS).includes(position.sector) &&
    typeof position.areaIndex === 'number' &&
    position.areaIndex >= 0 &&
    typeof position.zoneId === 'string'
  );
}

export default {
  SECTORS,
  RISK_BANDS,
  MAP_ZOOM,
  SECTOR_THEMES,
  createWorldPosition,
  getDefaultPosition,
  deriveMapZoom,
  getRiskBandName,
  isInCity,
  isInBadlands,
  positionToRunnerCoords,
  selectNextZone,
  getAdjacentZones,
  isValidPosition,
};
