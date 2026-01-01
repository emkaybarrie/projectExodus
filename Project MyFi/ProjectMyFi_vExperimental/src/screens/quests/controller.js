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
import { resolvePart } from '../../ui/registry.js';
import { ensureGlobalCSS } from '../../core/styleLoader.js';

import { createQuestsStore } from './model.js';

export function createController() {
  let cleanup = [];
  let unstyle = null;
  let surfaceMount = null;

  return {
    async mount(root, ctx = {}) {
      // IMPORTANT:
      // The router/plane owns horizontal swipe gestures via `touch-action:none` on `.screen-root`.
      // We therefore DO NOT mark the screen root as `.scrollable` (that would re-enable browser
      // horizontal panning and interfere with router navigation). Instead, we create an inner
      // scroll region that opts into vertical scrolling only.
      root.classList.add('questsScreen');

      // Optional screen-level uplift (blank file = baseline; safe to edit/delete content).
      ensureGlobalCSS('screen.quests', new URL('./uplift.css', import.meta.url));

      // Create the single authoritative scroll container for this screen.
      const scroll = document.createElement('div');
      scroll.className = 'questsScroll scrollable';
      root.appendChild(scroll);
      unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

      // Screen store (Model A): controller owns state + actions.
      // Parts render from this store via ctx.quests.
      const questsStore = createQuestsStore();

      // JSON-first surface
      const surface = await loadJSON(new URL('./surface.json', import.meta.url));
      surfaceMount = await mountSurface(scroll, surface, {
        resolvePart,
        ctx: { ...ctx, quests: questsStore }
      });

      // (Optional) example of listening to part events without touching DOM structure
      const onClaimed = (e) => {
        // placeholder: could fan out to Events feature, toast, etc
        // console.log('claimed', e.detail);
      };
      scroll.addEventListener('quests:claimed', onClaimed);
      cleanup.push(() => scroll.removeEventListener('quests:claimed', onClaimed));

      cleanup.push(() => {
        try { root.removeChild(scroll); } catch {}
      });
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
