// scenePacer.js — WO-BASELINE-COHERENCE: Scene pacing and budget controls
//
// Controls the rate and timing of scene/incident triggers based on:
//   - distance01 (from distanceDriver)
//   - Daily scene budget (max incidents per day)
//   - Cooldown periods (minimum time between incidents)
//   - Pacing curve (more incidents at higher distance)
//
// Events emitted:
//   - scenePacer:ready { canTrigger, reason, cooldownRemaining }
//   - scenePacer:triggered { sceneCount, budgetRemaining }
//   - scenePacer:budgetExhausted { sceneCount }
//
// Events subscribed:
//   - distance:updated { distance01 } - tracks progression
//   - episode:resolved - counts toward budget

/**
 * Default configuration (overridable via __MYFI_DEV_CONFIG__)
 */
const DEFAULT_CONFIG = {
  // Maximum incidents per day
  dailyBudget: 12,

  // Minimum cooldown between incidents (ms)
  minCooldownMs: 30000, // 30 seconds

  // Maximum cooldown between incidents (ms)
  maxCooldownMs: 180000, // 3 minutes

  // Distance threshold before incidents can start (0..1)
  incidentThreshold: 0.05, // After 5% distance

  // Pacing curve: how distance affects incident frequency
  // 'linear' | 'front-loaded' | 'back-loaded' | 'even'
  pacingCurve: 'even',

  // Probability multiplier at distance01=1.0 vs distance01=0.0
  // Higher = more incidents later in day
  pacingMultiplier: 1.5,

  // Quiet zone: fraction of day (at start) with reduced incidents
  quietZoneFraction: 0.1, // First 10% of day is quieter

  // Quiet zone probability reduction
  quietZoneReduction: 0.5, // 50% fewer incidents in quiet zone

  // Check interval (ms)
  checkIntervalMs: 5000,
};

/**
 * Get merged config from defaults and __MYFI_DEV_CONFIG__
 */
function getConfig() {
  const devConfig = typeof window !== 'undefined' && window.__MYFI_DEV_CONFIG__?.scenePacer;
  return { ...DEFAULT_CONFIG, ...devConfig };
}

/**
 * Pacing curves: map distance01 to incident probability modifier
 */
const PACING_CURVES = {
  // Linear: probability scales linearly with distance
  linear: (d, multiplier) => 1 + (multiplier - 1) * d,

  // Front-loaded: more incidents early
  'front-loaded': (d, multiplier) => multiplier - (multiplier - 1) * d,

  // Back-loaded: more incidents late (exponential)
  'back-loaded': (d, multiplier) => 1 + (multiplier - 1) * Math.pow(d, 2),

  // Even: uniform distribution regardless of distance
  even: () => 1,
};

/**
 * Creates a Scene Pacer system
 *
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event dispatch
 * @param {Function} options.onReadyChange - Callback when ready state changes
 * @returns {Object} Scene pacer interface
 */
