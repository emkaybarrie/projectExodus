// journeyRunner.js — Journey Runner Core
// Part of I2-JourneyRunner-Phase1
// Spec: /The Forge/myfi/specs/system/JOURNEYS_SPEC.md

import { getExecutor, isSupported } from './ops/index.js';

// Default timeout: 30s (per Director decision)
const DEFAULT_TIMEOUT_MS = 30000;

// Journeys registry
const journeys = new Map();

// Currently running journey (one at a time for Phase 1)
let runningJourney = null;

// Context passed to ops
let runnerContext = null;

/**
 * Initialize the journey runner with context.
 * @param {object} ctx - { router, modalManager, actionBus }
 */
export function init(ctx) {
  runnerContext = ctx;
  console.log('[JourneyRunner] Initialized');
}

/**
 * Load journeys from manifest and convention paths.
 * @returns {Promise<void>}
 */
export async function loadJourneys() {
  journeys.clear();

  // 1. Load from manifest
  await loadFromManifest();

  // 2. Load from convention paths (src/journeys/**/*.journey.json)
  await loadFromConvention();

  console.log(`[JourneyRunner] Loaded ${journeys.size} journeys`);
}

/**
 * Load journeys from manifest.json
 */
async function loadFromManifest() {
  try {
    const manifestUrl = new URL('./manifest.json', import.meta.url).href;
    const res = await fetch(manifestUrl);

    if (!res.ok) {
      console.warn('[JourneyRunner] No manifest.json found or fetch failed');
      return;
    }

    const manifest = await res.json();
    const entries = manifest.journeys || [];

    for (const entry of entries) {
      if (!entry.id || !entry.path) continue;

      try {
        const journeyUrl = new URL(entry.path, import.meta.url).href;
        const journeyRes = await fetch(journeyUrl);

        if (!journeyRes.ok) {
          console.warn(`[JourneyRunner] Failed to load journey: ${entry.id}`);
          continue;
        }

        const journey = await journeyRes.json();
        registerJourney(journey);
      } catch (e) {
        console.warn(`[JourneyRunner] Error loading journey ${entry.id}:`, e);
      }
    }
  } catch (e) {
    console.warn('[JourneyRunner] Error loading manifest:', e);
  }
}

/**
 * Load journeys from convention paths.
 * Convention: src/journeys/**\/*.journey.json
 * Note: In browser, we can't scan directories. Convention discovery relies on manifest.
 * For Phase 1, convention paths are listed in manifest with convention: true flag.
 */
async function loadFromConvention() {
  // Browser limitation: can't scan filesystem
  // Convention discovery in browser requires a build step or explicit listing
  // For Phase 1, journeys are explicitly listed in manifest
  console.log('[JourneyRunner] Convention discovery: using manifest entries');
}

/**
 * Register a journey.
 * @param {object} journey
 */
function registerJourney(journey) {
  if (!journey.id) {
    console.warn('[JourneyRunner] Journey missing id, skipping');
    return;
  }

  if (journey.type !== 'journey') {
    console.warn(`[JourneyRunner] Invalid journey type for ${journey.id}`);
    return;
  }

  if (journeys.has(journey.id)) {
    console.warn(`[JourneyRunner] Duplicate journey id: ${journey.id}, overwriting`);
  }

  journeys.set(journey.id, journey);
  console.log(`[JourneyRunner] Registered: ${journey.id}${journey.title ? ` (${journey.title})` : ''}`);
}

/**
 * Bind journeys with triggers to ActionBus.
 * WO-HUB-02: Mark as persistent (runner-level subscription, not cleaned up per-surface)
 */
export function bindTriggers() {
  if (!runnerContext?.actionBus) {
    console.error('[JourneyRunner] Cannot bind triggers: no actionBus in context');
    return;
  }

  // Subscribe to wildcard to catch all actions
  runnerContext.actionBus.subscribe('*', (params, meta) => {
    const { action, source } = meta;

    // ARCHITECT ADDENDUM: Prevent self-trigger loops
    // Ignore actions where source === 'journey'
    if (source === 'journey') {
      return;
    }

    // Find journeys with matching triggers
    for (const [id, journey] of journeys) {
      if (!journey.trigger) continue;

      if (matchesTrigger(journey.trigger, action, params, source)) {
        console.log(`[JourneyRunner] Trigger matched: ${action} → ${id}`);
        runJourney(id, params).catch((e) => {
          console.error(`[JourneyRunner] Journey ${id} failed:`, e);
        });
        // Only trigger first matching journey
        break;
      }
    }
  }, 'journeyRunner', { persistent: true });

  console.log('[JourneyRunner] Triggers bound to ActionBus');
}

/**
 * Check if action matches a trigger.
 * @param {object} trigger - { action, from?, params? }
 * @param {string} actionName
 * @param {object} actionParams
 * @param {string} source
 * @returns {boolean}
 */
