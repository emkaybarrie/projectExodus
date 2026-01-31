// navigate.js — Navigate op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.1

/**
 * Switch to a different Surface.
 * @param {object} step - { op: 'navigate', surfaceId?: string, fromTrigger?: string, params?: object }
 * @param {object} ctx - { router, journeyId, triggerParams, ... }
 *
 * surfaceId can be:
 * - A literal string (e.g., "hub")
 * - Omitted if fromTrigger is specified (reads surfaceId from triggerParams[fromTrigger])
 */
export async function execute(step, ctx) {
  let { surfaceId, fromTrigger, params } = step;

  // Support dynamic surfaceId from trigger params
  if (!surfaceId && fromTrigger && ctx.triggerParams) {
    surfaceId = ctx.triggerParams[fromTrigger];
  }

  if (!surfaceId) {
    throw new Error('navigate op requires surfaceId (or fromTrigger with valid trigger params)');
  }

  if (!ctx.router?.navigate) {
    throw new Error('navigate op requires router in context');
  }

  console.log(`[Journey:${ctx.journeyId}] navigate → ${surfaceId}`, params || '');

  await ctx.router.navigate(surfaceId, params);
}

export default { execute };
