// tools/surfaces-studio/modules/canvas.js
import { $ } from './dom.js';
import { toast } from './toast.js';

function px(n){ return `${Math.max(1, Math.round(n))}px`; }

export function initCanvas(state){
  const stage   = $('#canvasStage');
  const frame   = $('#canvasFrame');
  const gridSvg = $('#gridSvg');

  const tagSize = $('#tagSize');
  const tagGrid = $('#tagGrid');
  const tagPath = $('#tagPath');

  // Toolbar controls
  const toolSelect = $('#toolSelect');
  const toolDraw   = $('#toolDraw');
  const toolPan    = $('#toolPan');

  const gridColsInp = $('#gridCols');
  const gridRowsInp = $('#gridRows');
  const btnGrid     = $('#btnToggleGrid');
  const btnSnap     = $('#btnToggleSnap');

  if (!frame) return;

  // ---------- Helpers ----------
  function setTool(next){
    state.tool = next;
    syncToolbar();
    toast(`Tool: ${next}`);
  }

  function syncToolbar(){
    // Tool buttons
    toolSelect?.classList.toggle('isOn', state.tool === 'select');
    toolDraw?.classList.toggle('isOn',   state.tool === 'draw');
    toolPan?.classList.toggle('isOn',    state.tool === 'pan');

    // Grid/snap buttons (use "btnPrimary" feel by toggling class)
    btnGrid?.classList.toggle('btnPrimary', !!state.showGrid);
    btnSnap?.classList.toggle('btnPrimary', !!state.snapOn);

    // Inputs
    if (gridColsInp) gridColsInp.value = String(state.gridCols || 12);
    if (gridRowsInp) gridRowsInp.value = String(state.gridRows || 24);

    // Tags
    if (tagGrid) tagGrid.textContent = `${state.gridCols}×${state.gridRows}`;
    if (tagPath) tagPath.textContent = `/${(state.path || []).join('/') || ''}`;
  }

  function applyCanvasSize(){
    const w = state.canvasW || 390;
    const h = state.canvasH || 844;
    const s = state.canvasScale || 1;

    // Canvas frame uses CSS vars for physical size
    frame.style.setProperty('--cv-w', px(w * s));
    frame.style.setProperty('--cv-h', px(h * s));

    if (tagSize) tagSize.textContent = `${w}×${h} @${s}×`;

    // Grid SVG keeps logical coords (0..w, 0..h)
    if (gridSvg){
      gridSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      gridSvg.setAttribute('preserveAspectRatio', 'none');
    }
  }

  function drawGrid(){
    if (!gridSvg) return;
    const w = state.canvasW || 390;
    const h = state.canvasH || 844;

    // Hide grid fully if toggled off
    gridSvg.style.display = state.showGrid ? 'block' : 'none';
    if (!state.showGrid) return;

    const cols = Math.max(1, parseInt(state.gridCols || 12, 10));
    const rows = Math.max(1, parseInt(state.gridRows || 24, 10));

    const stepX = w / cols;
    const stepY = h / rows;

    // Light grid lines (no heavy DOM)
    // We render as one big path for performance
    let d = '';
    for (let c = 1; c < cols; c++){
      const x = c * stepX;
      d += `M ${x} 0 L ${x} ${h} `;
    }
    for (let r = 1; r < rows; r++){
      const y = r * stepY;
      d += `M 0 ${y} L ${w} ${y} `;
    }

    gridSvg.innerHTML = `
      <path d="${d}" fill="none" stroke="rgba(234,240,255,.14)" stroke-width="1" />
      <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="rgba(234,240,255,.18)" stroke-width="1" />
    `;
  }

  function recenterStage(){
    if (!stage) return;
    // Center the surface in the scroll viewport
    const cx = Math.max(0, (stage.scrollWidth  - stage.clientWidth)  / 2);
    const cy = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    stage.scrollLeft = cx;
    stage.scrollTop  = cy;
  }

  function refreshAll(){
    applyCanvasSize();
    drawGrid();
    syncToolbar();
    syncChromeGuides();
    requestAnimationFrame(() => recenterStage());
  }

  // ---------- MyFi chrome safe-area guides (header/footer) ----------
  function ensureGuide(id, cls){
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = cls;
    frame.appendChild(el);
    return el;
  }

  function syncChromeGuides(){
    // Ensure guide elements exist
    const topEl = ensureGuide('chromeGuideTop', 'chromeGuide chromeGuideTop');
    const botEl = ensureGuide('chromeGuideBottom', 'chromeGuide chromeGuideBottom');

    const on = !!state.showChromeGuides;
    topEl.hidden = !on;
    botEl.hidden = !on;

    if (!on) return;

    const topH = Math.max(0, Number(state.chromeTop || 0));
    const botH = Math.max(0, Number(state.chromeBottom || 0));

    topEl.style.height = `${topH}px`;
    botEl.style.height = `${botH}px`;

    // bottom guide should sit at bottom of the *logical* canvas
    botEl.style.top = `${Math.max(0, state.canvasH - botH)}px`;
  }



  // ---------- Wire toolbar ----------
  toolSelect?.addEventListener('click', () => setTool('select'));
  toolDraw?.addEventListener('click',   () => setTool('draw'));
  toolPan?.addEventListener('click',    () => setTool('pan'));

  btnGrid?.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    refreshAll();
    toast(state.showGrid ? 'Grid on' : 'Grid off');
  });

  btnSnap?.addEventListener('click', () => {
    state.snapOn = !state.snapOn;
    syncToolbar();
    toast(state.snapOn ? 'Snap on' : 'Snap off');
  });

  function clampInt(v, min, max, fallback){
    const n = parseInt(String(v || ''), 10);
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
    return fallback;
  }

  gridColsInp?.addEventListener('change', () => {
    state.gridCols = clampInt(gridColsInp.value, 4, 24, state.gridCols || 12);
    refreshAll();
    state.emit('canvasChanged'); // helps other modules if listening
  });

  gridRowsInp?.addEventListener('change', () => {
    state.gridRows = clampInt(gridRowsInp.value, 6, 48, state.gridRows || 24);
    refreshAll();
    state.emit('canvasChanged');
  });

  // Keyboard shortcuts: V (select), R (draw), Space (pan while held)
  let panHeld = false;
  window.addEventListener('keydown', (e) => {
    // Ignore if typing in an input/textarea/select
    const t = e.target?.tagName?.toLowerCase();
    if (t === 'input' || t === 'textarea' || t === 'select') return;

    if (e.code === 'KeyV') setTool('select');
    if (e.code === 'KeyR') setTool('draw');

    if (e.code === 'Space' && !panHeld){
      panHeld = true;
      // temporary pan (remember prior)
      state.__prevTool = state.tool;
      state.tool = 'pan';
      syncToolbar();
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && panHeld){
      panHeld = false;
      // restore previous tool
      state.tool = state.__prevTool || 'select';
      state.__prevTool = null;
      syncToolbar();
      e.preventDefault();
    }
  });

  // ---------- React to state changes ----------
  state.on('canvasChanged', () => refreshAll());
  state.on('pathChanged',   () => syncToolbar());

  // First paint
  refreshAll();
}
