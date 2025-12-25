// tools/surfaces-studio/modules/exporter.js
import { $, $$ } from './dom.js';
import { toast } from './toast.js';

export function initExporter(state) {
  const pop = $('#exportPopover');
  const menuBtn = $('#btnExportMenu');
  const exportBtn = $('#btnExport');

  // Copy buttons are emitted by slotDesigner
  state.on('copyJson', async () => { await copyText(buildJSON(state)); toast('Copied JSON'); });
  state.on('copyHtml', async () => { await copyText(buildHTML(state)); toast('Copied HTML'); });
  state.on('copyCss', async () => { await copyText(buildCSS(state)); toast('Copied CSS'); });

  $('#btnCopyJson')?.addEventListener('click', async () => { await copyText(buildJSON(state)); toast('Copied JSON'); });
  $('#btnCopyHtml')?.addEventListener('click', async () => { await copyText(buildHTML(state)); toast('Copied HTML'); });
  $('#btnCopyCss')?.addEventListener('click', async () => { await copyText(buildCSS(state)); toast('Copied CSS'); });

  exportBtn?.addEventListener('click', async () => {
    // Export all to clipboard blocks (friendly)
    const payload = [
      `<!-- view.html -->\n${buildHTML(state)}`,
      `/* styles.css */\n${buildCSS(state)}`,
      `/* layout.json */\n${buildJSON(state)}`,
      `/* ui.parts.js */\n${buildPartsJS(state)}`
    ].join('\n\n');
    await copyText(payload);
    toast('Exported ALL (copied)');
  });

    // Export popover menu
    menuBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    });

    // Clicking inside the popover should NOT close it
    pop?.addEventListener('click', (e) => {
    e.stopPropagation();
    });

    // Clicking anywhere else closes it
    window.addEventListener('click', () => {
    pop.hidden = true;
    });

    // ESC closes it
    window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') pop.hidden = true;
    });


  pop?.querySelectorAll('.popItem')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.export;
      pop.hidden = true;

      if (kind === 'html') { await copyText(buildHTML(state)); toast('Copied HTML'); }
      if (kind === 'css') { await copyText(buildCSS(state)); toast('Copied CSS'); }
      if (kind === 'json') { await copyText(buildJSON(state)); toast('Copied JSON'); }
      if (kind === 'parts') { await copyText(buildPartsJS(state)); toast('Copied ui.parts.js'); }
      if (kind === 'all') {
        const payload = [
          `<!-- view.html -->\n${buildHTML(state)}`,
          `/* styles.css */\n${buildCSS(state)}`,
          `/* layout.json */\n${buildJSON(state)}`,
          `/* ui.parts.js */\n${buildPartsJS(state)}`
        ].join('\n\n');
        await copyText(payload);
        toast('Exported ALL (copied)');
      }
    });
  });

  // Open JSON file
  const fileJson = $('#fileJson');
  $('#btnOpenJson')?.addEventListener('click', () => fileJson?.click());
  fileJson?.addEventListener('change', async () => {
    const f = fileJson.files?.[0];
    if (!f) return;
    const txt = await f.text();
    try {
      const obj = JSON.parse(txt);
      applyLayoutJSON(state, obj);
      toast('Loaded layout.json');
    } catch (e) {
      console.error(e);
      toast('Invalid JSON');
    } finally {
      fileJson.value = '';
    }
  });
}

/* ---------------------------
   Export builders
--------------------------- */

function buildJSON(state) {
  const obj = {
    version: 1,
    surface: { type: state.surfaceType, id: state.surfaceId },
    canvas: { w: state.canvasW, h: state.canvasH, cols: state.gridCols, rows: state.gridRows },
    slots: state.rootSlots,
    partsMap: state.partsMap
  };
  return JSON.stringify(obj, null, 2);
}

