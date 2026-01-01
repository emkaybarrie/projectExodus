let c = null;
let _setHeaderTitle = null;

function escapeHtml(s) {
  const str = String(s ?? '');
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}

function showMountError(root, label, err) {
  try {
    const msg = err?.stack || err?.message || String(err);
    root.innerHTML = `
      <div style="padding:14px;">
        <div style="font:14px system-ui; font-weight:900; margin-bottom:8px;">Quests failed to load</div>
        <div style="font:12px system-ui; opacity:.85; margin-bottom:8px;">${escapeHtml(label)}</div>
        <pre style="white-space:pre-wrap; font:12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height:1.35; background:rgba(0,0,0,.06); padding:10px; border-radius:12px;">${escapeHtml(msg)}</pre>
      </div>
    `;
  } catch {}
}

async function probe(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    return { ok: res.ok, status: res.status, statusText: res.statusText, ct };
  } catch (e) {
    return { ok: false, status: 0, statusText: 'fetch failed', ct: '', err: e?.message || String(e) };
  }
}

export default {
  id: 'quests',
  route: 'quests',
  title: 'QUESTS',
  chrome: {
    mode: 'full',
    footer: {
      left:  { icon:'🏁', title:'Active',    onClick(){ alert('Active Quests'); } },
      main:  { icon:'＋', title:'New Goal',  onClick(){ alert('Create Goal'); } },
      right: { icon:'📚', title:'Completed', onClick(){ alert('Completed'); } },
    }
  },
  background: { key: 'panorama' },

  async mount(root) {
    root.innerHTML = `<div style="padding:14px; font:12px system-ui; opacity:.8;">Loading quests…</div>`;

    try {
      // Dynamically import chrome helper (avoid static import at module eval time)
      const chromeUrl = new URL('../../core/chrome.js', import.meta.url).href + `?v=${Date.now()}`;
      const chromeMod = await import(chromeUrl);
      _setHeaderTitle = chromeMod.setHeaderTitle || null;

      // Dynamically import controller (avoid static import at module eval time)
      const controllerUrl = new URL('./controller.js', import.meta.url).href + `?v=${Date.now()}`;
      const controllerMod = await import(controllerUrl);

      const createController = controllerMod.createController || null;
      if (typeof createController !== 'function') {
        throw new Error('controller.js must export createController()');
      }

      c = createController();
      await c.mount(root);
    } catch (err) {
      // Probe to distinguish “module fetch / MIME / SW” vs “runtime error”
      const entryUrl = new URL('./index.js', import.meta.url).href;
      const ctrlUrl = new URL('./controller.js', import.meta.url).href;
      const chromeRawUrl = new URL('../../core/chrome.js', import.meta.url).href;

      const entryProbe = await probe(entryUrl);
      const ctrlProbe = await probe(ctrlUrl);
      const chromeProbe = await probe(chromeRawUrl);

      const meta =
        `Entry:  ok=${entryProbe.ok} status=${entryProbe.status} ct="${entryProbe.ct}"\n` +
        `Ctrl:   ok=${ctrlProbe.ok} status=${ctrlProbe.status} ct="${ctrlProbe.ct}"\n` +
        `Chrome: ok=${chromeProbe.ok} status=${chromeProbe.status} ct="${chromeProbe.ct}"\n` +
        (ctrlProbe.err ? `Ctrl fetch err: ${ctrlProbe.err}\n` : '') +
        (chromeProbe.err ? `Chrome fetch err: ${chromeProbe.err}\n` : '');

      showMountError(root, meta, err);
      throw err;
    }
  },

  onShow() {
    try { _setHeaderTitle && _setHeaderTitle('QUESTS'); } catch {}
    try { c?.onShow?.(); } catch {}
  },

  onHide() {
    try { c?.onHide?.(); } catch {}
  },

  unmount() {
    try { c?.unmount?.(); } catch {}
    c = null;
    _setHeaderTitle = null;
  }
};
