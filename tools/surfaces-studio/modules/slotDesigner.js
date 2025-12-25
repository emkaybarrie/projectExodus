// tools/surfaces-studio/modules/slotDesigner.js
import { $, $$ } from './dom.js';
import { toast } from './toast.js';

export function initSlotDesigner(state) {
  const frame = $('#canvasFrame');
  const layer = $('#slotsLayer');
  const drawGhost = $('#drawGhost');

  // Property panel fields (already in your HTML)
  const slotName = $('#slotName');
  const slotVariant = $('#slotVariant');
  const slotSurface = $('#slotSurface');
  const minH = $('#minH');
  const zIndex = $('#zIndex');

  const btnDelete = $('#btnDeleteSlot');
  const btnEditInside = $('#btnEditInside');
  const btnBackOut = $('#btnBackOut');
  const btnDuplicate = $('#btnDuplicateSlot');
  const btnAutoName = $('#btnAutoName');
  const btnMakeContainer = $('#btnMakeContainer');
  const btnClearContainer = $('#btnClearContainer');

  function currentSlots() { return state.getCurrentSlots(); }
  function selectedSlot() { return state.findSlotById(state.selectedSlotId); }

  function normalizeSlotId(id) {
    const raw = (id || '').trim();
    if (!raw) return '';
    const out = raw.startsWith('slot-') ? raw : `slot-${raw}`;
    return out.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '').toLowerCase();
  }

  function setInspectorEnabled(on) {
    [slotName, slotVariant, slotSurface, minH, zIndex,
     btnDelete, btnEditInside, btnDuplicate, btnAutoName, btnMakeContainer, btnClearContainer
    ].forEach(el => { if (el) el.disabled = !on; });

    if (btnBackOut) btnBackOut.disabled = (state.path.length === 0);
  }

  function syncInspector() {
    const s = selectedSlot();
    if (!s) {
      setInspectorEnabled(false);
      if (btnBackOut) btnBackOut.disabled = (state.path.length === 0);
      return;
    }
    setInspectorEnabled(true);

    slotName.value = s.id;
    slotVariant.value = (s.variant || '');
    slotSurface.value = (s.surface || 'card');
    minH.value = String(s.minH ?? 0);
    zIndex.value = String(s.z ?? 0);

    if (btnEditInside) btnEditInside.disabled = !s.isContainer;
  }

  function selectSlot(id) {
    state.selectedSlotId = id;
    state.emit('selectionChanged');
    state.emit('render');
    syncInspector();
  }

  function deselect() {
    state.selectedSlotId = null;
    state.emit('selectionChanged');
    state.emit('render');
    syncInspector();
  }

  function addSlot(slot) {
    currentSlots().push(slot);
    selectSlot(slot.id);
    state.emit('slotsChanged');
  }

  function removeSelected() {
    const id = state.selectedSlotId;
    if (!id) return;
    const slots = currentSlots();
    const i = slots.findIndex(s => s.id === id);
    if (i >= 0) slots.splice(i, 1);
    deselect();
    state.emit('slotsChanged');
    toast('Slot deleted');
  }

  // Rendering: slot boxes + handles
  function renderSlots() {
    layer.innerHTML = '';

    const slots = currentSlots().slice().sort((a,b) => (a.z||0) - (b.z||0));
    for (const s of slots) {
      const box = document.createElement('div');
      box.className = 'slotBox' + (s.id === state.selectedSlotId ? ' isSelected' : '');
      box.style.left = `${s.x}px`;
      box.style.top = `${s.y}px`;
      box.style.width = `${s.w}px`;
      box.style.height = `${s.h}px`;
      box.style.zIndex = `${s.z || 0}`;

      box.innerHTML = `
        <div class="slotHead">
          <div class="slotTitle">${s.id}</div>
          <div class="slotMeta">${s.variant || 'default'}</div>
        </div>
        <div class="handle tl" data-h="tl"></div>
        <div class="handle tr" data-h="tr"></div>
        <div class="handle bl" data-h="bl"></div>
        <div class="handle br" data-h="br"></div>
      `;

      // Select on click
      box.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectSlot(s.id);

        // Drag-move if not on a handle
        const h = e.target?.dataset?.h;
        if (!h && state.tool === 'select') {
          state.dragging = {
            type: 'move',
            id: s.id,
            startX: e.clientX,
            startY: e.clientY,
            origX: s.x,
            origY: s.y,
            shiftNoSnap: e.shiftKey === true
          };
        }
      });

      // Resize handles
      box.querySelectorAll('.handle').forEach(hEl => {
        hEl.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          selectSlot(s.id);
          if (state.tool !== 'select') return;
          state.dragging = {
            type: 'resize',
            id: s.id,
            handle: hEl.dataset.h,
            startX: e.clientX,
            startY: e.clientY,
            orig: { x:s.x, y:s.y, w:s.w, h:s.h },
            shiftNoSnap: e.shiftKey === true
          };
        });
      });

      layer.appendChild(box);
    }
  }

  // Drawing new slots
  function beginDraw(e) {
    const rect = layer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { snapX, snapY } = state.__snap;

    state.drawing = { x0: snapX(x), y0: snapY(y), x1: snapX(x), y1: snapY(y), shiftNoSnap: e.shiftKey === true };
    drawGhost.hidden = false;
    drawGhost.style.left = `${state.drawing.x0}px`;
    drawGhost.style.top = `${state.drawing.y0}px`;
    drawGhost.style.width = `0px`;
    drawGhost.style.height = `0px`;
  }

  function updateDraw(e) {
    if (!state.drawing) return;
    const rect = layer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    const { snapX, snapY } = state.__snap;
    if (!state.drawing.shiftNoSnap) {
      x = snapX(x); y = snapY(y);
    }

    state.drawing.x1 = x;
    state.drawing.y1 = y;

    const left = Math.min(state.drawing.x0, x);
    const top  = Math.min(state.drawing.y0, y);
    const w = Math.abs(x - state.drawing.x0);
    const h = Math.abs(y - state.drawing.y0);

    drawGhost.style.left = `${left}px`;
    drawGhost.style.top = `${top}px`;
    drawGhost.style.width = `${w}px`;
    drawGhost.style.height = `${h}px`;
  }

  function endDraw() {
    if (!state.drawing) return;
    const { x0,y0,x1,y1 } = state.drawing;
    const left = Math.min(x0,x1);
    const top  = Math.min(y0,y1);
    const w = Math.abs(x1-x0);
    const h = Math.abs(y1-y0);

    state.drawing = null;
    drawGhost.hidden = true;

    if (w < 24 || h < 24) return;

    const id = autoSlotId();
    addSlot({
      id,
      x:left, y:top, w, h,
      z:0,
      minH:0,
      variant:'',
      surface:'card',
      isContainer:false,
      children:[]
    });

    toast(`Added ${id}`);
  }

  function autoSlotId() {
    // simple unique slot-n naming; user can rename
    const slots = currentSlots();
    let i = slots.length + 1;
    let id = `slot-${i}`;
    while (slots.some(s => s.id === id)) { i++; id = `slot-${i}`; }
    return id;
  }

  // Move / resize
  function onMove(e) {
    if (!state.dragging) return;
    const s = state.findSlotById(state.dragging.id);
    if (!s) return;

    const dx = e.clientX - state.dragging.startX;
    const dy = e.clientY - state.dragging.startY;

    const { snapX, snapY } = state.__snap;

    if (state.dragging.type === 'move') {
      let nx = state.dragging.origX + dx;
      let ny = state.dragging.origY + dy;
      if (!state.dragging.shiftNoSnap) {
        nx = snapX(nx); ny = snapY(ny);
      }
      s.x = clamp(nx, 0, state.canvasW - s.w);
      s.y = clamp(ny, 0, state.canvasH - s.h);
    } else if (state.dragging.type === 'resize') {
      const o = state.dragging.orig;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;

      // handle logic
      const h = state.dragging.handle;
      if (h.includes('r')) nw = o.w + dx;
      if (h.includes('l')) { nw = o.w - dx; nx = o.x + dx; }
      if (h.includes('b')) nh = o.h + dy;
      if (h.includes('t')) { nh = o.h - dy; ny = o.y + dy; }

      // snap
      if (!state.dragging.shiftNoSnap) {
        nx = snapX(nx); ny = snapY(ny);
        nw = snapX(nw); nh = snapY(nh);
      }

      // clamp minimums
      nw = Math.max(24, nw);
      nh = Math.max(24, nh);

      // clamp within canvas
      nx = clamp(nx, 0, state.canvasW - 24);
      ny = clamp(ny, 0, state.canvasH - 24);
      nw = Math.min(nw, state.canvasW - nx);
      nh = Math.min(nh, state.canvasH - ny);

      s.x = nx; s.y = ny; s.w = nw; s.h = nh;
    }

    state.emit('render');
    state.emit('slotsChanged');
  }

  function onUp() {
    if (state.dragging) {
      state.dragging = null;
      state.emit('slotsChanged');
      return;
    }
  }

  // Canvas mouse handlers
  frame.addEventListener('mousedown', (e) => {
    // click blank area -> deselect
    if (e.target === frame || e.target === layer || e.target === drawGhost) {
      if (state.tool === 'draw') {
        beginDraw(e);
      } else if (state.tool === 'select') {
        deselect();
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (state.drawing) updateDraw(e);
    else if (state.dragging) onMove(e);
  });

  window.addEventListener('mouseup', () => {
    if (state.drawing) endDraw();
    if (state.dragging) onUp();
  });

  // Inspector edits
  slotName?.addEventListener('change', () => {
    const s = selectedSlot(); if (!s) return;
    const next = normalizeSlotId(slotName.value);
    if (!next) return;
    // ensure unique within this container
    if (currentSlots().some(x => x.id === next && x !== s)) {
      toast('Slot ID already exists in this container');
      slotName.value = s.id;
      return;
    }
    // rename in partsMap too
    if (state.partsMap[s.id]) {
      state.partsMap[next] = state.partsMap[s.id];
      delete state.partsMap[s.id];
    }
    s.id = next;
    state.selectedSlotId = next;
    state.emit('render');
    syncInspector();
    toast(`Renamed to ${next}`);
  });

  slotVariant?.addEventListener('change', () => {
    const s = selectedSlot(); if (!s) return;
    s.variant = slotVariant.value || '';
    state.emit('render'); state.emit('slotsChanged');
  });

  slotSurface?.addEventListener('change', () => {
    const s = selectedSlot(); if (!s) return;
    s.surface = slotSurface.value || 'card';
    state.emit('slotsChanged');
  });

  minH?.addEventListener('change', () => {
    const s = selectedSlot(); if (!s) return;
    s.minH = parseInt(minH.value || '0', 10);
    state.emit('slotsChanged');
  });

  zIndex?.addEventListener('change', () => {
    const s = selectedSlot(); if (!s) return;
    s.z = parseInt(zIndex.value || '0', 10);
    state.emit('render'); state.emit('slotsChanged');
  });

  btnDelete?.addEventListener('click', removeSelected);

  btnDuplicate?.addEventListener('click', () => {
    const s = selectedSlot(); if (!s) return;
    const copy = structuredClone(s);
    copy.id = autoSlotId();
    copy.x = clamp(copy.x + 12, 0, state.canvasW - copy.w);
    copy.y = clamp(copy.y + 12, 0, state.canvasH - copy.h);
    addSlot(copy);
    toast(`Duplicated to ${copy.id}`);
  });

  btnAutoName?.addEventListener('click', () => {
    const s = selectedSlot(); if (!s) return;
    const id = autoSlotId();
    s.id = id;
    state.selectedSlotId = id;
    state.emit('render');
    syncInspector();
    toast(`Auto-named: ${id}`);
  });

  btnMakeContainer?.addEventListener('click', () => {
    const s = selectedSlot(); if (!s) return;
    s.isContainer = true;
    s.children = s.children || [];
    btnEditInside.disabled = false;
    toast('Marked as container');
    state.emit('slotsChanged');
  });

  btnClearContainer?.addEventListener('click', () => {
    const s = selectedSlot(); if (!s) return;
    s.isContainer = false;
    // keep children (do not destroy), but edit-inside disabled
    btnEditInside.disabled = true;
    toast('Container cleared (children preserved)');
    state.emit('slotsChanged');
  });

  btnEditInside?.addEventListener('click', () => {
    const s = selectedSlot(); if (!s || !s.isContainer) return;
    state.path.push(s.id);
    state.selectedSlotId = null;
    state.emit('pathChanged');
    state.emit('render');
    syncInspector();
    toast(`Editing inside ${s.id}`);
  });

  btnBackOut?.addEventListener('click', () => {
    if (!state.path.length) return;
    state.path.pop();
    state.selectedSlotId = null;
    state.emit('pathChanged');
    state.emit('render');
    syncInspector();
    toast('Back');
  });

  // Copy buttons (use exporter later, but basic for now)
  $('#btnCopyJson')?.addEventListener('click', () => state.emit('copyJson'));
  $('#btnCopyHtml')?.addEventListener('click', () => state.emit('copyHtml'));
  $('#btnCopyCss')?.addEventListener('click', () => state.emit('copyCss'));

  // Hook render
  state.on('render', renderSlots);
  state.on('slotsChanged', syncInspector);
  state.on('selectionChanged', syncInspector);
  state.on('pathChanged', () => { if (btnBackOut) btnBackOut.disabled = (state.path.length === 0); });

  // Initial
  renderSlots();
  syncInspector();
  setInspectorEnabled(false);
}

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
