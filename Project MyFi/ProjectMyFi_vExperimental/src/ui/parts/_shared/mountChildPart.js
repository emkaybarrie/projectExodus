/**
 * mountChildPart()
 * Minimal helper for prefabs to compose primitives using the same part contract.
 */
export function mountChildPart({ registry, partId, el, variant = 'default', props, slice, emit }) {
  const Part = registry?.[partId];
  if (!Part) {
    // Fail visibly (never silent blank)
    el.textContent = `[missing part: ${partId}]`;
    return {
      update() {},
      unmount() {}
    };
  }

  const inst = Part.mount({
    el,
    variant,
    props: props || {},
    slice,
    tokens: null,
    emit: emit || (() => {})
  });

  return {
    update({ props: nextProps, slice: nextSlice } = {}) {
      inst?.update?.({ props: nextProps ?? props, slice: nextSlice ?? slice, tokens: null });
    },
    unmount() {
      try { inst?.unmount?.(); } catch {}
    }
  };
}
