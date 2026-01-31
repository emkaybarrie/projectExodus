// title.js — Title Screen
// Main menu and entry point

/**
 * Create title screen controller
 */
export function createTitleScreen(elements, audio, events) {
  const { titleScreen, playBtn, optionsBtn } = elements;

  /**
   * Show the title screen
   */
  function show() {
    titleScreen.classList.remove('hidden');
    titleScreen.classList.add('active');

    // Animate title entrance
    const title = titleScreen.querySelector('h1');
    if (title) {
      title.style.animation = 'none';
      title.offsetHeight; // Trigger reflow
      title.style.animation = 'pulse 2s ease-in-out infinite';
    }
  }

  /**
   * Hide the title screen
   */
  function hide() {
    titleScreen.classList.add('hidden');
    titleScreen.classList.remove('active');
  }

  /**
   * Setup event handlers
   */
  function setup() {
    playBtn.addEventListener('click', () => {
      audio.playSfx('select');
      events.emit('screen:change', 'select');
    });

    if (optionsBtn) {
      optionsBtn.addEventListener('click', () => {
        audio.playSfx('select');
        events.emit('screen:options');
      });
    }

    // Keyboard shortcut
    const handleKeypress = (e) => {
      if (titleScreen.classList.contains('active')) {
        if (e.code === 'Space' || e.code === 'Enter') {
          audio.playSfx('select');
          events.emit('screen:change', 'select');
        }
      }
    };

    window.addEventListener('keydown', handleKeypress);

    return () => {
      window.removeEventListener('keydown', handleKeypress);
    };
  }

  return {
    show,
    hide,
    setup,
  };
}

export default { createTitleScreen };
