// closeModal.js — CloseModal op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.3

/**
 * Close current or named modal.
 * @param {object} step - { op: 'closeModal', modalId?: string }
 * @param {object} ctx - { modalManager, journeyId, ... }
 */
export async function execute(step, ctx) {
  const { modalId } = step;

  if (!ctx.modalManager?.closeModal) {
    throw new Error('closeModal op requires modalManager in context');
  }

  console.log(`[Journey:${ctx.journeyId}] closeModal${modalId ? ` → ${modalId}` : ''}`);

  await ctx.modalManager.closeModal(modalId);
}

export default { execute };
