// dioramaManifest.js — Diorama Manifest Schema & Loader
// WO-DIORAMA-01: Extended manifest schema with version detection
// Supports V1 (simple array), V2 (items with tags/weights), V3 (layers)

/**
 * Manifest schema versions
 */
export const MANIFEST_VERSIONS = {
  V1: 1, // Simple backgrounds array only
  V2: 2, // Items with tags, weights, constraints
  V3: 3, // Full layered composition
};

/**
 * Default constraint values
 */
export const DEFAULT_CONSTRAINTS = {
  minIntensity: 0,
  maxIntensity: 5,
  timeBuckets: null, // null = any time
  excludeWith: [],
  requireWith: [],
};

/**
 * Default item values
 */
export const DEFAULT_ITEM = {
  weight: 1,
  tags: [],
  constraints: { ...DEFAULT_CONSTRAINTS },
};

/**
 * Layer types for V3 manifests
 */
export const LAYER_TYPES = {
  BACKGROUND: 'background',
  HERO: 'hero',
  ENEMY: 'enemy',
  VFX: 'vfx',
  FOREGROUND: 'foreground',
  GRADE: 'grade',
};

/**
 * Layer render order (back to front)
 */
export const LAYER_ORDER = [
  LAYER_TYPES.BACKGROUND,
  LAYER_TYPES.ENEMY,
  LAYER_TYPES.HERO,
  LAYER_TYPES.VFX,
  LAYER_TYPES.FOREGROUND,
  LAYER_TYPES.GRADE,
];

/**
 * Detect manifest version from raw manifest object
 * @param {Object} manifest - Raw manifest object
 * @returns {number} Version number (1, 2, or 3)
 */
export function detectManifestVersion(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return MANIFEST_VERSIONS.V1;
  }

  // Explicit version field
  if (manifest.version) {
    return manifest.version;
  }

  // V3: Has layers object
  if (manifest.layers && typeof manifest.layers === 'object') {
    return MANIFEST_VERSIONS.V3;
  }

  // V2: Has items array with objects
  if (manifest.items && Array.isArray(manifest.items) && manifest.items.length > 0) {
    const firstItem = manifest.items[0];
    if (typeof firstItem === 'object' && (firstItem.filename || firstItem.tags || firstItem.weight)) {
      return MANIFEST_VERSIONS.V2;
    }
  }

  // Default: V1 (simple backgrounds array)
  return MANIFEST_VERSIONS.V1;
}

/**
 * Normalize a V1 manifest to internal format
 * @param {Object} manifest - Raw V1 manifest
 * @param {string} folderPath - Folder path for context
 * @returns {Object} Normalized manifest
 */
