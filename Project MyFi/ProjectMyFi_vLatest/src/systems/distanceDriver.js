// distanceDriver.js — WO-BASELINE-COHERENCE + WO-HYBRID-ROUTING
//
// Provides distance01 (0..1) derived from:
//   - baseScheduleDistance: Time-of-day curve (dayT from episodeClock)
//   - pressureModifier: EMA-smoothed spend pressure
//   - spikeImpulse + aftershock: Sudden spend spike handling
//
// Final formula: distance01 = clamp01(baseSchedule + pressureModifier + spikeImpulse)
//
// Features:
//   - Hybrid mode: Schedule is spine, pressure can push ahead
//   - Spend spike detection with impulse + aftershock decay
//   - EMA smoothing for pressure modifier
//   - Tunable via __MYFI_DEV_CONFIG__
//
// Events emitted:
//   - distance:updated { distance01, baseSchedule, pressureModifier, spikeImpulse, aftershock, delta }
//   - distance:spike { amount, impulse, aftershockAdded }
//   - distance:reset { reason }
//   - distance:pressureOverride { reason, threshold, currentPressure }

/**
 * Default configuration (overridable via __MYFI_DEV_CONFIG__)
 */
const DEFAULT_CONFIG = {
  // === Base Schedule ===
  // Steepness of daily trajectory curve (higher = faster early progress, slower late)
  distanceCurveSteepness: 2.0,

  // Base daily progression rate (distance per hour in 24h cycle)
  baseProgressionRate: 0.042, // ~1.0 over 24 hours

  // === Pressure Model ===
  // How much each $ of spend affects pressure (0.01 = $100 spend → 1.0 pressure)
  spendPressureScalar: 0.01,

  // Maximum pressure value (capped to prevent runaway)
  maxPressure: 2.0,

  // Pressure decay rate per second (how fast pressure returns to 0)
  pressureDecayRate: 0.02,

  // EMA smoothing alpha (0.05-0.15 recommended)
  // Lower = smoother, slower response; Higher = faster response
  pressureEmaAlpha: 0.1,

  // === Spike Detection ===
  // Spend amount threshold to trigger spike ($50 default)
  spikeThreshold: 50,

  // Impulse scale: how much spike affects distance immediately (0.1 = $100 spike → 0.1 distance)
  spikeImpulseScale: 0.001,

  // Maximum impulse (cap to prevent distance jump to 1)
  maxSpikeImpulse: 0.15,

  // Aftershock: portion of spike that lingers (0.3 = 30% of impulse becomes aftershock)
  aftershockRatio: 0.3,

  // Aftershock decay rate per second
  aftershockDecayRate: 0.01,

  // === Hybrid Override Thresholds ===
  // Pressure level to trigger EXPLORE override (schedule wants REST/WAKE but pressure is high)
  exploreOverrideThreshold: 0.5,

  // Pressure level to trigger WIND_DOWN override (late-day high pressure → force return)
  returnOverrideThreshold: 0.8,

  // dayT after which WIND_DOWN override can trigger
  returnOverrideDayT: 0.7,

  // dayT before which REST is blocked (closure window)
  restBlockedBeforeDayT: 0.8,

  // === General ===
  // Jitter range (±this value added to each update)
  jitterRange: 0.005,

  // Update interval in ms
  updateIntervalMs: 1000,

  // WO-NARRATIVE-CONSOLIDATION: Demo mode emission removed
  // Transaction emission is now handled solely by chrome.js narrative engine
  // DistanceDriver only responds to spend signals, doesn't emit them
};

/**
 * Get merged config from defaults and __MYFI_DEV_CONFIG__
 */
function getConfig() {
  const devConfig = typeof window !== 'undefined' && window.__MYFI_DEV_CONFIG__?.distanceDriver;
  return { ...DEFAULT_CONFIG, ...devConfig };
}

/**
 * WO-HYBRID-ROUTING: Distance bands for sub-pool selection
 * Maps distance01 to named regions for visual/incident sub-pool selection
 */
export const DISTANCE_BANDS = {
  CITY: {
    id: 'city',
    label: 'City',
    min: 0,
    max: 0.15,
    description: 'Safe haven, starting area',
  },
  INNER: {
    id: 'inner',
    label: 'Inner Wilds',
    min: 0.15,
    max: 0.35,
    description: 'Outskirts, light encounters',
  },
  MID: {
    id: 'mid',
    label: 'Mid Wilds',
    min: 0.35,
    max: 0.65,
    description: 'Balanced exploration zone',
  },
  OUTER: {
    id: 'outer',
    label: 'Outer Wilds',
    min: 0.65,
    max: 0.85,
    description: 'Dangerous territory, intense encounters',
  },
  DEEP: {
    id: 'deep',
    label: 'Deep Wilds',
    min: 0.85,
    max: 1.0,
    description: 'Most dangerous, epic encounters',
  },
};

