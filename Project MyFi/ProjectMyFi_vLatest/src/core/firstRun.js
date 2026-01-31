// firstRun.js — First-Run State Management
// Tracks whether user has seen the welcome overlay

const FIRST_RUN_KEY = 'myfi.firstRunComplete';

/**
 * Check if user has completed the first-run experience
 */
export function hasCompletedFirstRun() {
  return localStorage.getItem(FIRST_RUN_KEY) === '1';
}

/**
 * Mark first-run as complete
 */
export function markFirstRunComplete() {
  localStorage.setItem(FIRST_RUN_KEY, '1');
}

/**
 * Reset first-run state (for testing)
 */
export function resetFirstRun() {
  localStorage.removeItem(FIRST_RUN_KEY);
}

export default {
  hasCompletedFirstRun,
  markFirstRunComplete,
  resetFirstRun,
};