export function createScenePacer(options = {}) {
  const { actionBus, onReadyChange } = options;

  // State
  let sceneCountToday = 0;        // Incidents triggered today
  let lastTriggerMs = 0;          // When last incident was triggered
  let currentDistance = 0;        // Current distance01
  let isReady = false;            // Whether an incident can trigger
  let checkTimerId = null;
  let isRunning = false;
  let dayStartMs = Date.now();
  // WO-WATCH-EPISODE-ROUTING: Activity state incident bias
  let activityIncidentBias = 'medium'; // minimal, low, medium, high, very_high
  let activityPacingMultiplier = 1.0;

  /**
   * Calculate current cooldown based on distance and config
   * Higher distance = shorter cooldowns (more frequent incidents)
   */
  function calculateCooldown() {
    const config = getConfig();
    const { minCooldownMs, maxCooldownMs } = config;

    // Lerp between max and min based on distance (higher distance = shorter cooldown)
    const t = currentDistance;
    const cooldown = maxCooldownMs - (maxCooldownMs - minCooldownMs) * t;

    return Math.floor(cooldown);
  }

  /**
   * Calculate incident probability modifier based on pacing curve
   */
  function calculatePacingModifier() {
    const config = getConfig();
    const curveFunc = PACING_CURVES[config.pacingCurve] || PACING_CURVES.even;
    return curveFunc(currentDistance, config.pacingMultiplier);
  }

  /**
   * Check if in quiet zone (early part of day)
   */
  function isInQuietZone() {
    const config = getConfig();
    return currentDistance < config.quietZoneFraction;
  }

  /**
   * WO-WATCH-EPISODE-ROUTING: Convert activity incident bias to multiplier
   */
  const ACTIVITY_BIAS_MULTIPLIERS = {
    minimal: 0.1,
    low: 0.5,
    medium: 1.0,
    high: 1.5,
    very_high: 2.0,
  };

  function getActivityBiasMultiplier() {
    return ACTIVITY_BIAS_MULTIPLIERS[activityIncidentBias] ?? 1.0;
  }

  /**
   * Check if pacing allows a new incident
   */
  function checkReadyState() {
    const config = getConfig();
    const now = Date.now();

    // Check budget exhaustion
    if (sceneCountToday >= config.dailyBudget) {
      updateReadyState(false, 'budget_exhausted', 0);
      return;
    }

    // Check distance threshold
    if (currentDistance < config.incidentThreshold) {
      updateReadyState(false, 'below_threshold', 0);
      return;
    }

    // Check cooldown
    const cooldown = calculateCooldown();
    const elapsed = now - lastTriggerMs;
    const cooldownRemaining = Math.max(0, cooldown - elapsed);

    if (cooldownRemaining > 0) {
      updateReadyState(false, 'cooldown', cooldownRemaining);
      return;
    }

    // Apply pacing probability check
    // WO-WATCH-EPISODE-ROUTING: Include activity state bias in probability
    const pacingMod = calculatePacingModifier();
    const quietMod = isInQuietZone() ? config.quietZoneReduction : 1;
    const activityMod = getActivityBiasMultiplier() * activityPacingMultiplier;
    const probability = 0.3 * pacingMod * quietMod * activityMod; // Base 30% chance per check

    if (Math.random() > probability) {
      updateReadyState(false, 'pacing_skip', 0);
      return;
    }

    // Ready for incident
    updateReadyState(true, 'ready', 0);
  }

  /**
   * Update and emit ready state
   */
  function updateReadyState(ready, reason, cooldownRemaining) {
    const wasReady = isReady;
    isReady = ready;

    if (actionBus) {
      actionBus.emit('scenePacer:ready', {
        canTrigger: ready,
        reason,
        cooldownRemaining,
        sceneCount: sceneCountToday,
        budgetRemaining: getConfig().dailyBudget - sceneCountToday,
        distance: currentDistance,
      });
    }

    if (ready !== wasReady && onReadyChange) {
      onReadyChange(ready, reason);
    }
  }

  /**
   * Record that an incident was triggered
   */
  function recordTrigger() {
    const config = getConfig();
    sceneCountToday++;
    lastTriggerMs = Date.now();
    isReady = false;

    if (actionBus) {
      actionBus.emit('scenePacer:triggered', {
        sceneCount: sceneCountToday,
        budgetRemaining: config.dailyBudget - sceneCountToday,
      });

      if (sceneCountToday >= config.dailyBudget) {
        actionBus.emit('scenePacer:budgetExhausted', {
          sceneCount: sceneCountToday,
        });
      }
    }

    console.log(`[ScenePacer] Incident triggered (${sceneCountToday}/${config.dailyBudget})`);
  }

  /**
   * Request permission to trigger an incident
   * Returns true if allowed, false if blocked by pacing
   */
  function requestTrigger() {
    if (!isReady) {
      console.log('[ScenePacer] Trigger request denied - not ready');
      return false;
    }

    recordTrigger();
    return true;
  }

  /**
   * Force a trigger (bypass pacing for manual/demo triggers)
   */
  function forceTrigger() {
    recordTrigger();
    console.log('[ScenePacer] Force trigger - bypassing pacing');
    return true;
  }

  /**
   * Initialize the pacer
   */
  function init() {
    if (actionBus && actionBus.subscribe) {
      // Track distance updates
      actionBus.subscribe('distance:updated', (data) => {
        currentDistance = data.distance01;
      }, 'scenePacer', { persistent: true });

      // Count resolved episodes
      actionBus.subscribe('episode:resolved', () => {
        // Episode resolved counts toward our tracking
        // (recordTrigger is called when episode starts, not ends)
      }, 'scenePacer', { persistent: true });

      // Listen for episode start to record trigger
      actionBus.subscribe('episode:started', () => {
        recordTrigger();
      }, 'scenePacer', { persistent: true });

      // Day reset
      actionBus.subscribe('day:reset', () => {
        reset('day_boundary');
      }, 'scenePacer', { persistent: true });

      // Distance reset
      actionBus.subscribe('distance:reset', () => {
        reset('distance_reset');
      }, 'scenePacer', { persistent: true });

      // WO-WATCH-EPISODE-ROUTING: Track activity state changes
      actionBus.subscribe('activityState:changed', (data) => {
        if (data.to) {
          activityIncidentBias = data.to.incidentBias || 'medium';
          activityPacingMultiplier = data.to.pacingMultiplier ?? 1.0;
          console.log(`[ScenePacer] Activity state: ${data.to.label}, incident bias: ${activityIncidentBias}, pacing: ${activityPacingMultiplier}x`);
        }
      }, 'scenePacer', { persistent: true });
    }

    console.log('[ScenePacer] Initialized');
  }

  /**
   * Start the pacer
   */
  function start() {
    if (isRunning) return;

    const config = getConfig();
    isRunning = true;

    // Start check loop
    checkTimerId = setInterval(checkReadyState, config.checkIntervalMs);

    // Initial check
    checkReadyState();

    console.log('[ScenePacer] Started');
  }

  /**
   * Stop the pacer
   */
  function stop() {
    isRunning = false;

    if (checkTimerId) {
      clearInterval(checkTimerId);
      checkTimerId = null;
    }

    console.log('[ScenePacer] Stopped');
  }

  /**
   * Reset pacer state (new day)
   */
  function reset(reason = 'manual') {
    sceneCountToday = 0;
    lastTriggerMs = 0;
    isReady = false;
    dayStartMs = Date.now();

    console.log(`[ScenePacer] Reset (reason: ${reason})`);
  }

  /**
   * Get current state
   */
  function getState() {
    const config = getConfig();
    return {
      sceneCountToday,
      budgetRemaining: config.dailyBudget - sceneCountToday,
      isReady,
      currentDistance,
      cooldown: calculateCooldown(),
      lastTriggerMs,
      isRunning,
      config,
    };
  }

  /**
   * Get time until next potential trigger
   */
  function getTimeUntilReady() {
    const cooldown = calculateCooldown();
    const elapsed = Date.now() - lastTriggerMs;
    return Math.max(0, cooldown - elapsed);
  }

  return {
    init,
    start,
    stop,
    reset,
    requestTrigger,
    forceTrigger,
    getState,
    getTimeUntilReady,

    // Direct accessors
    get isReady() { return isReady; },
    get sceneCount() { return sceneCountToday; },
    get budgetRemaining() { return getConfig().dailyBudget - sceneCountToday; },
  };
}

export default { createScenePacer };
