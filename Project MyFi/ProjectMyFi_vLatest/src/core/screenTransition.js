/**
 * screenTransition.js - Animated screen transition system
 *
 * Provides smooth slide animations between screens based on navigation direction.
 */

// Current pending transition direction
let pendingDirection = null;

// Direction to CSS transform mappings
const DIRECTION_TRANSFORMS = {
  left: { exit: 'translateX(-100%)', enter: 'translateX(100%)' },   // Slide left: current goes left, new from right
  right: { exit: 'translateX(100%)', enter: 'translateX(-100%)' },  // Slide right: current goes right, new from left
  up: { exit: 'translateY(-100%)', enter: 'translateY(100%)' },     // Slide up: current goes up, new from bottom
  down: { exit: 'translateY(100%)', enter: 'translateY(-100%)' },   // Slide down: current goes down, new from top
};

// Timing
const TRANSITION_DURATION = 300; // ms

/**
 * Set the direction for the next transition
 * Call this before navigation to animate the transition
 * @param {'left'|'right'|'up'|'down'|null} direction
 */
export function setTransitionDirection(direction) {
  pendingDirection = direction;
}

/**
 * Get and clear the pending transition direction
 * @returns {'left'|'right'|'up'|'down'|null}
 */
export function consumeTransitionDirection() {
  const dir = pendingDirection;
  pendingDirection = null;
  return dir;
}

/**
 * Perform an animated transition between screens
 * @param {HTMLElement} hostEl - Container element
 * @param {HTMLElement} oldContent - Current screen content (will be removed)
 * @param {HTMLElement} newContent - New screen content (will be added)
 * @param {'left'|'right'|'up'|'down'} direction - Direction of transition
 * @returns {Promise} Resolves when animation completes
 */
export function animateTransition(hostEl, oldContent, newContent, direction) {
  return new Promise((resolve) => {
    const transforms = DIRECTION_TRANSFORMS[direction];

    if (!transforms || !oldContent) {
      // No animation, just swap
      if (oldContent?.parentNode) oldContent.remove();
      if (!newContent.parentNode) hostEl.appendChild(newContent);
      resolve();
      return;
    }

    // Setup container for animation
    hostEl.style.position = 'relative';
    hostEl.style.overflow = 'hidden';

    // Position old content absolutely for exit animation
    oldContent.style.position = 'absolute';
    oldContent.style.top = '0';
    oldContent.style.left = '0';
    oldContent.style.right = '0';
    oldContent.style.bottom = '0';
    oldContent.style.transition = `transform ${TRANSITION_DURATION}ms ease-out`;
    oldContent.style.zIndex = '1';
    oldContent.style.width = '100%';
    oldContent.style.height = '100%';

    // Setup new content with enter start position (already in DOM from router)
    newContent.style.position = 'absolute';
    newContent.style.top = '0';
    newContent.style.left = '0';
    newContent.style.right = '0';
    newContent.style.bottom = '0';
    newContent.style.transform = transforms.enter;
    newContent.style.transition = `transform ${TRANSITION_DURATION}ms ease-out`;
    newContent.style.zIndex = '2';
    newContent.style.width = '100%';
    newContent.style.height = '100%';

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        oldContent.style.transform = transforms.exit;
        newContent.style.transform = 'translate(0, 0)';
      });
    });

    // Cleanup after animation
    setTimeout(() => {
      if (oldContent.parentNode) oldContent.remove();

      // Reset new content positioning but preserve flex container behavior
      newContent.style.position = '';
      newContent.style.top = '';
      newContent.style.left = '';
      newContent.style.right = '';
      newContent.style.bottom = '';
      newContent.style.transform = '';
      newContent.style.transition = '';
      newContent.style.zIndex = '';
      // Preserve full dimensions for flex layout
      newContent.style.width = '100%';
      newContent.style.height = '100%';

      // Reset host
      hostEl.style.overflow = '';

      resolve();
    }, TRANSITION_DURATION + 50);
  });
}

export default {
  setTransitionDirection,
  consumeTransitionDirection,
  animateTransition,
};
