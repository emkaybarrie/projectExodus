/**
 * Quests Screen Controller (Surface Host)
 * - Renders DSL surface into the screen root
 * - Builds VM slices via quests feature
 * - Provides actions registry (routes UI events -> feature APIs)
 *
 * NOTE:
 * This controller uses dynamic imports inside mount() so that:
 * - The module always evaluates (even if a dependency path is wrong on mobile/GitHub Pages)
 * - Failures report the exact URL that couldn't be imported
 */
function escapeHtml(s) {
  const str = String(s ?? '');
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}

function showFatal(root, title, detail) {
  try {
    root.innerHTML = `
      <div style="padding:14px;">
        <div style="font:14px system-ui; font-weight:900; margin-bottom:8px;">${escapeHtml(title)}</div>
        <pre style="white-space:pre-wrap; font:12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height:1.35; background:rgba(0,0,0,.06); padding:10px; border-radius:12px;">${escapeHtml(detail)}</pre>
      </div>
    `;
  } catch {}
}

async function importOrThrow(rel, base, label) {
  const url = new URL(rel, base).href;
  try {
    return await import(url);
  } catch (e) {
    const msg = e?.stack || e?.message || String(e);
    throw new Error(`[quests.controller] failed to import ${label}\n${url}\n\n${msg}`);
  }
}

export function createController() {
  let unstyle = null;
  let surfaceHandle = null;
  let vmStore = null;
  let unsub = null;

  let rootEl = null;

  // Loaded lazily (so a bad path doesn't prevent controller eval)
  let loadScopedCSS = null;
  let getFeature = null;
  let loadSurfaceSpec = null;
  let renderSurface = null;
  let partRegistry = null;
  let createActions = null;
  let createVMStore = null;

  async function buildVM() {
    const quests = getFeature('quests').api;
    return quests.buildVM();
  }

  async function refresh() {
    if (!vmStore) return;
    await vmStore.refresh();
  }

  return {
    async mount(root) {
      rootEl = root;
      root.innerHTML = `<div style="padding:14px; font:12px system-ui; opacity:.75;">Loading quests…</div>`;

      try {
        // Resolve relative to *this* file reliably
        const base = import.meta.url;

        // 1) Import dependencies with explicit per-module error messages
        ({ loadScopedCSS } = await importOrThrow('../../core/cssScope.js', base, 'core/cssScope.js'));
        ({ getFeature } = await importOrThrow('../../features/registry.js', base, 'features/registry.js'));
        ({ loadSurfaceSpec } = await importOrThrow('../../ui/surfaces/registry.js', base, 'ui/surfaces/registry.js'));
        ({ renderSurface } = await importOrThrow('../../ui/renderer/surfaceRenderer.js', base, 'ui/renderer/surfaceRenderer.js'));
        ({ partRegistry } = await importOrThrow('../../ui/parts/registry.js', base, 'ui/parts/registry.js'));
        ({ createActions } = await importOrThrow('../../ui/actions/registry.js', base, 'ui/actions/registry.js'));
        ({ createVMStore } = await importOrThrow('../../core/vmStore.js', base, 'core/vmStore.js'));

        // 2) Optional: scoped css
        // Guard: root.id must exist for scoping; if missing, scope to a fallback id
        const scopeId = root.id || 'screen-quests';
        unstyle = await loadScopedCSS(new URL('./styles.css', import.meta.url), scopeId);

        // 3) Build surface container
        root.replaceChildren();
        const mountEl = document.createElement('div');
        mountEl.className = 'ui-surface-root';
        root.appendChild(mountEl);

        // 4) Load surface spec once
        const surfaceSpec = await loadSurfaceSpec('quests.v1');

        // 5) VM store + subscription
        vmStore = createVMStore({ buildVM });
        unsub = vmStore.subscribe((vm) => {
          surfaceHandle?.update?.({ vm });
        });

        const vm = await vmStore.refresh();

        // 6) Actions close over refresh()
        const actions = createActions({ vmStore, refresh });

        // 7) Render surface
        surfaceHandle = renderSurface({
          surfaceSpec,
          mountEl,
          vm,
          actions,
          partRegistry,
          opts: {}
        });

      } catch (e) {
        const msg = e?.stack || e?.message || String(e);
        showFatal(root, 'Quests failed to mount', msg);
        throw e; // lets router snap back + toast too (your new router patch)
      }
    },

    onShow() {
      refresh().catch(() => {});
    },

    onHide() {},

    unmount() {
      try { surfaceHandle?.unmount?.(); } catch {}

      try { unsub?.(); } catch {}
      unsub = null;
      vmStore = null;
      surfaceHandle = null;

      try { if (unstyle) unstyle(); } catch {}
      unstyle = null;

      if (rootEl) rootEl.replaceChildren();
      rootEl = null;
    }
  };
}
