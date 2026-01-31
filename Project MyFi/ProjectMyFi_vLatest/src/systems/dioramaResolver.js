// dioramaResolver.js — Smart Diorama Asset Resolver
// WO-DIORAMA-02: Best-available-match resolution with scoring, constraints, and repetition avoidance

import {
  MANIFEST_VERSIONS,
  LAYER_TYPES,
  LAYER_ORDER,
  loadManifest,
  normalizeManifest,
  createEmptyManifest,
  hasAssets,
  supportsLayers,
  getLayerItems,
  mergeManifests,
} from './dioramaManifest.js';

import {
  ASSET_BASE_PATH,
  buildAssetPathChain,
} from './assetRoutingSchema.js';

/**
 * Scoring weights for path dimension matching
 */
export const SCORING_WEIGHTS = {
  beatType: 10,      // Primary dimension - highest weight
  activityPhase: 5,  // Secondary dimension
  region: 2,         // Tertiary dimension
  timeBucket: 3,     // Time-of-day matching
  intensityMatch: 4, // Intensity tier matching
  tagMatch: 1,       // Per-tag match bonus
  weightBonus: 0,    // Item weight is a multiplier, not additive
};

/**
 * Default resolver options
 */
export const DEFAULT_RESOLVER_OPTIONS = {
  maxCacheAge: 300000,        // 5 minutes
  lruSize: 10,                // Remember last 10 selections for variety
  enableLayers: false,        // Layer composition (future)
  logDecisions: false,        // Emit resolver decision logs
  fallbackToLegacy: true,     // Fall back to legacy folders
};

/**
 * Time bucket definitions (maps to episodeClock segments)
 */
export const TIME_BUCKETS = {
  dawn: 'dawn',
  morning: 'morning',
  midday: 'day',       // Alias
  day: 'day',
  afternoon: 'day',    // Alias
  evening: 'dusk',     // Alias
  dusk: 'dusk',
  night: 'night',
};

/**
 * Normalize segment ID to time bucket
 */
export function segmentToTimeBucket(segmentId) {
  return TIME_BUCKETS[segmentId] || 'day';
}

/**
 * Create the diorama resolver
 */
