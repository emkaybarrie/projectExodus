export function validatePartRegistry(partRegistry) {
  const errors = [];
  for (const [key, Part] of Object.entries(partRegistry || {})) {
    const id = Part?.id;
    if (!id) errors.push(`Part "${key}" missing export id`);
    if (id && id !== key) errors.push(`Part registry key "${key}" does not match Part.id "${id}"`);
    if (typeof Part?.mount !== 'function') errors.push(`Part "${key}" missing mount()`);
  }
  return { ok: errors.length === 0, errors };
}
