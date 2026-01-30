// assetRegistry.js — Asset loading and caching for Stage dioramas
// Per STAGE_EPISODES_SPEC_V1.md
//
// Resolves, preloads, and caches stage assets
// Provides veil placeholder for missing assets

/**
 * Asset path configuration
 */
const ASSET_PATHS = {
  BASE: '../assets/art/stage/',
  BACKGROUNDS: 'backgrounds/',
  ACTORS: 'actors/',
  PROPS: 'props/',
  EFFECTS: 'effects/',
  VEIL: '../assets/ui/veil-placeholder.svg',
};

/**
 * Asset manifest (can be loaded from JSON)
 */
const DEFAULT_MANIFEST = {
  backgrounds: {
    rest: { variants: ['morning', 'day', 'dusk', 'night'], fallback: 'day' },
    patrol: { variants: ['morning', 'day', 'dusk', 'night'], fallback: 'day' },
    explore: { variants: ['morning', 'day', 'dusk', 'night'], fallback: 'day' },
    return: { variants: ['morning', 'day', 'dusk', 'night'], fallback: 'day' },
    city: { variants: ['morning', 'day', 'dusk', 'night'], fallback: 'day' },
    combat: { variants: ['default'], fallback: 'default' },
  },
  actors: {
    players: ['avatar'],
    enemies: ['imp', 'gremlin', 'dragon', 'golem', 'sentinel', 'wraith', 'phantom', 'shadow', 'void'],
    npcs: ['merchant', 'guide'],
  },
  props: ['rock', 'chest', 'sign', 'campfire'],
  effects: ['fog', 'dust', 'embers', 'runes', 'glow'],
};

/**
 * Create an Asset Registry
 *
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL for asset resolution
 * @param {Object} options.manifest - Asset manifest (optional)
 * @returns {Object} Asset registry interface
 */
