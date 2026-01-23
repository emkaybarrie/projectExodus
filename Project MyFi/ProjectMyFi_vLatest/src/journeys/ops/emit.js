// emit.js — Emit op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.5

/**
 * Emit an action upward.
 * @param {object} step - { op: 'emit', action: string, params?: object }
 * @param {object} ctx - { actionBus, journeyId, ... }
 */
export async function execute(step, ctx) {
  const { action, params } = step;

  if (!action) {
    throw new Error('emit op requires action name');
  }

  if (!ctx.actionBus?.emit) {
    throw new Error('emit op requires actionBus in context');
  }

  console.log(`[Journey:${ctx.journeyId}] emit → ${action}`, params || '');

  // Source is 'journey' to prevent self-trigger loops (per Architect addendum)
  ctx.actionBus.emit(action, params || {}, 'journey');
}

export default { execute };
