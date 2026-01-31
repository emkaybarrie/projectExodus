// episodeRouter.js — Episode Router (Time-of-Day Activity Routing)
// Maps time-of-day segments to activity states
// Drives contextual visual pools, incident pools, and pacing

import { DAY_SEGMENTS, getSegmentFromDayT } from './episodeClock.js';

/**
 * Activity State definitions
 * Each state has associated behavior modifiers for the system
 */
export const ACTIVITY_STATES = {
  WAKE: {
    id: 'wake',
    label: 'Wake Up',
    description: 'Starting the day, light engagement',
    incidentBias: 'low',          // Fewer incidents
    visualPool: 'morning',         // Warm, fresh visuals
    pacingMultiplier: 0.5,         // Slower pacing
    distanceBias: 0,               // No distance bias
  },
  EXPLORE: {
    id: 'explore',
    label: 'Explore',
    description: 'Active exploration and discovery',
    incidentBias: 'medium',        // Normal incident rate
    visualPool: 'active',          // Bright, energetic visuals
    pacingMultiplier: 1.0,         // Normal pacing
    distanceBias: 0.15,            // Boost distance progression
  },
  FOCUS: {
    id: 'focus',
    label: 'Focus',
    description: 'Deep engagement period',
    incidentBias: 'high',          // More incidents
    visualPool: 'intense',         // Focused, clear visuals
    pacingMultiplier: 1.5,         // Faster pacing
    distanceBias: 0.25,            // Strong distance boost
  },
  WIND_DOWN: {
    id: 'wind_down',
    label: 'Wind Down',
    description: 'Transitioning to rest',
    incidentBias: 'low',           // Fewer incidents
    visualPool: 'evening',         // Warm, calming visuals
    pacingMultiplier: 0.75,        // Slower pacing
    distanceBias: 0,               // No distance bias
  },
  REST: {
    id: 'rest',
    label: 'Rest',
    description: 'Minimal activity, ambient only',
    incidentBias: 'minimal',       // Almost no incidents
    visualPool: 'night',           // Dark, peaceful visuals
    pacingMultiplier: 0.25,        // Very slow pacing
    distanceBias: -0.1,            // Slight distance regression
  },
};

/**
 * Default segment-to-activity mapping
 * Can be overridden via __MYFI_DEV_CONFIG__
 */
const DEFAULT_SEGMENT_MAPPING = {
  dawn: ACTIVITY_STATES.WAKE,
  morning: ACTIVITY_STATES.EXPLORE,
  midday: ACTIVITY_STATES.FOCUS,
  afternoon: ACTIVITY_STATES.EXPLORE,
  evening: ACTIVITY_STATES.WIND_DOWN,
  night: ACTIVITY_STATES.REST,
};

/**
 * WO-HYBRID-ROUTING: Default config for hybrid routing
 */
const DEFAULT_HYBRID_CONFIG = {
  // Enable hybrid routing (pressure can override schedule)
  hybridModeEnabled: true,

  // dayT before which REST is blocked (closure window)
  restBlockedBeforeDayT: 0.8,

  // States that can be overridden to EXPLORE by pressure
  exploreOverrideFromStates: ['wake', 'rest'],

  // States that can be overridden to WIND_DOWN by pressure (late day)
  returnOverrideFromStates: ['explore', 'focus'],
};

/**
 * Get merged config from defaults and __MYFI_DEV_CONFIG__
 */
function getConfig() {
  const devConfig = typeof window !== 'undefined' && window.__MYFI_DEV_CONFIG__?.episodeRouter;
  return {
    segmentMapping: { ...DEFAULT_SEGMENT_MAPPING, ...devConfig?.segmentMapping },
    ...DEFAULT_HYBRID_CONFIG,
    ...devConfig,
  };
}

/**
 * Create the Episode Router
 *
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event dispatch
 * @param {Object} options.episodeClock - Episode clock instance
 * @param {Function} options.onStateChange - Callback when activity state changes
 * @returns {Object} Episode router interface
 */
