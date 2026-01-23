// openModal.js — OpenModal op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.2

/**
 * Open a modal overlay.
 * @param {object} step - { op: 'openModal', modalId: string, data?: object }
 * @param {object} ctx - { modalManager, journeyId, ... }
 */
export async function execute(step, ctx) {
  const { modalId, data } = step;

  if (!modalId) {
    throw new Error('openModal op requires modalId');
  }

  if (!ctx.modalManager?.openModal) {
    throw new Error('openModal op requires modalManager in context');
  }

  console.log(`[Journey:${ctx.journeyId}] openModal → ${modalId}`, data || '');

  await ctx.modalManager.openModal(modalId, data);
}

export default { execute };
