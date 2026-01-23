// log.js — Log op executor
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6.6

/**
 * Debug logging (dev/QA use).
 * @param {object} step - { op: 'log', message: string, level?: string }
 * @param {object} ctx - { journeyId, ... }
 */
export async function execute(step, ctx) {
  const { message, level = 'info' } = step;

  if (!message) {
    throw new Error('log op requires message');
  }

  const prefix = `[Journey:${ctx.journeyId}]`;

  switch (level) {
    case 'error':
      console.error(prefix, message);
      break;
    case 'warn':
      console.warn(prefix, message);
      break;
    case 'debug':
      console.debug(prefix, message);
      break;
    case 'info':
    default:
      console.log(prefix, message);
      break;
  }
}

export default { execute };
