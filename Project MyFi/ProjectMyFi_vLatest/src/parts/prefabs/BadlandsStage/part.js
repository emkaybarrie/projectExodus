// BadlandsStage Part — HUB Refactor: 3-Tab Stage
// Tabs: Current Event | Recent Events | Loadout (tab bar at bottom)
// WO-STAGE-EPISODES-V1: Added Episode system integration with slow-time overlay
//
// ═══════════════════════════════════════════════════════════════════════════════
// WO-S1: SPECTATOR-MODE SIMULATION MODEL
// ═══════════════════════════════════════════════════════════════════════════════
//
// The Stage is a REAL-TIME NARRATIVE RENDERER, not a UI component.
// It simulates the Badlands game loop in spectator mode.
//
// DERIVED MODES (see stageSchemas.STAGE_MODES):
// ┌─────────────────┐     ┌───────────────────┐     ┌───────────────┐
// │  IDLE_TRAVEL    │────►│ INCIDENT_OVERLAY  │────►│ COMBAT_ACTIVE │
// │                 │     │   (or choice tag) │     │               │
// │ World cycling:  │     │                   │     │ Autobattler   │
// │ rest→patrol→    │◄────│ Slow-time, player │◄────│ ticks, enemy  │
// │ explore→return→ │     │ can tag or skip   │     │ HP, damage    │
// │ city (loop)     │     │                   │     │               │
// └─────────────────┘     └───────────────────┘     └───────────────┘
//        ▲                                                  │
//        └────────────────── RESOLUTION ◄───────────────────┘
//
// KEY PRINCIPLE: Stage SHOWS mode, it does NOT control behavior.
// Combat logic is in autobattler.js, episode logic is in episodeRunner.js.
// ═══════════════════════════════════════════════════════════════════════════════

import { ensureGlobalCSS } from '../../../core/styleLoader.js';
// WO-DEV-ASSET-PREFLIGHT: Import asset preflight system
import {
  preflightBackground,
  getMissingAssets,
  generateMissingPlaceholderHTML,
  ensurePlaceholderCSS,
} from '../../../systems/assetPreflight.js';
// WO-ASSET-ROUTING: Import asset routing schema for beat type / activity phase / region routing
import {
  buildAssetPathChain,
  getFallbackImage,
  BEAT_TYPES,
  LEGACY_STATE_FOLDERS,
} from '../../../systems/assetRoutingSchema.js';

// WO-DIORAMA: Import smart diorama resolver
import {
  createDioramaResolver,
  createRecipeFromContext,
} from '../../../systems/dioramaResolver.js';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchText failed ${res.status} for ${url}`);
  return await res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchJSON failed ${res.status} for ${url}`);
  return await res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// World State Background System
// ═══════════════════════════════════════════════════════════════════════════════

// World state cycle order (loop)
const WORLD_STATE_CYCLE = ['rest', 'patrol', 'explore', 'return', 'city'];

// WO-WATCH-EPISODE-ROUTING: Visual pool to world state bias mapping
// Each activity visual pool biases which world states are more likely
const VISUAL_POOL_STATE_BIAS = {
  morning: ['rest', 'patrol', 'city'],           // Calm, safe states
  active: ['patrol', 'explore', 'return'],       // Movement states
  intense: ['explore', 'patrol'],                // High-energy states
  evening: ['return', 'city', 'rest'],           // Winding down states
  night: ['rest', 'city'],                       // Calm, shelter states
  default: WORLD_STATE_CYCLE,                    // Full cycle
};

// Background folders for each state
const BG_FOLDER_BASE = '../../../../assets/art/stages/';
const STATE_FOLDERS = {
  combat: 'combat/',
  rest: 'rest/',
  patrol: 'patrol/',
  explore: 'explore/',
  return: 'return/',
  city: 'city/',
};

// Fallback images for each state
const STATE_FALLBACKS = {
  combat: 'wardwatch-combat-01.png',
  rest: 'wardwatch-rest-01.png',
  patrol: 'wardwatch-patrol-01.png',
  explore: 'wardwatch-explore-01.png',
  return: 'wardwatch-return-01.png',
  city: 'wardwatch-city-01.png',
};

// Background manifests cache (loaded once per state)
const backgroundsCache = {};

async function loadStateBackgrounds(stateName, baseUrl) {
  if (backgroundsCache[stateName]) return backgroundsCache[stateName];

  const folder = STATE_FOLDERS[stateName];
  if (!folder) {
    console.warn(`[BadlandsStage] Unknown state: ${stateName}`);
    backgroundsCache[stateName] = [];
    return [];
  }

  try {
    const manifestUrl = new URL(BG_FOLDER_BASE + folder + 'manifest.json', baseUrl).href;
    const manifest = await fetchJSON(manifestUrl);
    backgroundsCache[stateName] = manifest.backgrounds || [];
    console.log(`[BadlandsStage] Loaded ${backgroundsCache[stateName].length} backgrounds for state: ${stateName}`);
  } catch (err) {
    console.warn(`[BadlandsStage] Failed to load ${stateName} backgrounds manifest, using fallback`, err);
    backgroundsCache[stateName] = [STATE_FALLBACKS[stateName]];
  }

  return backgroundsCache[stateName];
}

async function loadAllStateBackgrounds(baseUrl) {
  const allStates = [...WORLD_STATE_CYCLE, 'combat'];
  await Promise.all(allStates.map(state => loadStateBackgrounds(state, baseUrl)));
}

function getRandomBackground(stateName, baseUrl) {
  const backgrounds = backgroundsCache[stateName] || [];
  const folder = STATE_FOLDERS[stateName] || 'patrol/';
  const fallback = STATE_FALLBACKS[stateName] || 'wardwatch-patrol-01.png';

  if (backgrounds.length === 0) {
    return new URL(BG_FOLDER_BASE + folder + fallback, baseUrl).href;
  }

  const randomIndex = Math.floor(Math.random() * backgrounds.length);
  const filename = backgrounds[randomIndex];
  return new URL(BG_FOLDER_BASE + folder + filename, baseUrl).href;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-ASSET-ROUTING: Routing-based Background Selection
// ═══════════════════════════════════════════════════════════════════════════════

// Cache for routed folder manifests (keyed by folder path)
const routedManifestCache = {};

/**
 * WO-ASSET-ROUTING: Load manifest for a folder path
 * Returns array of background filenames or empty array if not found
 */
async function loadRoutedManifest(folderPath, baseUrl) {
  if (routedManifestCache[folderPath]) {
    return routedManifestCache[folderPath];
  }

  try {
    const manifestUrl = new URL(BG_FOLDER_BASE + folderPath + '/manifest.json', baseUrl).href;
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      routedManifestCache[folderPath] = null; // Mark as checked but not found
      return null;
    }
    const manifest = await response.json();
    routedManifestCache[folderPath] = manifest.backgrounds || [];
    console.log(`[BadlandsStage] Loaded ${routedManifestCache[folderPath].length} backgrounds from ${folderPath}`);
    return routedManifestCache[folderPath];
  } catch (err) {
    routedManifestCache[folderPath] = null; // Mark as checked but not found
    return null;
  }
}

/**
 * WO-ASSET-ROUTING: Select background using routing context with fallback chain
 *
 * Tries paths in order from most specific to least specific:
 * 1. beatType/activityPhase/region (e.g., combat/focus/center)
 * 2. beatType/activityPhase (e.g., combat/focus)
 * 3. beatType (e.g., combat)
 * 4. idle (ultimate fallback)
 *
 * @param {Object} routingContext - Routing context from incident.renderPlan.assetRouting
 * @param {string} routingContext.beatType - Beat type (combat, traversal, social, anomaly, idle)
 * @param {string} routingContext.activityPhase - Activity phase (wake, explore, focus, etc.)
 * @param {string} routingContext.region - Region (north, east, south, west, center)
 * @param {string[]} routingContext.pathChain - Pre-computed fallback paths
 * @param {string} routingContext.legacyState - Legacy state for backward compatibility
 * @param {string} baseUrl - Base URL for asset paths
 * @returns {Promise<{url: string, folderUsed: string, fallbackLevel: number}>}
 */
async function selectBackgroundWithRouting(routingContext, baseUrl) {
  const {
    beatType = BEAT_TYPES.IDLE,
    pathChain = null,
    legacyState = 'patrol',
  } = routingContext || {};

  // Build path chain if not pre-computed
  const paths = pathChain || buildAssetPathChain(routingContext || {});

  // Try each path in order
  for (let i = 0; i < paths.length; i++) {
    const folderPath = paths[i];
    const backgrounds = await loadRoutedManifest(folderPath, baseUrl);

    if (backgrounds && backgrounds.length > 0) {
      const randomIndex = Math.floor(Math.random() * backgrounds.length);
      const filename = backgrounds[randomIndex];
      const url = new URL(BG_FOLDER_BASE + folderPath + '/' + filename, baseUrl).href;

      console.log(`[BadlandsStage] Asset routing: Using ${folderPath} (fallback level ${i})`);
      return {
        url,
        folderUsed: folderPath,
        fallbackLevel: i,
        filename,
      };
    }
  }

  // Ultimate fallback: use legacy state folders
  const legacyFolder = STATE_FOLDERS[legacyState] || LEGACY_STATE_FOLDERS[legacyState] || 'patrol/';
  const legacyFallback = STATE_FALLBACKS[legacyState] || getFallbackImage(beatType);
  const url = new URL(BG_FOLDER_BASE + legacyFolder + legacyFallback, baseUrl).href;

  console.log(`[BadlandsStage] Asset routing: Using legacy fallback ${legacyFolder}${legacyFallback}`);
  return {
    url,
    folderUsed: legacyFolder,
    fallbackLevel: paths.length, // Beyond all routing paths
    filename: legacyFallback,
  };
}

/**
 * WO-ASSET-ROUTING: Select background for an incident using its render plan
 *
 * @param {Object} incident - Incident object with renderPlan.assetRouting
 * @param {string} baseUrl - Base URL for asset paths
 * @returns {Promise<{url: string, folderUsed: string, fallbackLevel: number}>}
 */
async function selectBackgroundForIncident(incident, baseUrl) {
  const routingContext = incident?.renderPlan?.assetRouting;
  if (!routingContext) {
    // No routing context, fall back to legacy state
    const legacyState = incident?.renderPlan?.state || 'patrol';
    return {
      url: getRandomBackground(legacyState, baseUrl),
      folderUsed: STATE_FOLDERS[legacyState] || 'patrol/',
      fallbackLevel: -1, // Indicates legacy selection
      filename: null,
    };
  }

  return selectBackgroundWithRouting(routingContext, baseUrl);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-DIORAMA: Smart Diorama Resolver Integration
// ═══════════════════════════════════════════════════════════════════════════════

// Module-level smart resolver instance (created lazily)
let smartResolver = null;

/**
 * WO-DIORAMA: Get or create the smart resolver instance
 */
function getSmartResolver() {
  if (!smartResolver) {
    smartResolver = createDioramaResolver({
      lruSize: 10,
      logDecisions: true, // Enable for dev visibility
    });
  }
  return smartResolver;
}

/**
 * WO-DIORAMA: Select background using the smart resolver with best-match algorithm
 *
 * @param {Object} incident - Incident object with renderPlan.assetRouting
 * @param {Object} options - Additional options
 * @param {string} options.clockSegment - Current clock segment from episodeClock
 * @param {Object} options.actionBus - ActionBus for emitting resolver events
 * @param {string} baseUrl - Base URL for asset paths
 * @returns {Promise<{url: string, path: string, fallbackLevel: number, assetId: string}>}
 */
async function selectBackgroundWithSmartResolver(incident, options, baseUrl) {
  const { clockSegment = null, actionBus = null } = options || {};
  const routingContext = incident?.renderPlan?.assetRouting;

  if (!routingContext) {
    // No routing context, fall back to static selection
    const result = await selectBackgroundForIncident(incident, baseUrl);
    return result;
  }

  const resolver = getSmartResolver();

  // Build recipe from routing context
  const recipe = {
    beatType: routingContext.beatType || 'idle',
    activityPhase: routingContext.activityPhase || null,
    region: routingContext.region || null,
    timeBucket: routingContext.timeBucket || null,
    intensityTier: routingContext.intensityTier || 2,
    requiredTags: [],
    preferredTags: [],
    excludeTags: [],
    activeTags: [],
  };

  // Resolve using smart algorithm
  const result = await resolver.resolve(recipe);

  // Emit event for dev inspector
  if (actionBus) {
    actionBus.emit('diorama:resolved', {
      recipe,
      decision: result.decision,
      result: {
        success: result.success,
        url: result.url,
        assetId: result.assetId,
        path: result.path,
        fallbackLevel: result.fallbackLevel,
        score: result.score,
      },
    });
  }

  if (result.success && result.url) {
    console.log(`[BadlandsStage] Smart resolver: Using ${result.path} (fallback level ${result.fallbackLevel})`);
    return {
      url: result.url,
      folderUsed: result.path,
      fallbackLevel: result.fallbackLevel,
      filename: result.assetId,
      assetId: result.assetId,
    };
  }

  // Smart resolver failed, fall back to static selection
  console.log('[BadlandsStage] Smart resolver found no match, using static fallback');
  return selectBackgroundForIncident(incident, baseUrl);
}

/**
 * WO-DIORAMA: Prewarm the smart resolver cache
 */
async function prewarmSmartResolver() {
  const resolver = getSmartResolver();
  await resolver.prewarm(['combat', 'traversal', 'social', 'anomaly', 'idle']);
}

/**
 * WO-HUB-04: Preload image and resolve when loaded
 * Returns a promise that resolves with the URL when the image is ready
 */
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => {
      console.warn(`[BadlandsStage] Failed to preload image: ${url}`);
      resolve(url); // Still resolve to allow fallback behavior
    };
    img.src = url;
  });
}

