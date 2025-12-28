// tools/surfaces-studio/studio.js
import { $ } from './modules/dom.js';
import { toast } from './modules/toast.js';
import { createStudioState } from './modules/state.js';
import { initTabs } from './modules/tabs.js';
import { initCanvas } from './modules/canvas.js';
import { initSlotDesigner } from './modules/slotDesigner.js';
import { initExporter } from './modules/exporter.js';

import { initLiveHooks } from './modules/liveHooks.js';
import { initPartsComposer } from './modules/partsComposer.js';
import { initDataBrowser } from './modules/dataBrowser.js';
import { initPartSandbox } from './modules/partSandbox.js';
import { initJourneyRunner } from './modules/journeyRunner.js';
import { initValidate } from './modules/validate.js';

import { loadStudioState, saveStudioState } from './modules/persist.js';

const state = createStudioState();

// DEV: expose studio state for debugging (safe; this tool is local-only)
window.__STUDIO__ = window.__STUDIO__ || {};
window.__STUDIO__.state = state;
console.log('[Surfaces Studio] state exposed at window.__STUDIO__.state');

function syncSurfaceTypeUI() {
  $('#segScreen')?.classList.toggle('isOn', state.surfaceType === 'screen');
  $('#segModal')?.classList.toggle('isOn', state.surfaceType === 'modal');
  $('#segScreen')?.setAttribute('aria-selected', state.surfaceType === 'screen' ? 'true' : 'false');
  $('#segModal')?.setAttribute('aria-selected', state.surfaceType === 'modal' ? 'true' : 'false');
}

function wireSurfacePicker() {
  $('#segScreen')?.addEventListener('click', () => {
    state.surfaceType = 'screen';
    syncSurfaceTypeUI();
    state.emit('surfaceChanged');
  });

  $('#segModal')?.addEventListener('click', () => {
    state.surfaceType = 'modal';
    syncSurfaceTypeUI();
    state.emit('surfaceChanged');
  });

  const inp = $('#surfaceId');
  if (inp) {
    inp.value = state.surfaceId || '';
    inp.addEventListener('change', () => {
      state.surfaceId = (inp.value || '').trim() || 'hub';
      state.emit('surfaceChanged');
    });
  }
}

function wirePresetControls() {
  // Keep your existing baseline behavior; canvas.js owns actual sizing.
  const preset = $('#preset');
  const wrap = $('#customSizeWrap');
  const w = $('#customW');
  const h = $('#customH');

  function applyPreset() {
    const v = preset?.value || 'mobile-390x844';
    if (v === 'custom') {
      wrap && (wrap.hidden = false);
      state.baseW = parseInt(w?.value || '390', 10);
      state.baseH = parseInt(h?.value || '844', 10);
    } else {
      wrap && (wrap.hidden = true);
      const m = v.match(/(\d+)x(\d+)/i);
      state.baseW = m ? parseInt(m[1], 10) : 390;
      state.baseH = m ? parseInt(m[2], 10) : 844;
    }
    state.emit('canvasChanged');
  }

  preset?.addEventListener('change', applyPreset);
  w?.addEventListener('change', applyPreset);
  h?.addEventListener('change', applyPreset);

  applyPreset();
}

function initPersistence() {
  const loaded = loadStudioState(state);
  if (loaded) toast('Loaded saved studio state');

  // Autosave on important changes
  const save = () => saveStudioState(state);

  state.on('surfaceChanged', save);
  state.on('canvasChanged', save);
  state.on('slotsChanged', save);
  state.on('partsChanged', save);

  // also save on tab change etc if needed later
}

// ---------- Phase A: Chrome safe-area controls ----------
function initChromeControls(){
  const t = $('#chromeTop');
  const b = $('#chromeBottom');
  const toggle = $('#btnToggleChrome');

  if (t) t.value = String(state.chromeTop ?? 56);
  if (b) b.value = String(state.chromeBottom ?? 64);

  function apply(){
    const top = Math.max(0, Number(t?.value ?? state.chromeTop ?? 0));
    const bot = Math.max(0, Number(b?.value ?? state.chromeBottom ?? 0));
    state.chromeTop = top;
    state.chromeBottom = bot;
    state.emit('canvas:refresh');
  }

  t?.addEventListener('change', apply);
  b?.addEventListener('change', apply);

  toggle?.addEventListener('click', () => {
    state.showChromeGuides = !state.showChromeGuides;
    state.emit('canvas:refresh');
  });
}

// ---------- Phase A: Progress UI (surface + selected slot) ----------
function initProgressUI(){
  const tag = $('#tagProgress');
  const pct = $('#progressPct');
  const fill = $('#progressFill');
  const steps = $('#progressSteps');

  function stepPill(ok, label){
    return `<span class="stepPill ${ok ? 'isOk' : ''}">${ok ? '✓' : '•'} ${label}</span>`;
  }

  function compute(){
    const slots = flattenSlots(state.rootSlots || []);
    const total = slots.length || 0;

    // slot completeness: defined + (mapped partId) + (slicePath) + (visualised at least once)
    let doneSlots = 0;

    for (const s of slots){
      const map = state.partsMap?.[s.id];
      const hasPart = !!map?.partId;
      const hasSlice = !!(map?.slicePath && String(map.slicePath).trim().length);
      const visualised = !!map?.lastPreviewedAtMs; // optional; will be 0/undefined until sandbox marks it
      const ok = hasPart && hasSlice; // keep this strict for now
      if (ok) doneSlots++;
    }

    const pctNum = total ? Math.round((doneSlots / total) * 100) : 0;
    return { total, doneSlots, pctNum };
  }

  function render(){
    const { total, doneSlots, pctNum } = compute();
    const txt = total ? `${pctNum}% (${doneSlots}/${total})` : '—';

    if (tag) tag.textContent = `Progress: ${txt}`;
    if (pct) pct.textContent = txt;
    if (fill) fill.style.width = `${pctNum}%`;

    // Selected slot step breakdown
    if (steps){
      const selId = state.selectedSlotId;
      if (!selId){
        steps.innerHTML = `<span class="muted tiny">Select a slot to see its steps.</span>`;
      } else {
        const map = state.partsMap?.[selId];
        const hasPart = !!map?.partId;
        const hasSlice = !!(map?.slicePath && String(map.slicePath).trim().length);
        const hasStyle = !!(map?.preferVariant && map.preferVariant !== 'baseline'); // optional future
        steps.innerHTML =
          stepPill(true, `Slot: ${selId}`) +
          stepPill(hasPart, 'Mapped part') +
          stepPill(hasSlice, 'Slice path') +
          stepPill(hasStyle, 'Alt variant');
      }
    }
  }

  // Re-render on anything that changes structure/mapping
  const rerender = () => render();
  state.on('slotsChanged', rerender);
  state.on('selectionChanged', rerender);
  state.on('partsChanged', rerender);
  state.on('pathChanged', rerender);

  // Initial paint
  render();
}

function flattenSlots(list){
  const out = [];
  const walk = (arr) => {
    for (const s of (arr || [])){
      out.push(s);
      if (s.children?.length) walk(s.children);
    }
  };
  walk(list);
  return out;
}


function boot() {
  syncSurfaceTypeUI();
  wireSurfacePicker();
  wirePresetControls();

  initTabs(state);
  initCanvas(state);
  initSlotDesigner(state);
  initExporter(state);

  initLiveHooks(state);
  initPartsComposer(state);
  initDataBrowser(state);
  initPartSandbox(state);
  initJourneyRunner(state);
  initValidate(state);

  initPersistence();

  initChromeControls();
  initProgressUI();


  // initial render
  state.emit('render');
}

boot();
