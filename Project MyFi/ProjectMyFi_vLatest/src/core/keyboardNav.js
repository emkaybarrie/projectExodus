// keyboardNav.js — Keyboard navigation for cross-layout screens
// Arrow keys navigate between screens in a cross pattern centered on hub
//
// Layout:
//           guidance (north)
//              ↑
//   quests ←  hub  → avatar
//              ↓
//          badlands (south)

import { setTransitionDirection } from './screenTransition.js';

// Navigation map: currentScreen → { arrowKey → targetScreen }
const NAVIGATION_MAP = {
  hub: {
    ArrowUp: 'guidance',
    ArrowDown: 'badlands',
    ArrowLeft: 'quests',
    ArrowRight: 'avatar',
  },
  guidance: {
    ArrowDown: 'hub',
  },
  badlands: {
    ArrowUp: 'hub',
  },
  quests: {
    ArrowRight: 'hub',
  },
  avatar: {
    ArrowLeft: 'hub',
  },
};

// Transition directions for smooth animations
// Maps: (from, to) → transitionDirection
// The direction indicates where new content enters from
const TRANSITION_DIRECTIONS = {
  // From hub to outer screens
  'hub→guidance': 'down',    // Going north, content enters from top
  'hub→badlands': 'up',      // Going south, content enters from bottom
  'hub→quests': 'right',     // Going west, content enters from left
  'hub→avatar': 'left',      // Going east, content enters from right
  // From outer screens back to hub
  'guidance→hub': 'up',      // Going south, content enters from bottom
  'badlands→hub': 'down',    // Going north, content enters from top
  'quests→hub': 'left',      // Going east, content enters from right
  'avatar→hub': 'right',     // Going west, content enters from left
};

// Module state
let actionBus = null;
let enabled = true;
let boundHandler = null;

/**
 * Get current route from location hash
 */
function getCurrentRoute() {
  return location.hash.replace(/^#/, '') || 'hub';
}

/**
 * Get transition direction for a navigation
 */
function getTransitionDirection(from, to) {
  const key = `${from}→${to}`;
  return TRANSITION_DIRECTIONS[key] || null;
}

/**
 * Check if any modal is currently visible
 */
function isModalOpen() {
  // Check for Chrome modals (compass, spirit stone, energy, socials, dev config)
  const chromeModals = document.querySelectorAll(
    '[data-role="compassModal"]:not([hidden]),' +
    '[data-role="spiritStoneModal"]:not([hidden]),' +
    '[data-role="energyModal"]:not([hidden]),' +
    '[data-role="socialsModal"]:not([hidden]),' +
    '[data-role="devConfigModal"]:not([hidden]),' +
    '[data-role="modalHost"]:not([hidden])'
  );
  return chromeModals.length > 0;
}

/**
 * Handle keydown events
 */
function handleKeydown(event) {
  if (!enabled) return;

  // Ignore if user is typing in an input field
  const target = event.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  // Ignore if modifier keys are pressed (allow browser shortcuts)
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  // Ignore if a modal is open
  if (isModalOpen()) {
    return;
  }

  // Only handle arrow keys
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return;
  }

  const currentRoute = getCurrentRoute();
  const navOptions = NAVIGATION_MAP[currentRoute];

  if (!navOptions) {
    console.log(`[KeyboardNav] No navigation options for route: ${currentRoute}`);
    return;
  }

  const targetRoute = navOptions[event.key];

  if (!targetRoute) {
    console.log(`[KeyboardNav] No target for ${event.key} from ${currentRoute}`);
    return;
  }

  // Prevent default browser behavior (scrolling)
  event.preventDefault();

  // Get transition direction
  const transitionDir = getTransitionDirection(currentRoute, targetRoute);

  console.log(`[KeyboardNav] ${event.key}: ${currentRoute} → ${targetRoute} (transition: ${transitionDir})`);

  // Set transition direction for animation
  if (transitionDir) {
    setTransitionDirection(transitionDir);
  }

  // Emit navigation action for journey system
  if (actionBus) {
    actionBus.emit('nav:keyboard', {
      key: event.key,
      from: currentRoute,
      to: targetRoute,
      transitionDir,
    }, 'keyboardNav');
  }
}

/**
 * Initialize keyboard navigation
 * @param {object} ctx - { actionBus }
 */
export function init(ctx) {
  if (boundHandler) {
    console.warn('[KeyboardNav] Already initialized');
    return;
  }

  actionBus = ctx.actionBus;

  boundHandler = handleKeydown;
  document.addEventListener('keydown', boundHandler);

  console.log('[KeyboardNav] Initialized - arrow keys navigate between screens');
}

/**
 * Destroy keyboard navigation
 */
export function destroy() {
  if (boundHandler) {
    document.removeEventListener('keydown', boundHandler);
    boundHandler = null;
  }
  actionBus = null;
  enabled = true;
}

/**
 * Enable keyboard navigation
 */
export function enable() {
  enabled = true;
  console.log('[KeyboardNav] Enabled');
}

/**
 * Disable keyboard navigation (e.g., when modal is open)
 */
export function disable() {
  enabled = false;
  console.log('[KeyboardNav] Disabled');
}

/**
 * Check if keyboard navigation is enabled
 */
export function isEnabled() {
  return enabled;
}

/**
 * Get the navigation map (for testing/debugging)
 */
export function getNavigationMap() {
  return NAVIGATION_MAP;
}

export default {
  init,
  destroy,
  enable,
  disable,
  isEnabled,
  getNavigationMap,
};
