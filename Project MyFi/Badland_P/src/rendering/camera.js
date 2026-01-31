// camera.js — Side-Scroller Camera
// Follows player with smooth interpolation and height-based zoom
// Supports extreme vertical gameplay (sky platforms at Y=-150)

// Camera constants
const FOLLOW_SPEED = 5; // Interpolation speed
const LOOK_AHEAD = 200; // How far ahead of player to look
const VERTICAL_DEAD_ZONE = 80; // Vertical dead zone (reduced for more responsive vertical tracking)

// Zoom constants for height-based scaling
// Supports 4 tiers: ground (~450), low (350-420), mid (220-340), high (80-200), sky (-150 to 60)
const BASE_ZOOM = 1.0; // Normal zoom level (at ground)
const MIN_ZOOM = 0.5; // Maximum zoom out (at sky tier)
const HEIGHT_THRESHOLD = 350; // Y position below which we start zooming out
const HEIGHT_ZOOM_RANGE = 600; // Range over which zoom scales (covers ground to sky)
const ZOOM_SMOOTHING = 2.5; // How smoothly zoom transitions (slightly faster for vertical play)

/**
 * Create the camera
 */
export function createCamera(viewportWidth, viewportHeight) {
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  let width = viewportWidth;
  let height = viewportHeight;

  // Zoom state
  let zoom = BASE_ZOOM;
  let targetZoom = BASE_ZOOM;

  /**
   * Follow a target position
   */
  function follow(target, dt) {
    // Target X is ahead of player
    targetX = target.x - width * 0.3 + LOOK_AHEAD;

    // Target Y tries to keep player in vertical center with dead zone
    // More responsive vertical tracking for multi-tier gameplay
    const centerY = height / 2;
    const playerScreenY = target.y - y;

    if (Math.abs(playerScreenY - centerY) > VERTICAL_DEAD_ZONE) {
      targetY = target.y - centerY;
    }

    // Calculate target zoom based on height
    // Lower Y = higher in the level = more zoom out
    // Supports sky tier at Y=-150
    if (target.y < HEIGHT_THRESHOLD) {
      // Player is above threshold, zoom out proportionally
      const heightAboveThreshold = HEIGHT_THRESHOLD - target.y;
      const zoomFactor = Math.min(1, heightAboveThreshold / HEIGHT_ZOOM_RANGE);
      targetZoom = BASE_ZOOM - (BASE_ZOOM - MIN_ZOOM) * zoomFactor;
    } else {
      // Player is at or below threshold, use base zoom
      targetZoom = BASE_ZOOM;
    }

    // Smooth zoom interpolation (prevent sudden jumps)
    zoom += (targetZoom - zoom) * ZOOM_SMOOTHING * dt;
    zoom = Math.max(MIN_ZOOM, Math.min(BASE_ZOOM, zoom));

    // Smooth position interpolation
    x += (targetX - x) * FOLLOW_SPEED * dt;
    y += (targetY - y) * FOLLOW_SPEED * dt;

    // Adjust Y clamp based on zoom - supports extreme heights
    // At max zoom out, can see from Y=-300 to Y=500+
    const zoomOutFactor = (BASE_ZOOM - zoom) / (BASE_ZOOM - MIN_ZOOM); // 0 to 1
    const minY = -300 * zoomOutFactor; // Allow seeing sky tier
    const maxY = 200 + zoomOutFactor * 200;
    y = Math.max(minY, Math.min(maxY, y));
  }

  /**
   * Reset camera to origin
   */
  function reset() {
    x = 0;
    y = 0;
    targetX = 0;
    targetY = 0;
  }

  /**
   * Resize viewport
   */
  function resize(w, h) {
    width = w;
    height = h;
  }

  /**
   * Get camera offset for rendering
   */
  function getOffset() {
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  /**
   * Get visible range in world coordinates
   */
  function getVisibleRange() {
    return {
      minX: x,
      maxX: x + width,
      minY: y,
      maxY: y + height,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  function worldToScreen(worldX, worldY) {
    return {
      x: worldX - x,
      y: worldY - y,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  function screenToWorld(screenX, screenY) {
    return {
      x: screenX + x,
      y: screenY + y,
    };
  }

  return {
    follow,
    reset,
    resize,
    getOffset,
    getVisibleRange,
    worldToScreen,
    screenToWorld,
    getZoom: () => zoom,
    get x() { return x; },
    get y() { return y; },
    get width() { return width; },
    get height() { return height; },
    get zoom() { return zoom; },
  };
}

export default { createCamera };
