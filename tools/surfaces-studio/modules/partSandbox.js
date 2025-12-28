// tools/surfaces-studio/modules/partSandbox.js
import { $ } from './dom.js';
import { toast } from './toast.js';

export function initPartSandbox(state) {
  const sel = $('#sandboxPart');
  const box = $('#sandboxJson');
  const preview = $('#sandboxPreview');

  const btnPull  = $('#btnPullSlice');
  const btnRender = $('#btnRenderSandbox');
  const btnStub   = $('#btnExportPartStub');

  if (!sel || !box || !preview) return;

  // Add baseline/uplift toggle (no HTML change required)
  let toggleWrap = document.getElementById('sandboxVariantWrap');
  if (!toggleWrap) {
    toggleWrap = document.createElement('div');
    toggleWrap.id = 'sandboxVariantWrap';
    toggleWrap.className = 'row';
    toggleWrap.style.marginTop = '10px';
    toggleWrap.innerHTML = `
      <span class="pill">Render:</span>
      <label class="pill" style="cursor:pointer;">
        <input type="radio" name="sbv" value="baseline" checked> baseline
      </label>
      <label class="pill" style="cursor:pointer;">
        <input type="radio" name="sbv" value="uplift"> uplift
      </label>
    `;
    // place after select
    sel.parentElement?.appendChild(toggleWrap);
  }

  function getVariant() {
    const r = toggleWrap.querySelector('input[name="sbv"]:checked');
    return r?.value || 'baseline';
  }

  function refreshPartList() {
    const ids = Object.keys(state.partsLibrary || {}).sort((a,b)=>a.localeCompare(b));
    sel.innerHTML = '';
    for (const id of ids) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${id} (${state.partsLibrary[id]?.meta?.type || 'part'})`;
      sel.appendChild(opt);
    }
  }

  async function render() {
    const partId = sel.value;
    const part = state.partsLibrary?.[partId];
    if (!part) { toast('Part not found'); return; }

    const variant = getVariant();
    const bundle = (variant === 'uplift' && part.uplift) ? part.uplift : part.baseline;

    const slice = safeParse(box.value || '{}');
    await renderPartBundle(preview, bundle, slice, { partId, variant });

    toast(`Rendered ${partId} (${variant === 'uplift' && part.uplift ? 'uplift' : 'baseline'})`);
  }

  btnRender?.addEventListener('click', render);

  btnStub?.addEventListener('click', async () => {
    const partId = sel.value;
    const part = state.partsLibrary?.[partId];
    if (!part) { toast('Part not found'); return; }

    const stub = `// ${partId} — part module stub
export function mount(el, slice = {}, ctx = {}) {
  // el.innerHTML = ...
  return () => {};
}
`;
    await copyText(stub);
    toast('Copied part stub');
  });

  btnPull?.addEventListener('click', async () => {
    if (!state.liveConnected || !state.liveVM) {
      toast('Live VM not connected');
      return;
    }
    // pull full vm slice by path if possible — simplest for now:
    box.value = JSON.stringify(state.liveVM, null, 2);
    toast('Pulled live VM (full)');
  });

  // keep updated
  state.on('partsChanged', refreshPartList);
  refreshPartList();

  // default sample
  if (!box.value.trim()) {
    box.value = JSON.stringify({
      title: 'Sample',
      pill: '+3',
      body: 'This is a baseline sandbox slice.',
      items: [
        { title: 'Event', meta: 'now', body: 'Did a thing.' },
        { title: 'Another', meta: 'today', body: 'Did another thing.' }
      ]
    }, null, 2);
  }
}

async function renderPartBundle(container, bundle, slice, ctx) {
  container.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = bundle?.css || '';
  container.appendChild(style);

  const mountHost = document.createElement('div');
  mountHost.style.minHeight = '80px';
  container.appendChild(mountHost);

  const js = bundle?.js || '';
  if (!js.trim()) {
    mountHost.innerHTML = bundle?.html || '<div class="muted">No JS. Showing HTML only.</div>';
    return;
  }

  const blob = new Blob([js], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    const mod = await import(url);
    const mount = mod?.mount;
    if (typeof mount !== 'function') {
      mountHost.innerHTML = `<pre class="codeBox">Part JS must export: export function mount(el, slice, ctx)</pre>`;
      return;
    }

    // Mount the module
    mount(mountHost, slice, ctx);
  } catch (e) {
    mountHost.innerHTML = `<pre class="codeBox">${escapeHtml(String(e?.stack || e))}</pre>`;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

async function copyText(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
