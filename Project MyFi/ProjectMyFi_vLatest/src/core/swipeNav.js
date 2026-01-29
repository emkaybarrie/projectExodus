/**
 * SwipeNav - Cross Swipe Navigation System
 *
 * Hub-centred cross layout:
 *        guidance (N)
 *            |
 * avatar (W)--HUB--quests (E)
 *            |
 *       badlands (S)
 *
 * Swipe direction maps to navigation (pull-to-reveal):
 * - Swipe left  → avatar (pull from west)
 * - Swipe right → quests (pull from east)
 * - Swipe up    → badlands (pull from south)
 * - Swipe down  → guidance (pull from north)
 */

import { emit } from './actionBus.js';
import { setTransitionDirection } from './screenTransition.js';

// Navigation map from each screen
// Swipe direction maps to screen reveal:
// - Swipe left  → avatar (reveal from west/left)
// - Swipe right → quests (reveal from east/right)
// - Swipe up    → badlands (reveal from south/bottom)
// - Swipe down  → guidance (reveal from north/top)
const NAV_MAP = {
  hub: {
    left: 'avatar',
    right: 'quests',
    up: 'badlands',
    down: 'guidance'
  },
  quests: {
    left: 'hub'   // Can only go back to hub
  },
  avatar: {
    right: 'hub'  // Can only go back to hub
  },
  guidance: {
    up: 'hub'     // Can only go back to hub (swipe up to return)
  },
  badlands: {
    down: 'hub'   // Can only go back to hub (swipe down to return)
  }
};

// Edge positions for glow feedback
const EDGE_MAP = {
  left: 'edge-right',   // Swiping left reveals right edge glow
  right: 'edge-left',
  up: 'edge-bottom',
  down: 'edge-top'
};

/**
 * Create swipe navigation controller
 * @param {HTMLElement} hostEl - Element to attach listeners to
 * @param {Object} options
 * @param {Function} options.navigate - Navigation function (surfaceId) => void
 * @param {Function} options.getCurrentRoute - Returns current surface ID
 * @returns {Object} Controller with enable/disable/destroy methods
 */
