// tools/surfaces-studio/modules/state.js
export function createStudioState() {
  const listeners = new Map();

  const state = {
    // Surface identity
    surfaceType: 'screen', // 'screen' | 'modal'
    surfaceId: 'hub',

    // Canvas (logical size of the surface)
    canvasW: 390,
    canvasH: 844,

    // MyFi chrome safe areas (header/footer).
    // These are *guides only* for layout planning; they do not affect exports.
    chromeTop: 56,
    chromeBottom: 64,
    showChromeGuides: true,

    // Canvas (base + transform)
    baseW: 390,
    baseH: 844,
    orientation: 'portrait', // 'portrait' | 'landscape'
    zoom: 1, // 1 = 1:1 (logical)

    // Grid
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

    // Slot -> mapping
    // slotId -> { partId, slicePath, variant }
    partsMap: {},

    // ✅ Part library (inventory; reusable; not tied 1:1 to slots)
    // partId -> {
    //   meta:{ title,type,createdAt,updatedAt },
    //   contract:{ version, requiredMarkers },
    //   baseline:{ html, css, js },
    //   uplift?:{ html, css, js }
    // }
    partsLibrary: {},

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
      // NOTE: resetSurface does NOT clear library by default
      this.emit('slotsChanged');
      this.emit('partsChanged');
      this.emit('selectionChanged');
      this.emit('pathChanged');
      this.emit('render');
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
    hasPart(partId) {
      return !!this.partsLibrary?.[partId];
    }
  };

  return state;
}
