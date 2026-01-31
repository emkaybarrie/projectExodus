// events.js — Simple Event Bus
// Pub/sub pattern for game events

/**
 * Create an event bus for inter-system communication
 */
export function createEventBus() {
  const listeners = new Map();

  /**
   * Subscribe to an event
   */
  function on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  function off(event, callback) {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  /**
   * Emit an event
   */
  function emit(event, data = {}) {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`[EventBus] Error in listener for "${event}":`, e);
        }
      });
    }
  }

  /**
   * Subscribe to an event once
   */
  function once(event, callback) {
    const wrapper = (data) => {
      off(event, wrapper);
      callback(data);
    };
    return on(event, wrapper);
  }

  /**
   * Clear all listeners for an event (or all events)
   */
  function clear(event = null) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }

  return {
    on,
    off,
    emit,
    once,
    clear,
  };
}

export default { createEventBus };
