// tools/surfaces-studio/modules/partsComposer.js
import { $, $$ } from './dom.js';
import { toast } from './toast.js';

const CONTRACT_BEGIN = '<!-- CONTRACT:BEGIN -->';
const CONTRACT_END   = '<!-- CONTRACT:END -->';

export function initPartsComposer(state) {
  const listEl = $('#partsList');
  const detailEl = $('#partsDetail');
  if (!listEl || !detailEl) return;

  // -----------------------------
  // Helpers
  // -----------------------------

  function now() { return Date.now(); }

  function normalizeId(raw) {
    const s = (raw || '').trim().toLowerCase();
    return s
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  function slotIdToPartId(slotId) {
    // slot-events-log -> events-log
    const base = (slotId || '').replace(/^slot-/, '');
    const id = normalizeId(base || 'part');
    return id || `part-${Math.random().toString(16).slice(2, 8)}`;
  }

  function currentSlotsFlat() {
    // flatten all slots (including nested containers)
    const out = [];
    (function walk(list, path = []) {
      for (const s of (list || [])) {
        out.push({ slot: s, path });
        if (s.children?.length) walk(s.children, path.concat(s.id));
      }
    })(state.rootSlots, []);
    return out;
  }

  function getMap(slotId) {
    return state.partsMap?.[slotId] || { partId: '', slicePath: '', variant: '' };
  }

  function setMap(slotId, next) {
    state.partsMap = state.partsMap || {};
    state.partsMap[slotId] = {
      partId: (next.partId || '').trim(),
      slicePath: (next.slicePath || '').trim(),
      variant: (next.variant || '').trim()
    };
    state.emit('partsChanged');
  }

  function deleteMap(slotId) {
    if (state.partsMap?.[slotId]) {
      delete state.partsMap[slotId];
      state.emit('partsChanged');
    }
  }

  function getPart(partId) {
    return state.partsLibrary?.[partId] || null;
  }

  function upsertPart(partId, patch) {
    state.partsLibrary = state.partsLibrary || {};
    const existing = state.partsLibrary[partId];

    if (!existing) {
      state.partsLibrary[partId] = patch;
    } else {
      state.partsLibrary[partId] = {
        ...existing,
        ...patch,
        meta: { ...(existing.meta || {}), ...(patch.meta || {}) }
      };
    }
    state.emit('partsChanged');
  }

  function ensurePart(partId, type, baseline) {
    const existing = getPart(partId);
    if (existing) return existing;

    const created = {
      meta: {
        title: partId,
        type,
        createdAt: now(),
        updatedAt: now()
      },
      contract: {
        version: 1,
        requiredMarkers: ['CONTRACT:BEGIN', 'CONTRACT:END']
      },
      baseline,
      uplift: null
    };
    upsertPart(partId, created);
    return created;
  }

  function copyText(txt) {
    return navigator.clipboard.writeText(txt).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  }

  // -----------------------------
  // Templates (Forge)
  // -----------------------------

  function templateCard(partId) {
    const html = `<!-- ${partId} -->
${CONTRACT_BEGIN}
<div class="pCard" data-part="${partId}">
  <div class="pCardHead">
    <div class="pCardTitle" data-bind="title">Title</div>
    <div class="pCardPill" data-bind="pill">pill</div>
  </div>
  <div class="pCardBody" data-bind="body">Body text…</div>
</div>
${CONTRACT_END}
`;

    const css = `
/* ${partId} baseline */
.pCard{ border-radius:16px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); padding:12px; }
.pCardHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.pCardTitle{ font-weight:850; }
.pCardPill{ font-size:12px; opacity:.8; border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:4px 8px; }
.pCardBody{ margin-top:10px; opacity:.9; line-height:1.35; }
`.trim();

    const js = `
/**
 * ${partId} baseline part module
 * Exports mount(el, slice, ctx) -> optional unmount()
 */
export function mount(el, slice = {}, ctx = {}) {
  el.innerHTML = \`${escapeBackticks(html)}\`;
  const root = el.querySelector('[data-part="${partId}"]') || el;
  bindText(root, 'title', slice?.title ?? 'Title');
  bindText(root, 'pill', slice?.pill ?? '');
  bindText(root, 'body', slice?.body ?? '');
  return () => {};
}

function bindText(root, key, value) {
  const n = root.querySelector(\`[data-bind="\${key}"]\`);
  if (n) n.textContent = String(value ?? '');
}
`.trim();

    return { html, css, js };
  }

  function templateList(partId) {
    const html = `<!-- ${partId} -->
${CONTRACT_BEGIN}
<div class="pList" data-part="${partId}">
  <div class="pListHead">
    <div class="pListTitle" data-bind="title">List</div>
  </div>
  <div class="pListBody">
    <ul class="pListUl" data-bind="items"></ul>
  </div>
</div>
${CONTRACT_END}
`;

    const css = `
/* ${partId} baseline */
.pList{ border-radius:16px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.03); padding:12px; }
.pListTitle{ font-weight:850; }
.pListBody{ margin-top:10px; }
.pListUl{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.pListLi{ border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); border-radius:12px; padding:10px; }
.pListLiTop{ display:flex; justify-content:space-between; gap:10px; }
.pListLiTitle{ font-weight:750; }
.pListLiMeta{ opacity:.75; font-size:12px; }
.pListLiBody{ margin-top:6px; opacity:.9; font-size:13px; line-height:1.35; }
`.trim();

    const js = `
/**
 * ${partId} baseline part module
 * slice shape:
 * { title?: string, items?: Array<{title, meta, body}> }
 */
export function mount(el, slice = {}, ctx = {}) {
  el.innerHTML = \`${escapeBackticks(html)}\`;
  const root = el.querySelector('[data-part="${partId}"]') || el;

  const title = root.querySelector('[data-bind="title"]');
  if (title) title.textContent = String(slice?.title ?? 'List');

  const ul = root.querySelector('[data-bind="items"]');
  if (ul) {
    ul.innerHTML = '';
    const items = Array.isArray(slice?.items) ? slice.items : [];
    for (const it of items) {
      const li = document.createElement('li');
      li.className = 'pListLi';
      li.innerHTML = \`
        <div class="pListLiTop">
          <div class="pListLiTitle">\${escapeHtml(it?.title ?? 'Item')}</div>
          <div class="pListLiMeta">\${escapeHtml(it?.meta ?? '')}</div>
        </div>
        <div class="pListLiBody">\${escapeHtml(it?.body ?? '')}</div>
      \`;
      ul.appendChild(li);
    }
  }
  return () => {};
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
`.trim();

    return { html, css, js };
  }

  function templateCarousel(partId) {
    const html = `<!-- ${partId} -->
${CONTRACT_BEGIN}
<div class="pCar" data-part="${partId}">
  <div class="pCarHead">
    <div class="pCarTitle" data-bind="title">Carousel</div>
    <div class="pCarMeta" data-bind="meta"></div>
  </div>
  <div class="pCarRow" data-bind="items"></div>
</div>
${CONTRACT_END}
`;

    const css = `
/* ${partId} baseline */
.pCar{ border-radius:16px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.03); padding:12px; }
.pCarHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.pCarTitle{ font-weight:850; }
.pCarMeta{ font-size:12px; opacity:.75; }
.pCarRow{ margin-top:10px; display:flex; gap:10px; overflow:auto; padding-bottom:6px; }
.pCarItem{ min-width:220px; border-radius:14px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.03); padding:10px; }
.pCarItemTitle{ font-weight:800; }
.pCarItemBody{ margin-top:6px; opacity:.9; font-size:13px; line-height:1.35; }
`.trim();

    const js = `
/**
 * ${partId} baseline part module
 * slice shape:
 * { title?: string, meta?: string, items?: Array<{title, body}> }
 */
export function mount(el, slice = {}, ctx = {}) {
  el.innerHTML = \`${escapeBackticks(html)}\`;
  const root = el.querySelector('[data-part="${partId}"]') || el;

  const t = root.querySelector('[data-bind="title"]');
  if (t) t.textContent = String(slice?.title ?? 'Carousel');

  const meta = root.querySelector('[data-bind="meta"]');
  if (meta) meta.textContent = String(slice?.meta ?? '');

  const row = root.querySelector('[data-bind="items"]');
  if (row) {
    row.innerHTML = '';
    const items = Array.isArray(slice?.items) ? slice.items : [];
    for (const it of items) {
      const card = document.createElement('div');
      card.className = 'pCarItem';
      card.innerHTML = \`
        <div class="pCarItemTitle">\${escapeHtml(it?.title ?? 'Item')}</div>
        <div class="pCarItemBody">\${escapeHtml(it?.body ?? '')}</div>
      \`;
      row.appendChild(card);
    }
  }

  return () => {};
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
`.trim();

    return { html, css, js };
  }

  function escapeBackticks(s) {
    return String(s).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  }

  // -----------------------------
  // UI rendering
  // -----------------------------

  let selectedSlotId = null;

  function renderList() {
    const rows = currentSlotsFlat();
    listEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'list';

    for (const { slot, path } of rows) {
      const map = getMap(slot.id);
      const hasMap = !!map.partId;

      const btn = document.createElement('button');
      btn.className = 'slotRow' + (selectedSlotId === slot.id ? ' isOn' : '');
      btn.type = 'button';
      btn.innerHTML = `
        <div class="slotRowTop">
          <div class="slotRowId">${slot.id}</div>
          <div class="slotRowBadge ${hasMap ? 'hasMap':''}">${hasMap ? 'mapped' : 'unmapped'}</div>
        </div>
        <div class="crumbs">${path.length ? '/' + path.join('/') : '/'}</div>
        <div class="slotRowMeta">
          <span class="pill">variant: ${(slot.variant || 'default')}</span>
          <span class="pill">surface: ${(slot.surface || 'card')}</span>
          <span class="pill">z: ${(slot.z || 0)}</span>
        </div>
        <div class="hintSmall">part: <code>${map.partId || '—'}</code> · slice: <code>${map.slicePath || '—'}</code></div>
      `;

      btn.addEventListener('click', () => {
        selectedSlotId = slot.id;
        renderList();
        renderDetail(slot.id);
      });

      wrap.appendChild(btn);
    }

    listEl.appendChild(wrap);
  }

  function renderDetail(slotId) {
    const map = getMap(slotId);
    const library = state.partsLibrary || {};
    const partIds = Object.keys(library).sort((a,b)=>a.localeCompare(b));

    detailEl.innerHTML = `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">Mapping</div>
            <div class="itemSub">Slot <code>${slotId}</code> → Part + slicePath</div>
          </div>
          <div class="row">
            <button class="btn btnTiny" id="btnUnmap">Unmap</button>
          </div>
        </div>

        <div class="panelDivider"></div>

        <div class="field">
          <label class="fieldLbl">Part</label>
          <select class="fieldSel" id="mapPartSel"></select>
          <div class="hintSmall">Choose an existing part, or forge a new one.</div>
        </div>

        <div class="grid2">
          <div class="field">
            <label class="fieldLbl">Slice path</label>
            <input class="fieldInp" id="mapSlice" type="text" placeholder="eventsFeed.items" spellcheck="false" />
          </div>
          <div class="field">
            <label class="fieldLbl">Variant</label>
            <input class="fieldInp" id="mapVariant" type="text" placeholder="dense / flat / scroll" spellcheck="false" />
          </div>
        </div>

        <div class="row">
          <button class="btn btnPrimary" id="btnSaveMap">Save map</button>
          <button class="btn" id="btnCopyUpliftManifest">Copy uplift manifest</button>
        </div>
      </div>

      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">Part Forge</div>
            <div class="itemSub">Create baseline parts inside Studio and auto-map them.</div>
          </div>
        </div>

        <div class="grid2">
          <div class="field">
            <label class="fieldLbl">New Part ID</label>
            <input class="fieldInp" id="forgePartId" type="text" spellcheck="false" placeholder="${slotIdToPartId(slotId)}" />
          </div>
          <div class="field">
            <label class="fieldLbl">Template</label>
            <select class="fieldSel" id="forgeTpl">
              <option value="card">Card</option>
              <option value="list">List</option>
              <option value="carousel">Carousel</option>
            </select>
          </div>
        </div>

        <div class="row">
          <button class="btn btnPrimary" id="btnForge">Forge + map</button>
          <button class="btn" id="btnForgeOnly">Forge only</button>
        </div>

        <div class="hintSmall">Forge creates a baseline part with CONTRACT markers and a runnable JS module.</div>
      </div>

      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">Edit uplift (optional)</div>
            <div class="itemSub">Paste uplifted HTML/CSS/JS back into the library.</div>
          </div>
        </div>

        <div class="field">
          <label class="fieldLbl">Uplift HTML</label>
          <textarea class="codeArea" id="upliftHtml" spellcheck="false" placeholder="<!-- CONTRACT:BEGIN --> ..."></textarea>
        </div>
        <div class="field">
          <label class="fieldLbl">Uplift CSS</label>
          <textarea class="codeArea" id="upliftCss" spellcheck="false" placeholder="/* uplift css */"></textarea>
        </div>
        <div class="field">
          <label class="fieldLbl">Uplift JS</label>
          <textarea class="codeArea" id="upliftJs" spellcheck="false" placeholder="export function mount(el, slice, ctx) { ... }"></textarea>
        </div>

        <div class="row">
          <button class="btn btnPrimary" id="btnSaveUplift">Save uplift</button>
          <button class="btn" id="btnClearUplift">Clear uplift</button>
        </div>
      </div>
    `;

    // populate mapping select
    const sel = $('#mapPartSel');
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '— none —';
    sel.appendChild(optNone);

    for (const id of partIds) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = `${id} (${library[id]?.meta?.type || 'part'})`;
      sel.appendChild(o);
    }
    sel.value = map.partId || '';

    $('#mapSlice').value = map.slicePath || '';
    $('#mapVariant').value = map.variant || '';

    $('#btnUnmap')?.addEventListener('click', () => {
      deleteMap(slotId);
      toast('Unmapped');
      renderList();
      renderDetail(slotId);
    });

    $('#btnSaveMap')?.addEventListener('click', () => {
      setMap(slotId, {
        partId: $('#mapPartSel').value,
        slicePath: $('#mapSlice').value,
        variant: $('#mapVariant').value
      });
      toast('Mapping saved');
      renderList();
    });

    // uplift manifest for currently mapped part
    $('#btnCopyUpliftManifest')?.addEventListener('click', async () => {
      const partId = ($('#mapPartSel').value || '').trim();
      if (!partId) { toast('Select a part first'); return; }
      const part = getPart(partId);
      if (!part) { toast('Part not found'); return; }

      const contract = buildContractJson(partId, part);
      const prompt = buildAiPrompt(partId);

      const manifest = {
        version: 1,
        partId,
        files: {
          'part.html': part.baseline?.html || '',
          'part.css': part.baseline?.css || '',
          'part.js': part.baseline?.js || '',
          'contract.json': JSON.stringify(contract, null, 2),
          'ai-prompt.md': prompt
        }
      };

      await copyText(JSON.stringify(manifest, null, 2));
      toast('Copied uplift manifest');
    });

    // Forge
    $('#btnForge')?.addEventListener('click', () => {
      const partId = normalizeId($('#forgePartId').value) || slotIdToPartId(slotId);
      const tpl = $('#forgeTpl').value || 'card';
      const baseline = forgeBaseline(partId, tpl);

      ensurePart(partId, tpl, baseline);

      // auto-map
      setMap(slotId, {
        partId,
        slicePath: $('#mapSlice').value || '',
        variant: $('#mapVariant').value || ''
      });

      toast(`Forged ${partId} + mapped`);
      renderList();
      renderDetail(slotId);
    });

    $('#btnForgeOnly')?.addEventListener('click', () => {
      const partId = normalizeId($('#forgePartId').value) || slotIdToPartId(slotId);
      const tpl = $('#forgeTpl').value || 'card';
      const baseline = forgeBaseline(partId, tpl);
      ensurePart(partId, tpl, baseline);
      toast(`Forged ${partId}`);
      renderList();
      renderDetail(slotId);
    });

    // Uplift editors prefill from mapped part if available
    const currentPartId = ($('#mapPartSel').value || '').trim();
    const part = currentPartId ? getPart(currentPartId) : null;

    const uh = $('#upliftHtml');
    const uc = $('#upliftCss');
    const uj = $('#upliftJs');

    if (part?.uplift) {
      uh.value = part.uplift.html || '';
      uc.value = part.uplift.css || '';
      uj.value = part.uplift.js || '';
    } else {
      uh.value = '';
      uc.value = '';
      uj.value = '';
    }

    $('#btnSaveUplift')?.addEventListener('click', () => {
      const partId = ($('#mapPartSel').value || '').trim();
      if (!partId) { toast('Select a part first'); return; }
      const base = getPart(partId);
      if (!base) { toast('Part not found'); return; }

      upsertPart(partId, {
        meta: { updatedAt: now() },
        uplift: {
          html: uh.value || '',
          css: uc.value || '',
          js: uj.value || ''
        }
      });

      toast('Uplift saved');
      state.emit('partsChanged');
    });

    $('#btnClearUplift')?.addEventListener('click', () => {
      const partId = ($('#mapPartSel').value || '').trim();
      if (!partId) { toast('Select a part first'); return; }

      upsertPart(partId, {
        meta: { updatedAt: now() },
        uplift: null
      });

      uh.value = ''; uc.value = ''; uj.value = '';
      toast('Uplift cleared');
      state.emit('partsChanged');
    });
  }

  function forgeBaseline(partId, tpl) {
    if (tpl === 'list') return templateList(partId);
    if (tpl === 'carousel') return templateCarousel(partId);
    return templateCard(partId);
  }

  function buildContractJson(partId, part) {
    return {
      partId,
      version: 1,
      requiredMarkers: ['CONTRACT:BEGIN', 'CONTRACT:END'],
      moduleExports: ['mount'],
      notes: [
        'Do not remove CONTRACT markers.',
        'Keep exported function signature: mount(el, slice, ctx).'
      ],
      baselineHasUplift: !!part?.uplift
    };
  }

  function buildAiPrompt(partId) {
    return [
      `# MyFi Surfaces Studio — AI Uplift`,
      ``,
      `You are uplifting a UI part for Project MyFi.`,
      `Goal: keep functionality and contract stable, improve styling/UX.`,
      ``,
      `## Hard rules`,
      `- DO NOT remove or alter these markers:`,
      `  - ${CONTRACT_BEGIN}`,
      `  - ${CONTRACT_END}`,
      `- Keep exported API: \`export function mount(el, slice, ctx)\``,
      `- Preserve any \`data-bind="..."\` hooks and \`data-part="${partId}"\` root.`,
      `- You may add classes, wrapper divs, and richer markup INSIDE the contract region, but keep hooks.`,
      ``,
      `## Inputs you will receive`,
      `- part.html, part.css, part.js (baseline)`,
      `- contract.json`,
      ``,
      `## Output`,
      `Return improved: part.html, part.css, part.js`,
      `Keep the contract intact. Make it look more “MyFi fantasy glass” but still performant.`,
      ``
    ].join('\n');
  }

  // -----------------------------
  // Wiring
  // -----------------------------

  function rerender() {
    renderList();
    if (selectedSlotId) renderDetail(selectedSlotId);
  }

  state.on('slotsChanged', () => rerender());
  state.on('partsChanged', () => rerender());
  state.on('surfaceChanged', () => rerender());

  // initial
  renderList();
  detailEl.innerHTML = `<div class="muted tiny">Select a slot to map / forge parts.</div>`;
}
