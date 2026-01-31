// surfaceCompositor.js — Updated for HUB-07 Overlay Slot Support
// Adds: actionBus integration, error fallback with ErrorCard, overlay slot layering

import { createPartEmitter, checkForLeaks } from './actionBus.js';
import { ensureGlobalCSS } from './styleLoader.js';
import * as actionBus from './actionBus.js';

export async function mountSurface(hostEl, surface, { resolvePart, ctx, vm = {} }) {
  const mounted = [];

  const root = document.createElement('div');
  root.className = 'surface-root';
  hostEl.appendChild(root);

  // HUB-07: Create separate container for overlay slots (renders above base slots)
  const overlayRoot = document.createElement('div');
  overlayRoot.className = 'surface-overlay-root';
  hostEl.appendChild(overlayRoot);

  const slots = Array.isArray(surface.slots) ? surface.slots : [];

  // HUB-07: Separate base slots from overlay slots
  const baseSlots = slots.filter(s => !s.overlay);
  const overlaySlots = slots.filter(s => s.overlay);

  // Mount base slots first
  for (const slotDef of baseSlots) {
    const api = await mountSlot(root, slotDef, { resolvePart, ctx, vm });
    if (api) mounted.push(api);
  }

  // Mount overlay slots after (on top layer)
  for (const slotDef of overlaySlots) {
    const api = await mountSlot(overlayRoot, slotDef, { resolvePart, ctx, vm, isOverlay: true });
    if (api) mounted.push(api);
  }

  // HUB-07: Validate overlay configuration
  if (overlaySlots.length > 0) {
    console.log(`[SurfaceCompositor] Mounted ${overlaySlots.length} overlay slot(s):`,
      overlaySlots.map(s => s.id).join(', '));
  }

  return {
    unmount() {
      for (let i = mounted.length - 1; i >= 0; i--) {
        try {
          mounted[i].unmount();
        } catch (e) {
          console.warn('part unmount failed', e);
        }
      }
      mounted.length = 0;

      // WO-HUB-02: Only remove elements we created, not entire hostEl
      // This prevents clearing new content during animated screen transitions
      // where the new surface is already mounted in hostEl via a wrapper
      if (root.parentNode) root.remove();
      if (overlayRoot.parentNode) overlayRoot.remove();

      // HUB-08-R: Check for subscription leaks after all parts unmounted
      // Delayed slightly to allow async cleanup
      setTimeout(() => {
        checkForLeaks(surface.id || 'unknown');
      }, 150);
    },
  };
}

/**
 * Mount a single slot (HUB-07: extracted for reuse with overlay support)
 */
async function mountSlot(parentEl, slotDef, { resolvePart, ctx, vm, isOverlay = false }) {
  const slotEl = document.createElement('div');

  // HUB-07: Apply overlay-specific classes for layering and input capture
  if (isOverlay) {
    slotEl.className = `slot slot-overlay ${slotDef.card ? 'slot-card' : ''}`;
    // Input capture: overlay backdrop prevents click-through when active
    slotEl.dataset.overlaySlot = 'true';
  } else {
    slotEl.className = `slot ${slotDef.card ? 'slot-card' : ''}`;
  }

  slotEl.dataset.slotId = slotDef.id || '';
  parentEl.appendChild(slotEl);

  const partKind = slotDef?.part?.kind;
  if (!partKind) {
    // HUB-07: Warn on empty overlay slots (likely misconfiguration)
    if (isOverlay) {
      console.warn(`[SurfaceCompositor] Overlay slot "${slotDef.id}" has no part.kind specified`);
    }
    return null;
  }

  // Create scoped emitter for this Part
  const emitter = createPartEmitter(partKind);

  // Get VM data for this slot (keyed by slot id)
  const slotData = vm[slotDef.id] || {};

  try {
    const factory = await resolvePart(partKind);
    const api = await factory(slotEl, {
      id: slotDef.id || partKind,
      kind: partKind,
      props: slotDef.part.props || {},
      data: slotData,
      ctx: { ...ctx, emitter, actionBus, isOverlay },
      packet: slotDef.part.packet || null,
    });

    return api?.unmount ? api : null;
  } catch (error) {
    // Mount ErrorCard as fallback
    console.error(`[SurfaceCompositor] Failed to mount Part "${partKind}" in slot "${slotDef.id}":`, error);

    // HUB-07: Make overlay errors visible (not silent failure)
    if (isOverlay) {
      console.error(`[SurfaceCompositor] OVERLAY SLOT ERROR: "${slotDef.id}" failed to mount. This may cause input capture issues.`);
    }

    await mountErrorCard(slotEl, {
      slotId: slotDef.id,
      kind: partKind,
      error,
      isOverlay,
    });
    return null;
  }
}

// Mount ErrorCard fallback (HUB-07: enhanced for overlay error visibility)
async function mountErrorCard(slotEl, { slotId, kind, error, isOverlay = false }) {
  try {
    // Load ErrorCard CSS
    const cssUrl = new URL('../parts/primitives/ErrorCard/uplift.css', import.meta.url).href;
    await ensureGlobalCSS('part.ErrorCard', cssUrl);

    // Dynamically import ErrorCard
    const modUrl = new URL('../parts/primitives/ErrorCard/part.js', import.meta.url).href;
    const mod = await import(modUrl);
    const factory = mod.default;

    await factory(slotEl, { id: slotId, kind, error, slotId });
  } catch (e) {
    // Last resort: inline error display
    console.error('[SurfaceCompositor] ErrorCard failed to load:', e);
    // HUB-07: Overlay errors get prominent styling
    const overlayStyle = isOverlay
      ? 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;'
      : '';
    slotEl.innerHTML = `
      <div style="${overlayStyle}background:#4a1a1a;border:2px solid #e74c3c;padding:16px;color:#fff;border-radius:8px;margin:8px;">
        <strong>${isOverlay ? 'OVERLAY ' : ''}Part Error:</strong> ${kind || 'unknown'}<br>
        <small>${error?.message || error || 'Unknown error'}</small>
      </div>
    `;
  }
}
