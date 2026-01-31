// episodeClock.js — Episode Time-of-Day Clock
// Tracks simulated time-of-day with acceleration for Watch Mode
// Provides dayT (0..1) representing progress through a simulated day

/**
 * Time scale presets for dev controls
 */
export const TIME_SCALES = {
  REALTIME: 1,      // 1 real second = 1 simulated second
  FAST: 5,          // 5x speed
  FASTER: 20,       // 20x speed
  RAPID: 60,        // 1 real second = 1 simulated minute
  TURBO: 300,       // 5 real seconds = full day
};

/**
 * Day segment definitions (for routing)
 */
export const DAY_SEGMENTS = {
  DAWN: { id: 'dawn', start: 0.0, end: 0.125, label: 'Dawn' },           // 0:00 - 3:00
  MORNING: { id: 'morning', start: 0.125, end: 0.333, label: 'Morning' }, // 3:00 - 8:00
  MIDDAY: { id: 'midday', start: 0.333, end: 0.5, label: 'Midday' },      // 8:00 - 12:00
  AFTERNOON: { id: 'afternoon', start: 0.5, end: 0.667, label: 'Afternoon' }, // 12:00 - 16:00
  EVENING: { id: 'evening', start: 0.667, end: 0.833, label: 'Evening' }, // 16:00 - 20:00
  NIGHT: { id: 'night', start: 0.833, end: 1.0, label: 'Night' },         // 20:00 - 24:00
};

/**
 * Convert dayT to segment
 */
export function getSegmentFromDayT(dayT) {
  const normalizedT = dayT % 1; // Wrap around
  for (const segment of Object.values(DAY_SEGMENTS)) {
    if (normalizedT >= segment.start && normalizedT < segment.end) {
      return segment;
    }
  }
  // Edge case: exactly 1.0 wraps to dawn
  return DAY_SEGMENTS.DAWN;
}

/**
 * Convert dayT to 24-hour time string (HH:MM)
 */
export function dayTToTimeString(dayT) {
  const normalizedT = dayT % 1;
  const totalMinutes = Math.floor(normalizedT * 1440); // 1440 minutes in a day
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert 24-hour time to dayT
 */
export function timeStringToDayT(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60 + minutes) / 1440;
}

/**
 * Create the episode clock
 */
export function createEpisodeClock(options = {}) {
  const {
    initialDayT = 0.25,           // Start at 6:00 AM by default
    defaultTimeScale = TIME_SCALES.REALTIME,
    dayDurationSeconds = 86400,   // Real-world day length in seconds (for 1x scale)
  } = options;

  // Clock state
  let dayT = initialDayT;
  let timeScale = defaultTimeScale;
  let isPaused = false;
  let lastUpdateTime = null;

  // Tracking
  let totalElapsedDays = 0;
  let listeners = [];

  /**
   * Update the clock (call from game loop)
   * @param {number} dt - Delta time in seconds
   */
  function update(dt) {
    if (isPaused || dt <= 0) return;

    // Calculate simulated time advancement
    // At 1x scale, dt seconds = dt seconds of simulated time
    // dayDurationSeconds = how many real seconds make up one simulated day
    const simulatedDt = dt * timeScale;
    const dayDelta = simulatedDt / dayDurationSeconds;

    const previousSegment = getSegmentFromDayT(dayT);
    const previousDayT = dayT;

    dayT += dayDelta;

    // Track day wrapping
    if (dayT >= 1) {
      totalElapsedDays += Math.floor(dayT);
      dayT = dayT % 1;
    }

    const currentSegment = getSegmentFromDayT(dayT);

    // Notify listeners of time change
    notifyListeners('tick', { dayT, previousDayT, dt: simulatedDt });

    // Notify if segment changed
    if (currentSegment.id !== previousSegment.id) {
      notifyListeners('segmentChange', {
        from: previousSegment,
        to: currentSegment,
        dayT,
      });
    }
  }

  /**
   * Set the time scale
   */
  function setTimeScale(scale) {
    const previousScale = timeScale;
    timeScale = scale;
    notifyListeners('timeScaleChange', { from: previousScale, to: scale });
  }

  /**
   * Pause the clock
   */
  function pause() {
    if (!isPaused) {
      isPaused = true;
      notifyListeners('pause', { dayT });
    }
  }

  /**
   * Resume the clock
   */
  function resume() {
    if (isPaused) {
      isPaused = false;
      notifyListeners('resume', { dayT });
    }
  }

  /**
   * Toggle pause state
   */
  function togglePause() {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }

  /**
   * Jump to a specific dayT
   */
  function setDayT(newDayT) {
    const previousDayT = dayT;
    const previousSegment = getSegmentFromDayT(dayT);

    dayT = newDayT % 1;
    if (dayT < 0) dayT += 1;

    const currentSegment = getSegmentFromDayT(dayT);

    notifyListeners('jump', { from: previousDayT, to: dayT });

    if (currentSegment.id !== previousSegment.id) {
      notifyListeners('segmentChange', {
        from: previousSegment,
        to: currentSegment,
        dayT,
      });
    }
  }

  /**
   * Jump to next segment
   */
  function jumpToNextSegment() {
    const currentSegment = getSegmentFromDayT(dayT);
    setDayT(currentSegment.end + 0.001); // Small offset to ensure we're in next segment
  }

  /**
   * Jump to previous segment
   */
  function jumpToPreviousSegment() {
    const currentSegment = getSegmentFromDayT(dayT);
    // Find the segment that ends at current segment's start
    let previousEnd = currentSegment.start - 0.001;
    if (previousEnd < 0) previousEnd += 1;
    const previousSegment = getSegmentFromDayT(previousEnd);
    setDayT(previousSegment.start);
  }

  /**
   * Jump to a specific segment by ID
   */
  function jumpToSegment(segmentId) {
    const segment = DAY_SEGMENTS[segmentId.toUpperCase()];
    if (segment) {
      setDayT(segment.start + 0.001);
    }
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
          console.error(`[EpisodeClock] Listener error for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Get current state (for debugging/dev UI)
   */
  function getState() {
    const segment = getSegmentFromDayT(dayT);
    return {
      dayT,
      timeString: dayTToTimeString(dayT),
      segment: segment.id,
      segmentLabel: segment.label,
      segmentProgress: (dayT - segment.start) / (segment.end - segment.start),
      timeScale,
      isPaused,
      totalElapsedDays,
    };
  }

  /**
   * Reset clock to initial state
   */
  function reset() {
    dayT = initialDayT;
    timeScale = defaultTimeScale;
    isPaused = false;
    totalElapsedDays = 0;
    notifyListeners('reset', { dayT });
  }

  return {
    // Update
    update,

    // Time control
    setTimeScale,
    pause,
    resume,
    togglePause,

    // Navigation
    setDayT,
    jumpToNextSegment,
    jumpToPreviousSegment,
    jumpToSegment,

    // State
    getState,
    getDayT: () => dayT,
    getTimeScale: () => timeScale,
    isPaused: () => isPaused,
    getCurrentSegment: () => getSegmentFromDayT(dayT),

    // Events
    on,
    off,

    // Reset
    reset,
  };
}

export default { createEpisodeClock, TIME_SCALES, DAY_SEGMENTS, getSegmentFromDayT, dayTToTimeString, timeStringToDayT };
