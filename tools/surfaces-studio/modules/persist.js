// tools/surfaces-studio/modules/persist.js
import { toast } from './toast.js';

const KEY = 'surfacesStudio.v1';

export function loadStudioState(state) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);

    // Defensive: only assign known fields
    if (obj?.surfaceType) state.surfaceType = obj.surfaceType;
    if (obj?.surfaceId) state.surfaceId = obj.surfaceId;

    if (obj?.canvasW) state.canvasW = obj.canvasW;
    if (obj?.canvasH) state.canvasH = obj.canvasH;

    if (obj?.baseW) state.baseW = obj.baseW;
    if (obj?.baseH) state.baseH = obj.baseH;
    if (obj?.orientation) state.orientation = obj.orientation;
    if (obj?.zoom) state.zoom = obj.zoom;

    if (obj?.gridCols) state.gridCols = obj.gridCols;
    if (obj?.gridRows) state.gridRows = obj.gridRows;
    if (typeof obj?.showGrid === 'boolean') state.showGrid = obj.showGrid;
    if (typeof obj?.snapOn === 'boolean') state.snapOn = obj.snapOn;

    if (Array.isArray(obj?.rootSlots)) state.rootSlots = obj.rootSlots;
    if (obj?.partsMap && typeof obj.partsMap === 'object') state.partsMap = obj.partsMap;

    if (obj?.partsLibrary && typeof obj.partsLibrary === 'object') state.partsLibrary = obj.partsLibrary;

    // reset volatile
    state.selectedSlotId = null;
    state.path = [];
    state.dragging = null;
    state.drawing = null;

    state.emit('surfaceChanged');
    state.emit('slotsChanged');
    state.emit('partsChanged');
    state.emit('render');

    return true;
  } catch (e) {
    console.warn('[Studio] load failed:', e);
    return false;
  }
}

export function saveStudioState(state) {
  try {
    const obj = {
      surfaceType: state.surfaceType,
      surfaceId: state.surfaceId,

      canvasW: state.canvasW,
      canvasH: state.canvasH,

      baseW: state.baseW,
      baseH: state.baseH,
      orientation: state.orientation,
      zoom: state.zoom,

      gridCols: state.gridCols,
      gridRows: state.gridRows,
      showGrid: state.showGrid,
      snapOn: state.snapOn,

      rootSlots: state.rootSlots,
      partsMap: state.partsMap,

      // ✅ persistent library
      partsLibrary: state.partsLibrary
    };

    localStorage.setItem(KEY, JSON.stringify(obj));
    return true;
  } catch (e) {
    console.warn('[Studio] save failed:', e);
    return false;
  }
}

export function clearStudioState(state) {
  try {
    localStorage.removeItem(KEY);
    toast('Cleared saved studio state');
    state.resetSurface();
  } catch (e) {
    console.warn('[Studio] clear failed:', e);
  }
}
