/**
 * Journey Contract (dev-validated)
 * A journey is a thin orchestration script: navigation + modal opens + feature calls.
 *
 * Required:
 * - id: string
 * - feature: string (which feature "owns" it)
 * - title: string (for menus/dev tools)
 * - steps: array of step objects
 */
export function validateJourneyShape(expectedId, journey) {
  const problems = [];
  if (!journey || typeof journey !== 'object') problems.push('journey is not an object');
  if (!journey?.id) problems.push('missing "id"');
  if (journey?.id && journey.id !== expectedId) problems.push(`id mismatch: registry="${expectedId}" file="${journey.id}"`);
  if (!journey?.feature) problems.push('missing "feature"');
  if (!journey?.title) problems.push('missing "title"');
  if (!Array.isArray(journey?.steps)) problems.push('missing "steps" array');
  return { ok: problems.length === 0, problems, journey };
}
