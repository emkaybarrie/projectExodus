/**
 * Screen Contract (dev-validated)
 * A "screen" is an autonomous region that owns its UI + wiring.
 *
 * Required:
 * - id: string (must match the registered route id)
 * - mount(root, ctx): Promise<void> | void
 *
 * Optional:
 * - unmount(): void
 * - chrome: chrome profile object
 * - title/route metadata (legacy-friendly)
 *
 * Screens should NOT contain business logic or data fetching.
 * They call Feature Pack APIs for that.
 */
export function validateScreenShape(id, mod) {
  const screen = mod?.default ?? mod;
  const problems = [];

  if (!screen || typeof screen !== 'object') problems.push('export is not an object (default export expected)');
  if (!screen?.id) problems.push('missing "id"');
  if (screen?.id && screen.id !== id) problems.push(`id mismatch: registry="${id}" file="${screen.id}"`);
  if (typeof screen?.mount !== 'function') problems.push('missing "mount(root, ctx)" function');

  return { ok: problems.length === 0, problems, screen };
}
