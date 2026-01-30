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
 * - Swipe left  → quests (reveal from west/left)
 * - Swipe right → avatar (reveal from east/right)
 * - Swipe up    → badlands (reveal from south/bottom)
 * - Swipe down  → guidance (reveal from north/top)
 *
 * Interactive dragging: Screen follows finger during swipe
 */

import { emit } from './actionBus.js';
import { setTransitionDirection } from './screenTransition.js';

// Navigation map from each screen
// Conceptual layout:  Quests (W) -- HUB -- Avatar (E)
// Swipe direction reveals screen from that side:
// - Swipe left  → Avatar (pull from east/right)
// - Swipe right → Quests (pull from west/left)
const NAV_MAP = {
  hub: {
    left: 'avatar',     // Swipe left reveals Avatar (from right)
    right: 'quests',    // Swipe right reveals Quests (from left)
    up: 'badlands',
    down: 'guidance'
  },
  quests: {
    left: 'hub'         // Swipe left from Quests returns to Hub
  },
  avatar: {
    right: 'hub'        // Swipe right from Avatar returns to Hub
  },
  guidance: {
    up: 'hub'
  },
  badlands: {
    down: 'hub'
  }
};

// Edge positions for glow feedback
const EDGE_MAP = {
  left: 'edge-right',
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
  let lockedAxis = null;
  let tracking = false;
  let interactiveDrag = false; // Track if we're in interactive drag mode

  // Thresholds
  const AXIS_LOCK_THRESHOLD = 10;
  const SWIPE_THRESHOLD = 60;      // px minimum for swipe commit
  const VELOCITY_THRESHOLD = 0.25;  // px/ms minimum velocity
  const MAX_DRAG_DISTANCE = 150;    // Max visual drag distance (parallax feel)

  // Edge glow elements
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

  function hideAllEdgeGlows() {
    if (!edgeGlows) return;
    edgeGlows.querySelectorAll('.swipe-edge-glow').forEach(el => {
      el.classList.remove('active');
      el.style.setProperty('--glow-intensity', '0');
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

  // Get the surface host element for interactive dragging
  function getSurfaceHost() {
    return hostEl.querySelector('.chrome__surfaceHost');
  }

  // Apply interactive drag transform to the surface
  function applyDragTransform(deltaX, deltaY, direction) {
    const surfaceHost = getSurfaceHost();
    if (!surfaceHost) return;

    // Calculate drag amount with easing (resistance at edges)
    let dragX = 0;
    let dragY = 0;

    if (lockedAxis === 'x') {
      const sign = deltaX > 0 ? 1 : -1;
      const absDelta = Math.abs(deltaX);
      // Apply resistance curve for parallax feel
      dragX = sign * Math.min(absDelta * 0.5, MAX_DRAG_DISTANCE);
    } else if (lockedAxis === 'y') {
      const sign = deltaY > 0 ? 1 : -1;
      const absDelta = Math.abs(deltaY);
      dragY = sign * Math.min(absDelta * 0.5, MAX_DRAG_DISTANCE);
    }

    surfaceHost.style.transition = 'none';
    surfaceHost.style.transform = `translate(${dragX}px, ${dragY}px)`;
  }

  // Reset drag transform with animation
  function resetDragTransform(animate = true) {
    const surfaceHost = getSurfaceHost();
    if (!surfaceHost) return;

    if (animate) {
      surfaceHost.style.transition = 'transform 250ms ease-out';
    }
    surfaceHost.style.transform = '';

    // Cleanup after animation
    if (animate) {
      setTimeout(() => {
        surfaceHost.style.transition = '';
      }, 260);
    }
  }

  function handleStart(e) {
    if (!enabled) return;

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
    interactiveDrag = false;

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

    // Check if navigation is possible
    const canNav = canNavigate(direction);

    // Prevent scroll if this is a valid navigation swipe
    if (canNav && e.cancelable) {
      e.preventDefault();
    }

    // Apply interactive drag effect if valid navigation
    if (canNav) {
      interactiveDrag = true;
      applyDragTransform(deltaX, deltaY, direction);
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
      if (interactiveDrag) resetDragTransform(true);
      emit('swipe:cancel', { reason: 'no-axis-lock' });
      return;
    }

    const direction = getSwipeDirection(deltaX, deltaY);
    const distance = lockedAxis === 'x' ? absDeltaX : absDeltaY;
    const velocity = distance / elapsed;

    // Check if navigation is possible
    const targetRoute = canNavigate(direction);

    // Determine if swipe qualifies for navigation
    const meetsThreshold = distance >= SWIPE_THRESHOLD;
    const meetsVelocity = velocity >= VELOCITY_THRESHOLD;
    const shouldNavigate = targetRoute && meetsThreshold && meetsVelocity;

    if (shouldNavigate) {
      // Reset transform immediately (navigation will handle transition)
      resetDragTransform(false);

      // Navigate with transition
      emit('swipe:navigate', { direction, target: targetRoute, velocity });
      setTransitionDirection(direction);
      navigate(targetRoute);
    } else {
      // Snap back with animation
      if (interactiveDrag) {
        resetDragTransform(true);
      }

      if (!targetRoute) {
        emit('swipe:blocked', { direction, currentRoute: getCurrentRoute() });
      } else if (!meetsThreshold) {
        emit('swipe:cancel', { reason: 'below-threshold', distance });
      } else {
        emit('swipe:cancel', { reason: 'too-slow', velocity });
      }
    }

    interactiveDrag = false;
  }

  function handleCancel() {
    tracking = false;
    lockedAxis = null;
    if (interactiveDrag) {
      resetDragTransform(true);
    }
    interactiveDrag = false;
    hideAllEdgeGlows();
    emit('swipe:cancel', { reason: 'touch-cancel' });
  }

  function attach() {
    hostEl.addEventListener('touchstart', handleStart, { passive: true });
    hostEl.addEventListener('touchmove', handleMove, { passive: false });
    hostEl.addEventListener('touchend', handleEnd, { passive: true });
    hostEl.addEventListener('touchcancel', handleCancel, { passive: true });

    hostEl.addEventListener('pointerdown', handleStart, { passive: true });
    hostEl.addEventListener('pointermove', handleMove, { passive: false });
    hostEl.addEventListener('pointerup', handleEnd, { passive: true });
    hostEl.addEventListener('pointercancel', handleCancel, { passive: true });

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
