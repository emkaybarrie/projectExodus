// wait.js — Wait op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.4

/**
 * Pause execution for ms or until event.
 * @param {object} step - { op: 'wait', ms?: number, event?: string }
 * @param {object} ctx - { actionBus, journeyId, signal, ... }
 */
export async function execute(step, ctx) {
  const { ms, event } = step;

  if (ms == null && !event) {
    throw new Error('wait op requires either ms or event');
  }

  if (ms != null && event) {
    console.warn(`[Journey:${ctx.journeyId}] wait: both ms and event provided; using ms`);
  }

  // Wait for milliseconds
  if (ms != null) {
    console.log(`[Journey:${ctx.journeyId}] wait → ${ms}ms`);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);

      // Handle cancellation
      if (ctx.signal) {
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Journey cancelled during wait'));
        });
      }
    });

    return;
  }

  // Wait for event
  if (event) {
    console.log(`[Journey:${ctx.journeyId}] wait → event: ${event}`);

    if (!ctx.actionBus?.subscribe) {
      throw new Error('wait op with event requires actionBus in context');
    }

    await new Promise((resolve, reject) => {
      const unsubscribe = ctx.actionBus.subscribe(event, () => {
        unsubscribe();
        resolve();
      });

      // Handle cancellation
      if (ctx.signal) {
        ctx.signal.addEventListener('abort', () => {
          unsubscribe();
          reject(new Error('Journey cancelled during wait'));
        });
      }
    });
  }
}

export default { execute };
