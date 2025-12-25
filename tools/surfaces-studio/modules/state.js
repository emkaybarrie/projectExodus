// tools/surfaces-studio/modules/state.js
export function createStudioState() {
  const listeners = new Map();

  const state = {
    // Surface identity
    surfaceType: 'screen', // 'screen' | 'modal'
    surfaceId: 'hub',

    // Canvas
    canvasW: 390,
    canvasH: 844,
    gridCols: 12,
    gridRows: 24,
    showGrid: true,
    snapOn: true,

    // Editing
    tool: 'select', // select | draw | pan
    selectedSlotId: null,
    path: [], // nested containers stack: slot ids
    dragging: null, // {type:'move'|'resize', slotId, ...}
    drawing: null,  // {x0,y0,x1,y1}

    // Slots data model (per “current container” path)
    // Slot: {id,x,y,w,h,z,minH,variant,surface,isContainer,children:[]}
    rootSlots: [],

    // Parts mapping (for Parts Composer export)
    partsMap: {}, // slotId -> { partId, slicePath, variant }

    // Live hooks
    liveConnected: false,
    liveVM: null,
    liveJourneys: null,

    // Events
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt)?.delete(fn);
    },
    emit(evt, detail) {
      listeners.get(evt)?.forEach(fn => {
        try { fn(detail); } catch (e) { console.error(e); }
      });
    },

    resetSurface() {
      this.selectedSlotId = null;
      this.path = [];
      this.dragging = null;
      this.drawing = null;
      this.rootSlots = [];
      this.partsMap = {};
      this.emit('slotsChanged');
      this.emit('selectionChanged');
      this.emit('pathChanged');
    },

    // Helpers
    getCurrentSlots() {
      // walk path into nested children
      let slots = this.rootSlots;
      for (const id of this.path) {
        const slot = slots.find(s => s.id === id);
        slots = slot?.children || [];
      }
      return slots;
    },
    findSlotById(id) {
      function walk(list) {
        for (const s of list) {
          if (s.id === id) return s;
          const hit = walk(s.children || []);
          if (hit) return hit;
        }
        return null;
      }
      return walk(this.rootSlots);
    },
  };

  return state;
}
