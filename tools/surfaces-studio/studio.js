// tools/surfaces-studio/studio.js
import { $, $$ } from './modules/dom.js';
import { toast } from './modules/toast.js';
import { createStudioState } from './modules/state.js';
import { initTabs } from './modules/tabs.js';
import { initCanvas } from './modules/canvas.js';
import { initSlotDesigner } from './modules/slotDesigner.js';
import { initExporter } from './modules/exporter.js';

import { initLiveHooks } from './modules/liveHooks.js';
import { initPartsComposer } from './modules/partsComposer.js';
import { initDataBrowser } from './modules/dataBrowser.js';
import { initSandbox } from './modules/sandbox.js';
import { initJourneys } from './modules/journeys.js';
import { initValidate } from './modules/validate.js';

const state = createStudioState();

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
    toast('Surface type: screen');
    state.emit('surfaceChanged');
  });

  $('#segModal')?.addEventListener('click', () => {
    state.surfaceType = 'modal';
    syncSurfaceTypeUI();
    toast('Surface type: modal');
    state.emit('surfaceChanged');
  });

  const idInput = $('#surfaceId');
  if (idInput) {
    idInput.value = state.surfaceId;
    idInput.addEventListener('change', () => {
      state.surfaceId = (idInput.value || '').trim() || 'unnamed';
      toast(`Surface ID: ${state.surfaceId}`);
      state.emit('surfaceChanged');
    });
  }

  const preset = $('#preset');
  const customWrap = $('#customSizeWrap');
  const customW = $('#customW');
  const customH = $('#customH');

  function applyPreset() {
    const v = preset?.value || 'mobile-390x844';
    if (v === 'custom') {
      customWrap.hidden = false;
      state.canvasW = parseInt(customW.value || '390', 10);
      state.canvasH = parseInt(customH.value || '844', 10);
    } else {
      customWrap.hidden = true;
      const [, wh] = v.split('mobile-');
      const [w, h] = wh.split('x').map(n => parseInt(n, 10));
      state.canvasW = w;
      state.canvasH = h;
    }
    state.emit('canvasChanged');
  }

  preset?.addEventListener('change', applyPreset);
  customW?.addEventListener('change', applyPreset);
  customH?.addEventListener('change', applyPreset);

  // Initial
  applyPreset();
  syncSurfaceTypeUI();
}

function init() {
  wireSurfacePicker();
  initTabs(state);
  initCanvas(state);
  initSlotDesigner(state);
  initExporter(state);

  // Optional modules (they won’t break if you’re not using them yet)
  initLiveHooks(state);
  initPartsComposer(state);
  initDataBrowser(state);
  initSandbox(state);
  initJourneys(state);
  initValidate(state);

  // New button (clears current layout)
  $('#btnNew')?.addEventListener('click', () => {
    state.resetSurface();
    toast('New surface layout created');
  });

  toast('Surfaces Studio ready');
}

document.addEventListener('DOMContentLoaded', init);
