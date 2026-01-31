// stageSignals.js — Signal ingestion and queue management
// Per STAGE_EPISODES_SPEC_V1.md
//
// Handles incoming signals and routes them to the episode runner

import { createSignal, SIGNAL_KINDS, isValidSignal } from '../core/stageSchemas.js';

/**
 * Create a Stage Signal system
 *
 * @param {Object} options
 * @param {Object} options.actionBus - ActionBus for event dispatch
 * @param {Function} options.onSignal - Callback when a signal is processed
 * @returns {Object} Signal system interface
 */
export function createStageSignals(options = {}) {
  const { actionBus, onSignal } = options;

  // Signal queue for buffering when episode is active
  const signalQueue = [];
  let isProcessing = false;
  let isPaused = false;

  /**
   * Emit queue status update
   */
  function emitQueueStatus() {
    if (actionBus) {
      actionBus.emit('stageSignals:queueStatus', {
        queueLength: signalQueue.length,
        isPaused,
        isProcessing,
      });
    }
  }

  /**
   * Ingest a raw signal
   * Validates, normalizes, and queues for processing
   */
  function ingest(rawSignal) {
    // Normalize to Signal schema if needed
    const signal = isValidSignal(rawSignal)
      ? rawSignal
      : createSignal({
          kind: rawSignal.kind || SIGNAL_KINDS.TRANSACTION,
          sourceRef: rawSignal.sourceRef || rawSignal.source || '',
          payload: rawSignal.payload || rawSignal,
        });

    // Add to queue
    signalQueue.push(signal);

    if (isPaused) {
      console.log(`[StageSignals] Queued signal: ${signal.id} (queue: ${signalQueue.length}, episode active)`);
      emitQueueStatus(); // Notify UI of queue change
    } else {
      console.log(`[StageSignals] Ingested signal: ${signal.id} - processing immediately`);
      processNext();
    }

    return signal;
  }

  /**
   * Process the next signal in queue
   */
  function processNext() {
    if (isProcessing || isPaused || signalQueue.length === 0) {
      return;
    }

    isProcessing = true;
    const signal = signalQueue.shift();

    console.log(`[StageSignals] Processing signal: ${signal.id}`);

    // Emit to actionBus for episode runner to pick up
    if (actionBus) {
      actionBus.emit('stage:signal', signal);
    }

    // Call callback if provided
    if (onSignal) {
      onSignal(signal);
    }

    isProcessing = false;
    emitQueueStatus(); // Notify UI of queue change
  }

  /**
   * Pause signal processing (during active episode)
   */
  function pause() {
    isPaused = true;
    console.log('[StageSignals] Paused - signals will queue');
  }

  /**
   * Resume signal processing
   */
  function resume() {
    isPaused = false;
    if (signalQueue.length > 0) {
      console.log(`[StageSignals] Resumed - processing ${signalQueue.length} queued signal(s)`);
      processNext();
    } else {
      console.log('[StageSignals] Resumed - queue empty');
    }
  }

  /**
   * Subscribe to actionBus events if available
   * WO-HUB-02: Mark as persistent (system-level subscriptions, not cleaned up per-surface)
   */
  function init() {
    if (actionBus && actionBus.subscribe) {
      // Listen for episode lifecycle to pause/resume
      actionBus.subscribe('episode:started', () => {
        pause();
      }, 'stageSignals', { persistent: true });

      actionBus.subscribe('episode:resolved', () => {
        // Small delay before resuming to allow UI to settle
        setTimeout(() => {
          resume();
        }, 500);
      }, 'stageSignals', { persistent: true });

      // Listen for external signal injection
      actionBus.subscribe('signal:inject', (data) => {
        ingest(data);
      }, 'stageSignals', { persistent: true });
    }
  }

  /**
   * Get queue status
   */
  function getStatus() {
    return {
      queueLength: signalQueue.length,
      isProcessing,
      isPaused,
    };
  }

  /**
   * Clear the queue
   */
  function clearQueue() {
    signalQueue.length = 0;
    console.log('[StageSignals] Queue cleared');
  }

  return {
    init,
    ingest,
    pause,
    resume,
    getStatus,
    clearQueue,
    processNext,
  };
}

/**
 * Helper: Create a transaction signal from spend data
 */
export function createTransactionSignal({
  amount,
  merchant,
  category = 'discretionary',
  isAnomaly = false,
  sourceRef = 'demo',
} = {}) {
  return createSignal({
    kind: SIGNAL_KINDS.TRANSACTION,
    sourceRef,
    payload: {
      amount,
      merchant,
      category,
      isAnomaly,
    },
  });
}

/**
 * Helper: Create an anomaly signal
 */
export function createAnomalySignal({
  description,
  severity = 'medium',
  sourceRef = 'system',
} = {}) {
  return createSignal({
    kind: SIGNAL_KINDS.ANOMALY,
    sourceRef,
    payload: {
      description,
      severity,
    },
  });
}

/**
 * Helper: Create a threshold signal
 */
export function createThresholdSignal({
  threshold,
  current,
  type = 'spending',
  sourceRef = 'budget',
} = {}) {
  return createSignal({
    kind: SIGNAL_KINDS.THRESHOLD,
    sourceRef,
    payload: {
      threshold,
      current,
      type,
      exceeded: current > threshold,
    },
  });
}

/**
 * Helper: Create an ambient signal (quiet period)
 */
export function createAmbientSignal({
  reason = 'quiet_period',
  sourceRef = 'system',
} = {}) {
  return createSignal({
    kind: SIGNAL_KINDS.AMBIENT,
    sourceRef,
    payload: { reason },
  });
}

export default {
  createStageSignals,
  createTransactionSignal,
  createAnomalySignal,
  createThresholdSignal,
  createAmbientSignal,
};
