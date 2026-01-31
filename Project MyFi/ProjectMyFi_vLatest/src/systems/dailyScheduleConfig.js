// dailyScheduleConfig.js — WO-DEV-RENDER-BINDING / Baseline Schedule
//
// Defines the baseline daily routine that runs with zero spending inputs.
// The schedule is the "spine" of the day - activity states follow this by default.
//
// Activity State Loop:
//   WAKE → EXPLORE → FOCUS → WIND_DOWN → REST → (loop)
//
// This config is used by episodeRouter to determine scheduled states.
// Overridable via __MYFI_DEV_CONFIG__.dailySchedule

/**
 * Activity state definitions with time boundaries
 * Times are in 24-hour format (HH:MM)
 *
 * Schedule can be:
 * - Fixed: States follow exact times
 * - With Jitter: Small random variation on boundaries
 * - Override: Pressure can override schedule (hybrid mode)
 */
export const DEFAULT_DAILY_SCHEDULE = {
  // ═══════════════════════════════════════════════════════════════════════
  // SCHEDULE SEGMENTS (time → activity state mapping)
  // ═══════════════════════════════════════════════════════════════════════
  segments: [
    {
      id: 'prepare',
      activityStateId: 'wake',
      startTime: '05:00',
      endTime: '08:00',
      label: 'Prepare',
      description: 'Day begins, preparing for adventure',
      visualPool: 'morning',
      incidentBias: 'minimal',
    },
    {
      id: 'patrol',
      activityStateId: 'explore',
      startTime: '08:00',
      endTime: '12:00',
      label: 'Patrol',
      description: 'Light exploration, scouting the area',
      visualPool: 'active',
      incidentBias: 'low',
    },
    {
      id: 'explore',
      activityStateId: 'focus',
      startTime: '12:00',
      endTime: '17:00',
      label: 'Explore',
      description: 'Deep exploration, main activity period',
      visualPool: 'intense',
      incidentBias: 'high',
    },
    {
      id: 'return',
      activityStateId: 'wind_down',
      startTime: '17:00',
      endTime: '20:00',
      label: 'Return',
      description: 'Heading back, winding down',
      visualPool: 'evening',
      incidentBias: 'medium',
    },
    {
      id: 'relax',
      activityStateId: 'wind_down',
      startTime: '20:00',
      endTime: '23:00',
      label: 'Relax',
      description: 'Evening rest, light activity',
      visualPool: 'evening',
      incidentBias: 'low',
    },
    {
      id: 'recover',
      activityStateId: 'rest',
      startTime: '23:00',
      endTime: '05:00', // Wraps to next day
      label: 'Recover',
      description: 'Night rest, recovery period',
      visualPool: 'night',
      incidentBias: 'minimal',
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════
  // JITTER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════
  jitter: {
    enabled: false,
    minMinutes: 5,
    maxMinutes: 15,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TIME MODE SETTINGS
  // ═══════════════════════════════════════════════════════════════════════
  timeMode: {
    // 'watch' = simulated time (accelerated), 'realtime' = follows local clock
    default: 'watch',

    // In realtime mode, offset from local time (minutes)
    realtimeOffsetMinutes: 0,
  },
};

/**
 * Get merged config from defaults and __MYFI_DEV_CONFIG__
 */
export function getDailyScheduleConfig() {
  const devConfig = typeof window !== 'undefined' && window.__MYFI_DEV_CONFIG__?.dailySchedule;
  if (!devConfig) return DEFAULT_DAILY_SCHEDULE;

  return {
    ...DEFAULT_DAILY_SCHEDULE,
    ...devConfig,
    segments: devConfig.segments || DEFAULT_DAILY_SCHEDULE.segments,
    jitter: { ...DEFAULT_DAILY_SCHEDULE.jitter, ...devConfig.jitter },
    timeMode: { ...DEFAULT_DAILY_SCHEDULE.timeMode, ...devConfig.timeMode },
  };
}

/**
 * Convert time string (HH:MM) to dayT (0..1)
 */
export function timeStringToDayT(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60 + minutes) / 1440;
}

/**
 * Convert dayT (0..1) to time string (HH:MM)
 */
export function dayTToTimeString(dayT) {
  const normalizedT = dayT % 1;
  const totalMinutes = Math.floor(normalizedT * 1440);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get current schedule segment for a given dayT
 * @param {number} dayT - Day progress (0..1)
 * @returns {Object} Schedule segment
 */
export function getScheduleSegmentForDayT(dayT) {
  const config = getDailyScheduleConfig();
  const normalizedT = dayT % 1;

  for (const segment of config.segments) {
    const startT = timeStringToDayT(segment.startTime);
    let endT = timeStringToDayT(segment.endTime);

    // Handle wrap-around (e.g., 23:00 - 05:00)
    if (endT < startT) {
      // This segment wraps past midnight
      if (normalizedT >= startT || normalizedT < endT) {
        return segment;
      }
    } else {
      if (normalizedT >= startT && normalizedT < endT) {
        return segment;
      }
    }
  }

  // Fallback to first segment
  return config.segments[0];
}

/**
 * Get activity state ID for a given dayT
 * @param {number} dayT - Day progress (0..1)
 * @returns {string} Activity state ID
 */
export function getActivityStateIdForDayT(dayT) {
  const segment = getScheduleSegmentForDayT(dayT);
  return segment.activityStateId;
}

/**
 * Get visual pool for a given dayT
 * @param {number} dayT - Day progress (0..1)
 * @returns {string} Visual pool name
 */
export function getVisualPoolForDayT(dayT) {
  const segment = getScheduleSegmentForDayT(dayT);
  return segment.visualPool || 'default';
}

/**
 * Get incident bias for a given dayT
 * @param {number} dayT - Day progress (0..1)
 * @returns {string} Incident bias level
 */
export function getIncidentBiasForDayT(dayT) {
  const segment = getScheduleSegmentForDayT(dayT);
  return segment.incidentBias || 'medium';
}

/**
 * Get all schedule segment boundaries as dayT values
 * Useful for clock jumping
 */
export function getScheduleSegmentBoundaries() {
  const config = getDailyScheduleConfig();
  return config.segments.map(segment => ({
    id: segment.id,
    label: segment.label,
    dayT: timeStringToDayT(segment.startTime),
    activityStateId: segment.activityStateId,
  }));
}

/**
 * Apply jitter to a time value if enabled
 * @param {number} dayT - Base dayT value
 * @returns {number} dayT with jitter applied
 */
export function applyJitter(dayT) {
  const config = getDailyScheduleConfig();
  if (!config.jitter.enabled) return dayT;

  const { minMinutes, maxMinutes } = config.jitter;
  const jitterMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  const jitterDayT = jitterMinutes / 1440;

  // Random direction
  const direction = Math.random() > 0.5 ? 1 : -1;

  return Math.max(0, Math.min(1, dayT + direction * jitterDayT));
}

/**
 * Get current local time as dayT
 * Used when timeMode is 'realtime'
 */
export function getLocalTimeDayT() {
  const now = new Date();
  const config = getDailyScheduleConfig();
  const offsetMs = config.timeMode.realtimeOffsetMinutes * 60 * 1000;
  const adjustedTime = new Date(now.getTime() + offsetMs);

  const hours = adjustedTime.getHours();
  const minutes = adjustedTime.getMinutes();
  const seconds = adjustedTime.getSeconds();

  return (hours * 3600 + minutes * 60 + seconds) / 86400;
}

/**
 * Check if we should use realtime mode
 */
export function isRealtimeMode() {
  const config = getDailyScheduleConfig();

  // Check dev config override
  if (typeof window !== 'undefined') {
    const devConfig = window.__MYFI_DEV_CONFIG__;
    if (devConfig?.watchModeEnabled === false && devConfig?.realtimeMode === true) {
      return true;
    }
  }

  return config.timeMode.default === 'realtime';
}

export default {
  DEFAULT_DAILY_SCHEDULE,
  getDailyScheduleConfig,
  timeStringToDayT,
  dayTToTimeString,
  getScheduleSegmentForDayT,
  getActivityStateIdForDayT,
  getVisualPoolForDayT,
  getIncidentBiasForDayT,
  getScheduleSegmentBoundaries,
  applyJitter,
  getLocalTimeDayT,
  isRealtimeMode,
};
