// camera.js — Side-Scroller Camera
// Follows player with smooth interpolation

// Camera constants
const FOLLOW_SPEED = 5; // Interpolation speed
const LOOK_AHEAD = 200; // How far ahead of player to look
const VERTICAL_DEAD_ZONE = 100; // Vertical dead zone

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

  /**
   * Follow a target position
   */
  function follow(target, dt) {
    // Target X is ahead of player
    targetX = target.x - width * 0.3 + LOOK_AHEAD;

    // Target Y tries to keep player in vertical center with dead zone
    const centerY = height / 2;
    const playerScreenY = target.y - y;

    if (Math.abs(playerScreenY - centerY) > VERTICAL_DEAD_ZONE) {
      targetY = target.y - centerY;
    }

    // Smooth interpolation
    x += (targetX - x) * FOLLOW_SPEED * dt;
    y += (targetY - y) * FOLLOW_SPEED * dt;

    // Clamp Y to prevent seeing above ground
    y = Math.max(0, Math.min(200, y));
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
    get x() { return x; },
    get y() { return y; },
    get width() { return width; },
    get height() { return height; },
  };
}

export default { createCamera };
