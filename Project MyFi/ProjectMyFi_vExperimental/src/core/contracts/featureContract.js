/**
 * Feature Pack Contract (dev-validated)
 * A "feature pack" is shared capability used by multiple screens/journeys.
 *
 * Required:
 * - id: string
 * - api: object with named functions (stable public surface)
 *
 * Optional:
 * - init(ctx): for one-time setup (adapters, listeners)
 */
export function validateFeatureShape(expectedId, feature) {
  const problems = [];

  if (!feature || typeof feature !== 'object') problems.push('feature is not an object');
  if (!feature?.id) problems.push('missing "id"');
  if (feature?.id && feature.id !== expectedId) problems.push(`id mismatch: registry="${expectedId}" file="${feature.id}"`);
  if (!feature?.api || typeof feature.api !== 'object') problems.push('missing "api" object');

  return { ok: problems.length === 0, problems, feature };
}