export function createEpisodeRouter(options = {}) {
  const { actionBus, episodeClock, onStateChange } = options;

  // State
  let currentState = null;
  let previousState = null;
  let stateStartTime = null;
  let isRunning = false;
  let listeners = [];

  // WO-HYBRID-ROUTING: Pressure override state
  let scheduledState = null;         // What the schedule says we should be in
  let currentPressureOverride = null; // Active override: { reason, state }
  let overrideStartTime = null;       // When override started

  /**
   * Get activity state for a day segment
   */
  function getStateForSegment(segment) {
    const config = getConfig();
    const segmentId = typeof segment === 'string' ? segment : segment.id;
    return config.segmentMapping[segmentId] || ACTIVITY_STATES.EXPLORE;
  }

  /**
   * Get activity state for a specific dayT
   */
  function getStateForDayT(dayT) {
    const segment = getSegmentFromDayT(dayT);
    return getStateForSegment(segment);
  }

  /**
   * Transition to a new activity state
   */
  function transitionTo(newState, reason = 'segment_change') {
    if (currentState?.id === newState.id) {
      return; // No change
    }

    previousState = currentState;
    currentState = newState;
    stateStartTime = Date.now();

    // WO-HYBRID-ROUTING: Track if this is override or scheduled
    const isOverride = reason.startsWith('pressure_override');

    const transitionData = {
      from: previousState,
      to: currentState,
      reason,
      timestamp: stateStartTime,
      isOverride,
      scheduledState: scheduledState,
      pressureOverride: currentPressureOverride,
    };

    console.log(`[EpisodeRouter] State transition: ${previousState?.id || 'none'} → ${currentState.id} (${reason})${isOverride ? ' [OVERRIDE]' : ''}`);

    // Emit to actionBus
    if (actionBus) {
      actionBus.emit('activityState:changed', transitionData);

      // Emit specific state events for easier subscription
      actionBus.emit(`activityState:${currentState.id}`, {
        state: currentState,
        previous: previousState,
        isOverride,
      });
    }

    // Notify local listeners
    notifyListeners('stateChange', transitionData);

    // Call callback
    if (onStateChange) {
      onStateChange(transitionData);
    }
  }

  /**
   * Handle segment change from episode clock
   * WO-HYBRID-ROUTING: Now considers pressure overrides and closure windows
   */
  function handleSegmentChange(data) {
    const { from, to, dayT } = data;
    const config = getConfig();

    // Get scheduled state for this segment
    let newScheduledState = getStateForSegment(to);

    // WO-HYBRID-ROUTING: Enforce REST closure window
    if (newScheduledState.id === 'rest' && dayT < config.restBlockedBeforeDayT) {
      console.log(`[EpisodeRouter] REST blocked (dayT ${dayT.toFixed(3)} < ${config.restBlockedBeforeDayT}), using WIND_DOWN`);
      newScheduledState = ACTIVITY_STATES.WIND_DOWN;
    }

    // Update scheduled state (what we'd be in without override)
    scheduledState = newScheduledState;

    console.log(`[EpisodeRouter] Segment change: ${from.id} → ${to.id}, scheduled state: ${newScheduledState.id}`);

    // WO-HYBRID-ROUTING: Check if pressure override is active
    if (config.hybridModeEnabled && currentPressureOverride) {
      console.log(`[EpisodeRouter] Pressure override active: ${currentPressureOverride.reason}, staying in ${currentState?.id}`);
      return; // Don't transition, override is in control
    }

    transitionTo(newScheduledState, 'segment_change');
  }

  /**
   * Handle clock tick (for continuous updates if needed)
   */
  function handleClockTick(data) {
    // Could be used for gradual transitions or progress tracking
    // For now, just emit progress within current state
    if (currentState && actionBus) {
      const segment = getSegmentFromDayT(data.dayT);
      const stateProgress = (data.dayT - segment.start) / (segment.end - segment.start);

      actionBus.emit('activityState:progress', {
        state: currentState,
        dayT: data.dayT,
        segmentProgress: stateProgress,
        timeInState: Date.now() - stateStartTime,
      });
    }
  }

  /**
   * Force a specific activity state (for dev controls)
   */
  function forceState(stateId) {
    const state = ACTIVITY_STATES[stateId.toUpperCase()];
    if (state) {
      transitionTo(state, 'forced');
      return true;
    }
    console.warn(`[EpisodeRouter] Unknown state: ${stateId}`);
    return false;
  }

  /**
   * WO-HYBRID-ROUTING: Handle pressure override from distanceDriver
   */
  function handlePressureOverride(data) {
    const config = getConfig();
    const { reason, currentPressure, dayT } = data;

    if (!config.hybridModeEnabled) {
      return; // Hybrid mode disabled
    }

    // Handle override cleared
    if (reason === 'cleared') {
      if (currentPressureOverride) {
        console.log(`[EpisodeRouter] Pressure override cleared, returning to scheduled state: ${scheduledState?.id}`);
        currentPressureOverride = null;
        overrideStartTime = null;

        // Return to scheduled state
        if (scheduledState) {
          transitionTo(scheduledState, 'pressure_override_cleared');
        }
      }
      return;
    }

    // Check if we should apply the override
    const currentStateId = currentState?.id;

    if (reason === 'explore') {
      // EXPLORE override: only from REST/WAKE states
      if (config.exploreOverrideFromStates.includes(currentStateId)) {
        currentPressureOverride = { reason, state: ACTIVITY_STATES.EXPLORE };
        overrideStartTime = Date.now();
        console.log(`[EpisodeRouter] Applying EXPLORE override (from ${currentStateId})`);
        transitionTo(ACTIVITY_STATES.EXPLORE, 'pressure_override_explore');
      } else {
        console.log(`[EpisodeRouter] EXPLORE override skipped (${currentStateId} not in override list)`);
      }
    } else if (reason === 'return') {
      // WIND_DOWN override: late day high pressure
      if (config.returnOverrideFromStates.includes(currentStateId)) {
        currentPressureOverride = { reason, state: ACTIVITY_STATES.WIND_DOWN };
        overrideStartTime = Date.now();
        console.log(`[EpisodeRouter] Applying WIND_DOWN override (from ${currentStateId}, dayT: ${dayT.toFixed(3)})`);
        transitionTo(ACTIVITY_STATES.WIND_DOWN, 'pressure_override_return');
      } else {
        console.log(`[EpisodeRouter] WIND_DOWN override skipped (${currentStateId} not in override list)`);
      }
    }
  }

  /**
   * Initialize the router
   */
  function init() {
    // Subscribe to episode clock events
    if (episodeClock) {
      episodeClock.on('segmentChange', handleSegmentChange);
      episodeClock.on('tick', handleClockTick);

      // Set initial state based on current clock time
      const initialSegment = episodeClock.getCurrentSegment();
      const initialState = getStateForSegment(initialSegment);
      scheduledState = initialState; // Initialize scheduled state
      transitionTo(initialState, 'init');
    }

    // Subscribe to actionBus events
    if (actionBus && actionBus.subscribe) {
      // Listen for manual state override requests
      actionBus.subscribe('activityState:force', (data) => {
        // Clear pressure override when manually forcing
        currentPressureOverride = null;
        overrideStartTime = null;
        forceState(data.stateId);
      }, 'episodeRouter', { persistent: true });

      // WO-HYBRID-ROUTING: Listen for pressure overrides from distanceDriver
      actionBus.subscribe('distance:pressureOverride', handlePressureOverride,
        'episodeRouter', { persistent: true });

      // Day reset
      actionBus.subscribe('day:reset', () => {
        // Clear pressure override on day reset
        currentPressureOverride = null;
        overrideStartTime = null;
        scheduledState = ACTIVITY_STATES.WAKE;
        transitionTo(ACTIVITY_STATES.WAKE, 'day_reset');
      }, 'episodeRouter', { persistent: true });
    }

    console.log('[EpisodeRouter] Initialized');
  }

  /**
   * Start the router
   */
  function start() {
    if (isRunning) return;
    isRunning = true;
    console.log('[EpisodeRouter] Started');
  }

  /**
   * Stop the router
   */
  function stop() {
    isRunning = false;
    console.log('[EpisodeRouter] Stopped');
  }

  /**
   * Add event listener
   */
  function on(event, callback) {
    listeners.push({ event, callback });
    return () => off(event, callback);
  }

  /**
   * Remove event listener
   */
  function off(event, callback) {
    listeners = listeners.filter(l => !(l.event === event && l.callback === callback));
  }

  /**
   * Notify listeners of an event
   */
  function notifyListeners(event, data) {
    for (const listener of listeners) {
      if (listener.event === event) {
        try {
          listener.callback(data);
        } catch (err) {
          console.error(`[EpisodeRouter] Listener error for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      currentState,
      previousState,
      stateStartTime,
      timeInState: stateStartTime ? Date.now() - stateStartTime : 0,
      isRunning,
      // WO-HYBRID-ROUTING additions
      scheduledState,
      currentPressureOverride,
      overrideStartTime,
      isOverridden: currentPressureOverride !== null,
      timeInOverride: overrideStartTime ? Date.now() - overrideStartTime : 0,
    };
  }

  /**
   * WO-HYBRID-ROUTING: Check if currently in pressure override
   */
  function isInOverride() {
    return currentPressureOverride !== null;
  }

  /**
   * WO-HYBRID-ROUTING: Get scheduled state (what schedule says without override)
   */
  function getScheduledState() {
    return scheduledState;
  }

  /**
   * WO-HYBRID-ROUTING: Clear any active pressure override
   */
  function clearOverride() {
    if (currentPressureOverride) {
      console.log(`[EpisodeRouter] Manual override clear, returning to: ${scheduledState?.id}`);
      currentPressureOverride = null;
      overrideStartTime = null;
      if (scheduledState) {
        transitionTo(scheduledState, 'override_cleared_manual');
      }
    }
  }

  /**
   * Get current activity state
   */
  function getCurrentActivityState() {
    return currentState;
  }

  /**
   * Get pacing multiplier for current state
   */
  function getPacingMultiplier() {
    return currentState?.pacingMultiplier ?? 1.0;
  }

  /**
   * Get distance bias for current state
   */
  function getDistanceBias() {
    return currentState?.distanceBias ?? 0;
  }

  /**
   * Get visual pool for current state
   */
  function getVisualPool() {
    return currentState?.visualPool ?? 'default';
  }

  /**
   * Get incident bias for current state
   */
  function getIncidentBias() {
    return currentState?.incidentBias ?? 'medium';
  }

  return {
    // Lifecycle
    init,
    start,
    stop,

    // State management
    forceState,
    transitionTo,
    clearOverride,

    // Queries
    getState,
    getCurrentActivityState,
    getStateForSegment,
    getStateForDayT,
    getPacingMultiplier,
    getDistanceBias,
    getVisualPool,
    getIncidentBias,
    // WO-HYBRID-ROUTING queries
    isInOverride,
    getScheduledState,

    // Events
    on,
    off,

    // Direct accessors
    get currentState() { return currentState; },
    get previousState() { return previousState; },
    get isRunning() { return isRunning; },
    // WO-HYBRID-ROUTING accessors
    get scheduledState() { return scheduledState; },
    get currentPressureOverride() { return currentPressureOverride; },
    get isOverridden() { return currentPressureOverride !== null; },
  };
}

/**
 * Incident bias to probability multiplier mapping
 */
export const INCIDENT_BIAS_MULTIPLIERS = {
  minimal: 0.1,
  low: 0.5,
  medium: 1.0,
  high: 1.5,
  very_high: 2.0,
};

/**
 * Get incident probability multiplier for a bias level
 */
export function getIncidentMultiplier(bias) {
  return INCIDENT_BIAS_MULTIPLIERS[bias] ?? 1.0;
}

export default {
  createEpisodeRouter,
  ACTIVITY_STATES,
  INCIDENT_BIAS_MULTIPLIERS,
  getIncidentMultiplier,
};
