// surfaceCompositor.js — Updated for I1-Hub-Phase1-Scaffold
// Adds: actionBus integration, error fallback with ErrorCard

import { createPartEmitter } from './actionBus.js';
import { ensureGlobalCSS } from './styleLoader.js';

export async function mountSurface(hostEl, surface, { resolvePart, ctx, vm = {} }) {
  const mounted = [];

  const root = document.createElement('div');
  root.className = 'surface-root';
  hostEl.appendChild(root);

  const slots = Array.isArray(surface.slots) ? surface.slots : [];

  for (const slotDef of slots) {
    const slotEl = document.createElement('div');
    slotEl.className = `slot ${slotDef.card ? 'slot-card' : ''}`;
    slotEl.dataset.slotId = slotDef.id || '';
    root.appendChild(slotEl);

    const partKind = slotDef?.part?.kind;
    if (!partKind) continue;

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
        ctx: { ...ctx, emitter },
        packet: slotDef.part.packet || null,
      });

      if (api?.unmount) mounted.push(api);
    } catch (error) {
      // Mount ErrorCard as fallback
      console.error(`[SurfaceCompositor] Failed to mount Part "${partKind}" in slot "${slotDef.id}":`, error);
      await mountErrorCard(slotEl, {
        slotId: slotDef.id,
        kind: partKind,
        error,
      });
    }
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
      hostEl.innerHTML = '';
    },
  };
}

// Mount ErrorCard fallback
async function mountErrorCard(slotEl, { slotId, kind, error }) {
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
    slotEl.innerHTML = `
      <div style="background:#4a1a1a;border:2px solid #e74c3c;padding:16px;color:#fff;border-radius:8px;margin:8px;">
        <strong>Part Error:</strong> ${kind || 'unknown'}<br>
        <small>${error?.message || error || 'Unknown error'}</small>
      </div>
    `;
  }
}