export function createAssetRegistry(options = {}) {
  const { baseUrl = import.meta.url, manifest = DEFAULT_MANIFEST } = options;

  // Cache for loaded assets
  const cache = new Map();
  const loadingPromises = new Map();
  const missingAssets = new Set();

  /**
   * Resolve asset URL
   */
  function resolveUrl(path) {
    try {
      return new URL(ASSET_PATHS.BASE + path, baseUrl).href;
    } catch (e) {
      console.warn(`[AssetRegistry] Failed to resolve URL: ${path}`);
      return null;
    }
  }

  /**
   * Resolve veil placeholder URL
   */
  function getVeilUrl() {
    try {
      return new URL(ASSET_PATHS.VEIL, baseUrl).href;
    } catch (e) {
      // Return data URL as ultimate fallback
      return 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
          <rect fill="#1a1025" width="100" height="100"/>
          <text x="50" y="55" text-anchor="middle" fill="#8b5cf6" font-size="12">?</text>
        </svg>
      `);
    }
  }

  /**
   * Preload an image asset
   */
  function preloadImage(url) {
    // Return cached if available
    if (cache.has(url)) {
      return Promise.resolve(cache.get(url));
    }

    // Return existing loading promise if in progress
    if (loadingPromises.has(url)) {
      return loadingPromises.get(url);
    }

    // Start loading
    const promise = new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        cache.set(url, { url, loaded: true, element: img });
        loadingPromises.delete(url);
        resolve({ url, loaded: true });
      };

      img.onerror = () => {
        console.warn(`[AssetRegistry] Failed to load: ${url}`);
        missingAssets.add(url);
        loadingPromises.delete(url);
        // Resolve with veil instead of rejecting
        resolve({ url, loaded: false, fallback: getVeilUrl() });
      };

      img.src = url;
    });

    loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Get background asset URL
   */
  function getBackgroundUrl(id, variant = null) {
    const bgConfig = manifest.backgrounds[id];
    if (!bgConfig) {
      console.warn(`[AssetRegistry] Unknown background: ${id}`);
      return getVeilUrl();
    }

    const actualVariant = variant && bgConfig.variants.includes(variant)
      ? variant
      : bgConfig.fallback;

    const path = `${ASSET_PATHS.BACKGROUNDS}${id}/${actualVariant}.png`;
    return resolveUrl(path) || getVeilUrl();
  }

  /**
   * Get actor asset URL
   */
  function getActorUrl(slot, kind, pose = 'idle') {
    // Determine actor category
    let category = 'enemies';
    if (slot === 'player') category = 'players';
    if (slot === 'npc') category = 'npcs';

    const path = `${ASSET_PATHS.ACTORS}${category}/${kind}/${pose}.png`;
    return resolveUrl(path) || getVeilUrl();
  }

  /**
   * Get prop asset URL
   */
  function getPropUrl(kind) {
    if (!manifest.props.includes(kind)) {
      console.warn(`[AssetRegistry] Unknown prop: ${kind}`);
      return getVeilUrl();
    }

    const path = `${ASSET_PATHS.PROPS}${kind}.png`;
    return resolveUrl(path) || getVeilUrl();
  }

  /**
   * Get effect asset URL
   */
  function getEffectUrl(kind) {
    if (!manifest.effects.includes(kind)) {
      console.warn(`[AssetRegistry] Unknown effect: ${kind}`);
      return getVeilUrl();
    }

    const path = `${ASSET_PATHS.EFFECTS}${kind}.png`;
    return resolveUrl(path) || getVeilUrl();
  }

  /**
   * Preload all assets for a diorama spec
   */
  async function preloadDiorama(dioramaSpec) {
    const urls = [];

    // Background
    const bgUrl = getBackgroundUrl(
      dioramaSpec.background.id,
      dioramaSpec.background.variant
    );
    urls.push(bgUrl);

    // Actors
    for (const actor of dioramaSpec.actors || []) {
      const actorUrl = getActorUrl(actor.slot, actor.kind, actor.pose);
      urls.push(actorUrl);
    }

    // Props
    for (const prop of dioramaSpec.props || []) {
      const propUrl = getPropUrl(prop.kind);
      urls.push(propUrl);
    }

    // Effects
    for (const effect of dioramaSpec.effects || []) {
      const effectUrl = getEffectUrl(effect.kind);
      urls.push(effectUrl);
    }

    // Preload all
    const results = await Promise.all(urls.map(url => preloadImage(url)));

    console.log(`[AssetRegistry] Preloaded ${results.length} assets for diorama`);

    return results;
  }

  /**
   * Check if an asset is cached
   */
  function isCached(url) {
    return cache.has(url);
  }

  /**
   * Check if an asset failed to load
   */
  function isMissing(url) {
    return missingAssets.has(url);
  }

  /**
   * Clear cache
   */
  function clearCache() {
    cache.clear();
    loadingPromises.clear();
    missingAssets.clear();
    console.log('[AssetRegistry] Cache cleared');
  }

  /**
   * Get cache stats
   */
  function getStats() {
    return {
      cached: cache.size,
      loading: loadingPromises.size,
      missing: missingAssets.size,
    };
  }

  /**
   * Get list of missing assets
   */
  function getMissingAssets() {
    return [...missingAssets];
  }

  return {
    // URL resolution
    resolveUrl,
    getVeilUrl,
    getBackgroundUrl,
    getActorUrl,
    getPropUrl,
    getEffectUrl,

    // Loading
    preloadImage,
    preloadDiorama,

    // Cache management
    isCached,
    isMissing,
    clearCache,
    getStats,
    getMissingAssets,

    // Manifest access
    getManifest: () => ({ ...manifest }),
  };
}

// Export singleton for convenience
let defaultRegistry = null;

export function getDefaultRegistry(baseUrl) {
  if (!defaultRegistry) {
    defaultRegistry = createAssetRegistry({ baseUrl });
  }
  return defaultRegistry;
}

export default {
  createAssetRegistry,
  getDefaultRegistry,
  ASSET_PATHS,
};
