// input.js — Input Manager
// Unified input handling for keyboard and touch

import { createKeyboardInput } from './keyboard.js';
import { createTouchInput } from './touch.js';

/**
 * Create the input manager
 */
export function createInputManager(canvas, events = null) {
  const keyboard = createKeyboardInput();
  const touch = createTouchInput(canvas);

  // Unified input state
  const state = {
    jump: false,
    attack: false,
    skill: false,
    fastFall: false,
    slowDown: false,
    speedUp: false,
  };

  // Track press events (for single-fire actions)
  const pressed = {
    jump: false,
    attack: false,
    skill: false,
    pause: false,
  };

  /**
   * Update input state from all sources
   */
  function update() {
    const kb = keyboard.getState();
    const tc = touch.getState();

    // Combine inputs (OR logic)
    state.jump = kb.jump || tc.jump;
    state.attack = kb.attack || tc.attack;
    state.skill = kb.skill || tc.skill;
    state.fastFall = kb.fastFall || tc.fastFall;
    state.slowDown = kb.slowDown || tc.slowDown;
    state.speedUp = kb.speedUp || tc.speedUp;

    // Track press events
    pressed.jump = kb.jumpPressed || tc.jumpPressed;
    pressed.attack = kb.attackPressed || tc.attackPressed;
    pressed.skill = kb.skillPressed || tc.skillPressed;
    pressed.pause = kb.pausePressed || false; // Pause only from keyboard

    // Emit pause event if pressed
    if (pressed.pause && events) {
      events.emit('input:pause');
    }

    // Clear press events after reading
    keyboard.clearPressed();
    touch.clearPressed();
  }

  /**
   * Get current input state (includes pressed flags for single-fire actions)
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
   * Check if an action was just pressed
   */
  function wasPressed(action) {
    return pressed[action] || false;
  }

  /**
   * Enable/disable input
   */
  function setEnabled(enabled) {
    keyboard.setEnabled(enabled);
    touch.setEnabled(enabled);
  }

  /**
   * Cleanup
   */
  function destroy() {
    keyboard.destroy();
    touch.destroy();
  }

  /**
   * Initialize (no-op, for API compatibility)
   */
  function init() {
    // Input is initialized on creation
  }

  return {
    init,
    update,
    getState,
    wasPressed,
    setEnabled,
    destroy,
  };
}

export default { createInputManager };
