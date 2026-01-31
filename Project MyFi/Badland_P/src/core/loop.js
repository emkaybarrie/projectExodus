// loop.js — Game Loop Manager
// Fixed timestep with interpolation for smooth rendering

const TARGET_FPS = 60;
const FIXED_DT = 1000 / TARGET_FPS; // ~16.67ms
const MAX_FRAME_TIME = 250; // Max time per frame to prevent spiral of death

/**
 * Create a game loop with fixed timestep updates
 */
export function createGameLoop({ update, render }) {
  let isRunning = false;
  let rafId = null;
  let lastTime = 0;
  let accumulator = 0;

  /**
   * Main loop tick
   */
  function tick(currentTime) {
    if (!isRunning) return;

    // Calculate delta time
    let frameTime = currentTime - lastTime;
    lastTime = currentTime;

    // Clamp to prevent spiral of death
    if (frameTime > MAX_FRAME_TIME) {
      frameTime = MAX_FRAME_TIME;
    }

    accumulator += frameTime;

    // Fixed timestep updates
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT / 1000); // Convert to seconds
      accumulator -= FIXED_DT;
    }

    // Render (can happen at any rate)
    render();

    // Schedule next frame
    rafId = requestAnimationFrame(tick);
  }

  /**
   * Start the game loop
   */
  function start() {
    if (isRunning) return;
    isRunning = true;
    lastTime = performance.now();
    accumulator = 0;
    rafId = requestAnimationFrame(tick);
    console.log('[GameLoop] Started');
  }

  /**
   * Stop the game loop
   */
  function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    console.log('[GameLoop] Stopped');
  }

  /**
   * Check if loop is running
   */
  function getIsRunning() {
    return isRunning;
  }

  return {
    start,
    stop,
    isRunning: getIsRunning,
  };
}

export default { createGameLoop };
