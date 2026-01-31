// devRenderInspector.js — WO-DEV-RENDER-BINDING
//
// Dev-only service that tracks the causal chain from dev controls to stage rendering.
// Maintains a timeline buffer of events and exposes current render context.
//
// Gated by __MYFI_DEV_CONFIG__.enableRenderInspector (default OFF)
//
// Features:
//   - Event timeline buffer (rolling 50 events)
//   - Current render context snapshot
//   - Missing asset tracking
//   - World sim state for map/stage binding

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  // Enable the render inspector
  enabled: false,

  // Maximum events to keep in timeline buffer
  maxTimelineEvents: 50,

  // Maximum missing assets to track
  maxMissingAssets: 20,

  // Show console logs for events
  logEvents: true,
};

/**
 * Get merged config from defaults and __MYFI_DEV_CONFIG__
 */
function getConfig() {
  const devConfig = typeof window !== 'undefined' && window.__MYFI_DEV_CONFIG__?.renderInspector;
  return { ...DEFAULT_CONFIG, ...devConfig };
}

/**
 * Check if inspector is enabled
 */
function isEnabled() {
  const config = getConfig();
  return config.enabled || (typeof window !== 'undefined' && window.__MYFI_DEV_CONFIG__?.enableRenderInspector);
}

/**
 * Create the Dev Render Inspector
 *
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event subscription
 * @returns {Object} Render inspector interface
 */