function matchesTrigger(trigger, actionName, actionParams, source) {
  // Action name must match
  if (trigger.action !== actionName) {
    return false;
  }

  // Source filter (optional)
  if (trigger.from && trigger.from !== source) {
    return false;
  }

  // Params matching (optional)
  if (trigger.params) {
    for (const [key, value] of Object.entries(trigger.params)) {
      if (actionParams[key] !== value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Run a journey by ID.
 * @param {string} journeyId
 * @param {object} triggerParams - Params from the triggering action
 * @returns {Promise<{ cancel: function }>}
 */
export async function runJourney(journeyId, triggerParams = {}) {
  const journey = journeys.get(journeyId);

  if (!journey) {
    throw new Error(`Journey not found: ${journeyId}`);
  }

  // Check if already running
  if (runningJourney) {
    console.warn(`[JourneyRunner] Journey already running: ${runningJourney.id}, cancelling`);
    await cancelCurrentJourney();
  }

  // Create abort controller for cancellation
  const abortController = new AbortController();

  runningJourney = {
    id: journeyId,
    journey,
    abortController,
    startTime: Date.now(),
  };

  // Emit journey.start
  emitLifecycleEvent('journey.start', { journeyId, title: journey.title });

  // Setup timeout
  const timeoutMs = journey.timeout ?? DEFAULT_TIMEOUT_MS;
  let timeoutId = null;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      if (runningJourney?.id === journeyId) {
        console.warn(`[JourneyRunner] Journey timeout: ${journeyId} (${timeoutMs}ms)`);
        emitLifecycleEvent('journey.timeout', { journeyId, timeoutMs });
        abortController.abort();
        runningJourney = null;
      }
    }, timeoutMs);
  }

  try {
    // Execute steps sequentially
    const steps = journey.steps || [];

    for (let i = 0; i < steps.length; i++) {
      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error('Journey cancelled');
      }

      const step = steps[i];
      const stepIndex = i;

      // Emit journey.step
      emitLifecycleEvent('journey.step', { journeyId, stepIndex, op: step.op });

      await executeStep(step, {
        journeyId,
        stepIndex,
        triggerParams,
        signal: abortController.signal,
      });
    }

    // Clear timeout
    if (timeoutId) clearTimeout(timeoutId);

    // Emit journey.complete
    emitLifecycleEvent('journey.complete', {
      journeyId,
      duration: Date.now() - runningJourney.startTime,
    });

    runningJourney = null;

  } catch (error) {
    // Clear timeout
    if (timeoutId) clearTimeout(timeoutId);

    // Only emit error if not cancelled/timeout (those have their own events)
    if (!abortController.signal.aborted) {
      emitLifecycleEvent('journey.error', {
        journeyId,
        error: error.message,
      });
    }

    runningJourney = null;
    throw error;
  }

  return {
    cancel: () => cancelJourney(journeyId),
  };
}

/**
 * Execute a single step.
 * @param {object} step - { op, ...params }
 * @param {object} stepCtx - { journeyId, stepIndex, triggerParams, signal }
 */
async function executeStep(step, stepCtx) {
  const { op } = step;

  if (!op) {
    throw new Error('Step missing op');
  }

  if (!isSupported(op)) {
    throw new Error(`Unknown operation: ${op}`);
  }

  const executor = getExecutor(op);

  // Build full context for op
  const ctx = {
    ...runnerContext,
    ...stepCtx,
  };

  await executor(step, ctx);
}

/**
 * Cancel a running journey.
 * @param {string} journeyId
 */
export function cancelJourney(journeyId) {
  if (!runningJourney || runningJourney.id !== journeyId) {
    console.warn(`[JourneyRunner] Cannot cancel: journey ${journeyId} not running`);
    return;
  }

  console.log(`[JourneyRunner] Cancelling journey: ${journeyId}`);
  emitLifecycleEvent('journey.cancel', { journeyId });
  runningJourney.abortController.abort();
  runningJourney = null;
}

/**
 * Cancel the currently running journey.
 */
export async function cancelCurrentJourney() {
  if (runningJourney) {
    cancelJourney(runningJourney.id);
  }
}

/**
 * Emit a lifecycle event via ActionBus.
 * @param {string} event
 * @param {object} data
 */
function emitLifecycleEvent(event, data) {
  if (runnerContext?.actionBus) {
    runnerContext.actionBus.emit(event, data, 'journeyRunner');
  }
  console.log(`[JourneyRunner] ${event}`, data);
}

/**
 * List all loaded journeys.
 * @returns {Array<{ id: string, title?: string }>}
 */
export function listJourneys() {
  return Array.from(journeys.values()).map((j) => ({
    id: j.id,
    title: j.title,
  }));
}

/**
 * Get a journey by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getJourney(id) {
  return journeys.get(id) || null;
}

/**
 * Check if a journey is currently running.
 * @returns {boolean}
 */
export function isRunning() {
  return runningJourney !== null;
}

/**
 * Get the currently running journey ID.
 * @returns {string|null}
 */
export function getRunningJourneyId() {
  return runningJourney?.id || null;
}

export default {
  init,
  loadJourneys,
  bindTriggers,
  runJourney,
  cancelJourney,
  cancelCurrentJourney,
  listJourneys,
  getJourney,
  isRunning,
  getRunningJourneyId,
};