export function createDioramaResolver(options = {}) {
  const config = { ...DEFAULT_RESOLVER_OPTIONS, ...options };

  // Manifest cache: path -> { manifest, loadedAt }
  const manifestCache = new Map();

  // Availability index: path -> boolean (does manifest exist?)
  const availabilityIndex = new Map();

  // LRU for repetition avoidance: array of recently selected asset IDs
  const recentSelections = [];

  // Decision log for debugging
  let lastDecision = null;

  /**
   * Get base URL for assets
   */
  function getBaseUrl() {
    // Resolve relative to module location or use absolute
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return new URL(ASSET_BASE_PATH, import.meta.url).href;
    }
    return ASSET_BASE_PATH;
  }

  /**
   * Load manifest with caching
   */
  async function loadCachedManifest(folderPath) {
    const cacheKey = folderPath;
    const cached = manifestCache.get(cacheKey);

    if (cached && (Date.now() - cached.loadedAt) < config.maxCacheAge) {
      return cached.manifest;
    }

    const baseUrl = getBaseUrl();
    const manifestUrl = `${baseUrl}/${folderPath}/manifest.json`;

    const manifest = await loadManifest(manifestUrl, folderPath);

    // Update availability index
    availabilityIndex.set(folderPath, manifest !== null && hasAssets(manifest));

    if (manifest) {
      manifestCache.set(cacheKey, {
        manifest,
        loadedAt: Date.now(),
      });
    }

    return manifest;
  }

  /**
   * Check if a path is known to be available (from cache)
   */
  function isPathAvailable(folderPath) {
    return availabilityIndex.get(folderPath);
  }

  /**
   * Build the probe order for a given recipe
   * Returns paths sorted by expected score (best first)
   */
  function buildProbeOrder(recipe) {
    const { beatType, activityPhase, region, timeBucket, intensityTier } = recipe;

    // Start with the standard path chain
    const baseChain = buildAssetPathChain({
      beatType,
      activityPhase,
      region,
    });

    // Score each path by how many dimensions it matches
    const scoredPaths = baseChain.map((path, index) => {
      let score = 0;
      const parts = path.split('/');

      // beatType match
      if (parts[0] === beatType) {
        score += SCORING_WEIGHTS.beatType;
      }

      // activityPhase match (if in path)
      if (parts.length > 1 && parts[1] === activityPhase) {
        score += SCORING_WEIGHTS.activityPhase;
      }

      // region match (if in path)
      if (parts.length > 2 && parts[2] === region) {
        score += SCORING_WEIGHTS.region;
      }

      // Prefer earlier paths in chain (tiebreaker)
      score -= index * 0.1;

      return { path, score };
    });

    // Sort by score descending
    scoredPaths.sort((a, b) => b.score - a.score);

    return scoredPaths.map(p => p.path);
  }

  /**
   * Score an item against the recipe
   */
  function scoreItem(item, recipe, pathScore) {
    let score = pathScore; // Start with path score

    const { timeBucket, intensityTier, requiredTags, preferredTags } = recipe;

    // Time bucket matching
    if (timeBucket && item.constraints?.timeBuckets) {
      if (item.constraints.timeBuckets.includes(timeBucket)) {
        score += SCORING_WEIGHTS.timeBucket;
      } else {
        // Doesn't match time - significant penalty
        score -= SCORING_WEIGHTS.timeBucket * 2;
      }
    }

    // Intensity matching
    if (intensityTier !== undefined) {
      const minInt = item.constraints?.minIntensity ?? 0;
      const maxInt = item.constraints?.maxIntensity ?? 5;

      if (intensityTier >= minInt && intensityTier <= maxInt) {
        // Perfect match - bonus for being in range
        score += SCORING_WEIGHTS.intensityMatch;
      } else {
        // Out of range - penalty
        score -= SCORING_WEIGHTS.intensityMatch * 2;
      }
    }

    // Tag matching
    const itemTags = new Set(item.tags || []);

    // Required tags (must have all)
    if (requiredTags && requiredTags.length > 0) {
      const hasAllRequired = requiredTags.every(tag => itemTags.has(tag));
      if (!hasAllRequired) {
        return -Infinity; // Disqualify
      }
      score += requiredTags.length * SCORING_WEIGHTS.tagMatch * 2;
    }

    // Preferred tags (bonus for each match)
    if (preferredTags && preferredTags.length > 0) {
      for (const tag of preferredTags) {
        if (itemTags.has(tag)) {
          score += SCORING_WEIGHTS.tagMatch;
        }
      }
    }

    // Exclude tags
    if (recipe.excludeTags && recipe.excludeTags.length > 0) {
      for (const tag of recipe.excludeTags) {
        if (itemTags.has(tag)) {
          return -Infinity; // Disqualify
        }
      }
    }

    // Item weight as multiplier
    score *= (item.weight ?? 1);

    // Repetition penalty
    const recentIndex = recentSelections.indexOf(item.id);
    if (recentIndex !== -1) {
      // More recent = bigger penalty
      const recency = 1 - (recentIndex / config.lruSize);
      score *= (0.3 + 0.7 * (1 - recency)); // 30-100% of score based on recency
    }

    return score;
  }

  /**
   * Check if item passes constraint filters
   */
  function passesConstraints(item, recipe) {
    const constraints = item.constraints || {};

    // Time bucket check
    if (recipe.timeBucket && constraints.timeBuckets) {
      if (!constraints.timeBuckets.includes(recipe.timeBucket)) {
        return false;
      }
    }

    // Intensity check
    if (recipe.intensityTier !== undefined) {
      const minInt = constraints.minIntensity ?? 0;
      const maxInt = constraints.maxIntensity ?? 5;
      if (recipe.intensityTier < minInt || recipe.intensityTier > maxInt) {
        return false;
      }
    }

    // Exclude with check
    if (constraints.excludeWith && recipe.activeTags) {
      for (const excludeTag of constraints.excludeWith) {
        if (recipe.activeTags.includes(excludeTag)) {
          return false;
        }
      }
    }

    // Require with check
    if (constraints.requireWith && constraints.requireWith.length > 0) {
      const hasRequired = constraints.requireWith.every(
        tag => recipe.activeTags?.includes(tag)
      );
      if (!hasRequired) {
        return false;
      }
    }

    return true;
  }

  /**
   * Track a selection for repetition avoidance
   */
  function trackSelection(assetId) {
    // Remove if already in list
    const existingIndex = recentSelections.indexOf(assetId);
    if (existingIndex !== -1) {
      recentSelections.splice(existingIndex, 1);
    }

    // Add to front
    recentSelections.unshift(assetId);

    // Trim to LRU size
    while (recentSelections.length > config.lruSize) {
      recentSelections.pop();
    }
  }

  /**
   * Resolve best background for a recipe
   * @param {Object} recipe - Resolution recipe
   * @param {string} recipe.beatType - Beat type (combat, traversal, etc.)
   * @param {string} recipe.activityPhase - Activity phase (wake, explore, etc.)
   * @param {string} recipe.region - Region (north, east, etc.)
   * @param {string} recipe.timeBucket - Time bucket (dawn, day, dusk, night)
   * @param {number} recipe.intensityTier - Intensity tier (1-5)
   * @param {string[]} recipe.requiredTags - Tags that must be present
   * @param {string[]} recipe.preferredTags - Tags to prefer
   * @param {string[]} recipe.excludeTags - Tags to exclude
   * @param {string[]} recipe.activeTags - Currently active context tags
   * @returns {Promise<Object>} Resolution result
   */
  async function resolve(recipe) {
    const decision = {
      recipe,
      probeOrder: [],
      manifestsChecked: [],
      candidatesScored: [],
      selected: null,
      fallbackLevel: 0,
      duration: 0,
    };

    const startTime = performance.now();

    try {
      // Build probe order
      decision.probeOrder = buildProbeOrder(recipe);

      // Probe each path in order
      let bestCandidate = null;
      let bestScore = -Infinity;
      let bestPath = null;

      for (let i = 0; i < decision.probeOrder.length; i++) {
        const path = decision.probeOrder[i];
        const pathScore = (decision.probeOrder.length - i) * 2; // Higher for earlier paths

        // Try to load manifest
        const manifest = await loadCachedManifest(path);

        decision.manifestsChecked.push({
          path,
          found: manifest !== null,
          itemCount: manifest?.items?.length || 0,
        });

        if (!manifest || !hasAssets(manifest)) {
          continue;
        }

        // Score each item in manifest
        for (const item of manifest.items) {
          // Quick constraint check first
          if (!passesConstraints(item, recipe)) {
            continue;
          }

          const itemScore = scoreItem(item, recipe, pathScore);

          decision.candidatesScored.push({
            id: item.id,
            path,
            score: itemScore,
            tags: item.tags,
          });

          if (itemScore > bestScore) {
            bestScore = itemScore;
            bestCandidate = item;
            bestPath = path;
            decision.fallbackLevel = i;
          }
        }

        // If we found something at this level, we might continue to find better
        // But if we're past the beat type level, stop searching
        if (bestCandidate && i >= 2) {
          break;
        }
      }

      // Build result
      if (bestCandidate) {
        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/${bestPath}/${bestCandidate.filename}`;

        decision.selected = {
          id: bestCandidate.id,
          url,
          path: bestPath,
          score: bestScore,
          tags: bestCandidate.tags,
        };

        // Track for repetition avoidance
        trackSelection(bestCandidate.id);

        decision.duration = performance.now() - startTime;
        lastDecision = decision;

        if (config.logDecisions) {
          console.log('[DioramaResolver] Decision:', decision);
        }

        return {
          success: true,
          url,
          assetId: bestCandidate.id,
          path: bestPath,
          fallbackLevel: decision.fallbackLevel,
          score: bestScore,
          decision: config.logDecisions ? decision : null,
        };
      }

      // No candidates found
      decision.duration = performance.now() - startTime;
      lastDecision = decision;

      if (config.logDecisions) {
        console.warn('[DioramaResolver] No candidates found:', decision);
      }

      return {
        success: false,
        url: null,
        assetId: null,
        path: null,
        fallbackLevel: -1,
        score: 0,
        decision: config.logDecisions ? decision : null,
      };

    } catch (error) {
      console.error('[DioramaResolver] Resolution error:', error);
      decision.error = error.message;
      decision.duration = performance.now() - startTime;
      lastDecision = decision;

      return {
        success: false,
        url: null,
        assetId: null,
        path: null,
        fallbackLevel: -1,
        score: 0,
        error: error.message,
        decision: config.logDecisions ? decision : null,
      };
    }
  }

  /**
   * Pre-warm the availability index for common paths
   */
  async function prewarm(beatTypes = ['combat', 'traversal', 'social', 'anomaly', 'idle']) {
    const promises = [];

    for (const beatType of beatTypes) {
      // Check base beat type folder
      promises.push(loadCachedManifest(beatType));
    }

    await Promise.allSettled(promises);

    if (config.logDecisions) {
      console.log('[DioramaResolver] Prewarm complete:', {
        cached: manifestCache.size,
        available: [...availabilityIndex.entries()].filter(([k, v]) => v).map(([k]) => k),
      });
    }
  }

  /**
   * Clear caches
   */
  function clearCache() {
    manifestCache.clear();
    availabilityIndex.clear();
    recentSelections.length = 0;
    lastDecision = null;
  }

  /**
   * Get last decision (for debugging)
   */
  function getLastDecision() {
    return lastDecision;
  }

  /**
   * Get resolver stats
   */
  function getStats() {
    return {
      cachedManifests: manifestCache.size,
      knownPaths: availabilityIndex.size,
      availablePaths: [...availabilityIndex.entries()].filter(([k, v]) => v).length,
      recentSelections: recentSelections.slice(),
      lastDecisionDuration: lastDecision?.duration || 0,
    };
  }

  return {
    resolve,
    prewarm,
    clearCache,
    getLastDecision,
    getStats,
    isPathAvailable,
  };
}

/**
 * Create a recipe from incident and clock state
 */
export function createRecipeFromContext(context) {
  const {
    incident,
    activityPhase,
    region,
    clockSegment,
    difficulty,
    tags,
  } = context;

  return {
    beatType: incident?.kind || 'idle',
    activityPhase: activityPhase || null,
    region: region || null,
    timeBucket: clockSegment ? segmentToTimeBucket(clockSegment) : null,
    intensityTier: difficulty ?? 2,
    requiredTags: [],
    preferredTags: tags || [],
    excludeTags: [],
    activeTags: tags || [],
  };
}

export default {
  createDioramaResolver,
  createRecipeFromContext,
  segmentToTimeBucket,
  SCORING_WEIGHTS,
  DEFAULT_RESOLVER_OPTIONS,
  TIME_BUCKETS,
};
