/**
 * <SCREEN> Controller
 * Responsibility:
 * - Mount UI (inject view)
 * - Wire UI events (later)
 * - Call feature APIs / open modals by ID (later)
 *
 * NOTE: currently minimal placeholder to standardize screen structure.
 */
import { injectView } from '../../core/view.js';
import { loadScopedCSS } from '../../core/cssScope.js';

export function createController() {
  let cleanup = [];
  let unstyle = null;

  return {
    async mount(root) {
      unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);
      await injectView(root, new URL('./view.html', import.meta.url));
    },
    onShow() {},
    onHide() {},
    unmount() {
      cleanup.forEach(fn => { try { fn(); } catch {} });
      cleanup = [];
      if (unstyle) unstyle();
    }
  };
}
