/**
 * Quests Screen Controller (Surface Host)
 * - Renders DSL surface into the screen root
 * - Builds VM slices via quests feature
 * - Provides actions registry (routes UI events -> feature APIs)
 *
 * Chrome remains owned by the Shell / router (screens/quests/index.js).
 */
import { loadScopedCSS } from '../../core/cssScope.js';

import { getFeature } from '../../features/registry.js';

import { loadSurfaceSpec } from '../../ui/surfaces/registry.js';
import { renderSurface } from '../../ui/renderer/surfaceRenderer.js';
import { partRegistry } from '../../ui/parts/registry.js';
import { createActions } from '../../ui/actions/registry.js';

export function createController() {
  let unstyle = null;
  let surfaceHandle = null;
  let rootEl = null;
  let surfaceSpec = null;

  async function buildVM() {
    const quests = getFeature('quests').api;
    return quests.buildVM();
  }

  async function refresh() {
    if (!surfaceHandle) return;
    const vm = await buildVM();
    surfaceHandle.update({ vm });
  }

  return {
    async mount(root) {
      rootEl = root;

      // Optional: keep your existing quests/styles.css scoped if you want baseline spacing.
      // It's currently minimal; safe to keep.
      unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), root.id);

      // Build surface container
      root.replaceChildren();
      const mountEl = document.createElement('div');
      mountEl.className = 'ui-surface-root';
      root.appendChild(mountEl);

      // Load surface spec once
      surfaceSpec = await loadSurfaceSpec('quests.v1');

      // Initial VM
      const vm = await buildVM();

      // Actions close over refresh()
      const actions = createActions({ refresh });

      // Render surface
      surfaceHandle = renderSurface({
        surfaceSpec,
        mountEl,
        vm,
        actions,
        partRegistry,
        opts: {}
      });
    },

    onShow() {
      // You can refresh on show to ensure VM is current
      refresh().catch(() => {});
    },

    onHide() {},

    unmount() {
      try { surfaceHandle?.unmount?.(); } catch {}
      surfaceHandle = null;

      if (unstyle) unstyle();
      unstyle = null;

      if (rootEl) rootEl.replaceChildren();
      rootEl = null;
      surfaceSpec = null;
    }
  };
}
