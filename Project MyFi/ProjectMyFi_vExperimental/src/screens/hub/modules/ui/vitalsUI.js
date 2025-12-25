import { renderBars, renderPortrait } from './vitals.js';

export function createVitalsUI(root, deps = {}) {
  return {
    render(vm) {
      if (!vm) return;
      try { renderBars(vm); } catch {}
      try { renderPortrait(vm); } catch {}
    },
    destroy() {}
  };
}