function normalizeV1Manifest(manifest, folderPath = '') {
  const backgrounds = manifest.backgrounds || [];

  return {
    version: MANIFEST_VERSIONS.V1,
    folderPath,
    items: backgrounds.map((filename, index) => ({
      id: `${folderPath}/${filename}`.replace(/^\//, ''),
      filename,
      tags: [],
      weight: 1,
      constraints: { ...DEFAULT_CONSTRAINTS },
    })),
    layers: null,
    defaults: {
      timeBucket: null,
      intensity: 2,
    },
  };
}

/**
 * Normalize a V2 manifest to internal format
 * @param {Object} manifest - Raw V2 manifest
 * @param {string} folderPath - Folder path for context
 * @returns {Object} Normalized manifest
 */
function normalizeV2Manifest(manifest, folderPath = '') {
  const items = manifest.items || [];
  const legacyBackgrounds = manifest.backgrounds || [];

  // Combine items and legacy backgrounds
  const normalizedItems = [
    ...items.map((item, index) => ({
      id: item.id || `${folderPath}/${item.filename}`.replace(/^\//, ''),
      filename: item.filename,
      tags: item.tags || [],
      weight: item.weight ?? 1,
      constraints: {
        ...DEFAULT_CONSTRAINTS,
        ...item.constraints,
      },
    })),
    // Legacy backgrounds as simple items
    ...legacyBackgrounds.map((filename, index) => ({
      id: `legacy-${folderPath}/${filename}`.replace(/^\//, ''),
      filename,
      tags: ['legacy'],
      weight: 0.5, // Lower weight for legacy items
      constraints: { ...DEFAULT_CONSTRAINTS },
    })),
  ];

  return {
    version: MANIFEST_VERSIONS.V2,
    folderPath,
    items: normalizedItems,
    layers: null,
    defaults: {
      timeBucket: manifest.defaults?.timeBucket || null,
      intensity: manifest.defaults?.intensity ?? 2,
    },
  };
}

/**
 * Normalize a V3 manifest to internal format
 * @param {Object} manifest - Raw V3 manifest
 * @param {string} folderPath - Folder path for context
 * @returns {Object} Normalized manifest
 */
function normalizeV3Manifest(manifest, folderPath = '') {
  const layers = manifest.layers || {};
  const items = manifest.items || [];
  const legacyBackgrounds = manifest.backgrounds || [];

  // Normalize layer entries
  const normalizedLayers = {};
  for (const [layerType, layerItems] of Object.entries(layers)) {
    if (!LAYER_ORDER.includes(layerType)) {
      console.warn(`[DioramaManifest] Unknown layer type: ${layerType}`);
      continue;
    }

    normalizedLayers[layerType] = (layerItems || []).map((entry, index) => {
      // Entry can be string (filename) or object (full spec)
      if (typeof entry === 'string') {
        return {
          id: `${folderPath}/${layerType}/${entry}`.replace(/^\//, ''),
          filename: entry,
          tags: [],
          weight: 1,
          constraints: { ...DEFAULT_CONSTRAINTS },
        };
      }
      return {
        id: entry.id || `${folderPath}/${layerType}/${entry.filename}`.replace(/^\//, ''),
        filename: entry.filename,
        tags: entry.tags || [],
        weight: entry.weight ?? 1,
        constraints: {
          ...DEFAULT_CONSTRAINTS,
          ...entry.constraints,
        },
      };
    });
  }

  // Also normalize items for single-image fallback
  const normalizedItems = [
    ...items.map((item) => ({
      id: item.id || `${folderPath}/${item.filename}`.replace(/^\//, ''),
      filename: item.filename,
      tags: item.tags || [],
      weight: item.weight ?? 1,
      constraints: {
        ...DEFAULT_CONSTRAINTS,
        ...item.constraints,
      },
    })),
    ...legacyBackgrounds.map((filename) => ({
      id: `legacy-${folderPath}/${filename}`.replace(/^\//, ''),
      filename,
      tags: ['legacy'],
      weight: 0.5,
      constraints: { ...DEFAULT_CONSTRAINTS },
    })),
  ];

  return {
    version: MANIFEST_VERSIONS.V3,
    folderPath,
    items: normalizedItems,
    layers: normalizedLayers,
    defaults: {
      timeBucket: manifest.defaults?.timeBucket || null,
      intensity: manifest.defaults?.intensity ?? 2,
    },
  };
}

/**
 * Normalize any manifest version to internal format
 * @param {Object} manifest - Raw manifest object
 * @param {string} folderPath - Folder path for context
 * @returns {Object} Normalized manifest
 */
export function normalizeManifest(manifest, folderPath = '') {
  const version = detectManifestVersion(manifest);

  switch (version) {
    case MANIFEST_VERSIONS.V3:
      return normalizeV3Manifest(manifest, folderPath);
    case MANIFEST_VERSIONS.V2:
      return normalizeV2Manifest(manifest, folderPath);
    case MANIFEST_VERSIONS.V1:
    default:
      return normalizeV1Manifest(manifest, folderPath);
  }
}

/**
 * Create an empty manifest (for when no manifest file exists)
 * @param {string} folderPath - Folder path for context
 * @returns {Object} Empty normalized manifest
 */
export function createEmptyManifest(folderPath = '') {
  return {
    version: MANIFEST_VERSIONS.V1,
    folderPath,
    items: [],
    layers: null,
    defaults: {
      timeBucket: null,
      intensity: 2,
    },
  };
}

/**
 * Check if manifest has any usable assets
 * @param {Object} normalizedManifest - Normalized manifest
 * @returns {boolean} True if manifest has assets
 */
export function hasAssets(normalizedManifest) {
  if (!normalizedManifest) return false;

  // Check items
  if (normalizedManifest.items && normalizedManifest.items.length > 0) {
    return true;
  }

  // Check layers
  if (normalizedManifest.layers) {
    for (const layerItems of Object.values(normalizedManifest.layers)) {
      if (layerItems && layerItems.length > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if manifest supports layered composition
 * @param {Object} normalizedManifest - Normalized manifest
 * @returns {boolean} True if manifest has layer definitions
 */
export function supportsLayers(normalizedManifest) {
  return normalizedManifest?.version === MANIFEST_VERSIONS.V3 &&
         normalizedManifest?.layers !== null &&
         Object.keys(normalizedManifest.layers).length > 0;
}

/**
 * Get items from a specific layer
 * @param {Object} normalizedManifest - Normalized manifest
 * @param {string} layerType - Layer type from LAYER_TYPES
 * @returns {Array} Array of items for that layer
 */
export function getLayerItems(normalizedManifest, layerType) {
  if (!supportsLayers(normalizedManifest)) {
    return [];
  }
  return normalizedManifest.layers[layerType] || [];
}

/**
 * Merge multiple manifests (for combining folder-level + global manifests)
 * @param {Object[]} manifests - Array of normalized manifests (higher priority first)
 * @returns {Object} Merged manifest
 */
export function mergeManifests(manifests) {
  if (!manifests || manifests.length === 0) {
    return createEmptyManifest();
  }

  if (manifests.length === 1) {
    return manifests[0];
  }

  // Determine highest version
  const maxVersion = Math.max(...manifests.map(m => m.version));

  // Merge items (deduplicate by id)
  const seenIds = new Set();
  const mergedItems = [];
  for (const manifest of manifests) {
    for (const item of manifest.items || []) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        mergedItems.push(item);
      }
    }
  }

  // Merge layers (if any manifest has layers)
  let mergedLayers = null;
  const layerManifests = manifests.filter(m => m.layers);
  if (layerManifests.length > 0) {
    mergedLayers = {};
    for (const layerType of LAYER_ORDER) {
      const layerSeenIds = new Set();
      mergedLayers[layerType] = [];
      for (const manifest of layerManifests) {
        for (const item of manifest.layers[layerType] || []) {
          if (!layerSeenIds.has(item.id)) {
            layerSeenIds.add(item.id);
            mergedLayers[layerType].push(item);
          }
        }
      }
    }
  }

  // Use defaults from first manifest with defaults
  const defaults = manifests.find(m => m.defaults)?.defaults || {
    timeBucket: null,
    intensity: 2,
  };

  return {
    version: maxVersion,
    folderPath: manifests[0].folderPath,
    items: mergedItems,
    layers: mergedLayers,
    defaults,
  };
}

/**
 * Load and normalize a manifest from URL
 * @param {string} manifestUrl - URL to manifest.json
 * @param {string} folderPath - Folder path for context
 * @returns {Promise<Object>} Normalized manifest or null if not found
 */
export async function loadManifest(manifestUrl, folderPath = '') {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No manifest at this path
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const rawManifest = await response.json();
    return normalizeManifest(rawManifest, folderPath);
  } catch (error) {
    console.warn(`[DioramaManifest] Failed to load ${manifestUrl}:`, error.message);
    return null;
  }
}

export default {
  MANIFEST_VERSIONS,
  LAYER_TYPES,
  LAYER_ORDER,
  DEFAULT_CONSTRAINTS,
  DEFAULT_ITEM,
  detectManifestVersion,
  normalizeManifest,
  createEmptyManifest,
  hasAssets,
  supportsLayers,
  getLayerItems,
  mergeManifests,
  loadManifest,
};
