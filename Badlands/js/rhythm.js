/**
 * BADLANDS: Rhythm System
 *
 * Couples the audio beat to gameplay mechanics.
 * This is the CORE EXPERIMENT of the prototype.
 *
 * How rhythm is detected:
 * - AudioSystem fires beat events at precise intervals
 * - RhythmSystem tracks these and provides:
 *   1. Time until next beat
 *   2. "Beat window" for timing attacks/jumps
 *   3. Combo multiplier for on-beat actions
 *
 * How it feeds into gameplay:
 * - Level generation: Platforms spawn on beat
 * - Enemy spawns: Enemies appear on downbeats
 * - Ability windows: Perfect timing = bonus damage/effects
 * - Momentum: On-beat actions boost momentum
 * - Visual feedback: Screen pulses with beat
 */

const RhythmSystem = (() => {
  // Beat tracking
  let currentBeat = 0;
  let lastBeatTime = 0;
  let isActive = false;

  // Timing windows (in ms)
  const PERFECT_WINDOW = 50;  // ±50ms from beat
  const GOOD_WINDOW = 100;    // ±100ms from beat
  const OK_WINDOW = 150;      // ±150ms from beat

  // Combo system
  let combo = 0;
  let maxCombo = 0;
  let perfectHits = 0;
  let totalHits = 0;

  // Beat listeners (for visual feedback, level gen, etc.)
  const listeners = {
    beat: [],
    downbeat: []
  };

  // Multiplier based on combo
  const comboMultipliers = [1, 1.2, 1.5, 2.0, 2.5, 3.0];

  /**
   * Initialize rhythm system
   */
  function init() {
    // Listen to audio beats
    AudioSystem.onBeat(handleBeat);
    console.log('[Rhythm] Initialized');
  }

  /**
   * Start rhythm tracking
   */
  function start() {
    isActive = true;
    combo = 0;
    maxCombo = 0;
    perfectHits = 0;
    totalHits = 0;
    currentBeat = 0;
    lastBeatTime = performance.now();
  }

  /**
   * Stop rhythm tracking
   */
  function stop() {
    isActive = false;
  }

  /**
   * Handle incoming beat from audio system
   */
  function handleBeat(beatNum, isDownbeat) {
    if (!isActive) return;

    currentBeat = beatNum;
    lastBeatTime = performance.now();

    // Notify listeners
    listeners.beat.forEach(cb => cb(beatNum));
    if (isDownbeat) {
      listeners.downbeat.forEach(cb => cb(beatNum));
    }

    // Visual pulse (handled by game)
    document.body.classList.add('beat-pulse');
    setTimeout(() => {
      document.body.classList.remove('beat-pulse');
    }, 100);
  }

  /**
   * Get time until next beat (in ms)
   */
  function getTimeToNextBeat() {
    const interval = AudioSystem.getBeatInterval();
    const elapsed = performance.now() - lastBeatTime;
    return Math.max(0, interval - elapsed);
  }

  /**
   * Get time since last beat (in ms)
   */
  function getTimeSinceLastBeat() {
    return performance.now() - lastBeatTime;
  }

  /**
   * Get normalized beat phase (0 to 1, where 0 and 1 are on-beat)
   */
  function getBeatPhase() {
    const interval = AudioSystem.getBeatInterval();
    const elapsed = performance.now() - lastBeatTime;
    return (elapsed % interval) / interval;
  }

  /**
   * Check timing of an action and return rating
   * @returns {{ rating: string, multiplier: number, offset: number }}
   */
  function checkTiming() {
    const interval = AudioSystem.getBeatInterval();
    const elapsed = performance.now() - lastBeatTime;

    // Check distance from nearest beat (last or next)
    const distFromLast = elapsed;
    const distToNext = interval - elapsed;
    const offset = Math.min(distFromLast, distToNext);

    let rating, multiplier;

    if (offset <= PERFECT_WINDOW) {
      rating = 'PERFECT';
      multiplier = 2.0;
      perfectHits++;
    } else if (offset <= GOOD_WINDOW) {
      rating = 'GOOD';
      multiplier = 1.5;
    } else if (offset <= OK_WINDOW) {
      rating = 'OK';
      multiplier = 1.2;
    } else {
      rating = 'MISS';
      multiplier = 1.0;
    }

    return { rating, multiplier, offset };
  }

  /**
   * Register an on-beat action (for combo tracking)
   * @returns {{ rating: string, comboMultiplier: number, newCombo: number }}
   */
  function registerAction() {
    const timing = checkTiming();
    totalHits++;

    if (timing.rating !== 'MISS') {
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      // Play beat hit sound for good timing
      if (timing.rating === 'PERFECT') {
        AudioSystem.playSFX('beatHit', 0.3);
      }

      // Combo milestone sound
      if (combo > 0 && combo % 10 === 0) {
        AudioSystem.playSFX('combo', 0.4);
      }
    } else {
      combo = 0;
    }

    const comboMultiplier = getComboMultiplier();

    return {
      rating: timing.rating,
      timingMultiplier: timing.multiplier,
      comboMultiplier,
      totalMultiplier: timing.multiplier * comboMultiplier,
      newCombo: combo
    };
  }

  /**
   * Break the combo (e.g., when hit by enemy)
   */
  function breakCombo() {
    combo = 0;
  }

  /**
   * Get current combo count
   */
  function getCombo() {
    return combo;
  }

  /**
   * Get combo multiplier
   */
  function getComboMultiplier() {
    const idx = Math.min(Math.floor(combo / 5), comboMultipliers.length - 1);
    return comboMultipliers[idx];
  }

  /**
   * Get max combo achieved this run
   */
  function getMaxCombo() {
    return maxCombo;
  }

  /**
   * Get rhythm accuracy stats
   */
  function getStats() {
    return {
      perfectHits,
      totalHits,
      accuracy: totalHits > 0 ? (perfectHits / totalHits) * 100 : 0,
      maxCombo
    };
  }

  /**
   * Subscribe to beat events
   */
  function onBeat(callback) {
    listeners.beat.push(callback);
  }

  /**
   * Subscribe to downbeat events (every 4 beats)
   */
  function onDownbeat(callback) {
    listeners.downbeat.push(callback);
  }

  /**
   * Unsubscribe from beat events
   */
  function offBeat(callback) {
    const idx = listeners.beat.indexOf(callback);
    if (idx > -1) listeners.beat.splice(idx, 1);
  }

  /**
   * Get current beat number
   */
  function getCurrentBeat() {
    return currentBeat;
  }

  /**
   * Check if we're in the "power window" (close to beat)
   * Useful for enabling special abilities
   */
  function isInPowerWindow() {
    const interval = AudioSystem.getBeatInterval();
    const elapsed = performance.now() - lastBeatTime;
    const distFromLast = elapsed;
    const distToNext = interval - elapsed;
    return Math.min(distFromLast, distToNext) <= GOOD_WINDOW;
  }

  /**
   * Get beat intensity (0-1, peaks at beat)
   * Useful for visual effects
   */
  function getBeatIntensity() {
    const phase = getBeatPhase();
    // Creates a spike at 0 and 1 (on-beat)
    return phase < 0.5
      ? 1 - (phase * 2)
      : (phase - 0.5) * 2;
  }

  /**
   * Debug info
   */
  function getDebugInfo() {
    return {
      currentBeat,
      timeSinceBeat: getTimeSinceLastBeat().toFixed(0),
      timeToNext: getTimeToNextBeat().toFixed(0),
      phase: getBeatPhase().toFixed(2),
      intensity: getBeatIntensity().toFixed(2),
      combo,
      multiplier: getComboMultiplier().toFixed(1),
      inPowerWindow: isInPowerWindow()
    };
  }

  // Public API
  return {
    init,
    start,
    stop,
    getTimeToNextBeat,
    getTimeSinceLastBeat,
    getBeatPhase,
    getBeatIntensity,
    checkTiming,
    registerAction,
    breakCombo,
    getCombo,
    getComboMultiplier,
    getMaxCombo,
    getStats,
    onBeat,
    onDownbeat,
    offBeat,
    getCurrentBeat,
    isInPowerWindow,
    getDebugInfo,
    // Constants for external use
    PERFECT_WINDOW,
    GOOD_WINDOW,
    OK_WINDOW
  };
})();
