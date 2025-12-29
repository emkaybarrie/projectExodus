/**
 * resolveSlicePath(vm, "a.b.c")
 * - dot-path only
 * - returns undefined if missing
 */
export function resolveSlicePath(vm, path) {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur = vm;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
