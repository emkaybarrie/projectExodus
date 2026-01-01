/**
 * Quests Controller (JSON-first pilot)
 *
 * This screen is our proving ground for:
 * - Surfaces (JSON) describing layout + parts
 * - Parts owning all wiring/behaviour
 * - Keeping router/screen contracts unchanged
 */

import { loadScopedCSS } from '../../core/cssScope.js';
import { loadJSON, mountSurface } from '../../core/surface.js';
import { resolvePart } from '../../ui/parts/registry.js';

export function createController() {
  let cleanup = [];
  let unstyle = null;
  let surfaceMount = null;

  return {
    async mount(root, ctx = {}) {
      unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

      // JSON-first surface
      const surface = await loadJSON(new URL('./surface.json', import.meta.url));
      surfaceMount = await mountSurface(root, surface, {
        resolvePart,
        ctx
      });

      // (Optional) example of listening to part events without touching DOM structure
      const onClaimed = (e) => {
        // placeholder: could fan out to Events feature, toast, etc
        // console.log('claimed', e.detail);
      };
      root.addEventListener('quests:claimed', onClaimed);
      cleanup.push(() => root.removeEventListener('quests:claimed', onClaimed));
    },
    onShow() {},
    onHide() {},
    unmount() {
      cleanup.forEach(fn => { try { fn(); } catch {} });
      cleanup = [];
      try { surfaceMount?.unmount?.(); } catch {}
      surfaceMount = null;
      if (unstyle) unstyle();
    }
  };
}