function buildHTML(state) {
  const surfaceClass = state.surfaceType === 'modal' ? 'modal-surface' : 'screen-surface';

  // We export nested slots as nested <section> elements inside container slots.
  const htmlSlots = renderSlotsHTML(state.rootSlots);

  return [
    `<div class="surface ${surfaceClass}" data-surface="${escapeAttr(state.surfaceId)}">`,
    `  <div class="surface-inner">`,
    htmlSlots.split('\n').map(l => '    ' + l).join('\n'),
    `  </div>`,
    `</div>`
  ].join('\n');
}

function renderSlotsHTML(slots, depth = 0) {
  const pad = '  '.repeat(depth);
  return slots
    .slice()
    .sort((a,b) => (a.z||0)-(b.z||0))
    .map(s => {
      const attrs = [
        `id="${escapeAttr(s.id)}"`,
        `class="slot${s.surface === 'none' ? ' slot--none' : ''}"`,
        s.variant ? `data-variant="${escapeAttr(s.variant)}"` : '',
        s.isContainer ? `data-container="true"` : ''
      ].filter(Boolean).join(' ');

      const children = (s.children && s.children.length)
        ? `\n${renderSlotsHTML(s.children, depth + 1)}\n${pad}`
        : '';

      return `${pad}<section ${attrs}></section>${children ? children : ''}`;
    })
    .join('\n');
}

function buildCSS(state) {
  // Use absolute positioning for fidelity (matches slot editor).
  // You can later add an alternate "grid-template-areas" exporter.
  const lines = [];

  lines.push(`.surface { width: 100%; height: 100%; }`);
  lines.push(`.surface-inner { position: relative; width: ${state.canvasW}px; height: ${state.canvasH}px; }`);
  lines.push(`.slot { position: absolute; border-radius: 18px; }`);
  lines.push(`.slot--none { background: transparent !important; border: none !important; }`);
  lines.push(`.slot[data-variant="dense"] { padding: 10px; }`);
  lines.push(`.slot[data-variant="flat"] { padding: 0; }`);
  lines.push(`.slot[data-variant="scroll"] { overflow: auto; }`);

  // slot placement
  flattenSlots(state.rootSlots).forEach(s => {
    lines.push(`#${cssId(s.id)} { left:${px(s.x)}; top:${px(s.y)}; width:${px(s.w)}; height:${px(s.h)}; z-index:${s.z||0}; min-height:${px(s.minH||0)}; }`);
  });

  return lines.join('\n');
}

function buildPartsJS(state) {
  // Minimal export: mapping slotId -> partId + slicePath + variant
  return `// ui.parts.js (generated by Surfaces Studio)\n` +
`export const parts = ${JSON.stringify(state.partsMap || {}, null, 2)};\n`;
}

/* ---------------------------
   Import layout.json
--------------------------- */

function applyLayoutJSON(state, obj) {
  if (obj?.canvas) {
    state.canvasW = obj.canvas.w;
    state.canvasH = obj.canvas.h;
    state.gridCols = obj.canvas.cols;
    state.gridRows = obj.canvas.rows;
    state.emit('canvasChanged');
  }
  if (obj?.surface?.type) state.surfaceType = obj.surface.type;
  if (obj?.surface?.id) state.surfaceId = obj.surface.id;

  state.rootSlots = Array.isArray(obj.slots) ? obj.slots : [];
  state.partsMap = obj.partsMap || {};

  state.selectedSlotId = null;
  state.path = [];
  state.emit('pathChanged');
  state.emit('render');
  state.emit('slotsChanged');
}

/* ---------------------------
   Helpers
--------------------------- */

function flattenSlots(slots) {
  const out = [];
  (function walk(list){
    for (const s of list) {
      out.push(s);
      if (s.children?.length) walk(s.children);
    }
  })(slots || []);
  return out;
}

function cssId(id) {
  return String(id).replace(/[^a-zA-Z0-9\-_]/g, '\\$&');
}
function px(n){ return `${Math.round(n)}px`; }
function escapeAttr(s){ return String(s).replace(/"/g, '&quot;'); }

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}
