// mapZoomSystem.js — Map Visual Zoom System (WO-S5)
// FEATURE-FLAGGED: __MYFI_DEV_CONFIG__.enableMapZoom
//
// Adds VISUAL zoom to the World Map based on distance.
// This is purely visual and does NOT affect:
// - Avatar coordinates
// - Region detection
// - Location transitions
// - Map click logic
//
// Per STAGE-S5-MAP-ZOOM-V2 guardrails:
// - All map logic remains unchanged
// - Zoom is derived from existing distance01 value
// - Only applies CSS transform when feature is enabled
// - Map zoom is visual only and does not affect world logic

/**
 * Zoom configuration
 */
const ZOOM_CONFIG = {
  // Minimum zoom level (far out, full map visible)
  MIN_ZOOM: 1.0,
  // Maximum zoom level (close up on avatar)
  MAX_ZOOM: 2.0,
  // Transition duration for smooth zoom
  TRANSITION_MS: 300,
  // Easing function
  EASING: 'ease-out',
};

/**
 * Check if map zoom feature is enabled
 * @returns {boolean}
 */
function isEnabled() {
  const config = typeof window !== 'undefined' ? window.__MYFI_DEV_CONFIG__ : null;
  return config?.enableMapZoom === true;
}

/**
 * Derive zoom level from distance
 *
 * PURE FUNCTION - no side effects.
 * Maps distance01 (0-1) to a zoom level.
 *
 * Logic:
 * - distance01 = 0 (at home/center): MAX_ZOOM (zoomed in)
 * - distance01 = 1 (far from center): MIN_ZOOM (zoomed out)
 *
 * This creates a natural effect where being close to "home"
 * shows more local detail, while traveling far shows more of the world.
 *
 * @param {Object} options
 * @param {number} options.distance01 - Normalized distance (0-1)
 * @param {number} options.minZoom - Optional min zoom override
 * @param {number} options.maxZoom - Optional max zoom override
 * @returns {number} Zoom level
 */
export function deriveMapZoom({
  distance01 = 0,
  minZoom = ZOOM_CONFIG.MIN_ZOOM,
  maxZoom = ZOOM_CONFIG.MAX_ZOOM,
} = {}) {
  // Clamp distance to 0-1
  const d = Math.max(0, Math.min(1, distance01));

  // Inverse relationship: close = zoomed in, far = zoomed out
  // Linear interpolation from maxZoom (at 0) to minZoom (at 1)
  return maxZoom - (d * (maxZoom - minZoom));
}

/**
 * Get CSS transform string for zoom
 *
 * Returns empty string if feature is disabled.
 *
 * @param {number} zoomLevel - Zoom level from deriveMapZoom
 * @returns {string} CSS transform value
 */
export function getZoomTransformCSS(zoomLevel) {
  if (!isEnabled()) {
    return ''; // Feature disabled - no transform
  }

  if (zoomLevel === 1) {
    return ''; // No transform needed at 1x
  }

  return `scale(${zoomLevel})`;
}

/**
 * Get CSS transition string for smooth zoom
 * @returns {string} CSS transition value
 */
export function getZoomTransitionCSS() {
  if (!isEnabled()) {
    return '';
  }
  return `transform ${ZOOM_CONFIG.TRANSITION_MS}ms ${ZOOM_CONFIG.EASING}`;
}

/**
 * Apply zoom to a map container element
 *
 * Does nothing if feature is disabled.
 * Applies transform centered on a focal point (default: center).
 *
 * @param {HTMLElement} mapEl - Map container element
 * @param {number} distance01 - Normalized distance for zoom derivation
 * @param {Object} options
 * @param {number} options.focusX - X focal point (0-100%, default 50)
 * @param {number} options.focusY - Y focal point (0-100%, default 50)
 * @returns {Object|null} Applied state or null if disabled
 */
export function applyMapZoom(mapEl, distance01, options = {}) {
  if (!isEnabled() || !mapEl) {
    return null;
  }

  const { focusX = 50, focusY = 50 } = options;
  const zoomLevel = deriveMapZoom({ distance01 });
  const transform = getZoomTransformCSS(zoomLevel);
  const transition = getZoomTransitionCSS();

  // Apply to element
  mapEl.style.transition = transition;
  mapEl.style.transform = transform;
  mapEl.style.transformOrigin = `${focusX}% ${focusY}%`;

  return {
    applied: true,
    zoomLevel,
    distance01,
    focusX,
    focusY,
  };
}

/**
 * Apply zoom centered on avatar position
 *
 * @param {HTMLElement} mapEl - Map container element
 * @param {number} distance01 - Normalized distance
 * @param {Object} avatarPos - Avatar position on map
 * @param {number} avatarPos.x - X position (0-100%)
 * @param {number} avatarPos.y - Y position (0-100%)
 * @returns {Object|null} Applied state or null
 */
export function applyMapZoomOnAvatar(mapEl, distance01, avatarPos) {
  if (!avatarPos) {
    return applyMapZoom(mapEl, distance01);
  }

  return applyMapZoom(mapEl, distance01, {
    focusX: avatarPos.x ?? 50,
    focusY: avatarPos.y ?? 50,
  });
}

/**
 * Remove zoom from a map element
 *
 * @param {HTMLElement} mapEl - Map container element
 */
export function removeMapZoom(mapEl) {
  if (!mapEl) return;

  mapEl.style.transform = '';
  mapEl.style.transformOrigin = '';
  // Keep transition for smooth reset
  mapEl.style.transition = getZoomTransitionCSS() || 'none';
}

/**
 * Create a zoom controller for continuous updates
 *
 * Returns an object with update() and destroy() methods.
 * Useful for binding to state changes.
 *
 * @param {HTMLElement} mapEl - Map container element
 * @returns {Object} Zoom controller
 */
export function createMapZoomController(mapEl) {
  let lastZoomLevel = 1;
  let isDestroyed = false;

  function update(distance01, avatarPos = null) {
    if (isDestroyed || !isEnabled()) {
      return null;
    }

    const state = avatarPos
      ? applyMapZoomOnAvatar(mapEl, distance01, avatarPos)
      : applyMapZoom(mapEl, distance01);

    if (state) {
      lastZoomLevel = state.zoomLevel;
    }

    return state;
  }

  function getZoomLevel() {
    return lastZoomLevel;
  }

  function destroy() {
    isDestroyed = true;
    removeMapZoom(mapEl);
  }

  return {
    update,
    getZoomLevel,
    destroy,
  };
}

/**
 * Get system status
 * @returns {Object} Status object
 */
export function getSystemStatus() {
  return {
    enabled: isEnabled(),
    version: 'v2',
    featureFlag: 'enableMapZoom',
    zoomRange: [ZOOM_CONFIG.MIN_ZOOM, ZOOM_CONFIG.MAX_ZOOM],
    transitionMs: ZOOM_CONFIG.TRANSITION_MS,
    note: 'Map zoom is visual only and does not affect world logic.',
  };
}

export default {
  ZOOM_CONFIG,
  deriveMapZoom,
  getZoomTransformCSS,
  getZoomTransitionCSS,
  applyMapZoom,
  applyMapZoomOnAvatar,
  removeMapZoom,
  createMapZoomController,
  getSystemStatus,
  isEnabled,
};
