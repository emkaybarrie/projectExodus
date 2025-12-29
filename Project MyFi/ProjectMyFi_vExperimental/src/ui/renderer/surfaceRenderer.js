import { resolveSlicePath } from './slicePath.js';
import { routeEvent } from './bindings.js';
import { validateSurfaceSpec } from './validateSurface.js';
import { attachDebugOverlay } from './debugOverlay.js';

function makeGridEl(spec) {
  const grid = document.createElement('div');
  grid.className = 'ui-grid';

  const columns = spec?.grid?.columns ?? 12;
  const rowGap = spec?.grid?.rowGap ?? 12;
  const colGap = spec?.grid?.colGap ?? 12;
  const padding = spec?.grid?.padding ?? 16;

  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  grid.style.rowGap = `${rowGap}px`;
  grid.style.columnGap = `${colGap}px`;
  grid.style.padding = `${padding}px`;
  return grid;
}

function makeSlotEl(slot) {
  const el = document.createElement('div');
  el.className = 'ui-slot';
  el.dataset.uiSlot = slot.id;

  const area = slot.area || {};
  const col = area.col ?? 1;
  const colSpan = area.colSpan ?? 12;
  const row = area.row ?? 1;
  const rowSpan = area.rowSpan ?? 1;

  el.style.gridColumn = `${col} / span ${colSpan}`;
  el.style.gridRow = `${row} / span ${rowSpan}`;
  return el;
}

/**
 * renderSurface({ surfaceSpec, mountEl, vm, actions, partRegistry })
 *
 * Returns:
 *  { update({vm}), unmount() }
 */
export function renderSurface({ surfaceSpec, mountEl, vm, actions, partRegistry, opts = {} }) {
  if (!surfaceSpec) throw new Error('renderSurface: surfaceSpec required');
  if (!mountEl) throw new Error('renderSurface: mountEl required');

  const { ok, errors } = validateSurfaceSpec(surfaceSpec, { partRegistry });
  if (!ok) {
    console.error('[surfaceRenderer] invalid surface:', surfaceSpec?.id, errors);
    // Fail fast in dev; in prod you can soften this.
    throw new Error(`Invalid surfaceSpec "${surfaceSpec?.id}":\n- ${errors.join('\n- ')}`);
  }

  // Clear mount
  mountEl.replaceChildren();

  const grid = makeGridEl(surfaceSpec);
  mountEl.appendChild(grid);

  // Build slots
  const slotEls = new Map();
  for (const slot of surfaceSpec.slots) {
    const slotEl = makeSlotEl(slot);
    grid.appendChild(slotEl);
    slotEls.set(slot.id, slotEl);
  }

  // Mount parts
  const partInstances = new Map(); // slotId -> { instance, meta }
  const slotMetaList = [];

  function makeEmit(slotId, eventsMap) {
    return (eventName, detail) => {
      // Route immediately; no bubbling needed
      routeEvent({
        eventsMap,
        eventName,
        eventDetail: detail || {},
        actions
      }).catch(err => console.warn('[surfaceRenderer] action error', err));
    };
  }

  for (const m of surfaceSpec.mount) {
    const slotEl = slotEls.get(m.slotId);
    const partId = m.part.partId;
    const variant = m.part.variant || 'default';
    const eventsMap = m.events || {};
    const slicePath = m.bind?.slicePath;

    const Part = partRegistry[partId];
    const slice = resolveSlicePath(vm, slicePath);

    const wrapper = document.createElement('div');
    wrapper.dataset.uiPart = partId;
    wrapper.dataset.uiVariant = variant;
    wrapper.style.width = '100%';
    slotEl.appendChild(wrapper);

    let instance = null;
    try {
      instance = Part.mount({
        el: wrapper,
        variant,
        props: m.props || {},
        slice,
        tokens: null,
        emit: makeEmit(m.slotId, eventsMap)
      });
    } catch (e) {
      console.warn('[surfaceRenderer] part mount failed', partId, e);
      wrapper.className = 'ui-btn';
      wrapper.style.textAlign = 'left';
      wrapper.textContent = `Part mount failed: ${partId}`;
      instance = { update() {}, unmount() {} };
    }

    partInstances.set(m.slotId, { instance, meta: { slotId:m.slotId, partId, variant, slicePath, eventsMap, slotEl } });
    slotMetaList.push({ slotId:m.slotId, partId, variant, slicePath, eventsMap, slotEl });
  }

  // Optional debug overlay
  const debug = attachDebugOverlay({ mountEl, slotMetaList });

  return {
    update({ vm: nextVm }) {
      vm = nextVm;
      for (const m of surfaceSpec.mount) {
        const rec = partInstances.get(m.slotId);
        if (!rec?.instance?.update) continue;
        const slicePath = m.bind?.slicePath;
        const slice = resolveSlicePath(vm, slicePath);
        rec.instance.update({
          props: m.props || {},
          slice,
          tokens: null
        });
      }
    },
    unmount() {
      debug.detach?.();
      for (const rec of partInstances.values()) {
        try { rec.instance?.unmount?.(); } catch {}
      }
      partInstances.clear();
      mountEl.replaceChildren();
    }
  };
}