// WO-HUB-04: Track preloaded images to avoid re-preloading
const preloadedImages = new Set();

function getNextWorldState(currentState, visualPool = 'default') {
  // WO-WATCH-EPISODE-ROUTING: Use visual pool bias if available
  const biasedStates = VISUAL_POOL_STATE_BIAS[visualPool] || WORLD_STATE_CYCLE;

  // If current state is in biased list, cycle within that list
  const currentIndex = biasedStates.indexOf(currentState);
  if (currentIndex !== -1) {
    const nextIndex = (currentIndex + 1) % biasedStates.length;
    return biasedStates[nextIndex];
  }

  // If current state not in bias list, pick a random biased state
  return biasedStates[Math.floor(Math.random() * biasedStates.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-UX-4: Evocative World State Captions
// ═══════════════════════════════════════════════════════════════════════════════

const WORLD_STATE_CAPTIONS = {
  rest: {
    titles: ['Sanctuary', 'Respite', 'Haven', 'Refuge'],
    subtitles: [
      '— The fire crackles softly',
      '— A moment of peace',
      '— Wounds mend, strength returns',
      '— Safe, for now',
    ],
  },
  patrol: {
    titles: ['Wardwatch', 'The Perimeter', 'Vigil', 'Outer Guard'],
    subtitles: [
      '— All quiet on the frontier',
      '— Eyes on the horizon',
      '— The ward holds steady',
      '— Shadows stir, but hold',
    ],
  },
  explore: {
    titles: ['The Unknown', 'Uncharted', 'Beyond the Ward', 'Terra Incognita'],
    subtitles: [
      '— What lies ahead?',
      '— Fortune favors the bold',
      '— New ground, old dangers',
      '— Every step writes history',
    ],
  },
  return: {
    titles: ['Homeward', 'The Long Road', 'Journey\'s End', 'Back Trail'],
    subtitles: [
      '— The familiar beckons',
      '— Each step toward safety',
      '— Weary but wiser',
      '— Almost there',
    ],
  },
  city: {
    titles: ['The Hub', 'Hearth & Home', 'Civilization', 'The Ward'],
    subtitles: [
      '— Markets hum with life',
      '— Among kin and coin',
      '— A world behind walls',
      '— Trade and tidings',
    ],
  },
};

function getWorldStateCaption(stateName) {
  const stateData = WORLD_STATE_CAPTIONS[stateName] || WORLD_STATE_CAPTIONS.patrol;
  const titleIndex = Math.floor(Math.random() * stateData.titles.length);
  const subtitleIndex = Math.floor(Math.random() * stateData.subtitles.length);
  return {
    title: stateData.titles[titleIndex],
    subtitle: stateData.subtitles[subtitleIndex],
  };
}

export default async function mount(host, { id, data = {}, ctx = {} }) {
  // Load CSS
  const cssUrl = new URL('./uplift.css', import.meta.url).href;
  await ensureGlobalCSS('part.BadlandsStage', cssUrl);

  const root = document.createElement('div');
  root.className = 'Part-BadlandsStage BadlandsStage';

  // Load baseline HTML
  const baseUrl = new URL('./baseline.html', import.meta.url).href;
  const html = await fetchText(baseUrl);
  root.innerHTML = html;

  host.appendChild(root);

  // Pre-load all state backgrounds manifests
  await loadAllStateBackgrounds(import.meta.url);

  // WO-DIORAMA: Prewarm smart resolver cache
  prewarmSmartResolver().catch(err => {
    console.warn('[BadlandsStage] Smart resolver prewarm failed:', err);
  });

  // Combat settings (can be overridden by dev config)
  const DEFAULT_ENCOUNTER_DURATION = 30; // seconds (default, can be overridden)
  const COMBAT_TICK_INTERVAL = 2500; // ms per combat round (2.5 seconds)
  const TIMER_UPDATE_INTERVAL = 100; // ms for smooth timer animation

  function getDevConfig() {
    return window.__MYFI_DEV_CONFIG__ || {};
  }

  // Internal state
  const state = {
    activeTab: 'current', // current | recent | narrative
    stageMode: data.stageMode || 'world', // world | encounter_autobattler
    stageBgUrl: data.stageBgUrl || null, // Stage background URL from VM
    currentEncounter: data.currentEncounter || null,
    // WO-HUB-LAYOUT: Narrative log placeholder entries
    narrativeEntries: [],
    // WO-HUB-LAYOUT: DEPRECATED - recentEvents and loadout migrated to WorldMap
    // Keeping for backwards compatibility during migration
    recentEvents: [],
    loadout: {
      skills: [
        { slot: 1, id: 'strike', name: 'Strike', icon: '&#9876;', damage: 15, manaCost: 0, staminaCost: 8 },
        { slot: 2, id: 'guard', name: 'Guard', icon: '&#128737;', damage: 5, manaCost: 0, staminaCost: 3 },
        { slot: 3, id: null, name: 'Empty', icon: '&#10133;', damage: 0, manaCost: 0, staminaCost: 0 },
      ],
      equipment: [
        { slot: 'weapon', id: 'iron_sword', name: 'Iron Sword', icon: '&#128481;', stat: '+8 ATK', bonusDamage: 8 },
        { slot: 'armor', id: null, name: 'No Armor', icon: '&#128085;', stat: null, damageReduction: 0 },
      ],
    },
    selectedSkillSlot: null,
    // Timer state
    timerRemaining: 0,
    timerTotal: DEFAULT_ENCOUNTER_DURATION,
    timerIntervalId: null,
    combatTickIntervalId: null,
    // Enemy state (for autobattler simulation)
    enemyHpCurrent: 100,
    enemyHpMax: 100,
    enemyBaseDamage: 15,
    // World state system
    worldState: 'patrol', // rest | patrol | explore | return | city
    worldStateTimerId: null,
    currentBgUrl: null, // Current background URL (for any state)
    // WO-UX-4: Evocative captions
    scenicTitle: 'Wardwatch',
    scenicSubtitle: '— All quiet on the frontier',
    // WO-STAGE-EPISODES-V1: Episode system state
    episodeActive: false,
    currentEpisode: null,
    currentIncident: null,
    episodePhase: null, // setup | active | resolving | after
    slowTimeTimerRemaining: 0,
    slowTimeTimerTotal: 30,
    queueLength: 0, // Number of pending signals in queue
    // WO-S3: Unified overlay state
    awaitingEngagement: false, // True when showing Engage/Skip buttons
    isPlayerEngaged: false, // True after player engages
    overlayConfig: null, // Mode-specific overlay configuration
    // WO-WATCH-EPISODE-ROUTING: Activity state visual pool
    currentVisualPool: 'default',
    currentActivityState: null, // Activity state from episodeRouter
    // WO-DEV-ASSET-PREFLIGHT: Missing asset tracking
    currentMissingAsset: null, // Current missing asset entry for placeholder
    // WO-LIVE-DEMO: Event notification state (legacy)
    engagementState: 'inactive', // inactive | pending | engaged
    notificationExpanded: false, // True when capsule is expanded to full overlay
    pendingCombatBgUrl: null, // Combat background to use when player engages
    // WO-CAPSULE-V2: Capsule notification state machine
    // hidden: no active event
    // pending: event triggered, capsule banner visible at top
    // collapsed: capsule collapsed to orb at top-right (after COLLAPSE_DELAY)
    // expanded: player tapped, HUD panel visible with scene log and engage button
    // engaged: player engaged, activity state updated to 'engaged'
    capsuleState: 'hidden', // hidden | pending | collapsed | expanded | engaged
    capsuleCollapseTimerId: null, // Timer for auto-collapse
    // WO-CAPSULE-V2: Quick-engage overlay state
    // Shows briefly when story beat generated, allows hold-to-engage
    quickEngageVisible: false,
    quickEngageTimerId: null, // 5-second auto-dismiss timer
    quickEngageHoldTimerId: null, // Hold progress timer
    quickEngageHoldProgress: 0, // 0-100% hold progress
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // World State Transition System
  // ═══════════════════════════════════════════════════════════════════════════

  function getWorldStateConfig() {
    const devConfig = getDevConfig();
    return {
      minTransitionTime: devConfig.worldStateMinTime || 30, // seconds
      maxTransitionTime: devConfig.worldStateMaxTime || 90, // seconds
      randomizeOnStateChange: devConfig.worldStateRandomizeBg !== false, // default true
    };
  }

  function getRandomTransitionTime() {
    const config = getWorldStateConfig();
    const range = config.maxTransitionTime - config.minTransitionTime;
    return (config.minTransitionTime + Math.random() * range) * 1000; // ms
  }

  /**
   * WO-DEV-ASSET-PREFLIGHT: Select background with preflight validation
   * Returns { url: string, missingEntry: Object|null }
   */
  async function selectBackgroundForState(stateName) {
    const config = getWorldStateConfig();
    let selectedUrl;
    if (config.randomizeOnStateChange) {
      selectedUrl = getRandomBackground(stateName, import.meta.url);
    } else if (state.currentBgUrl && state.worldState === stateName) {
      // If not randomizing, keep current if same state type, else pick random
      selectedUrl = state.currentBgUrl;
    } else {
      selectedUrl = getRandomBackground(stateName, import.meta.url);
    }

    const folder = STATE_FOLDERS[stateName] || 'patrol/';
    const manifestPath = new URL(BG_FOLDER_BASE + folder + 'manifest.json', import.meta.url).href;
    const filename = selectedUrl.split('/').pop();

    // WO-DEV-RENDER-BINDING: Emit trace event for background selection
    if (ctx.actionBus && isDevRenderEnabled()) {
      ctx.actionBus.emit('stage:bgSelected', {
        poolFolder: folder,
        filename,
        manifestPath,
        fullUrl: selectedUrl,
        stateName,
      });
    }

    // WO-DEV-ASSET-PREFLIGHT: Preflight check the selected background
    const preflightResult = await preflightBackground({
      imageUrl: selectedUrl,
      poolFolder: folder,
      filename,
      manifestPath,
      stateName,
    });

    if (!preflightResult.valid) {
      // Asset is missing - try fallback or record for placeholder
      if (preflightResult.fallbackUrl) {
        // Use fallback URL
        console.warn(`[BadlandsStage] Missing asset, using fallback: ${preflightResult.fallbackUrl}`);
        return { url: preflightResult.fallbackUrl, missingEntry: preflightResult.missingEntry };
      } else {
        // No fallback available - will show placeholder
        console.error(`[BadlandsStage] Missing asset with no fallback: ${selectedUrl}`);
        return { url: null, missingEntry: preflightResult.missingEntry };
      }
    }

    return { url: selectedUrl, missingEntry: null };
  }

  // WO-DEV-RENDER-BINDING: Check if dev render inspector is enabled
  function isDevRenderEnabled() {
    const devConfig = getDevConfig();
    return devConfig.enableRenderInspector || devConfig.showStageDebugOverlay;
  }

  async function transitionToNextWorldState() {
    if (state.stageMode === 'encounter_autobattler') {
      // Don't transition during combat, timer will restart after combat
      return;
    }

    // WO-WATCH-EPISODE-ROUTING: Use visual pool bias for state selection
    const nextState = getNextWorldState(state.worldState, state.currentVisualPool);

    // WO-DEV-RENDER-BINDING: Emit pool selection trace event
    if (ctx.actionBus && isDevRenderEnabled()) {
      ctx.actionBus.emit('stage:poolSelected', {
        stateId: nextState,
        poolFolder: STATE_FOLDERS[nextState] || 'patrol/',
        reason: `visualPool:${state.currentVisualPool}`,
        previousState: state.worldState,
      });
    }

    // WO-DEV-ASSET-PREFLIGHT: Get background with preflight validation
    const bgResult = await selectBackgroundForState(nextState);
    const nextBgUrl = bgResult.url;
    state.currentMissingAsset = bgResult.missingEntry;

    // WO-HUB-04: Preload next background before transition (if valid)
    if (nextBgUrl && !preloadedImages.has(nextBgUrl)) {
      await preloadImage(nextBgUrl);
      preloadedImages.add(nextBgUrl);
    }

    // WO-UX-4: Update evocative captions
    const caption = getWorldStateCaption(nextState);
    state.scenicTitle = caption.title;
    state.scenicSubtitle = caption.subtitle;

    state.worldState = nextState;
    state.currentBgUrl = nextBgUrl;
    render(root, state);
    console.log(`[BadlandsStage] World state transitioned to: ${nextState}`);

    // WO-DEV-RENDER-BINDING: Emit world state changed event
    if (ctx.actionBus && isDevRenderEnabled()) {
      ctx.actionBus.emit('worldState:changed', {
        state: nextState,
        regionName: state.scenicTitle,
        bgUrl: nextBgUrl,
      });
    }

    // Schedule next transition
    scheduleWorldStateTransition();
  }

  function scheduleWorldStateTransition() {
    stopWorldStateTimer();
    const delay = getRandomTransitionTime();
    state.worldStateTimerId = setTimeout(transitionToNextWorldState, delay);
    console.log(`[BadlandsStage] Next world state transition in ${(delay / 1000).toFixed(1)}s`);
  }

  function stopWorldStateTimer() {
    if (state.worldStateTimerId) {
      clearTimeout(state.worldStateTimerId);
      state.worldStateTimerId = null;
    }
  }

  // WO-HUB-04: Initialize world state background with preload and start transition timer
  // WO-DEV-ASSET-PREFLIGHT: Ensure placeholder CSS is loaded if preflight enabled
  ensurePlaceholderCSS();
  const initialBgResult = await selectBackgroundForState(state.worldState);
  const initialBgUrl = initialBgResult.url;
  state.currentMissingAsset = initialBgResult.missingEntry;
  if (initialBgUrl) {
    await preloadImage(initialBgUrl);
    preloadedImages.add(initialBgUrl);
  }
  state.currentBgUrl = initialBgUrl;

  // WO-UX-4: Initialize evocative caption for initial state
  const initialCaption = getWorldStateCaption(state.worldState);
  state.scenicTitle = initialCaption.title;
  state.scenicSubtitle = initialCaption.subtitle;

  scheduleWorldStateTransition();

  // Combat simulation functions
  function startEncounterTimer() {
    stopEncounterTimer(); // Clear any existing timers

    // Get duration from dev config or use default
    const devConfig = getDevConfig();
    const encounterDuration = devConfig.encounterDuration || DEFAULT_ENCOUNTER_DURATION;

    state.timerRemaining = encounterDuration;
    state.timerTotal = encounterDuration;

    // Initialize enemy stats based on encounter difficulty
    const difficulty = state.currentEncounter?.baseDifficulty || 1;
    state.enemyHpMax = 80 + (difficulty * 20); // 100-160 HP based on difficulty
    state.enemyHpCurrent = state.enemyHpMax;
    state.enemyBaseDamage = 10 + (difficulty * 5); // 15-25 damage based on difficulty

    updateTimer(root, state.timerRemaining, state.timerTotal);
    updateEnemyHealth(root, state.enemyHpCurrent, state.enemyHpMax);

    // Timer countdown (visual only, smooth animation)
    state.timerIntervalId = setInterval(() => {
      state.timerRemaining -= TIMER_UPDATE_INTERVAL / 1000;
      if (state.timerRemaining <= 0) {
        state.timerRemaining = 0;
        resolveEncounter();
      }
      updateTimer(root, state.timerRemaining, state.timerTotal);
    }, TIMER_UPDATE_INTERVAL);

    // Combat ticks (discrete rounds)
    state.combatTickIntervalId = setInterval(() => {
      executeCombatRound();
    }, COMBAT_TICK_INTERVAL);

    // Execute first round immediately
    setTimeout(() => executeCombatRound(), 500);
  }

  function executeCombatRound() {
    if (state.stageMode !== 'encounter_autobattler' || !state.currentEncounter) return;

    // Get dev config for modifiers
    const devConfig = getDevConfig();
    const damageMultiplier = (devConfig.damageMultiplier || 100) / 100;
    const godMode = devConfig.godMode || false;

    // --- Avatar's Turn ---
    // Pick a random equipped skill
    const equippedSkills = state.loadout.skills.filter(s => s.id != null);
    const skill = equippedSkills.length > 0
      ? equippedSkills[Math.floor(Math.random() * equippedSkills.length)]
      : { damage: 10, manaCost: 0, staminaCost: 5 }; // Default basic attack

    // Calculate weapon bonus
    const weapon = state.loadout.equipment.find(e => e.slot === 'weapon' && e.id);
    const weaponBonus = weapon?.bonusDamage || 0;

    // Deal damage to enemy (with variance and multiplier)
    const damageVariance = Math.floor(Math.random() * 6) - 2; // -2 to +3
    const baseDamage = skill.damage + weaponBonus + damageVariance;
    const damageDealt = Math.max(1, Math.floor(baseDamage * damageMultiplier));
    state.enemyHpCurrent = Math.max(0, state.enemyHpCurrent - damageDealt);
    updateEnemyHealth(root, state.enemyHpCurrent, state.enemyHpMax);

    // --- Enemy's Turn ---
    // Calculate armor reduction
    const armor = state.loadout.equipment.find(e => e.slot === 'armor' && e.id);
    const damageReduction = armor?.damageReduction || 0;

    // Enemy attacks player (with variance) - skip if god mode
    const enemyVariance = Math.floor(Math.random() * 8) - 3; // -3 to +4
    const damageTaken = godMode ? 0 : Math.max(1, state.enemyBaseDamage + enemyVariance - damageReduction);

    // --- WO-HUB-01: Emit combat tick with explicit vitals impact ---
    if (ctx.actionBus) {
      ctx.actionBus.emit('combat:tick', {
        atMs: Date.now(),
        round: Math.ceil((state.timerTotal - state.timerRemaining) / (COMBAT_TICK_INTERVAL / 1000)),
        actor: 'enemy', // Enemy dealing damage to player
        reason: state.currentEncounter?.type ? `${state.currentEncounter.type}_attack` : 'enemy_attack',
        skillUsed: skill.id || 'basic_attack',
        damageDealt, // Damage to enemy
        damageTaken, // Damage to player
        // Explicit delta format for VitalsLedger
        healthDelta: -damageTaken,
        manaDelta: -(skill.manaCost || 0),
        staminaDelta: -(skill.staminaCost || 0),
        essenceDelta: 0,
        // Legacy format for backwards compatibility
        vitalsImpact: {
          health: -damageTaken,
          mana: -(skill.manaCost || 0),
          stamina: -(skill.staminaCost || 0),
          essence: 0,
        },
      }, 'BadlandsStage');
    }

    // Check for victory
    if (state.enemyHpCurrent <= 0) {
      resolveEncounter();
    }
  }

  function resolveEncounter() {
    stopEncounterTimer();
    state.enemyHpCurrent = 0;
    updateEnemyHealth(root, 0, state.enemyHpMax);

    // Auto-resolve via autobattler
    const hubController = window.__MYFI_DEBUG__?.hubController;
    const autobattler = hubController?.getAutobattler?.();
    if (autobattler?.forceResolve) {
      autobattler.forceResolve();
    }
  }

  function stopEncounterTimer() {
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
    if (state.combatTickIntervalId) {
      clearInterval(state.combatTickIntervalId);
      state.combatTickIntervalId = null;
    }
  }

  // WO-CAPSULE-V2: Capsule auto-collapse timer
  const CAPSULE_COLLAPSE_DELAY = 15000; // 15 seconds before collapsing to orb

  function startCapsuleCollapseTimer() {
    stopCapsuleCollapseTimer(); // Clear any existing timer

    state.capsuleCollapseTimerId = setTimeout(() => {
      // Only collapse if still in pending state (player didn't tap)
      if (state.capsuleState === 'pending') {
        state.capsuleState = 'collapsed';
        render(root, state);
        console.log('[BadlandsStage] Capsule auto-collapsed to orb');
      }
    }, CAPSULE_COLLAPSE_DELAY);
  }

  function stopCapsuleCollapseTimer() {
    if (state.capsuleCollapseTimerId) {
      clearTimeout(state.capsuleCollapseTimerId);
      state.capsuleCollapseTimerId = null;
    }
  }

  // WO-CAPSULE-V2: Quick-engage overlay functions
  const QUICK_ENGAGE_DURATION = 5000; // 5 seconds before auto-dismissing to capsule
  const HOLD_TO_ENGAGE_DURATION = 800; // 800ms hold to engage
  let quickEngageTimerStartMs = 0;
  let quickEngageAnimationId = null;

  function showQuickEngageOverlay(root, state, incident) {
    const overlay = root.querySelector('.BadlandsStage__quickEngage');
    if (!overlay) return;

    // Get incident data
    const icon = incident._enemy?.icon || incident.icon || '&#128058;';
    const title = incident._enemy?.label || incident.label || 'Encounter';
    const flavor = incident.narrative?.captionIn || 'A challenger emerges...';
    const theme = getEncounterTheme(incident);

    // Update overlay content
    const iconEl = root.querySelector('[data-bind="quickEngageIcon"]');
    const titleEl = root.querySelector('[data-bind="quickEngageTitle"]');
    const flavorEl = root.querySelector('[data-bind="quickEngageFlavor"]');
    if (iconEl) iconEl.innerHTML = icon;
    if (titleEl) titleEl.textContent = title;
    if (flavorEl) flavorEl.textContent = flavor;

    // Set theme
    overlay.dataset.theme = theme;
    overlay.dataset.visible = 'true';
    state.quickEngageVisible = true;

    console.log(`[BadlandsStage] Quick-engage overlay shown: ${title}`);
  }

  function hideQuickEngageOverlay(root, state) {
    const overlay = root.querySelector('.BadlandsStage__quickEngage');
    if (overlay) {
      overlay.dataset.visible = 'false';
    }
    state.quickEngageVisible = false;
    stopQuickEngageTimer();
    stopHoldToEngage(root, state);
  }

  function startQuickEngageTimer(root, state) {
    stopQuickEngageTimer();
    quickEngageTimerStartMs = Date.now();

    // Animate the timer bar
    function updateTimer() {
      const elapsed = Date.now() - quickEngageTimerStartMs;
      const remaining = Math.max(0, QUICK_ENGAGE_DURATION - elapsed);
      const percent = (remaining / QUICK_ENGAGE_DURATION) * 100;

      const timerFill = root.querySelector('[data-bind="quickEngageTimerFill"]');
      if (timerFill) {
        timerFill.style.width = `${percent}%`;
      }

      if (remaining <= 0) {
        // Timer expired - transition to capsule notification
        onQuickEngageTimeout(root, state);
      } else {
        quickEngageAnimationId = requestAnimationFrame(updateTimer);
      }
    }
    quickEngageAnimationId = requestAnimationFrame(updateTimer);
  }

  function stopQuickEngageTimer() {
    if (quickEngageAnimationId) {
      cancelAnimationFrame(quickEngageAnimationId);
      quickEngageAnimationId = null;
    }
  }

  async function onQuickEngageTimeout(root, state) {
    console.log('[BadlandsStage] Quick-engage timeout - showing capsule notification');
    hideQuickEngageOverlay(root, state);

    // Create encounter from incident for capsule notification
    if (state.currentIncident) {
      const incident = state.currentIncident;
      state.currentEncounter = {
        id: incident.id,
        type: incident.kind || 'combat',
        label: incident._enemy?.label || incident.label || 'Encounter',
        icon: incident._enemy?.icon || incident.icon || '&#128058;',
        baseDifficulty: incident.mechanics?.difficulty || 1,
        _incidentId: incident.id,
        _incident: incident, // WO-ASSET-ROUTING: Attach incident for routing
      };

      // WO-DIORAMA: Get background using smart resolver with best-match
      let combatBgUrl;
      if (incident.renderPlan?.assetRouting) {
        const bgResult = await selectBackgroundWithSmartResolver(
          incident,
          { clockSegment: state.clockSegment, actionBus: ctx.actionBus },
          import.meta.url
        );
        combatBgUrl = bgResult.url;
      } else {
        combatBgUrl = getRandomBackground('combat', import.meta.url);
      }
      state.pendingCombatBgUrl = combatBgUrl;

      // Show capsule notification
      state.engagementState = 'pending';
      state.capsuleState = 'pending';
      state.notificationExpanded = false;
      state.activeTab = 'current';
      render(root, state);
      startEncounterTimer();
      startCapsuleCollapseTimer();
    }
  }

  // Hold-to-engage logic
  let holdStartMs = 0;
  let holdAnimationId = null;

  function startHoldToEngage(root, state) {
    if (!state.quickEngageVisible) return;

    holdStartMs = Date.now();
    state.quickEngageHoldProgress = 0;

    function updateHold() {
      const elapsed = Date.now() - holdStartMs;
      const progress = Math.min(100, (elapsed / HOLD_TO_ENGAGE_DURATION) * 100);
      state.quickEngageHoldProgress = progress;

      // Update progress bar
      const progressEl = root.querySelector('.BadlandsStage__quickEngageProgress');
      if (progressEl) {
        progressEl.style.width = `${progress}%`;
      }

      if (progress >= 100) {
        // Hold complete - engage!
        onHoldToEngageComplete(root, state);
      } else {
        holdAnimationId = requestAnimationFrame(updateHold);
      }
    }
    holdAnimationId = requestAnimationFrame(updateHold);
  }

  function stopHoldToEngage(root, state) {
    if (holdAnimationId) {
      cancelAnimationFrame(holdAnimationId);
      holdAnimationId = null;
    }
    state.quickEngageHoldProgress = 0;
    const progressEl = root.querySelector('.BadlandsStage__quickEngageProgress');
    if (progressEl) {
      progressEl.style.width = '0%';
    }
  }

  function onHoldToEngageComplete(root, state) {
    console.log('[BadlandsStage] Hold-to-engage complete - engaging with journey');
    hideQuickEngageOverlay(root, state);

    // Emit episode:engage to trigger the full journey
    if (ctx.actionBus) {
      ctx.actionBus.emit('episode:engage');
    }
  }

  // Initial render
  render(root, state);

  // Bind interactions
  bindInteractions(root, state, ctx);

  // WO-CAPSULE-V2: Bind hold-to-engage touch/mouse events
  // These are separate from bindInteractions because they need access to the closure functions
  const holdToEngageBtn = root.querySelector('[data-action="holdToEngage"]');
  if (holdToEngageBtn) {
    // Mouse events
    holdToEngageBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startHoldToEngage(root, state);
    });
    holdToEngageBtn.addEventListener('mouseup', () => {
      stopHoldToEngage(root, state);
    });
    holdToEngageBtn.addEventListener('mouseleave', () => {
      stopHoldToEngage(root, state);
    });

    // Touch events
    holdToEngageBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startHoldToEngage(root, state);
    });
    holdToEngageBtn.addEventListener('touchend', () => {
      stopHoldToEngage(root, state);
    });
    holdToEngageBtn.addEventListener('touchcancel', () => {
      stopHoldToEngage(root, state);
    });
  }

  // Subscribe to events
  const unsubscribers = [];
  if (ctx.actionBus && ctx.actionBus.subscribe) {
    // State changes (only for non-encounter properties)
    // NOTE: stageMode and currentEncounter are controlled by autobattler events,
    // not hub:stateChange, to prevent race conditions where hub state resets
    // active encounters back to 'world' mode
    unsubscribers.push(
      ctx.actionBus.subscribe('hub:stateChange', (hubState) => {
        if (hubState?.badlandsStage) {
          // Only update stageBgUrl from hub state (visual config)
          // Do NOT update stageMode or currentEncounter here - those are
          // controlled by autobattler:spawn and autobattler:resolve events
          if (hubState.badlandsStage.stageBgUrl) {
            state.stageBgUrl = hubState.badlandsStage.stageBgUrl;
          }
          render(root, state);
        }
      })
    );

    // Encounter spawned (from autobattler)
    // WO-LIVE-DEMO: Show capsule notification first, then expand if player taps
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:spawn', async (encounter) => {
        // Pause world state transitions during combat
        stopWorldStateTimer();

        // WO-DIORAMA: Use smart resolver for best-match background selection
        let combatBgUrl;
        const incident = encounter._incident || state.currentIncident;
        if (incident?.renderPlan?.assetRouting) {
          const bgResult = await selectBackgroundWithSmartResolver(
            incident,
            { clockSegment: state.clockSegment, actionBus: ctx.actionBus },
            import.meta.url
          );
          combatBgUrl = bgResult.url;
          console.log(`[BadlandsStage] Smart resolver bg: ${bgResult.folderUsed} (level ${bgResult.fallbackLevel})`);
        } else {
          combatBgUrl = getRandomBackground('combat', import.meta.url);
        }

        // WO-HUB-04: Preload combat background before showing
        if (!preloadedImages.has(combatBgUrl)) {
          await preloadImage(combatBgUrl);
          preloadedImages.add(combatBgUrl);
        }

        state.currentEncounter = encounter;
        state.pendingCombatBgUrl = combatBgUrl; // Store for when player engages

        // WO-CAPSULE-V2: Show capsule notification at top
        // Background stays as current world state, capsule appears at top
        state.engagementState = 'pending';
        state.capsuleState = 'pending';
        state.notificationExpanded = false;
        state.activeTab = 'current'; // Switch to current tab
        render(root, state);
        startEncounterTimer(); // Start countdown (shows on capsule and orb)

        // WO-CAPSULE-V2: Auto-collapse to orb after brief delay
        startCapsuleCollapseTimer();
      })
    );

    // Encounter resolved (from autobattler)
    unsubscribers.push(
      ctx.actionBus.subscribe('autobattler:resolve', async (result) => {
        stopEncounterTimer(); // Stop countdown
        // Add to recent events
        if (state.currentEncounter) {
          state.recentEvents.unshift({
            id: `event-${Date.now()}`,
            name: state.currentEncounter.label || state.currentEncounter.name || 'Unknown Encounter',
            icon: state.currentEncounter.icon || '&#128058;',
            result: result?.isVictory ? 'victory' : 'defeat',
            timestamp: Date.now(),
            details: result?.summary || 'Encounter resolved.',
          });
          // Keep only last 10 events
          if (state.recentEvents.length > 10) {
            state.recentEvents.pop();
          }
        }

        // WO-HUB-04: Preload world state background before showing
        // WO-DEV-ASSET-PREFLIGHT: Use preflight for background selection
        const worldBgResult = await selectBackgroundForState(state.worldState);
        const worldBgUrl = worldBgResult.url;
        state.currentMissingAsset = worldBgResult.missingEntry;
        if (worldBgUrl && !preloadedImages.has(worldBgUrl)) {
          await preloadImage(worldBgUrl);
          preloadedImages.add(worldBgUrl);
        }

        state.stageMode = 'world';
        state.currentEncounter = null;
        state.currentBgUrl = worldBgUrl;
        // WO-LIVE-DEMO: Reset engagement state
        state.engagementState = 'inactive';
        state.notificationExpanded = false;
        state.pendingCombatBgUrl = null;
        // WO-CAPSULE-V2: Reset capsule state
        state.capsuleState = 'hidden';
        stopCapsuleCollapseTimer();
        render(root, state);

        // Resume world state transitions
        scheduleWorldStateTransition();
      })
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // WO-STAGE-EPISODES-V1: Episode System Subscriptions
    // ═══════════════════════════════════════════════════════════════════════════

    // Episode started
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:started', (data) => {
        state.episodeActive = true;
        state.currentEpisode = data.episode;
        state.currentIncident = data.incident;
        state.episodePhase = 'setup';
        console.log(`[BadlandsStage] Episode started: ${data.episode.id}`);
      })
    );

    // Episode phase change
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:phaseChange', (data) => {
        state.episodePhase = data.newPhase;
        state.currentIncident = data.incident; // Update incident reference
        console.log(`[BadlandsStage] Episode phase: ${data.newPhase}`);

        // WO-S3: Show unified overlay for ALL incident types when active
        if (data.newPhase === 'active') {
          // Overlay rendering is handled by episode:active event
        } else if (data.newPhase === 'resolving' || data.newPhase === 'after') {
          // Hide slow-time overlay
          state.awaitingEngagement = false;
          state.isPlayerEngaged = false;
          hideSlowTimeOverlay(root);
        }
      })
    );

    // Episode setup (show caption)
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:setup', (data) => {
        if (data.narrative?.captionIn) {
          showEpisodeCaption(root, data.narrative.captionIn);
        }
      })
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // WO-CAPSULE-V2: DISABLED - Legacy slow-time overlay and tagging menu
    // These handlers are kept for future reference/repurposing but are disabled.
    // The new flow uses: Capsule notification → Collapse to orb → HUD → Engage
    // To re-enable: uncomment the renderSlowTimeOverlay() calls below
    // ═══════════════════════════════════════════════════════════════════════════

    // WO-S3: Episode active - show quick-engage overlay
    // WO-CAPSULE-V2: Shows brief overlay, if timeout → capsule notification
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:active', (data) => {
        state.slowTimeTimerTotal = data.incident?.mechanics?.durationS || 30;
        state.slowTimeTimerRemaining = state.slowTimeTimerTotal;
        state.currentIncident = data.incident;
        state.overlayConfig = data.overlayConfig || data.incident?._overlayConfig;
        state.awaitingEngagement = data.awaitingEngagement !== false;
        state.isPlayerEngaged = false;

        const mechanicsMode = data.mechanicsMode || data.incident?.mechanics?.mode;
        console.log(`[BadlandsStage] Episode active - showing quick-engage overlay`);

        // WO-DEV-RENDER-BINDING: Emit incident shown trace event
        if (isDevRenderEnabled()) {
          ctx.actionBus.emit('stage:incidentShown', {
            incidentType: data.incident?.type,
            mode: mechanicsMode,
            durationMs: state.slowTimeTimerTotal * 1000,
            awaitingEngagement: state.awaitingEngagement,
          });
        }

        // WO-CAPSULE-V2: Show quick-engage overlay
        showQuickEngageOverlay(root, state, data.incident);
        startQuickEngageTimer(root, state);
      })
    );

    // WO-S3: Episode engaged - player chose to engage
    // WO-CAPSULE-V2: DISABLED - tagging menu replaced by HUD engage flow
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:engaged', (data) => {
        state.isPlayerEngaged = true;
        state.awaitingEngagement = false;
        state.currentIncident = data.incident;
        console.log('[BadlandsStage] Player engaged (tagging menu disabled)');

        // WO-CAPSULE-V2: DISABLED - tagging options overlay
        // Engagement now happens via capsule HUD, not slow-time overlay
        // renderSlowTimeOverlay(root, state);
      })
    );

    // Episode timer tick
    // WO-CAPSULE-V2: Timer updates now go to capsule/orb/HUD elements
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:timerTick', (data) => {
        state.slowTimeTimerRemaining = data.remainingMs / 1000;
        // WO-CAPSULE-V2: DISABLED - slow-time timer display
        // updateSlowTimeTimer(root, data.remainingMs, data.totalMs);
      })
    );

    // Episode resolved
    unsubscribers.push(
      ctx.actionBus.subscribe('episode:resolved', (data) => {
        state.episodeActive = false;
        state.currentEpisode = null;
        state.currentIncident = null;
        state.episodePhase = null;
        hideSlowTimeOverlay(root);

        // WO-CAPSULE-FIX: Reset capsule and engagement state on episode resolution
        state.capsuleState = 'hidden';
        state.engagementState = 'inactive';
        state.notificationExpanded = false;
        state.currentEncounter = null;
        stopCapsuleCollapseTimer();

        // Add to recent events (from episode)
        if (data.incident) {
          state.recentEvents.unshift({
            id: `event-${Date.now()}`,
            name: data.incident.narrative?.captionIn || 'Episode',
            icon: data.incident._enemy?.icon || '&#128176;',
            result: data.resolution?.mode === 'player' ? 'tagged' : 'auto',
            timestamp: Date.now(),
            details: `Tagged as: ${data.resolution?.choiceId || 'auto'}`,
          });
          if (state.recentEvents.length > 10) {
            state.recentEvents.pop();
          }
        }
        render(root, state);

        console.log(`[BadlandsStage] Episode resolved: ${data.episode.id}`);
      })
    );

    // WO-STAGE-EPISODES-V1: Queue status indicator
    unsubscribers.push(
      ctx.actionBus.subscribe('stageSignals:queueStatus', (data) => {
        state.queueLength = data.queueLength;
        updateQueueIndicator(root, data.queueLength);
      })
    );

    // WO-S5: Scene Beat added - update Recent Events
    unsubscribers.push(
      ctx.actionBus.subscribe('sceneBeat:added', (data) => {
        const beat = data.beat;
        if (beat && beat.display) {
          // WO-UX-NEXT: Show Resolution Echo for cause→effect visibility
          showResolutionEcho(root, beat);

          // Convert scene beat to recent event format
          state.recentEvents.unshift({
            id: beat.id,
            name: beat.display.title,
            icon: beat.display.icon,
            result: beat.resolvedBy,
            timestamp: beat.time,
            details: beat.display.choiceLabel
              ? `Tagged as: ${beat.display.choiceLabel}`
              : beat.display.subtitle,
            // WO-S5: Enhanced data from scene beat
            location: beat.display.locationLabel,
            vitalsImpact: beat.display.vitalsImpact,
            resultBadge: beat.display.resultBadge,
          });

          // Keep only last 10 events
          if (state.recentEvents.length > 10) {
            state.recentEvents.pop();
          }

          render(root, state);
        }
      })
    );

    // WO-WATCH-EPISODE-ROUTING: Activity state changed - update visual pool and caption
    unsubscribers.push(
      ctx.actionBus.subscribe('activityState:changed', (data) => {
        const newState = data.to;
        if (newState) {
          state.currentActivityState = newState;
          state.currentVisualPool = newState.visualPool || 'default';
          console.log(`[BadlandsStage] Activity state: ${newState.label}, visual pool: ${state.currentVisualPool}`);

          // Update segment caption
          updateSegmentCaption(root, newState.label);

          // Optionally trigger immediate world state transition to align with new activity
          // Only if not in combat and enough time has passed since last transition
          if (state.stageMode !== 'encounter_autobattler' && data.reason !== 'init') {
            // Check if current world state aligns with new visual pool
            const biasedStates = VISUAL_POOL_STATE_BIAS[state.currentVisualPool] || WORLD_STATE_CYCLE;
            if (!biasedStates.includes(state.worldState)) {
              // Current world state doesn't fit new activity, transition soon
              stopWorldStateTimer();
              state.worldStateTimerId = setTimeout(transitionToNextWorldState, 2000);
              console.log(`[BadlandsStage] World state doesn't fit activity, transitioning in 2s`);
            }
          }
        }
      })
    );

    // WO-WATCH-EPISODE-ROUTING: Clock tick - update time display
    unsubscribers.push(
      ctx.actionBus.subscribe('activityState:progress', (data) => {
        // Get clock state from debug (or could be passed in progress event)
        const clock = window.__MYFI_DEBUG__?.episodeClock;
        if (clock) {
          const clockState = clock.getState();
          updateSegmentCaptionTime(root, clockState.timeString, clockState.segmentLabel);
        }
      })
    );

  }

  return {
    unmount() {
      stopEncounterTimer(); // Clean up combat timer
      stopWorldStateTimer(); // Clean up world state timer
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      root.remove();
    },
    update(newData) {
      if (newData.badlandsStage) {
        Object.assign(state, newData.badlandsStage);
        render(root, state);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Interactions
// ═══════════════════════════════════════════════════════════════════════════════

function bindInteractions(root, state, ctx) {
  const container = root.querySelector('.BadlandsStage__container');
  if (!container) return;

  // WO-HUB-02: Tab toast timeout tracker (closure reference)
  let tabToastTimeoutId = null;

  // WO-S10: Swipe navigation for tab switching
  // WO-HUB-LAYOUT-REVERT: 3 tabs - Current | Narrative | Recent (swapped order)
  const TABS = ['current', 'narrative', 'recent'];
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeTracking = false;

  const content = container.querySelector('.BadlandsStage__content');
  if (content) {
    content.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swipeTracking = true;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      if (!swipeTracking) return;
      swipeTracking = false;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - swipeStartX;
      const deltaY = touch.clientY - swipeStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Only horizontal swipes, minimum 50px, horizontal > vertical
      if (absDeltaX > 50 && absDeltaX > absDeltaY * 1.5) {
        const currentIndex = TABS.indexOf(state.activeTab);
        let newIndex = currentIndex;

        if (deltaX < 0 && currentIndex < TABS.length - 1) {
          // Swipe left → next tab
          newIndex = currentIndex + 1;
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right → previous tab
          newIndex = currentIndex - 1;
        }

        if (newIndex !== currentIndex) {
          state.activeTab = TABS[newIndex];
          render(root, state);

          // Show tab toast
          const dot = container.querySelector(`[data-tab="${TABS[newIndex]}"]`);
          if (dot) {
            const icon = dot.dataset.icon || '';
            const label = dot.dataset.label || TABS[newIndex];
            showTabToast(root, icon, label, tabToastTimeoutId, (newTimeoutId) => {
              tabToastTimeoutId = newTimeoutId;
            });
          }
        }
      }
    }, { passive: true });

    content.addEventListener('touchcancel', () => {
      swipeTracking = false;
    }, { passive: true });
  }

  // Tab/Dot switching
  container.addEventListener('click', (e) => {
    const dotBtn = e.target.closest('[data-action="switchTab"]');
    if (dotBtn) {
      const tab = dotBtn.dataset.tab;
      if (tab && tab !== state.activeTab) {
        state.activeTab = tab;
        render(root, state);

        // WO-HUB-02: Show tab toast with icon and label from dot data attributes
        const icon = dotBtn.dataset.icon || '';
        const label = dotBtn.dataset.label || tab;
        showTabToast(root, icon, label, tabToastTimeoutId, (newTimeoutId) => {
          tabToastTimeoutId = newTimeoutId;
        });
      }
      return;
    }

    // Aid Avatar button
    const aidBtn = e.target.closest('[data-action="aidAvatar"]');
    if (aidBtn) {
      showToast(root, 'aid');
      return;
    }

    // Recent event tap (expand in-place)
    const recentItem = e.target.closest('.BadlandsStage__recentItem:not(.BadlandsStage__recentItem--empty)');
    if (recentItem) {
      recentItem.classList.toggle('BadlandsStage__recentItem--expanded');
      return;
    }

    // Skill slot tap (open picker)
    const skillSlot = e.target.closest('[data-action="editSkill"]');
    if (skillSlot) {
      state.selectedSkillSlot = parseInt(skillSlot.dataset.slot, 10);
      showModal(root, 'skillPicker');
      return;
    }

    // Skill option selection
    const skillOption = e.target.closest('.BadlandsStage__skillOption');
    if (skillOption && state.selectedSkillSlot != null) {
      const skillId = skillOption.dataset.skill;
      // Update loadout
      const slotIndex = state.loadout.skills.findIndex(s => s.slot === state.selectedSkillSlot);
      if (slotIndex !== -1 && skillId) {
        const skillData = getSkillData(skillId);
        state.loadout.skills[slotIndex] = {
          ...state.loadout.skills[slotIndex],
          id: skillId,
          name: skillData.name,
          icon: skillData.icon,
          // Combat stats
          damage: skillData.damage,
          manaCost: skillData.manaCost,
          staminaCost: skillData.staminaCost,
        };
        render(root, state);
      }
      hideModal(root, 'skillPicker');
      state.selectedSkillSlot = null;
      return;
    }

    // Close modal
    const closeModal = e.target.closest('[data-action="closeModal"]');
    if (closeModal) {
      hideModal(root, 'skillPicker');
      state.selectedSkillSlot = null;
      return;
    }

    // WO-CAPSULE-V2: Event capsule/orb tap - expand to HUD
    const expandTrigger = e.target.closest('[data-action="expandEvent"]');
    if (expandTrigger && (state.capsuleState === 'pending' || state.capsuleState === 'collapsed')) {
      // Player tapped capsule or orb - show HUD
      state.capsuleState = 'expanded';
      render(root, state);
      console.log('[BadlandsStage] Player expanded event notification to HUD');
      return;
    }

    // WO-CAPSULE-V2: HUD backdrop/close tap - collapse back to orb
    const collapseTrigger = e.target.closest('[data-action="collapseEvent"]');
    if (collapseTrigger && state.capsuleState === 'expanded') {
      state.capsuleState = 'collapsed';
      render(root, state);
      console.log('[BadlandsStage] Player collapsed HUD back to orb');
      return;
    }

    // WO-CAPSULE-V2: Engage button tap - engage with event
    const engageTrigger = e.target.closest('[data-action="engageEvent"]');
    if (engageTrigger && state.capsuleState === 'expanded') {
      // Player engaged - update state and re-render
      state.capsuleState = 'engaged';
      state.engagementState = 'engaged';
      state.notificationExpanded = true;
      // Switch to combat background
      if (state.pendingCombatBgUrl) {
        state.currentBgUrl = state.pendingCombatBgUrl;
      }
      state.stageMode = 'encounter_autobattler';
      render(root, state);
      console.log('[BadlandsStage] Player engaged with event');

      // Emit activity state change to 'engaged' (stubbed for now)
      if (ctx.actionBus) {
        ctx.actionBus.emit('engagement:started', {
          encounter: state.currentEncounter,
          activityState: 'engaged',
        });
      }
      return;
    }

    // Modal backdrop click
    const modal = e.target.closest('.BadlandsStage__modal');
    if (modal && e.target === modal) {
      modal.dataset.visible = 'false';
      state.selectedSkillSlot = null;
      return;
    }

    // WO-STAGE-EPISODES-V1: Tagging option selection
    const taggingOption = e.target.closest('[data-action="submitTagChoice"]');
    if (taggingOption && ctx.actionBus) {
      const choiceId = taggingOption.dataset.choice;
      console.log(`[BadlandsStage] Tagging choice: ${choiceId}`);
      ctx.actionBus.emit('episode:submitChoice', { choiceId });
      return;
    }

    // WO-STAGE-EPISODES-V1: Skip tagging (let autopilot handle)
    const skipBtn = e.target.closest('[data-action="skipTagging"]');
    if (skipBtn && ctx.actionBus) {
      console.log('[BadlandsStage] Skip tagging - letting autopilot handle');
      // Emit with unknown choice to trigger auto-resolution
      ctx.actionBus.emit('episode:submitChoice', { choiceId: 'unknown' });
      return;
    }

    // WO-S3: Engage button - player chooses to engage with incident
    const engageBtn = e.target.closest('[data-action="engage"]');
    if (engageBtn && ctx.actionBus) {
      console.log('[BadlandsStage] Player engaging with incident');
      ctx.actionBus.emit('episode:engage');
      return;
    }

    // WO-S3: Skip button - player skips incident (autopilot)
    const skipIncidentBtn = e.target.closest('[data-action="skip"]');
    if (skipIncidentBtn && ctx.actionBus) {
      console.log('[BadlandsStage] Player skipping incident');
      ctx.actionBus.emit('episode:skip');
      return;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════════════════

function render(root, state) {
  const container = root.querySelector('.BadlandsStage__container');
  if (!container) return;

  // Set stage background URL via CSS custom property
  // Background is managed by world state system (combat or world states: rest, patrol, explore, return, city)
  // state.currentBgUrl is set by world state transitions or combat spawn
  let stageBgUrl = state.currentBgUrl;
  if (!stageBgUrl && state.stageBgUrl) {
    // VM override (legacy support)
    stageBgUrl = new URL(state.stageBgUrl, document.baseURI).href;
  }
  if (!stageBgUrl && !state.currentMissingAsset) {
    // Fallback to current world state (only if no missing asset tracked)
    stageBgUrl = getRandomBackground(state.worldState, import.meta.url);
  }

  // WO-DEV-ASSET-PREFLIGHT: Handle missing asset placeholder
  renderMissingAssetPlaceholder(root, state);

  if (stageBgUrl) {
    container.style.setProperty('--stage-bg-url', `url('${stageBgUrl}')`);
  } else {
    // No background - use solid color fallback
    container.style.setProperty('--stage-bg-url', 'none');
  }

  // Set active tab and stage mode
  container.dataset.activeTab = state.activeTab;
  container.dataset.stageMode = state.stageMode;

  // Update dot navigation active state
  const dots = container.querySelectorAll('.BadlandsStage__dot');
  dots.forEach(dot => {
    dot.classList.toggle('BadlandsStage__dot--active', dot.dataset.tab === state.activeTab);
  });

  // Render current event tab content
  renderCurrentEvent(root, state);

  // Render recent events and narrative log
  renderRecentEvents(root, state);
  renderNarrativeLog(root, state);

  // WO-DEV-RENDER-BINDING: Update dev overlay if enabled
  updateDevRenderOverlay(root, state);
}

function renderCurrentEvent(root, state) {
  const scenic = root.querySelector('.BadlandsStage__scenic');
  const encounter = root.querySelector('.BadlandsStage__encounter');

  // WO-CAPSULE-V2: Get all notification elements
  const capsule = root.querySelector('.BadlandsStage__eventCapsule');
  const orb = root.querySelector('.BadlandsStage__eventOrb');
  const hud = root.querySelector('.BadlandsStage__eventHUD');

  // WO-CAPSULE-V2: Get encounter theme
  const theme = getEncounterTheme(state.currentEncounter);

  // WO-CAPSULE-V2: Handle notification state machine
  // States: hidden → pending → collapsed → expanded → engaged
  if (state.currentEncounter && state.capsuleState !== 'engaged') {
    const encounterIcon = state.currentEncounter.icon || '&#128058;';
    const encounterLabel = state.currentEncounter.label || state.currentEncounter.name || 'Encounter';
    const encounterType = (state.currentEncounter.type || 'ENCOUNTER').toUpperCase();

    // PENDING: Show full capsule banner at top
    if (capsule) {
      if (state.capsuleState === 'pending') {
        capsule.dataset.visible = 'true';
        capsule.dataset.theme = theme;
        // Update capsule content
        const capsuleIcon = root.querySelector('[data-bind="capsuleIcon"]');
        const capsuleTitle = root.querySelector('[data-bind="capsuleTitle"]');
        const capsuleType = root.querySelector('[data-bind="capsuleType"]');
        if (capsuleIcon) capsuleIcon.innerHTML = encounterIcon;
        if (capsuleTitle) capsuleTitle.textContent = encounterLabel;
        if (capsuleType) capsuleType.textContent = encounterType;
      } else {
        capsule.dataset.visible = 'false';
      }
    }

    // COLLAPSED: Show orb at top-right with radial timer
    if (orb) {
      if (state.capsuleState === 'collapsed') {
        orb.dataset.visible = 'true';
        orb.dataset.theme = theme;
        const orbIcon = root.querySelector('[data-bind="orbIcon"]');
        if (orbIcon) orbIcon.innerHTML = encounterIcon;
      } else {
        orb.dataset.visible = 'false';
      }
    }

    // EXPANDED: Show HUD panel with scene log and engage button
    if (hud) {
      if (state.capsuleState === 'expanded') {
        hud.dataset.visible = 'true';
        hud.dataset.theme = theme;
        // Update HUD content
        const hudIcon = root.querySelector('[data-bind="hudIcon"]');
        const hudTitle = root.querySelector('[data-bind="hudTitle"]');
        const hudType = root.querySelector('[data-bind="hudType"]');
        if (hudIcon) hudIcon.innerHTML = encounterIcon;
        if (hudTitle) hudTitle.textContent = encounterLabel;
        if (hudType) hudType.textContent = encounterType;
        // Populate scene log (stubbed for now - would pull from sceneBeatLog)
        renderHUDSceneLog(root, state);
      } else {
        hud.dataset.visible = 'false';
      }
    }

    // Show scenic background while not engaged
    if (scenic) scenic.dataset.visible = 'true';
    if (encounter) encounter.dataset.visible = 'false';

    // WO-UX-4: Update evocative captions
    const titleEl = root.querySelector('[data-bind="scenicTitle"]');
    const subtitleEl = root.querySelector('[data-bind="scenicSubtitle"]');
    if (titleEl) titleEl.textContent = state.scenicTitle;
    if (subtitleEl) subtitleEl.textContent = state.scenicSubtitle;

  } else if (state.stageMode === 'encounter_autobattler' && state.currentEncounter && state.capsuleState === 'engaged') {
    // ENGAGED: Show full encounter overlay
    // Hide all notification elements
    if (capsule) capsule.dataset.visible = 'false';
    if (orb) orb.dataset.visible = 'false';
    if (hud) hud.dataset.visible = 'false';

    if (scenic) scenic.dataset.visible = 'false';
    if (encounter) {
      encounter.dataset.visible = 'true';

      // Update encounter details
      const iconEl = root.querySelector('[data-bind="encounterIcon"]');
      const nameEl = root.querySelector('[data-bind="encounterName"]');
      const typeEl = root.querySelector('[data-bind="encounterType"]');
      const spriteEl = root.querySelector('[data-bind="enemySprite"]');

      // Use innerHTML for icons (HTML entities like &#128058;)
      if (iconEl) iconEl.innerHTML = state.currentEncounter.icon || '&#128058;';
      // Use label (from autobattler) with fallback to name
      if (nameEl) nameEl.textContent = state.currentEncounter.label || state.currentEncounter.name || 'Unknown';
      if (typeEl) typeEl.textContent = (state.currentEncounter.type || 'ENCOUNTER').toUpperCase();
      if (spriteEl) spriteEl.innerHTML = state.currentEncounter.icon || '&#128058;';
    }
  } else {
    // No event or cleared - hide all notifications, show scenic
    if (capsule) capsule.dataset.visible = 'false';
    if (orb) orb.dataset.visible = 'false';
    if (hud) hud.dataset.visible = 'false';

    if (scenic) scenic.dataset.visible = 'true';
    if (encounter) encounter.dataset.visible = 'false';

    // WO-UX-4: Update evocative captions
    const titleEl = root.querySelector('[data-bind="scenicTitle"]');
    const subtitleEl = root.querySelector('[data-bind="scenicSubtitle"]');
    if (titleEl) titleEl.textContent = state.scenicTitle;
    if (subtitleEl) subtitleEl.textContent = state.scenicSubtitle;
  }
}

// WO-CAPSULE-V2: Render scene log in HUD
function renderHUDSceneLog(root, state) {
  const logContent = root.querySelector('[data-bind="hudSceneLog"]');
  if (!logContent) return;

  // Get recent scene beats from sceneBeatLog if available
  const sceneBeatLog = window.__MYFI_DEBUG__?.sceneBeatLog;
  const recentBeats = sceneBeatLog?.getRecentBeats?.(5) || [];

  if (recentBeats.length === 0) {
    // Show placeholder entry
    logContent.innerHTML = `
      <div class="BadlandsStage__hudSceneEntry">
        <span class="BadlandsStage__hudSceneTime">--:--</span>
        <span class="BadlandsStage__hudSceneText">A challenger approaches from the wilds...</span>
      </div>
    `;
  } else {
    logContent.innerHTML = recentBeats.map(beat => {
      const time = new Date(beat.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `
        <div class="BadlandsStage__hudSceneEntry">
          <span class="BadlandsStage__hudSceneTime">${time}</span>
          <span class="BadlandsStage__hudSceneText">${beat.narrative || beat.label || 'Event occurred'}</span>
        </div>
      `;
    }).join('');
  }
}

// WO-LIVE-DEMO: Get encounter theme for capsule styling
function getEncounterTheme(encounter) {
  if (!encounter) return 'default';
  const type = (encounter.type || '').toLowerCase();
  if (type === 'combat' || type === 'beast' || type === 'hostile') return 'combat';
  if (type === 'social' || type === 'choice' || type === 'npc') return 'social';
  return 'default';
}

// WO-HUB-LAYOUT: Narrative Log tab (placeholder)
// Chronicles the avatar's day as a narrative summary
function renderNarrativeLog(root, state) {
  const listEl = root.querySelector('[data-bind="narrativeList"]');
  if (!listEl) return;

  if (!state.narrativeEntries || state.narrativeEntries.length === 0) {
    listEl.innerHTML = `
      <div class="BadlandsStage__narrativeEntry BadlandsStage__narrativeEntry--placeholder">
        <span class="BadlandsStage__narrativeText">Your journey awaits... The narrative log will chronicle your avatar's day as events unfold.</span>
      </div>
    `;
  } else {
    listEl.innerHTML = state.narrativeEntries.map(entry => `
      <div class="BadlandsStage__narrativeEntry">
        <span class="BadlandsStage__narrativeTime">${entry.time || ''}</span>
        <span class="BadlandsStage__narrativeText">${entry.text}</span>
      </div>
    `).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-HUB-LAYOUT: DEPRECATED - Migrated to WorldMap component
// Kept for reference during migration and backwards compatibility
// ═══════════════════════════════════════════════════════════════════════════════

function renderRecentEvents(root, state) {
  const listEl = root.querySelector('[data-bind="recentList"]');
  if (!listEl) return;

  if (state.recentEvents.length === 0) {
    listEl.innerHTML = `
      <li class="BadlandsStage__recentItem BadlandsStage__recentItem--empty">
        <span class="BadlandsStage__recentItemText">No recent encounters</span>
      </li>
    `;
  } else {
    listEl.innerHTML = state.recentEvents.map(event => `
      <li class="BadlandsStage__recentItem" data-result="${event.result || 'auto'}">
        <div class="BadlandsStage__recentItemMain">
          <span class="BadlandsStage__recentItemIcon">${event.icon}</span>
          <div class="BadlandsStage__recentItemInfo">
            <span class="BadlandsStage__recentItemName">${event.name}</span>
            <span class="BadlandsStage__recentItemTime">${formatTimeAgo(event.timestamp)}</span>
          </div>
          ${event.resultBadge ? `
            <span class="BadlandsStage__recentItemBadge BadlandsStage__recentItemBadge--${event.resultBadge.class}">
              ${event.resultBadge.label}
            </span>
          ` : ''}
        </div>
        <div class="BadlandsStage__recentItemDetails">
          ${event.details}
          ${event.location ? `<span class="BadlandsStage__recentItemLocation">${event.location}</span>` : ''}
        </div>
        ${event.vitalsImpact ? `
          <div class="BadlandsStage__recentItemVitals">
            ${event.vitalsImpact.map(v => `
              <span class="BadlandsStage__recentItemVital BadlandsStage__recentItemVital--${v.isPositive ? 'positive' : 'negative'}">
                ${v.label}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </li>
    `).join('');
  }
}

function renderLoadout(root, state) {
  const skillSlotsEl = root.querySelector('[data-bind="skillSlots"]');
  if (skillSlotsEl) {
    skillSlotsEl.innerHTML = state.loadout.skills.map(skill => `
      <div class="BadlandsStage__skillSlot ${skill.id ? '' : 'BadlandsStage__skillSlot--empty'}"
           data-slot="${skill.slot}"
           data-action="editSkill">
        <span class="BadlandsStage__skillIcon">${skill.icon}</span>
        <span class="BadlandsStage__skillName">${skill.name}</span>
      </div>
    `).join('');
  }

  const equipSlotsEl = root.querySelector('[data-bind="equipSlots"]');
  if (equipSlotsEl) {
    equipSlotsEl.innerHTML = state.loadout.equipment.map(equip => `
      <div class="BadlandsStage__equipSlot ${equip.id ? '' : 'BadlandsStage__equipSlot--empty'}"
           data-slot="${equip.slot}"
           data-action="editEquip">
        <span class="BadlandsStage__equipIcon">${equip.icon}</span>
        <span class="BadlandsStage__equipName">${equip.name}</span>
        ${equip.stat ? `<span class="BadlandsStage__equipStat">${equip.stat}</span>` : ''}
      </div>
    `).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function updateTimer(root, remaining, total) {
  const timerValue = root.querySelector('[data-bind="timerValue"]');
  const timerFill = root.querySelector('[data-bind="timerFill"]');
  const timerContainer = root.querySelector('.BadlandsStage__encounterTimer');

  // Calculate percent and urgency once for all timer elements
  const percent = total > 0 ? (remaining / total) * 100 : 0;
  const urgency = percent > 50 ? 'normal' : percent > 25 ? 'warning' : 'critical';

  // Update encounter timer
  if (timerValue) {
    timerValue.textContent = Math.ceil(remaining);
  }
  if (timerFill && total > 0) {
    timerFill.style.width = `${percent}%`;
    timerFill.dataset.urgency = urgency;
    if (timerContainer) timerContainer.dataset.urgency = urgency;
  }

  // WO-CAPSULE-V2: Update all notification timer elements
  // Capsule timer bar (pending state)
  const capsuleTimerFill = root.querySelector('[data-bind="capsuleTimerFill"]');
  const capsuleTimerValue = root.querySelector('[data-bind="capsuleTimerValue"]');
  const capsuleTimerBar = root.querySelector('.BadlandsStage__capsuleTimerBar');

  if (capsuleTimerFill && total > 0) {
    capsuleTimerFill.style.width = `${percent}%`;
    capsuleTimerFill.dataset.urgency = urgency;
    if (capsuleTimerBar) capsuleTimerBar.dataset.urgency = urgency;
  }
  if (capsuleTimerValue) {
    capsuleTimerValue.textContent = `${Math.ceil(remaining)}s`;
  }

  // WO-CAPSULE-V2: Update orb radial timer (collapsed state)
  // SVG circle uses stroke-dashoffset for radial progress
  // circumference = 2 * π * radius = 2 * 3.14159 * 16 ≈ 100.53
  const orbTimerFill = root.querySelector('[data-bind="orbTimerFill"]');
  if (orbTimerFill && total > 0) {
    const circumference = 100.53;
    const offset = circumference * (1 - percent / 100);
    orbTimerFill.style.strokeDashoffset = offset;
    orbTimerFill.dataset.urgency = urgency;
  }

  // WO-CAPSULE-V2: Update HUD timer (expanded state)
  const hudTimerFill = root.querySelector('[data-bind="hudTimerFill"]');
  const hudTimerValue = root.querySelector('[data-bind="hudTimerValue"]');

  if (hudTimerFill && total > 0) {
    hudTimerFill.style.width = `${percent}%`;
    hudTimerFill.dataset.urgency = urgency;
  }
  if (hudTimerValue) {
    hudTimerValue.textContent = `${Math.ceil(remaining)}s`;
  }
}

function updateEnemyHealth(root, current, max) {
  const healthFill = root.querySelector('[data-bind="enemyHealthFill"]');
  if (healthFill && max > 0) {
    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    healthFill.style.width = `${percent}%`;
  }
}

function showToast(root, toastId) {
  const toast = root.querySelector(`[data-toast="${toastId}"]`);
  if (toast) {
    toast.dataset.visible = 'true';
    setTimeout(() => {
      toast.dataset.visible = 'false';
    }, 4000);
  }
}

function showModal(root, modalId) {
  const modal = root.querySelector(`[data-modal="${modalId}"]`);
  if (modal) {
    modal.dataset.visible = 'true';
  }
}

function hideModal(root, modalId) {
  const modal = root.querySelector(`[data-modal="${modalId}"]`);
  if (modal) {
    modal.dataset.visible = 'false';
  }
}

/**
 * WO-HUB-02: Show tab toast with icon and label
 * Displays for 900ms then fades out (400ms CSS transition)
 */
function showTabToast(root, icon, label, currentTimeoutId, setTimeoutId) {
  const toast = root.querySelector('.BadlandsStage__tabToast');
  if (!toast) return;

  // Clear any existing timeout
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }

  // Update toast content
  const iconEl = toast.querySelector('[data-bind="tabToastIcon"]');
  const labelEl = toast.querySelector('[data-bind="tabToastLabel"]');
  if (iconEl) iconEl.innerHTML = icon;
  if (labelEl) labelEl.textContent = label;

  // Show toast
  toast.dataset.visible = 'true';

  // Hide after 900ms (CSS handles the 400ms fade out transition)
  const newTimeoutId = setTimeout(() => {
    toast.dataset.visible = 'false';
  }, 900);

  setTimeoutId(newTimeoutId);
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getSkillData(skillId) {
  const skills = {
    strike: { name: 'Strike', icon: '&#9876;', cost: '8 ST', damage: 15, manaCost: 0, staminaCost: 8 },
    guard: { name: 'Guard', icon: '&#128737;', cost: '3 ST', damage: 5, manaCost: 0, staminaCost: 3 },
    heal: { name: 'Heal', icon: '&#10024;', cost: '10 MP', damage: 0, manaCost: 10, staminaCost: 0 },
  };
  return skills[skillId] || { name: 'Unknown', icon: '&#10067;', cost: '?', damage: 5, manaCost: 0, staminaCost: 5 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-CAPSULE-V2: LEGACY - Slow-Time Overlay Helpers (DISABLED)
// These functions are DISABLED - replaced by capsule notification system.
// Kept for future reference/repurposing. To re-enable, uncomment the calls in
// episode:active and episode:engaged handlers above.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * WO-S3: Render the unified incident overlay
 * WO-CAPSULE-V2: DISABLED - This function is no longer called.
 * Shows for ALL incident types with mode-specific visuals
 * - awaitingEngagement: shows Engage/Skip buttons
 * - isPlayerEngaged: shows tagging options (Growth/Entertainment etc.)
 */
function renderSlowTimeOverlay(root, state) {
  const overlay = root.querySelector('.BadlandsStage__slowTime');
  if (!overlay) return;

  const incident = state.currentIncident;
  if (!incident) {
    overlay.dataset.visible = 'false';
    return;
  }

  // Get overlay config (mode-specific visuals)
  const config = state.overlayConfig || incident._overlayConfig || {
    theme: 'combat',
    icon: '&#9876;',
    title: 'Incident',
    subtitle: 'Something approaches',
    engageLabel: 'Engage',
    engageHint: 'Take action',
    skipLabel: 'Skip',
    skipHint: 'Let autopilot handle',
  };

  // Set overlay theme
  overlay.dataset.theme = config.theme;

  // Update caption (narrative)
  const captionEl = root.querySelector('[data-bind="episodeCaption"]');
  if (captionEl) {
    captionEl.textContent = incident.narrative?.captionIn || config.subtitle;
  }

  // WO-S3: Show incident icon and title
  const incidentIconEl = root.querySelector('[data-bind="incidentIcon"]');
  if (incidentIconEl) {
    // For combat, show enemy icon; otherwise show overlay config icon
    const displayIcon = incident._enemy?.icon || config.icon;
    incidentIconEl.innerHTML = displayIcon;
  }

  const incidentTitleEl = root.querySelector('[data-bind="incidentTitle"]');
  if (incidentTitleEl) {
    // For combat, show enemy label; otherwise show config title
    const displayTitle = incident._enemy?.label || config.title;
    incidentTitleEl.textContent = displayTitle;
  }

  // WO-S3: Render Engage/Skip buttons OR tagging options based on state
  const actionsEl = root.querySelector('[data-bind="overlayActions"]');
  if (actionsEl) {
    if (state.awaitingEngagement && !state.isPlayerEngaged) {
      // Show Engage/Skip buttons
      actionsEl.innerHTML = `
        <button class="BadlandsStage__overlayBtn BadlandsStage__overlayBtn--engage" data-action="engage">
          <span class="BadlandsStage__overlayBtnLabel">${config.engageLabel}</span>
          <span class="BadlandsStage__overlayBtnHint">${config.engageHint}</span>
        </button>
        <button class="BadlandsStage__overlayBtn BadlandsStage__overlayBtn--skip" data-action="skip">
          <span class="BadlandsStage__overlayBtnLabel">${config.skipLabel}</span>
          <span class="BadlandsStage__overlayBtnHint">${config.skipHint}</span>
        </button>
      `;
    } else if (state.isPlayerEngaged && incident.taggingPrompt?.options) {
      // Show tagging options
      const iconMap = {
        health: '&#10084;',
        mana: '&#10024;',
        stamina: '&#9889;',
        wardfire: '&#128293;',
        unknown: '&#10067;',
      };

      actionsEl.innerHTML = `
        <div class="BadlandsStage__taggingQuestion">${incident.taggingPrompt.question}</div>
        <div class="BadlandsStage__taggingOptionsGrid">
          ${incident.taggingPrompt.options.map(opt => `
            <div class="BadlandsStage__taggingOption" data-choice="${opt.id}" data-action="submitTagChoice">
              <div class="BadlandsStage__taggingOptionIcon">${iconMap[opt.id] || '&#10067;'}</div>
              <div class="BadlandsStage__taggingOptionContent">
                <span class="BadlandsStage__taggingOptionLabel">${opt.label}</span>
                ${opt.hint ? `<span class="BadlandsStage__taggingOptionHint">${opt.hint}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button class="BadlandsStage__overlayBtn BadlandsStage__overlayBtn--skipTag" data-action="skipTagging">
          Skip &rarr; Autopilot
        </button>
      `;
    }
  }

  // Legacy: Update tagging question element if it exists separately
  const questionEl = root.querySelector('[data-bind="taggingQuestion"]');
  if (questionEl && incident.taggingPrompt?.question && state.isPlayerEngaged) {
    questionEl.textContent = incident.taggingPrompt.question;
  }

  // Legacy: Render tagging options if separate element exists
  const optionsEl = root.querySelector('[data-bind="taggingOptions"]');
  if (optionsEl && incident.taggingPrompt?.options && state.isPlayerEngaged) {
    const iconMap = {
      health: '&#10084;',
      mana: '&#10024;',
      stamina: '&#9889;',
      wardfire: '&#128293;',
      unknown: '&#10067;',
    };

    optionsEl.innerHTML = incident.taggingPrompt.options.map(opt => `
      <div class="BadlandsStage__taggingOption" data-choice="${opt.id}" data-action="submitTagChoice">
        <div class="BadlandsStage__taggingOptionIcon">${iconMap[opt.id] || '&#10067;'}</div>
        <div class="BadlandsStage__taggingOptionContent">
          <span class="BadlandsStage__taggingOptionLabel">${opt.label}</span>
          ${opt.hint ? `<span class="BadlandsStage__taggingOptionHint">${opt.hint}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Show overlay
  overlay.dataset.visible = 'true';
}

/**
 * Hide the slow-time overlay
 */
function hideSlowTimeOverlay(root) {
  const overlay = root.querySelector('.BadlandsStage__slowTime');
  if (overlay) {
    overlay.dataset.visible = 'false';
  }
}

/**
 * Update slow-time timer display
 */
function updateSlowTimeTimer(root, remainingMs, totalMs) {
  const timerFill = root.querySelector('[data-bind="slowTimeTimerFill"]');
  const timerValue = root.querySelector('[data-bind="slowTimeTimerValue"]');
  const timerBar = root.querySelector('.BadlandsStage__slowTimeTimerBar');

  if (timerFill && totalMs > 0) {
    const percent = (remainingMs / totalMs) * 100;
    timerFill.style.width = `${percent}%`;

    // WO-UX-2: Set urgency level for timer gradient
    const urgency = percent > 50 ? 'normal' : percent > 25 ? 'warning' : 'critical';
    timerFill.dataset.urgency = urgency;
    if (timerBar) timerBar.dataset.urgency = urgency;
  }

  if (timerValue) {
    timerValue.textContent = Math.ceil(remainingMs / 1000);
  }
}

/**
 * Show episode caption (brief display)
 */
function showEpisodeCaption(root, text) {
  const captionEl = root.querySelector('[data-bind="episodeCaption"]');
  if (captionEl) {
    captionEl.textContent = text;
  }
}

/**
 * WO-UX-NEXT: Show Resolution Echo - cause→effect visibility
 * Displays a brief overlay showing what happened and its impact
 */
function showResolutionEcho(root, beat) {
  const echo = root.querySelector('.BadlandsStage__resolutionEcho');
  if (!echo || !beat?.display) return;

  // Update echo content
  const iconEl = echo.querySelector('[data-bind="echoIcon"]');
  const titleEl = echo.querySelector('[data-bind="echoTitle"]');
  const closureEl = echo.querySelector('[data-bind="echoClosure"]');
  const vitalsEl = echo.querySelector('[data-bind="echoVitals"]');

  if (iconEl) iconEl.innerHTML = beat.display.icon;
  if (titleEl) titleEl.textContent = beat.display.title;

  // Closure narrative based on resolution
  const closureLines = {
    player: ['The choice is made.', 'You decided.', 'Action taken.'],
    auto: ['The moment passes.', 'Autopilot handled it.', 'Resolved automatically.'],
    skip: ['Left behind.', 'Skipped.', 'Dismissed.'],
  };
  const lines = closureLines[beat.resolvedBy] || closureLines.auto;
  const closureLine = beat.display.subtitle || lines[Math.floor(Math.random() * lines.length)];
  if (closureEl) closureEl.textContent = closureLine;

  // Render vitals impact
  if (vitalsEl) {
    if (beat.display.vitalsImpact && beat.display.vitalsImpact.length > 0) {
      vitalsEl.innerHTML = beat.display.vitalsImpact.map(v => `
        <span class="BadlandsStage__echoVital BadlandsStage__echoVital--${v.isPositive ? 'positive' : 'negative'}">
          ${v.label}
        </span>
      `).join('');
    } else {
      vitalsEl.innerHTML = '';
    }
  }

  // Reset animation by removing and re-adding visible state
  echo.dataset.visible = 'false';
  // Force reflow to restart animation
  void echo.offsetWidth;
  echo.dataset.visible = 'true';

  // Auto-hide after animation completes (3s)
  setTimeout(() => {
    echo.dataset.visible = 'false';
  }, 3000);
}

/**
 * WO-WATCH-EPISODE-ROUTING: Update segment caption activity label
 */
function updateSegmentCaption(root, activityLabel) {
  const labelEl = root.querySelector('[data-bind="activityLabel"]');
  if (labelEl) {
    labelEl.textContent = activityLabel || 'Idle';
  }
}

/**
 * WO-WATCH-EPISODE-ROUTING: Update segment caption time and segment label
 */
function updateSegmentCaptionTime(root, timeString, segmentLabel) {
  const timeEl = root.querySelector('[data-bind="segmentTime"]');
  const segmentEl = root.querySelector('[data-bind="segmentLabel"]');
  if (timeEl) {
    timeEl.textContent = timeString || '--:--';
  }
  if (segmentEl) {
    segmentEl.textContent = segmentLabel || '--';
  }
}

/**
 * WO-STAGE-EPISODES-V1: Update queue indicator with visual dots
 * Shows 1-5 dots for queued items, then "+" for more
 */
function updateQueueIndicator(root, queueLength) {
  const indicator = root.querySelector('[data-bind="queueIndicator"]');
  const dotsContainer = root.querySelector('[data-bind="queueDots"]');

  if (!indicator || !dotsContainer) return;

  if (queueLength <= 0) {
    indicator.dataset.visible = 'false';
    return;
  }

  // Show indicator
  indicator.dataset.visible = 'true';

  // Build dots HTML (max 5 dots, then show +N)
  const maxDots = 5;
  const dotsToShow = Math.min(queueLength, maxDots);
  let dotsHtml = '';

  for (let i = 0; i < dotsToShow; i++) {
    dotsHtml += '<span class="BadlandsStage__queueDot"></span>';
  }

  // Add "+N" if more than maxDots
  if (queueLength > maxDots) {
    dotsHtml += `<span class="BadlandsStage__queueDot BadlandsStage__queueDot--plus">+${queueLength - maxDots}</span>`;
  }

  dotsContainer.innerHTML = dotsHtml;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-DEV-RENDER-BINDING: Dev Render Overlay
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create and insert the dev render overlay into the stage
 */
function createDevRenderOverlay(root) {
  // Check if overlay already exists
  if (root.querySelector('.BadlandsStage__devOverlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'BadlandsStage__devOverlay';
  overlay.dataset.visible = 'false';
  overlay.innerHTML = `
    <div class="BadlandsStage__devOverlayHeader">
      <span class="BadlandsStage__devOverlayTitle">Stage Debug</span>
      <button class="BadlandsStage__devOverlayClose" data-action="closeDevOverlay">&times;</button>
    </div>
    <div class="BadlandsStage__devOverlayContent">
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">DayT:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devDayT">0.000</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devTimeString">00:00</span>
      </div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">Segment:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devSegment">--</span>
        <span class="BadlandsStage__devOverlayLabel">Activity:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devActivity">--</span>
      </div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">Distance:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devDistance">0.000</span>
        <span class="BadlandsStage__devOverlayLabel">Band:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devBand">City</span>
      </div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">Override:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devOverride">None</span>
      </div>
      <div class="BadlandsStage__devOverlaySeparator"></div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">Pool:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devPool">--</span>
      </div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">BG:</span>
        <span class="BadlandsStage__devOverlayValue BadlandsStage__devOverlayValue--small" data-bind="devBg">--</span>
      </div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">World:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devWorldState">--</span>
      </div>
      <div class="BadlandsStage__devOverlaySeparator"></div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">Incident:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devIncident">None</span>
      </div>
      <div class="BadlandsStage__devOverlayRow">
        <span class="BadlandsStage__devOverlayLabel">Time Left:</span>
        <span class="BadlandsStage__devOverlayValue" data-bind="devIncidentTime">--</span>
      </div>
    </div>
    <div class="BadlandsStage__devOverlayFooter">
      <button class="BadlandsStage__devOverlayBtn" data-action="copyDevContext">Copy Context</button>
    </div>
  `;

  root.appendChild(overlay);

  // Bind close button
  overlay.querySelector('[data-action="closeDevOverlay"]')?.addEventListener('click', () => {
    overlay.dataset.visible = 'false';
  });

  // Bind copy context button
  overlay.querySelector('[data-action="copyDevContext"]')?.addEventListener('click', () => {
    const inspector = window.__MYFI_DEBUG__?.renderInspector;
    if (inspector) {
      inspector.copyContextToClipboard();
    } else {
      // Fallback: copy basic state info
      const context = {
        dayT: window.__MYFI_DEBUG__?.episodeClock?.getDayT(),
        distance01: window.__MYFI_DEBUG__?.distanceDriver?.distance01,
        activityState: window.__MYFI_DEBUG__?.episodeRouter?.currentState?.id,
      };
      navigator.clipboard.writeText(JSON.stringify(context, null, 2));
    }
  });
}

/**
 * Update the dev render overlay with current state
 */
function updateDevRenderOverlay(root, state) {
  const devConfig = window.__MYFI_DEV_CONFIG__ || {};
  if (!devConfig.showStageDebugOverlay) return;

  const overlay = root.querySelector('.BadlandsStage__devOverlay');
  if (!overlay) {
    createDevRenderOverlay(root);
    return updateDevRenderOverlay(root, state);
  }

  overlay.dataset.visible = 'true';

  // Get debug references
  const clock = window.__MYFI_DEBUG__?.episodeClock;
  const distanceDriver = window.__MYFI_DEBUG__?.distanceDriver;
  const router = window.__MYFI_DEBUG__?.episodeRouter;
  const inspector = window.__MYFI_DEBUG__?.renderInspector;

  // Update clock info
  if (clock) {
    const clockState = clock.getState();
    updateDevOverlayValue(overlay, 'devDayT', clockState.dayT.toFixed(3));
    updateDevOverlayValue(overlay, 'devTimeString', clockState.timeString);
    updateDevOverlayValue(overlay, 'devSegment', clockState.segmentLabel);
  }

  // Update distance info
  if (distanceDriver) {
    const driverState = distanceDriver.getState();
    updateDevOverlayValue(overlay, 'devDistance', driverState.distance01.toFixed(3));
    updateDevOverlayValue(overlay, 'devBand', driverState.distanceBand?.label || 'City');

    const override = driverState.currentPressureOverride;
    updateDevOverlayValue(overlay, 'devOverride', override ? override.reason.toUpperCase() : 'None');
  }

  // Update activity info
  if (router) {
    updateDevOverlayValue(overlay, 'devActivity', router.currentState?.label || '--');
  }

  // Update stage info
  updateDevOverlayValue(overlay, 'devPool', state.currentVisualPool || 'default');
  updateDevOverlayValue(overlay, 'devBg', state.currentBgUrl?.split('/').pop() || '--');
  updateDevOverlayValue(overlay, 'devWorldState', state.worldState || '--');

  // Update incident info
  if (state.episodeActive && state.currentIncident) {
    updateDevOverlayValue(overlay, 'devIncident', state.currentIncident.type || 'Active');
    updateDevOverlayValue(overlay, 'devIncidentTime', `${Math.ceil(state.slowTimeTimerRemaining)}s`);
  } else {
    updateDevOverlayValue(overlay, 'devIncident', 'None');
    updateDevOverlayValue(overlay, 'devIncidentTime', '--');
  }
}

function updateDevOverlayValue(overlay, bindKey, value) {
  const el = overlay.querySelector(`[data-bind="${bindKey}"]`);
  if (el) el.textContent = value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WO-DEV-ASSET-PREFLIGHT: Missing Asset Placeholder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render or hide the missing asset placeholder
 */
function renderMissingAssetPlaceholder(root, state) {
  const devConfig = window.__MYFI_DEV_CONFIG__ || {};
  const placeholderHost = root.querySelector('.BadlandsStage__assetPlaceholder');

  // Only show placeholder if preflight is enabled and there's a missing asset
  if (!devConfig.devAssetPreflightEnabled || !state.currentMissingAsset) {
    // Hide placeholder if exists
    if (placeholderHost) {
      placeholderHost.dataset.visible = 'false';
      placeholderHost.innerHTML = '';
    }
    return;
  }

  // Create placeholder host if it doesn't exist
  let host = placeholderHost;
  if (!host) {
    host = document.createElement('div');
    host.className = 'BadlandsStage__assetPlaceholder';
    const container = root.querySelector('.BadlandsStage__container');
    if (container) {
      container.appendChild(host);
    }
  }

  // Generate and insert placeholder HTML
  host.innerHTML = generateMissingPlaceholderHTML(state.currentMissingAsset);
  host.dataset.visible = 'true';
}
