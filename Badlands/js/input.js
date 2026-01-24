/**
 * BADLANDS: Input System
 *
 * Mobile-first touch controls with desktop fallback.
 *
 * Control Scheme:
 * - Left side tap: JUMP (tap = jump, hold = charge jump)
 * - Right side tap: ATTACK / ABILITY
 * - Swipe up: High jump (Rogue dash)
 * - Swipe down: Slide / Duck
 * - Swipe right: Boost (uses momentum)
 *
 * Why this suits momentum gameplay:
 * - Simple binary inputs keep player focused on timing
 * - Hold mechanic allows timing without precision
 * - Swipes for special moves don't interrupt flow
 * - No virtual joystick = no precision fiddling
 */

const InputSystem = (() => {
  // Input state
  const state = {
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    attackPressed: false,
    attackHeld: false,
    swipeUp: false,
    swipeDown: false,
    swipeRight: false,
    swipeLeft: false
  };

  // Touch tracking
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let leftTouchId = null;
  let rightTouchId = null;

  // Swipe thresholds
  const SWIPE_THRESHOLD = 50;
  const SWIPE_TIME_LIMIT = 300;

  // Key bindings (desktop fallback)
  const keyBindings = {
    jump: ['Space', 'KeyW', 'ArrowUp'],
    attack: ['KeyJ', 'KeyX', 'Enter'],
    swipeUp: ['KeyW', 'ArrowUp'],
    swipeDown: ['KeyS', 'ArrowDown'],
    swipeRight: ['KeyD', 'ArrowRight'],
    swipeLeft: ['KeyA', 'ArrowLeft'],
    pause: ['Escape', 'KeyP'],
    debug: ['KeyD']
  };

  // Pressed keys this frame
  const keysPressed = new Set();
  const keysHeld = new Set();

  // Callbacks
  let onJump = null;
  let onAttack = null;
  let onSwipe = null;
  let onPause = null;
  let onDebugToggle = null;

  /**
   * Initialize input listeners
   */
  function init() {
    // Touch events
    const leftZone = document.getElementById('touch-left');
    const rightZone = document.getElementById('touch-right');

    if (leftZone) {
      leftZone.addEventListener('touchstart', handleLeftTouchStart, { passive: false });
      leftZone.addEventListener('touchend', handleLeftTouchEnd, { passive: false });
      leftZone.addEventListener('touchcancel', handleLeftTouchEnd, { passive: false });
    }

    if (rightZone) {
      rightZone.addEventListener('touchstart', handleRightTouchStart, { passive: false });
      rightZone.addEventListener('touchend', handleRightTouchEnd, { passive: false });
      rightZone.addEventListener('touchcancel', handleRightTouchEnd, { passive: false });
    }

    // Global touch for swipes
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Prevent context menu on long press
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    console.log('[Input] Initialized');
  }

  /**
   * Handle left zone touch start (jump)
   */
  function handleLeftTouchStart(e) {
    e.preventDefault();
    if (leftTouchId !== null) return;

    const touch = e.changedTouches[0];
    leftTouchId = touch.identifier;

    state.jumpPressed = true;
    state.jumpHeld = true;
    state.jumpReleased = false;

    if (onJump) onJump('start');
  }

  /**
   * Handle left zone touch end
   */
  function handleLeftTouchEnd(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      if (touch.identifier === leftTouchId) {
        leftTouchId = null;
        state.jumpHeld = false;
        state.jumpReleased = true;
        if (onJump) onJump('end');
        break;
      }
    }
  }

  /**
   * Handle right zone touch start (attack)
   */
  function handleRightTouchStart(e) {
    e.preventDefault();
    if (rightTouchId !== null) return;

    const touch = e.changedTouches[0];
    rightTouchId = touch.identifier;

    state.attackPressed = true;
    state.attackHeld = true;

    if (onAttack) onAttack();
  }

  /**
   * Handle right zone touch end
   */
  function handleRightTouchEnd(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      if (touch.identifier === rightTouchId) {
        rightTouchId = null;
        state.attackHeld = false;
        break;
      }
    }
  }

  /**
   * Handle global touch start (for swipes)
   */
  function handleTouchStart(e) {
    // Don't track if we're on a button
    if (e.target.closest('button')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = performance.now();
  }

  /**
   * Handle touch move
   */
  function handleTouchMove(e) {
    // Could use for continuous swipe detection
  }

  /**
   * Handle global touch end (detect swipes)
   */
  function handleTouchEnd(e) {
    if (touchStartTime === 0) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const elapsed = performance.now() - touchStartTime;

    if (elapsed > SWIPE_TIME_LIMIT) {
      touchStartTime = 0;
      return;
    }

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Detect swipe direction
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
          state.swipeRight = true;
          if (onSwipe) onSwipe('right');
        } else {
          state.swipeLeft = true;
          if (onSwipe) onSwipe('left');
        }
      } else {
        // Vertical swipe
        if (deltaY < 0) {
          state.swipeUp = true;
          if (onSwipe) onSwipe('up');
        } else {
          state.swipeDown = true;
          if (onSwipe) onSwipe('down');
        }
      }
    }

    touchStartTime = 0;
  }

  /**
   * Handle key down
   */
  function handleKeyDown(e) {
    const code = e.code;

    // Prevent default for game keys
    if (keyBindings.jump.includes(code) ||
        keyBindings.attack.includes(code)) {
      e.preventDefault();
    }

    // Skip if already held
    if (keysHeld.has(code)) return;

    keysHeld.add(code);
    keysPressed.add(code);

    // Map to actions
    if (keyBindings.jump.includes(code)) {
      state.jumpPressed = true;
      state.jumpHeld = true;
      if (onJump) onJump('start');
    }

    if (keyBindings.attack.includes(code)) {
      state.attackPressed = true;
      state.attackHeld = true;
      if (onAttack) onAttack();
    }

    if (keyBindings.pause.includes(code)) {
      if (onPause) onPause();
    }

    // Debug toggle (Shift+D)
    if (code === 'KeyD' && e.shiftKey) {
      if (onDebugToggle) onDebugToggle();
    }
  }

  /**
   * Handle key up
   */
  function handleKeyUp(e) {
    const code = e.code;
    keysHeld.delete(code);

    if (keyBindings.jump.includes(code)) {
      state.jumpHeld = false;
      state.jumpReleased = true;
      if (onJump) onJump('end');
    }

    if (keyBindings.attack.includes(code)) {
      state.attackHeld = false;
    }
  }

  /**
   * Clear per-frame input states
   * Called at end of each game loop
   */
  function clear() {
    state.jumpPressed = false;
    state.jumpReleased = false;
    state.attackPressed = false;
    state.swipeUp = false;
    state.swipeDown = false;
    state.swipeRight = false;
    state.swipeLeft = false;
    keysPressed.clear();
  }

  /**
   * Get current input state (readonly copy)
   */
  function getState() {
    return { ...state };
  }

  /**
   * Check if jump was just pressed this frame
   */
  function isJumpPressed() {
    return state.jumpPressed;
  }

  /**
   * Check if jump is being held
   */
  function isJumpHeld() {
    return state.jumpHeld;
  }

  /**
   * Check if jump was just released
   */
  function isJumpReleased() {
    return state.jumpReleased;
  }

  /**
   * Check if attack was just pressed
   */
  function isAttackPressed() {
    return state.attackPressed;
  }

  /**
   * Check if attack is being held
   */
  function isAttackHeld() {
    return state.attackHeld;
  }

  /**
   * Check for swipe in direction
   */
  function isSwipe(direction) {
    switch (direction) {
      case 'up': return state.swipeUp;
      case 'down': return state.swipeDown;
      case 'left': return state.swipeLeft;
      case 'right': return state.swipeRight;
      default: return false;
    }
  }

  /**
   * Register callbacks
   */
  function setCallbacks({ jump, attack, swipe, pause, debug }) {
    if (jump) onJump = jump;
    if (attack) onAttack = attack;
    if (swipe) onSwipe = swipe;
    if (pause) onPause = pause;
    if (debug) onDebugToggle = debug;
  }

  // Public API
  return {
    init,
    clear,
    getState,
    isJumpPressed,
    isJumpHeld,
    isJumpReleased,
    isAttackPressed,
    isAttackHeld,
    isSwipe,
    setCallbacks
  };
})();
