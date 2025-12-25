// tools/surfaces-studio/modules/canvas.js
import { $, $$ } from './dom.js';
import { toast } from './toast.js';

export function initCanvas(state) {
  const frame = $('#canvasFrame');
  const gridSvg = $('#gridSvg');
  const layer = $('#slotsLayer');
  const ghost = $('#drawGhost');

  const tagSize = $('#tagSize');
  const tagGrid = $('#tagGrid');
  const tagPath = $('#tagPath');
  const tagSel = $('#tagSelection');

  function pxPerCol() { return state.canvasW / state.gridCols; }
  function pxPerRow() { return state.canvasH / state.gridRows; }

  function snapX(x) { return state.snapOn ? Math.round(x / pxPerCol()) * pxPerCol() : x; }
  function snapY(y) { return state.snapOn ? Math.round(y / pxPerRow()) * pxPerRow() : y; }

  function updateMeta() {
    tagSize.textContent = `${Math.round(state.canvasW)}×${Math.round(state.canvasH)}`;
    tagGrid.textContent = `${state.gridCols}×${state.gridRows}`;
    tagPath.textContent = '/' + (state.path.length ? state.path.join('/') : '');
    const sel = state.selectedSlotId ? state.selectedSlotId : 'No selection';
    tagSel.textContent = sel;
  }

  function resizeCanvas() {
    // canvasFrame is the viewport; slotsLayer uses a fixed internal coordinate system
    layer.style.width = `${state.canvasW}px`;
    layer.style.height = `${state.canvasH}px`;
    gridSvg.setAttribute('viewBox', `0 0 ${state.canvasW} ${state.canvasH}`);
    drawGrid();
    updateMeta();
    state.emit('render');
  }

  function drawGrid() {
    if (!state.showGrid) {
      gridSvg.innerHTML = '';
      return;
    }
    const cols = state.gridCols;
    const rows = state.gridRows;
    const w = state.canvasW;
    const h = state.canvasH;

    const colW = w / cols;
    const rowH = h / rows;

    const lines = [];
    const strokeMajor = 'rgba(255,255,255,.12)';
    const strokeMinor = 'rgba(255,255,255,.06)';

    for (let c = 0; c <= cols; c++) {
      const x = c * colW;
      const isMajor = c % 3 === 0;
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${isMajor ? strokeMajor : strokeMinor}" stroke-width="1"/>`);
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * rowH;
      const isMajor = r % 3 === 0;
      lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${isMajor ? strokeMajor : strokeMinor}" stroke-width="1"/>`);
    }
    gridSvg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`;
  }

  // Toolbar controls
  $('#gridCols')?.addEventListener('change', (e) => {
    state.gridCols = clamp(parseInt(e.target.value || '12', 10), 4, 24);
    resizeCanvas();
    state.emit('gridChanged');
  });
  $('#gridRows')?.addEventListener('change', (e) => {
    state.gridRows = clamp(parseInt(e.target.value || '24', 10), 6, 48);
    resizeCanvas();
    state.emit('gridChanged');
  });

  $('#btnToggleGrid')?.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    drawGrid();
    toast(state.showGrid ? 'Grid on' : 'Grid off');
  });

  $('#btnToggleSnap')?.addEventListener('click', () => {
    state.snapOn = !state.snapOn;
    toast(state.snapOn ? 'Snap on' : 'Snap off');
  });

  // Tools
  $$('#toolSelect, #toolDraw, #toolPan').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tool;
      state.tool = t;
      $$('#toolSelect, #toolDraw, #toolPan').forEach(b => b.classList.toggle('isOn', b.dataset.tool === t));
      toast(`Tool: ${t}`);
    });
  });

  // Listen to state changes
  state.on('canvasChanged', resizeCanvas);
  state.on('pathChanged', updateMeta);
  state.on('selectionChanged', updateMeta);

  // Expose snapping helpers for slotDesigner
  state.__snap = { snapX, snapY, pxPerCol, pxPerRow };

  // Initial
  resizeCanvas();
  updateMeta();
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
