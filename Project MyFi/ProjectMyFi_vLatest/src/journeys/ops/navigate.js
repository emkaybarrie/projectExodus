// navigate.js — Navigate op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.1

/**
 * Switch to a different Surface.
 * @param {object} step - { op: 'navigate', surfaceId: string, params?: object }
 * @param {object} ctx - { router, journeyId, ... }
 */
export async function execute(step, ctx) {
  const { surfaceId, params } = step;

  if (!surfaceId) {
    throw new Error('navigate op requires surfaceId');
  }

  if (!ctx.router?.navigate) {
    throw new Error('navigate op requires router in context');
  }

  console.log(`[Journey:${ctx.journeyId}] navigate → ${surfaceId}`, params || '');

  await ctx.router.navigate(surfaceId, params);
}

export default { execute };
