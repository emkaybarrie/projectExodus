// touch.js — Touch Input
// Optimized touch controls for mobile endless runner

// ═══════════════════════════════════════════════════════════════════════════
// TOUCH CONTROL SCHEME
//
// ┌─────────────┬─────────────────────────┬─────────────┐
// │   BRAKE     │                         │   THROTTLE  │
// │   (hold)    │     SWIPE UP = JUMP     │   (hold)    │
// │             │     SWIPE DOWN = FALL   │   +attack   │
// │    25%      │          50%            │     25%     │
// └─────────────┴─────────────────────────┴─────────────┘
//
// - SWIPE UP (anywhere) = Jump
// - SWIPE DOWN (anywhere) = Fast fall
// - Left 25% HOLD = Brake (slow down toward 10%)
// - Right 25% HOLD = Accelerate (speed up toward 100%)
// - Right 25% TAP = Attack
// - Center TAP = Jump (alternative)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create touch input handler
 */
export function createTouchInput(canvas) {
  let enabled = true;

  // Current state
  const state = {
    jump: false,
    attack: false,
    skill: false,
    fastFall: false,
    slowDown: false,
    speedUp: false,
  };

  // Press events (single-fire)
  const pressed = {
    jump: false,
    attack: false,
    skill: false,
  };

  // Active touches
  const touches = new Map();

  // Timing/gesture thresholds
  const SWIPE_THRESHOLD = 40;     // pixels to trigger swipe
  const TAP_MAX_DURATION = 250;   // ms - taps must be shorter than this
  const TAP_MAX_MOVE = 20;        // pixels - taps must move less than this

  // Zone boundaries (as fractions of screen width)
  const ZONE_LEFT_END = 0.25;     // 0-25% = brake zone
  const ZONE_RIGHT_START = 0.75;  // 75-100% = throttle zone
  // 25-75% = center jump zone

  /**
   * Get touch zone: 'left' (brake), 'center' (jump), 'right' (throttle)
   */
  function getTouchZone(clientX) {
    const rect = canvas.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;

    if (relativeX < ZONE_LEFT_END) return 'left';
    if (relativeX >= ZONE_RIGHT_START) return 'right';
    return 'center';
  }

  /**
   * Update visual feedback for touch zones
   */
  function updateZoneVisuals(zone, active) {
    const leftZone = document.getElementById('touch-left');
    const centerZone = document.getElementById('touch-center');
    const rightZone = document.getElementById('touch-right');

    // Reset all
    leftZone?.classList.remove('active');
    centerZone?.classList.remove('active');
    rightZone?.classList.remove('active');

    // Activate touched zone
    if (active) {
      if (zone === 'left') leftZone?.classList.add('active');
      else if (zone === 'center') centerZone?.classList.add('active');
      else if (zone === 'right') rightZone?.classList.add('active');
    }
  }

  /**
   * Handle touch start
   */
  function onTouchStart(e) {
    if (!enabled) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      const zone = getTouchZone(touch.clientX);

      touches.set(touch.identifier, {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now(),
        zone,
        hasMoved: false,
        wasProcessedAsTap: false,
      });

      // Immediate state based on zone (hold actions only)
      switch (zone) {
        case 'left':
          // Brake zone - hold to slow down
          state.slowDown = true;
          updateZoneVisuals('left', true);
          break;

        case 'center':
          // Center zone - no immediate action, wait for tap or swipe
          updateZoneVisuals('center', true);
          break;

        case 'right':
          // Throttle zone - hold to speed up
          state.speedUp = true;
          updateZoneVisuals('right', true);
          break;
      }
    }
  }

  /**
   * Handle touch move
   */
  function onTouchMove(e) {
    if (!enabled) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      const data = touches.get(touch.identifier);
      if (!data) continue;

      data.currentX = touch.clientX;
      data.currentY = touch.clientY;

      const dx = touch.clientX - data.startX;
      const dy = touch.clientY - data.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Mark as moved if beyond tap threshold
      if (distance > TAP_MAX_MOVE) {
        data.hasMoved = true;
      }

      // Detect swipe gestures (work from anywhere on screen)
      if (distance > SWIPE_THRESHOLD) {
        // Vertical swipe detection
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy < -SWIPE_THRESHOLD) {
            // Swipe UP (anywhere) = Jump
            state.jump = true;
            pressed.jump = true;
            data.wasProcessedAsTap = true; // Prevent tap action
          } else if (dy > SWIPE_THRESHOLD) {
            // Swipe DOWN (anywhere) = Fast fall
            state.fastFall = true;
          }
        }
      }

      // Check if touch moved to a different zone
      const currentZone = getTouchZone(touch.clientX);
      if (currentZone !== data.zone) {
        // Clear old zone state
        clearZoneState(data.zone);
        // Set new zone state
        data.zone = currentZone;
        applyZoneState(currentZone, true);
        updateZoneVisuals(currentZone, true);
      }
    }
  }

  /**
   * Handle touch end
   */
  function onTouchEnd(e) {
    if (!enabled) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      const data = touches.get(touch.identifier);
      if (!data) continue;

      const duration = Date.now() - data.startTime;
      const isTap = !data.hasMoved && duration < TAP_MAX_DURATION;

      // Handle tap actions
      if (isTap && !data.wasProcessedAsTap) {
        switch (data.zone) {
          case 'right':
            // Tap on right = attack
            state.attack = true;
            pressed.attack = true;
            // Brief attack state
            setTimeout(() => {
              state.attack = false;
            }, 100);
            break;

          case 'center':
            // Tap on center = jump (alternative to swipe up)
            pressed.jump = true;
            break;

          case 'left':
            // Tap on left = no action (brake only on hold)
            break;
        }
      }

      // Clear zone state
      clearZoneState(data.zone);
      updateZoneVisuals(data.zone, false);

      // Remove touch
      touches.delete(touch.identifier);
    }

    // Reset states if no more touches
    if (touches.size === 0) {
      resetAllStates();
    }

    // Update visuals based on remaining touches
    updateVisualsFromActiveTouches();
  }

  /**
   * Handle touch cancel
   */
  function onTouchCancel(e) {
    onTouchEnd(e);
  }

  /**
   * Apply state for a zone being touched
   */
  function applyZoneState(zone, active) {
    if (active) {
      switch (zone) {
        case 'left':
          state.slowDown = true;
          break;
        case 'center':
          // Jump is handled on initial touch
          break;
        case 'right':
          state.speedUp = true;
          break;
      }
    }
  }

  /**
   * Clear state for a zone no longer touched
   */
  function clearZoneState(zone) {
    switch (zone) {
      case 'left':
        state.slowDown = false;
        break;
      case 'center':
        state.jump = false;
        state.fastFall = false;
        break;
      case 'right':
        state.speedUp = false;
        state.skill = false;
        break;
    }
  }

  /**
   * Reset all states
   */
  function resetAllStates() {
    state.jump = false;
    state.attack = false;
    state.skill = false;
    state.fastFall = false;
    state.slowDown = false;
    state.speedUp = false;
  }

  /**
   * Update visuals based on currently active touches
   */
  function updateVisualsFromActiveTouches() {
    const activeZones = new Set();
    for (const [, data] of touches) {
      activeZones.add(data.zone);
    }

    const leftZone = document.getElementById('touch-left');
    const centerZone = document.getElementById('touch-center');
    const rightZone = document.getElementById('touch-right');

    if (leftZone) {
      leftZone.classList.toggle('active', activeZones.has('left'));
    }
    if (centerZone) {
      centerZone.classList.toggle('active', activeZones.has('center'));
    }
    if (rightZone) {
      rightZone.classList.toggle('active', activeZones.has('right'));
    }
  }

  // Attach listeners to document for better touch capture
  // (canvas might be covered by UI elements)
  const touchTarget = document.getElementById('touch-zones') || canvas;

  touchTarget.addEventListener('touchstart', onTouchStart, { passive: false });
  touchTarget.addEventListener('touchmove', onTouchMove, { passive: false });
  touchTarget.addEventListener('touchend', onTouchEnd, { passive: false });
  touchTarget.addEventListener('touchcancel', onTouchCancel, { passive: false });

  /**
   * Get current state
   */
  function getState() {
    return {
      ...state,
      jumpPressed: pressed.jump,
      attackPressed: pressed.attack,
      skillPressed: pressed.skill,
    };
  }

  /**
   * Clear press events
   */
  function clearPressed() {
    pressed.jump = false;
    pressed.attack = false;
    pressed.skill = false;
  }

  /**
   * Enable/disable
   */
  function setEnabled(value) {
    enabled = value;
    if (!enabled) {
      resetAllStates();
      touches.clear();
    }
  }

  /**
   * Cleanup
   */
  function destroy() {
    touchTarget.removeEventListener('touchstart', onTouchStart);
    touchTarget.removeEventListener('touchmove', onTouchMove);
    touchTarget.removeEventListener('touchend', onTouchEnd);
    touchTarget.removeEventListener('touchcancel', onTouchCancel);
  }

  return {
    getState,
    clearPressed,
    setEnabled,
    destroy,
  };
}

export default { createTouchInput };