export function createDevRenderInspector(options = {}) {
  const { actionBus } = options;

  // Timeline buffer (rolling window)
  const timelineBuffer = [];

  // Missing assets list
  const missingAssets = [];

  // Current render context (updated by events)
  let currentContext = {
    // Time/Schedule
    dayT: 0,
    segment: 'dawn',
    segmentLabel: 'Dawn',
    timeString: '00:00',

    // Activity State
    activityStateId: 'wake',
    activityStateLabel: 'Wake',
    scheduledState: 'wake',
    isOverridden: false,
    overrideReason: null,

    // Distance/Pressure
    distance01: 0,
    distanceBand: { id: 'city', label: 'City' },
    baseSchedule: 0,
    pressureModifier: 0,
    spikeImpulse: 0,
    aftershock: 0,
    rawPressure: 0,

    // Location/Zone
    locationId: 'center',
    regionName: 'Haven Outskirts',

    // Stage Rendering
    currentPoolFolder: null,
    currentBackgroundFilename: null,
    manifestPath: null,
    gradeProfileId: null,
    worldState: 'rest',

    // Incident State
    activeIncidentType: null,
    incidentMode: null,
    incidentTimeRemaining: 0,
    isEpisodeActive: false,

    // Map State (for WorldMap binding)
    mapPosX: 0,
    mapPosY: 0,
    mapZoom: 1,
    lastSpikeAmount: 0,
  };

  // Subscription unsubscribers
  const unsubscribers = [];
  let isInitialized = false;

  /**
   * Add event to timeline buffer
   */
  function addTimelineEvent(type, data) {
    if (!isEnabled()) return;

    const config = getConfig();
    const event = {
      type,
      timestamp: Date.now(),
      dayT: currentContext.dayT,
      realTimeString: new Date().toISOString().substr(11, 12),
      data,
    };

    timelineBuffer.push(event);

    // Trim buffer
    while (timelineBuffer.length > config.maxTimelineEvents) {
      timelineBuffer.shift();
    }

    if (config.logEvents) {
      console.log(`[RenderInspector] ${type}:`, data);
    }
  }

  /**
   * Add missing asset entry
   */
  function addMissingAsset(assetInfo) {
    if (!isEnabled()) return;

    const config = getConfig();

    // Check for duplicate
    const exists = missingAssets.some(a => a.expectedPath === assetInfo.expectedPath);
    if (exists) return;

    missingAssets.push({
      ...assetInfo,
      timestamp: Date.now(),
      fixInstructions: generateFixInstructions(assetInfo),
    });

    // Trim list
    while (missingAssets.length > config.maxMissingAssets) {
      missingAssets.shift();
    }

    console.warn(`[RenderInspector] Missing asset: ${assetInfo.type} - ${assetInfo.expectedPath}`);
  }

  /**
   * Generate fix instructions for missing asset
   */
  function generateFixInstructions(assetInfo) {
    const { type, poolFolder, filename, manifestPath, expectedPath } = assetInfo;

    const instructions = [];

    if (type === 'background') {
      instructions.push(`1. Add image file: ${expectedPath}`);
      instructions.push(`2. Update manifest: ${manifestPath}`);
      instructions.push(`   → Add "${filename}" to "backgrounds" array`);
    } else if (type === 'manifest') {
      instructions.push(`1. Create manifest file: ${manifestPath}`);
      instructions.push(`2. Add JSON with "backgrounds": ["bg1.png", "bg2.png"]`);
    } else if (type === 'pool') {
      instructions.push(`1. Create folder: ${poolFolder}`);
      instructions.push(`2. Add manifest.json with backgrounds array`);
      instructions.push(`3. Add at least 2 background images`);
    }

    return instructions;
  }

  /**
   * Clear missing assets list
   */
  function clearMissingAssets() {
    missingAssets.length = 0;
  }

  /**
   * Subscribe to ActionBus events
   */
  function subscribeToEvents() {
    if (!actionBus || !actionBus.subscribe) {
      console.warn('[RenderInspector] No actionBus provided, cannot subscribe to events');
      return;
    }

    // Clock/Segment events
    unsubscribers.push(
      actionBus.subscribe('activityState:progress', (data) => {
        if (data.dayT !== undefined) currentContext.dayT = data.dayT;
        if (data.segment) currentContext.segment = data.segment;
        if (data.segmentLabel) currentContext.segmentLabel = data.segmentLabel;
        if (data.timeString) currentContext.timeString = data.timeString;
      }, 'renderInspector', { persistent: true })
    );

    // Activity state changes
    unsubscribers.push(
      actionBus.subscribe('activityState:changed', (data) => {
        currentContext.activityStateId = data.to?.id || 'unknown';
        currentContext.activityStateLabel = data.to?.label || 'Unknown';
        currentContext.scheduledState = data.scheduledState?.id || data.to?.id;
        currentContext.isOverridden = data.isOverride || false;
        currentContext.overrideReason = data.pressureOverride?.reason || null;

        addTimelineEvent('activityState:changed', {
          from: data.from?.id,
          to: data.to?.id,
          reason: data.reason,
          isOverride: data.isOverride,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Distance updates
    unsubscribers.push(
      actionBus.subscribe('distance:updated', (data) => {
        currentContext.distance01 = data.distance01;
        currentContext.distanceBand = data.distanceBand || currentContext.distanceBand;
        currentContext.baseSchedule = data.baseSchedule;
        currentContext.pressureModifier = data.pressureModifier;
        currentContext.spikeImpulse = data.spikeImpulse;
        currentContext.aftershock = data.aftershock;
        currentContext.rawPressure = data.rawPressure;
        currentContext.dayT = data.dayT;

        // Only log occasionally to avoid spam
        // addTimelineEvent('distance:updated', { distance01: data.distance01 });
      }, 'renderInspector', { persistent: true })
    );

    // Spike events
    unsubscribers.push(
      actionBus.subscribe('distance:spike', (data) => {
        currentContext.lastSpikeAmount = data.amount;

        addTimelineEvent('distance:spike', {
          amount: data.amount,
          impulse: data.impulse,
          aftershockAdded: data.aftershockAdded,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Pressure override events
    unsubscribers.push(
      actionBus.subscribe('distance:pressureOverride', (data) => {
        currentContext.isOverridden = data.reason !== 'cleared';
        currentContext.overrideReason = data.reason !== 'cleared' ? data.reason : null;

        addTimelineEvent('distance:pressureOverride', {
          reason: data.reason,
          currentPressure: data.currentPressure,
          dayT: data.dayT,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Stage pool selection
    unsubscribers.push(
      actionBus.subscribe('stage:poolSelected', (data) => {
        currentContext.currentPoolFolder = data.poolFolder;
        currentContext.worldState = data.stateId;

        addTimelineEvent('stage:poolSelected', {
          stateId: data.stateId,
          poolFolder: data.poolFolder,
          reason: data.reason,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Background selection
    unsubscribers.push(
      actionBus.subscribe('stage:bgSelected', (data) => {
        currentContext.currentBackgroundFilename = data.filename;
        currentContext.manifestPath = data.manifestPath;

        addTimelineEvent('stage:bgSelected', {
          poolFolder: data.poolFolder,
          filename: data.filename,
          manifestPath: data.manifestPath,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Grade profile applied
    unsubscribers.push(
      actionBus.subscribe('stage:gradeApplied', (data) => {
        currentContext.gradeProfileId = data.gradeId;

        addTimelineEvent('stage:gradeApplied', {
          gradeId: data.gradeId,
          reason: data.reason,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Incident shown
    unsubscribers.push(
      actionBus.subscribe('stage:incidentShown', (data) => {
        currentContext.activeIncidentType = data.incidentType;
        currentContext.incidentMode = data.mode;
        currentContext.incidentTimeRemaining = data.durationMs;
        currentContext.isEpisodeActive = true;

        addTimelineEvent('stage:incidentShown', {
          incidentType: data.incidentType,
          mode: data.mode,
          durationMs: data.durationMs,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Episode lifecycle
    unsubscribers.push(
      actionBus.subscribe('episode:started', (data) => {
        currentContext.isEpisodeActive = true;
        currentContext.activeIncidentType = data.episode?.incident?.type;

        addTimelineEvent('episode:started', {
          episodeId: data.episode?.id,
          incidentType: data.episode?.incident?.type,
        });
      }, 'renderInspector', { persistent: true })
    );

    unsubscribers.push(
      actionBus.subscribe('episode:resolved', (data) => {
        currentContext.isEpisodeActive = false;
        currentContext.activeIncidentType = null;
        currentContext.incidentMode = null;

        addTimelineEvent('episode:resolved', {
          episodeId: data.episode?.id,
          resolution: data.resolution,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Asset missing events
    unsubscribers.push(
      actionBus.subscribe('asset:missing', (data) => {
        addMissingAsset(data);

        addTimelineEvent('asset:missing', {
          type: data.type,
          expectedPath: data.expectedPath,
        });
      }, 'renderInspector', { persistent: true })
    );

    // World state changes (for map binding)
    unsubscribers.push(
      actionBus.subscribe('worldState:changed', (data) => {
        currentContext.worldState = data.state;
        currentContext.regionName = data.regionName || currentContext.regionName;

        addTimelineEvent('worldState:changed', {
          state: data.state,
          regionName: data.regionName,
        });
      }, 'renderInspector', { persistent: true })
    );

    // Map position updates (from WorldMap binding)
    unsubscribers.push(
      actionBus.subscribe('map:positionUpdated', (data) => {
        currentContext.mapPosX = data.x;
        currentContext.mapPosY = data.y;
        currentContext.mapZoom = data.zoom || currentContext.mapZoom;
        currentContext.locationId = data.locationId || currentContext.locationId;
      }, 'renderInspector', { persistent: true })
    );

    console.log('[RenderInspector] Subscribed to events');
  }

  /**
   * Initialize the inspector
   */
  function init() {
    if (isInitialized) return;

    subscribeToEvents();
    isInitialized = true;

    console.log('[RenderInspector] Initialized (enabled:', isEnabled(), ')');
  }

  /**
   * Stop and clean up
   */
  function stop() {
    unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    unsubscribers.length = 0;
    isInitialized = false;
  }

  /**
   * Get current render context snapshot
   */
  function getCurrentRenderContext() {
    return { ...currentContext };
  }

  /**
   * Get world sim snapshot (unified state for map/stage binding)
   */
  function getWorldSimSnapshot() {
    return {
      // Time
      dayT: currentContext.dayT,
      timeOfDayLabel: currentContext.segmentLabel,
      segmentId: currentContext.segment,
      timeString: currentContext.timeString,

      // Activity
      activityStateId: currentContext.activityStateId,
      scheduledState: currentContext.scheduledState,
      isOverridden: currentContext.isOverridden,
      overrideReason: currentContext.overrideReason,

      // Distance
      distance01: currentContext.distance01,
      distanceBandId: currentContext.distanceBand?.id || 'city',
      distanceBandLabel: currentContext.distanceBand?.label || 'City',

      // Location/Map
      locationId: currentContext.locationId,
      regionName: currentContext.regionName,
      mapPosX: currentContext.mapPosX,
      mapPosY: currentContext.mapPosY,
      mapZoom: currentContext.mapZoom,

      // Incident
      activeIncident: currentContext.isEpisodeActive ? {
        type: currentContext.activeIncidentType,
        mode: currentContext.incidentMode,
      } : null,

      // Last spike (for map jump effect)
      lastSpikeAmount: currentContext.lastSpikeAmount,
    };
  }

  /**
   * Get timeline buffer (most recent first)
   */
  function getTimeline(limit = 50) {
    const events = [...timelineBuffer].reverse();
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Get missing assets list
   */
  function getMissingAssets() {
    return [...missingAssets];
  }

  /**
   * Copy current render context to clipboard
   */
  async function copyContextToClipboard() {
    const context = getCurrentRenderContext();
    const json = JSON.stringify(context, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      console.log('[RenderInspector] Context copied to clipboard');
      return true;
    } catch (err) {
      console.error('[RenderInspector] Failed to copy to clipboard:', err);
      return false;
    }
  }

  /**
   * Manually update context (for systems that don't emit events)
   */
  function updateContext(updates) {
    Object.assign(currentContext, updates);
  }

  return {
    init,
    stop,

    // Context access
    getCurrentRenderContext,
    getWorldSimSnapshot,
    updateContext,

    // Timeline
    getTimeline,
    addTimelineEvent,

    // Missing assets
    getMissingAssets,
    addMissingAsset,
    clearMissingAssets,

    // Utilities
    copyContextToClipboard,
    isEnabled,

    // Direct access for debugging
    get context() { return currentContext; },
    get timeline() { return timelineBuffer; },
    get missing() { return missingAssets; },
  };
}

export default { createDevRenderInspector };
