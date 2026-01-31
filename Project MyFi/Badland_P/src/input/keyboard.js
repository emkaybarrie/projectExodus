// keyboard.js — Keyboard Input
// Keyboard controls for desktop play

// Key mappings
const KEY_MAP = {
  // Jump
  Space: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',

  // Attack
  KeyX: 'attack',
  KeyJ: 'attack',
  Enter: 'attack',

  // Skill
  KeyZ: 'skill',
  KeyK: 'skill',

  // Fast fall
  KeyS: 'fastFall',
  ArrowDown: 'fastFall',

  // Speed control
  KeyA: 'slowDown',
  ArrowLeft: 'slowDown',
  KeyD: 'speedUp',
  ArrowRight: 'speedUp',

  // Pause
  Escape: 'pause',
  KeyP: 'pause',
};

/**
 * Create keyboard input handler
 */
export function createKeyboardInput() {
  let enabled = true;

  // Current held state
  const held = {
    jump: false,
    attack: false,
    skill: false,
    fastFall: false,
    slowDown: false,
    speedUp: false,
    pause: false,
  };

  // Press events (single frame)
  const pressed = {
    jump: false,
    attack: false,
    skill: false,
    pause: false,
  };

  /**
   * Handle keydown
   */
  function onKeyDown(e) {
    if (!enabled) return;

    const action = KEY_MAP[e.code];
    if (!action) return;

    // Prevent default for game keys
    e.preventDefault();

    // Track press event (only on initial press)
    if (!held[action] && (action === 'jump' || action === 'attack' || action === 'skill' || action === 'pause')) {
      pressed[action] = true;
    }

    held[action] = true;
  }

  /**
   * Handle keyup
   */
  function onKeyUp(e) {
    const action = KEY_MAP[e.code];
    if (!action) return;

    held[action] = false;
  }

  /**
   * Handle window blur (release all keys)
   */
  function onBlur() {
    Object.keys(held).forEach(key => {
      held[key] = false;
    });
  }

  // Attach listeners
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  /**
   * Get current state
   */
  function getState() {
    return {
      ...held,
      jumpPressed: pressed.jump,
      attackPressed: pressed.attack,
      skillPressed: pressed.skill,
      pausePressed: pressed.pause,
    };
  }

  /**
   * Clear press events
   */
  function clearPressed() {
    pressed.jump = false;
    pressed.attack = false;
    pressed.skill = false;
    pressed.pause = false;
  }

  /**
   * Enable/disable
   */
  function setEnabled(value) {
    enabled = value;
    if (!enabled) {
      Object.keys(held).forEach(key => {
        held[key] = false;
      });
    }
  }

  /**
   * Cleanup
   */
  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  }

  return {
    getState,
    clearPressed,
    setEnabled,
    destroy,
  };
}

export default { createKeyboardInput };