export function createSwipeNav(hostEl, { navigate, getCurrentRoute }) {
  let enabled = true;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lockedAxis = null; // 'x' | 'y' | null
  let tracking = false;

  // Thresholds
  const AXIS_LOCK_THRESHOLD = 10;  // px before axis locks
  const SWIPE_THRESHOLD = 50;       // px minimum for swipe
  const VELOCITY_THRESHOLD = 0.3;   // px/ms minimum velocity

  // Edge glow elements (injected into chrome)
  let edgeGlows = null;

  function createEdgeGlows() {
    const container = document.createElement('div');
    container.className = 'swipe-edge-glows';
    container.innerHTML = `
      <div class="swipe-edge-glow edge-top" data-edge="top"></div>
      <div class="swipe-edge-glow edge-right" data-edge="right"></div>
      <div class="swipe-edge-glow edge-bottom" data-edge="bottom"></div>
      <div class="swipe-edge-glow edge-left" data-edge="left"></div>
    `;
    return container;
  }

  function showEdgeGlow(direction) {
    if (!edgeGlows) return;
    const edgeClass = EDGE_MAP[direction];
    const el = edgeGlows.querySelector(`.${edgeClass}`);
    if (el) el.classList.add('active');
  }

  function hideAllEdgeGlows() {
    if (!edgeGlows) return;
    edgeGlows.querySelectorAll('.swipe-edge-glow').forEach(el => {
      el.classList.remove('active');
    });
  }

  function updateEdgeGlowIntensity(direction, progress) {
    if (!edgeGlows) return;
    const edgeClass = EDGE_MAP[direction];
    const el = edgeGlows.querySelector(`.${edgeClass}`);
    if (el) {
      const intensity = Math.min(1, progress / SWIPE_THRESHOLD);
      el.style.setProperty('--glow-intensity', intensity);
      if (intensity > 0.1) {
        el.classList.add('active');
      }
    }
  }

  function getSwipeDirection(deltaX, deltaY) {
    if (lockedAxis === 'x') {
      return deltaX < 0 ? 'left' : 'right';
    } else if (lockedAxis === 'y') {
      return deltaY < 0 ? 'up' : 'down';
    }
    return null;
  }

  function canNavigate(direction) {
    const currentRoute = getCurrentRoute();
    const routes = NAV_MAP[currentRoute];
    return routes && routes[direction];
  }

  function handleStart(e) {
    if (!enabled) return;

    // Ignore if interacting with scrollable content or inputs
    const target = e.target;
    if (target.closest('input, textarea, select, button, a, [data-no-swipe]')) {
      return;
    }

    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    lockedAxis = null;
    tracking = true;

    emit('swipe:start', { x: startX, y: startY });
  }

  function handleMove(e) {
    if (!enabled || !tracking) return;

    const touch = e.touches ? e.touches[0] : e;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Lock axis once threshold exceeded
    if (!lockedAxis) {
      if (absDeltaX > AXIS_LOCK_THRESHOLD || absDeltaY > AXIS_LOCK_THRESHOLD) {
        lockedAxis = absDeltaX > absDeltaY ? 'x' : 'y';
      } else {
        return;
      }
    }

    const direction = getSwipeDirection(deltaX, deltaY);
    if (!direction) return;

    const progress = lockedAxis === 'x' ? absDeltaX : absDeltaY;

    // Prevent scroll if this is a valid navigation swipe
    if (canNavigate(direction) && e.cancelable) {
      e.preventDefault();
    }

    // Show edge glow if navigation is possible
    if (canNavigate(direction)) {
      updateEdgeGlowIntensity(direction, progress);
    }

    emit('swipe:move', { direction, progress, deltaX, deltaY });
  }

  function handleEnd(e) {
    if (!enabled || !tracking) return;
    tracking = false;

    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const elapsed = Date.now() - startTime;

    hideAllEdgeGlows();

    if (!lockedAxis) {
      emit('swipe:cancel', { reason: 'no-axis-lock' });
      return;
    }

    const direction = getSwipeDirection(deltaX, deltaY);
    const distance = lockedAxis === 'x' ? absDeltaX : absDeltaY;
    const velocity = distance / elapsed;

    // Check if swipe qualifies
    if (distance < SWIPE_THRESHOLD) {
      emit('swipe:cancel', { reason: 'below-threshold', distance });
      return;
    }

    if (velocity < VELOCITY_THRESHOLD) {
      emit('swipe:cancel', { reason: 'too-slow', velocity });
      return;
    }

    // Check if navigation is possible
    const targetRoute = canNavigate(direction);
    if (!targetRoute) {
      emit('swipe:blocked', { direction, currentRoute: getCurrentRoute() });
      return;
    }

    // Navigate with transition!
    emit('swipe:navigate', { direction, target: targetRoute, velocity });
    setTransitionDirection(direction);
    navigate(targetRoute);
  }

  function handleCancel() {
    tracking = false;
    lockedAxis = null;
    hideAllEdgeGlows();
    emit('swipe:cancel', { reason: 'touch-cancel' });
  }

  // Attach listeners
  function attach() {
    // Touch events - touchmove must be non-passive to allow preventDefault for swipe
    hostEl.addEventListener('touchstart', handleStart, { passive: true });
    hostEl.addEventListener('touchmove', handleMove, { passive: false });
    hostEl.addEventListener('touchend', handleEnd, { passive: true });
    hostEl.addEventListener('touchcancel', handleCancel, { passive: true });

    // Pointer events for mouse/stylus
    hostEl.addEventListener('pointerdown', handleStart, { passive: true });
    hostEl.addEventListener('pointermove', handleMove, { passive: false });
    hostEl.addEventListener('pointerup', handleEnd, { passive: true });
    hostEl.addEventListener('pointercancel', handleCancel, { passive: true });

    // Inject edge glows
    edgeGlows = createEdgeGlows();
    hostEl.appendChild(edgeGlows);
  }

  function detach() {
    hostEl.removeEventListener('touchstart', handleStart);
    hostEl.removeEventListener('touchmove', handleMove);
    hostEl.removeEventListener('touchend', handleEnd);
    hostEl.removeEventListener('touchcancel', handleCancel);
    hostEl.removeEventListener('pointerdown', handleStart);
    hostEl.removeEventListener('pointermove', handleMove);
    hostEl.removeEventListener('pointerup', handleEnd);
    hostEl.removeEventListener('pointercancel', handleCancel);

    if (edgeGlows && edgeGlows.parentNode) {
      edgeGlows.parentNode.removeChild(edgeGlows);
    }
  }

  // Initialize
  attach();

  return {
    enable() { enabled = true; },
    disable() { enabled = false; },
    destroy() {
      enabled = false;
      detach();
    },
    isEnabled() { return enabled; }
  };
}

export default createSwipeNav;
