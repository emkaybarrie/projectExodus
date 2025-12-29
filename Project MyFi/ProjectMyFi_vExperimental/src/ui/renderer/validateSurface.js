export function validateSurfaceSpec(spec, { partRegistry } = {}) {
  const errors = [];

  if (!spec?.id) errors.push('surface missing id');
  if (!Array.isArray(spec?.slots)) errors.push('surface.slots must be an array');
  if (!Array.isArray(spec?.mount)) errors.push('surface.mount must be an array');

  const slotIds = new Set();
  for (const s of (spec.slots || [])) {
    if (!s?.id) errors.push('slot missing id');
    if (slotIds.has(s.id)) errors.push(`duplicate slot id: ${s.id}`);
    slotIds.add(s.id);
  }

  for (const m of (spec.mount || [])) {
    if (!m?.slotId) errors.push('mount entry missing slotId');
    if (m?.slotId && !slotIds.has(m.slotId)) errors.push(`mount references missing slot: ${m.slotId}`);
    const partId = m?.part?.partId;
    if (!partId) errors.push(`mount in slot ${m.slotId} missing part.partId`);
    if (partId && partRegistry && !partRegistry[partId]) errors.push(`unknown partId: ${partId}`);
    if (m?.bind?.slicePath && typeof m.bind.slicePath !== 'string') errors.push(`slicePath must be string in slot ${m.slotId}`);
  }

  return { ok: errors.length === 0, errors };
}
