// actionBus.js — Simple action emitter for Part → Parent events
// Part of I1-Hub-Phase1-Scaffold
// HUB-08-R: Added subscription lifecycle tracking and dev-mode leak detection

const listeners = new Map();

// HUB-08-R: Dev-mode subscription tracking for leak detection
const DEV_MODE = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.__MYFI_DEBUG__
);
const activeSubscriptions = new Map(); // subscriptionId → { action, source, stack }
let subscriptionCounter = 0;

export function emit(action, params = {}, source = 'unknown') {
  console.log(`[ActionBus] ${source} → ${action}`, params);

  const handlers = listeners.get(action) || [];
  for (const handler of handlers) {
    try {
      handler(params, { action, source });
    } catch (e) {
      console.error(`[ActionBus] Handler error for "${action}":`, e);
    }
  }

  // Also emit to wildcard listeners
  const wildcardHandlers = listeners.get('*') || [];
  for (const handler of wildcardHandlers) {
    try {
      handler(params, { action, source });
    } catch (e) {
      console.error(`[ActionBus] Wildcard handler error:`, e);
    }
  }
}

/**
 * Subscribe to an action.
 *
 * LIFECYCLE CONTRACT (HUB-08-R):
 * - Subscribe on mount (in Part's mount function)
 * - Store the returned unsubscribe function
 * - Call unsubscribe in unmount() — REQUIRED to prevent memory leaks
 *
 * @param {string} action - Action name to subscribe to ('*' for wildcard)
 * @param {Function} handler - Handler function (params, meta) => void
 * @param {string} [source] - Optional source identifier for dev-mode tracking
 * @returns {Function} Unsubscribe function — MUST be called on unmount
 */
export function subscribe(action, handler, source = 'unknown') {
  if (!listeners.has(action)) {
    listeners.set(action, []);
  }
  listeners.get(action).push(handler);

  // HUB-08-R: Track subscription in dev mode
  const subscriptionId = ++subscriptionCounter;
  if (DEV_MODE) {
    activeSubscriptions.set(subscriptionId, {
      action,
      source,
      stack: new Error().stack,
      timestamp: Date.now(),
    });
  }

  // Return unsubscribe function
  return () => {
    const handlers = listeners.get(action);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
    // HUB-08-R: Remove from tracking
    if (DEV_MODE) {
      activeSubscriptions.delete(subscriptionId);
    }
  };
}

export function clear() {
  listeners.clear();
  if (DEV_MODE) {
    activeSubscriptions.clear();
  }
}

// Create a scoped emitter for a specific Part
export function createPartEmitter(partId) {
  return {
    emit: (action, params = {}) => emit(action, params, partId),
    // HUB-08-R: Scoped subscribe with automatic source tagging
    subscribe: (action, handler) => subscribe(action, handler, partId),
  };
}

/**
 * HUB-08-R: Get active subscription count (dev mode only)
 * Use for debugging subscription leaks
 */
export function getActiveSubscriptionCount() {
  return DEV_MODE ? activeSubscriptions.size : -1;
}

/**
 * HUB-08-R: Check for subscription leaks after surface unmount
 * Call this from surfaceCompositor after unmounting all parts
 * @param {string} surfaceId - Surface that was unmounted
 */
export function checkForLeaks(surfaceId) {
  if (!DEV_MODE) return;

  const leaks = [];
  const now = Date.now();

  for (const [id, sub] of activeSubscriptions.entries()) {
    // Subscriptions older than 100ms after unmount check are likely leaks
    if (now - sub.timestamp > 100) {
      leaks.push(sub);
    }
  }

  if (leaks.length > 0) {
    console.warn(
      `[ActionBus] LEAK DETECTED after "${surfaceId}" unmount: ${leaks.length} subscription(s) not cleaned up`,
      leaks.map(l => ({ action: l.action, source: l.source }))
    );
  }
}

/**
 * HUB-08-R: Debug helper to list all active subscriptions
 */
export function debugSubscriptions() {
  if (!DEV_MODE) {
    console.log('[ActionBus] Debug mode not enabled');
    return;
  }

  console.group('[ActionBus] Active Subscriptions');
  for (const [id, sub] of activeSubscriptions.entries()) {
    console.log(`#${id}: ${sub.action} (source: ${sub.source})`);
  }
  console.groupEnd();
  return Array.from(activeSubscriptions.values());
}

export default {
  emit,
  subscribe,
  clear,
  createPartEmitter,
  // HUB-08-R: Lifecycle debugging
  checkForLeaks,
  getActiveSubscriptionCount,
  debugSubscriptions,
};
