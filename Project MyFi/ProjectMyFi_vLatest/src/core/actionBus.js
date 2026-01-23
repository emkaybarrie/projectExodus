// actionBus.js — Simple action emitter for Part → Parent events
// Part of I1-Hub-Phase1-Scaffold

const listeners = new Map();

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

export function subscribe(action, handler) {
  if (!listeners.has(action)) {
    listeners.set(action, []);
  }
  listeners.get(action).push(handler);

  // Return unsubscribe function
  return () => {
    const handlers = listeners.get(action);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  };
}

export function clear() {
  listeners.clear();
}

// Create a scoped emitter for a specific Part
export function createPartEmitter(partId) {
  return {
    emit: (action, params = {}) => emit(action, params, partId),
  };
}

export default { emit, subscribe, clear, createPartEmitter };