/**
 * Get distance band for a given distance01 value
 * @param {number} distance01 - Distance value (0..1)
 * @returns {Object} Distance band definition
 */
export function getDistanceBand(distance01) {
  if (distance01 < DISTANCE_BANDS.CITY.max) return DISTANCE_BANDS.CITY;
  if (distance01 < DISTANCE_BANDS.INNER.max) return DISTANCE_BANDS.INNER;
  if (distance01 < DISTANCE_BANDS.MID.max) return DISTANCE_BANDS.MID;
  if (distance01 < DISTANCE_BANDS.OUTER.max) return DISTANCE_BANDS.OUTER;
  return DISTANCE_BANDS.DEEP;
}

/**
 * Get all distance band IDs in order
 */
export function getDistanceBandIds() {
  return ['city', 'inner', 'mid', 'outer', 'deep'];
}

/**
 * Creates a Distance Driver system
 *
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event dispatch
 * @param {Function} options.onDistanceChange - Callback when distance updates
 * @returns {Object} Distance driver interface
 */
export function createDistanceDriver(options = {}) {
  const { actionBus, onDistanceChange, episodeClock } = options;

  // State
  let distance01 = 0;           // Current distance (0..1) - final output
  let baseScheduleDistance = 0; // Base from time-of-day schedule
  let pressureModifier = 0;     // EMA-smoothed pressure contribution
  let rawPressure = 0;          // Raw pressure before EMA smoothing
  let spikeImpulse = 0;         // Immediate spike effect (decays fast)
  let aftershock = 0;           // Lingering spike effect (decays slower)
  let dayStartMs = Date.now();  // When current "day" started
  let updateTimerId = null;
  let isRunning = false;

  // Legacy compat: trajectory alias
  let trajectoryBase = 0;

  // Tracking
  let lastUpdateMs = Date.now();
  let totalSpendToday = 0;
  let signalCountToday = 0;
  let spikeCountToday = 0;

  // WO-WATCH-EPISODE-ROUTING: Activity state distance bias
  let activityDistanceBias = 0;  // e.g., EXPLORE +0.15, FOCUS +0.25

  // WO-HYBRID-ROUTING: Pressure override state
  let currentPressureOverride = null; // { reason, threshold } when override is active

  /**
   * Calculate base schedule distance value (0..1) based on dayT
   * Uses episodeClock's dayT if available, otherwise calculates from elapsed time
   * Returns smooth S-curve: slow start, fast middle, slow end
   */
  function calculateBaseScheduleDistance(dayT) {
    const config = getConfig();

    // Apply steepness curve: smooth S-curve using sigmoid-like function
    // steepness controls how quickly it reaches mid-point
    const k = config.distanceCurveSteepness;

    // Modified logistic curve centered at 0.5, scaled to 0..1
    // This creates a smooth "adventure curve" - slow start, fast middle, slow end
    const trajectory = 1 / (1 + Math.exp(-k * (dayT - 0.5) * 4));

    return Math.max(0, Math.min(1, trajectory));
  }

  /**
   * Get current dayT (0..1) from episodeClock or calculate from elapsed time
   */
  function getCurrentDayT() {
    // Use episodeClock if available
    if (episodeClock && typeof episodeClock.getDayT === 'function') {
      return episodeClock.getDayT();
    }

    // Fallback: calculate from elapsed time since day start
    const dayLengthMs = 24 * 60 * 60 * 1000;
    const elapsedMs = Date.now() - dayStartMs;
    return Math.min(1, elapsedMs / dayLengthMs);
  }

  /**
   * Legacy alias for trajectory calculation
   * @deprecated Use calculateBaseScheduleDistance instead
   */
  function calculateTrajectory(elapsedMs) {
    const dayLengthMs = 24 * 60 * 60 * 1000;
    const dayT = Math.min(1, elapsedMs / dayLengthMs);
    return calculateBaseScheduleDistance(dayT);
  }

  /**
   * Add small jitter to avoid predictable movement
   */
  function addJitter(value) {
    const config = getConfig();
    const jitter = (Math.random() - 0.5) * 2 * config.jitterRange;
    return Math.max(0, Math.min(1, value + jitter));
  }

  /**
   * Process a spend signal to add pressure
   * Also detects spikes and triggers impulse + aftershock
   */
  function processSpendSignal(amount) {
    const config = getConfig();

    // Add to raw pressure based on amount
    const pressureGain = amount * config.spendPressureScalar;
    rawPressure = Math.min(config.maxPressure, rawPressure + pressureGain);

    // Track totals
    totalSpendToday += amount;
    signalCountToday++;

    // WO-HYBRID-ROUTING: Spike detection
    const isSpike = amount >= config.spikeThreshold;
    if (isSpike) {
      processSpikeSignal(amount);
    }

    console.log(`[DistanceDriver] Spend signal: $${amount}${isSpike ? ' [SPIKE]' : ''} → pressure +${pressureGain.toFixed(3)} (raw: ${rawPressure.toFixed(3)})`);
  }

  /**
   * WO-HYBRID-ROUTING: Process a spike signal
   * Triggers immediate impulse + adds to aftershock
   */
  function processSpikeSignal(amount) {
    const config = getConfig();

    // Calculate impulse: immediate distance jump
    const impulse = Math.min(
      config.maxSpikeImpulse,
      amount * config.spikeImpulseScale
    );

    // Add impulse (immediate effect)
    spikeImpulse = Math.min(config.maxSpikeImpulse, spikeImpulse + impulse);

    // Add to aftershock (lingering effect)
    const aftershockGain = impulse * config.aftershockRatio;
    aftershock += aftershockGain;

    spikeCountToday++;

    // Emit spike event
    if (actionBus) {
      actionBus.emit('distance:spike', {
        amount,
        impulse,
        aftershockAdded: aftershockGain,
        totalImpulse: spikeImpulse,
        totalAftershock: aftershock,
        spikeCount: spikeCountToday,
      });
    }

    console.log(`[DistanceDriver] SPIKE: $${amount} → impulse +${impulse.toFixed(3)}, aftershock +${aftershockGain.toFixed(3)}`);
  }

  /**
   * Update distance based on hybrid model:
   * distance01 = baseSchedule + pressureModifier + spikeImpulse + activityBias
   */
  function update() {
    const config = getConfig();
    const now = Date.now();
    const deltaMs = now - lastUpdateMs;
    const deltaSec = deltaMs / 1000;
    lastUpdateMs = now;

    // Get current dayT
    const dayT = getCurrentDayT();

    // === 1. Calculate base schedule distance ===
    baseScheduleDistance = calculateBaseScheduleDistance(dayT);
    trajectoryBase = baseScheduleDistance; // Legacy compat

    // === 2. Decay raw pressure ===
    const pressureDecay = deltaSec * config.pressureDecayRate;
    rawPressure = Math.max(0, rawPressure - pressureDecay);

    // === 3. EMA smoothing for pressure modifier ===
    // pressureModifier = EMA(rawPressure)
    // EMA formula: new = alpha * current + (1-alpha) * previous
    const alpha = config.pressureEmaAlpha;
    const targetPressureMod = rawPressure * 0.1; // Convert pressure to distance modifier (10% at max)
    pressureModifier = alpha * targetPressureMod + (1 - alpha) * pressureModifier;

    // === 4. Decay spike impulse (fast decay) ===
    // Impulse decays at 3x the aftershock rate for quick effect
    const impulsDecay = deltaSec * config.aftershockDecayRate * 3;
    spikeImpulse = Math.max(0, spikeImpulse - impulsDecay);

    // === 5. Decay aftershock (slow decay) ===
    const aftershockDecay = deltaSec * config.aftershockDecayRate;
    aftershock = Math.max(0, aftershock - aftershockDecay);

    // === 6. Activity state bias ===
    const activityBoost = activityDistanceBias * 0.1; // Apply bias as 10% modifier

    // === 7. Calculate final distance ===
    // Hybrid formula: schedule spine + pressure + spike + aftershock + activity
    const targetDistance =
      baseScheduleDistance +
      pressureModifier +
      spikeImpulse +
      aftershock +
      activityBoost;

    // Smooth interpolation toward target (avoid teleporting)
    const smoothFactor = 0.15; // 15% movement per update toward target
    const delta = (targetDistance - distance01) * smoothFactor;

    // Apply delta with jitter
    const newDistance = addJitter(distance01 + delta);

    // Store previous for delta reporting
    const prevDistance = distance01;
    distance01 = Math.max(0, Math.min(1, newDistance));

    // === 8. Check for pressure overrides ===
    checkPressureOverride(dayT, pressureModifier + spikeImpulse + aftershock);

    // WO-HYBRID-ROUTING: Get current distance band
    const distanceBand = getDistanceBand(distance01);

    // Emit update event
    if (actionBus) {
      actionBus.emit('distance:updated', {
        distance01,
        dayT,
        baseSchedule: baseScheduleDistance,
        pressureModifier,
        spikeImpulse,
        aftershock,
        rawPressure,
        delta: distance01 - prevDistance,
        totalSpendToday,
        signalCountToday,
        spikeCountToday,
        distanceBand,
        // Legacy compat
        trajectory: trajectoryBase,
        pressure: rawPressure,
      });
    }

    // Callback
    if (onDistanceChange) {
      onDistanceChange(distance01, {
        dayT,
        baseSchedule: baseScheduleDistance,
        pressureModifier,
        distanceBand,
        spikeImpulse,
        aftershock,
        delta: distance01 - prevDistance,
        // Legacy compat
        trajectory: trajectoryBase,
        pressure: rawPressure,
      });
    }
  }

  /**
   * WO-HYBRID-ROUTING: Check if pressure should override scheduled activity state
   * Emits events for episodeRouter to handle
   */
  function checkPressureOverride(dayT, totalPressure) {
    const config = getConfig();

    // Check explore override: high pressure during REST/WAKE should push to EXPLORE
    if (totalPressure >= config.exploreOverrideThreshold) {
      if (currentPressureOverride?.reason !== 'explore') {
        currentPressureOverride = {
          reason: 'explore',
          threshold: config.exploreOverrideThreshold,
        };
        if (actionBus) {
          actionBus.emit('distance:pressureOverride', {
            reason: 'explore',
            threshold: config.exploreOverrideThreshold,
            currentPressure: totalPressure,
            dayT,
          });
        }
        console.log(`[DistanceDriver] Pressure override: EXPLORE (pressure ${totalPressure.toFixed(3)} >= ${config.exploreOverrideThreshold})`);
      }
    }
    // Check return override: very high pressure late in day should force WIND_DOWN
    else if (totalPressure >= config.returnOverrideThreshold && dayT >= config.returnOverrideDayT) {
      if (currentPressureOverride?.reason !== 'return') {
        currentPressureOverride = {
          reason: 'return',
          threshold: config.returnOverrideThreshold,
        };
        if (actionBus) {
          actionBus.emit('distance:pressureOverride', {
            reason: 'return',
            threshold: config.returnOverrideThreshold,
            currentPressure: totalPressure,
            dayT,
          });
        }
        console.log(`[DistanceDriver] Pressure override: RETURN (pressure ${totalPressure.toFixed(3)} >= ${config.returnOverrideThreshold}, dayT ${dayT.toFixed(3)} >= ${config.returnOverrideDayT})`);
      }
    }
    // Clear override if pressure drops below threshold
    else if (currentPressureOverride && totalPressure < config.exploreOverrideThreshold * 0.7) {
      console.log(`[DistanceDriver] Pressure override cleared (pressure ${totalPressure.toFixed(3)} dropped)`);
      if (actionBus) {
        actionBus.emit('distance:pressureOverride', {
          reason: 'cleared',
          previousOverride: currentPressureOverride.reason,
          currentPressure: totalPressure,
          dayT,
        });
      }
      currentPressureOverride = null;
    }
  }

  // WO-NARRATIVE-CONSOLIDATION: Removed internal demo signal emission
  // DistanceDriver no longer emits its own demo signals - it only responds to
  // spend signals from the stageSignals pipeline (via actionBus subscriptions).
  //
  // Demo mode transaction emission is handled by ONE source:
  // - chrome.js auto-transaction loop (Narrative Engine)
  //
  // DistanceDriver's role is purely distance/pressure calculation:
  // - Listens for stage:signal and spend:recorded events
  // - Updates pressure, distance, and spike calculations
  // - Does NOT emit transaction signals

  /**
   * Initialize the driver
   */
  function init() {
    // Subscribe to spend signals
    if (actionBus && actionBus.subscribe) {
      // Listen for transaction signals from stageSignals
      actionBus.subscribe('stage:signal', (signal) => {
        if (signal.payload && typeof signal.payload.amount === 'number') {
          processSpendSignal(signal.payload.amount);
        }
      }, 'distanceDriver', { persistent: true });

      // Listen for direct spend events
      actionBus.subscribe('spend:recorded', (data) => {
        if (typeof data.amount === 'number') {
          processSpendSignal(data.amount);
        }
      }, 'distanceDriver', { persistent: true });

      // Listen for day reset
      actionBus.subscribe('day:reset', () => {
        reset('day_boundary');
      }, 'distanceDriver', { persistent: true });

      // WO-WATCH-EPISODE-ROUTING: Track activity state changes for distance bias
      actionBus.subscribe('activityState:changed', (data) => {
        if (data.to) {
          activityDistanceBias = data.to.distanceBias ?? 0;
          console.log(`[DistanceDriver] Activity state: ${data.to.label}, distance bias: ${activityDistanceBias > 0 ? '+' : ''}${activityDistanceBias}`);
        }
      }, 'distanceDriver', { persistent: true });
    }

    console.log('[DistanceDriver] Initialized');
  }

  /**
   * Start the driver
   * WO-NARRATIVE-CONSOLIDATION: Removed demo signal emission - only handles distance/pressure
   */
  function start() {
    if (isRunning) return;

    const config = getConfig();
    isRunning = true;
    lastUpdateMs = Date.now();

    // Start update loop (distance/pressure calculations only)
    updateTimerId = setInterval(update, config.updateIntervalMs);

    // Initial update
    update();

    console.log('[DistanceDriver] Started (distance/pressure mode)');
  }

  /**
   * Stop the driver
   */
  function stop() {
    isRunning = false;

    if (updateTimerId) {
      clearInterval(updateTimerId);
      updateTimerId = null;
    }

    console.log('[DistanceDriver] Stopped');
  }

  /**
   * Reset distance and pressure (new day or manual reset)
   */
  function reset(reason = 'manual') {
    distance01 = 0;
    baseScheduleDistance = 0;
    pressureModifier = 0;
    rawPressure = 0;
    spikeImpulse = 0;
    aftershock = 0;
    trajectoryBase = 0;
    dayStartMs = Date.now();
    totalSpendToday = 0;
    signalCountToday = 0;
    spikeCountToday = 0;
    lastUpdateMs = Date.now();
    currentPressureOverride = null;

    if (actionBus) {
      actionBus.emit('distance:reset', { reason });
    }

    console.log(`[DistanceDriver] Reset (reason: ${reason})`);
  }

  /**
   * Force set distance (for testing/debugging)
   */
  function setDistance(value) {
    distance01 = Math.max(0, Math.min(1, value));

    if (actionBus) {
      actionBus.emit('distance:updated', {
        distance01,
        trajectory: trajectoryBase,
        pressure,
        delta: 0,
        forced: true,
      });
    }

    console.log(`[DistanceDriver] Distance forced to: ${distance01.toFixed(3)}`);
  }

  /**
   * Add pressure directly (for testing/debugging)
   */
  function addPressure(amount) {
    const config = getConfig();
    pressure = Math.min(config.maxPressure, pressure + amount);
    console.log(`[DistanceDriver] Pressure added: ${amount} (total: ${pressure.toFixed(3)})`);
  }

  /**
   * Get current state
   */
  function getState() {
    const dayT = getCurrentDayT();
    return {
      distance01,
      dayT,
      distanceBand: getDistanceBand(distance01),
      baseSchedule: baseScheduleDistance,
      pressureModifier,
      spikeImpulse,
      aftershock,
      rawPressure,
      totalSpendToday,
      signalCountToday,
      spikeCountToday,
      isRunning,
      dayStartMs,
      currentPressureOverride,
      config: getConfig(),
      // Legacy compat
      trajectory: trajectoryBase,
      pressure: rawPressure,
    };
  }

  /**
   * WO-HYBRID-ROUTING: Manually trigger a spike (for testing)
   */
  function triggerSpike(amount = 100) {
    processSpikeSignal(amount);
    processSpendSignal(amount);
    console.log(`[DistanceDriver] Manual spike triggered: $${amount}`);
  }

  /**
   * WO-HYBRID-ROUTING: Get current total pressure effect
   */
  function getTotalPressure() {
    return pressureModifier + spikeImpulse + aftershock;
  }

  return {
    init,
    start,
    stop,
    reset,
    setDistance,
    addPressure,
    processSpendSignal,
    triggerSpike,
    getTotalPressure,
    getState,
    getDistanceBand: () => getDistanceBand(distance01),

    // Direct accessors
    get distance01() { return distance01; },
    get dayT() { return getCurrentDayT(); },
    get distanceBand() { return getDistanceBand(distance01); },
    get baseSchedule() { return baseScheduleDistance; },
    get pressureModifier() { return pressureModifier; },
    get spikeImpulse() { return spikeImpulse; },
    get aftershock() { return aftershock; },
    get currentPressureOverride() { return currentPressureOverride; },
    // Legacy compat
    get pressure() { return rawPressure; },
    get trajectory() { return trajectoryBase; },
  };
}

export default {
  createDistanceDriver,
  DISTANCE_BANDS,
  getDistanceBand,
  getDistanceBandIds,
};
