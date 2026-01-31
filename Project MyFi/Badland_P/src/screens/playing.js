// playing.js — Main Gameplay Screen
// Active game session controller

/**
 * Create playing screen controller
 */
export function createPlayingScreen(elements, audio, events) {
  const {
    playingScreen,
    gameCanvas,
    healthFill,
    momentumFill,
    distanceValue,
    scoreValue,
    essenceValue,
    pauseBtn,
    pauseOverlay,
    resumeBtn,
    quitBtn,
  } = elements;

  let isPaused = false;

  /**
   * Show the playing screen
   */
  function show() {
    playingScreen.classList.remove('hidden');
    playingScreen.classList.add('active');
    isPaused = false;
    hidePauseOverlay();
  }

  /**
   * Hide the playing screen
   */
  function hide() {
    playingScreen.classList.add('hidden');
    playingScreen.classList.remove('active');
  }

  /**
   * Update HUD elements
   */
  function updateHUD(state) {
    const {
      health = 100,
      maxHealth = 100,
      momentum = 0,
      distance = 0,
      score = 0,
      essence = 0,
    } = state;

    // Health bar
    const healthPercent = Math.max(0, (health / maxHealth) * 100);
    healthFill.style.width = `${healthPercent}%`;

    // Color based on health
    if (healthPercent > 60) {
      healthFill.style.backgroundColor = '#22c55e';
    } else if (healthPercent > 30) {
      healthFill.style.backgroundColor = '#fbbf24';
    } else {
      healthFill.style.backgroundColor = '#ef4444';
    }

    // Momentum bar
    const momentumPercent = Math.max(0, Math.min(100, momentum));
    momentumFill.style.width = `${momentumPercent}%`;

    // Momentum color gradient
    if (momentumPercent > 75) {
      momentumFill.style.backgroundColor = '#22d3ee';
    } else if (momentumPercent > 50) {
      momentumFill.style.backgroundColor = '#6366f1';
    } else {
      momentumFill.style.backgroundColor = '#a855f7';
    }

    // Distance and score
    distanceValue.textContent = `${Math.floor(distance)}m`;
    scoreValue.textContent = Math.floor(score).toLocaleString();
    essenceValue.textContent = essence;
  }

  /**
   * Show pause overlay
   */
  function showPauseOverlay() {
    isPaused = true;
    pauseOverlay.classList.remove('hidden');
    events.emit('game:pause');
  }

  /**
   * Hide pause overlay
   */
  function hidePauseOverlay() {
    isPaused = false;
    pauseOverlay.classList.add('hidden');
  }

  /**
   * Resume game
   */
  function resume() {
    hidePauseOverlay();
    events.emit('game:resume');
  }

  /**
   * Check if paused
   */
  function getPaused() {
    return isPaused;
  }

  /**
   * Setup event handlers
   */
  function setup() {
    pauseBtn.addEventListener('click', () => {
      audio.playSfx('select');
      showPauseOverlay();
    });

    resumeBtn.addEventListener('click', () => {
      audio.playSfx('select');
      resume();
    });

    quitBtn.addEventListener('click', () => {
      audio.playSfx('select');
      events.emit('run:end', { reason: 'quit' });
    });

    // Keyboard shortcuts
    const handleKeypress = (e) => {
      if (!playingScreen.classList.contains('active')) return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (isPaused) {
          resume();
        } else {
          showPauseOverlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeypress);

    // Touch zones for pause
    const touchZones = document.querySelector('.touch-zones');
    if (touchZones) {
      // Double-tap to pause could be added here
    }

    return () => {
      window.removeEventListener('keydown', handleKeypress);
    };
  }

  return {
    show,
    hide,
    setup,
    updateHUD,
    showPauseOverlay,
    hidePauseOverlay,
    resume,
    getPaused,
  };
}

export default { createPlayingScreen };
