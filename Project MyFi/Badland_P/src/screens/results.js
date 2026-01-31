// results.js — Results Screen
// End of run summary

/**
 * Create results screen controller
 */
export function createResultsScreen(elements, audio, events, roguelike) {
  const {
    resultsScreen,
    finalDistance,
    finalScore,
    finalEssence,
    retryBtn,
    menuBtn,
  } = elements;

  let lastRunData = null;

  /**
   * Show the results screen
   */
  function show(runData) {
    resultsScreen.classList.remove('hidden');
    resultsScreen.classList.add('active');

    lastRunData = runData || {};
    renderResults();

    // Save essence to persistent storage
    if (runData && runData.essence > 0) {
      roguelike.addEssence(runData.essence);
    }

    // Update best distance
    if (runData && runData.distance > 0) {
      roguelike.updateBestDistance(runData.region?.id, runData.distance);
    }
  }

  /**
   * Hide the results screen
   */
  function hide() {
    resultsScreen.classList.add('hidden');
    resultsScreen.classList.remove('active');
  }

  /**
   * Render results
   */
  function renderResults() {
    const {
      distance = 0,
      score = 0,
      essence = 0,
      reason = 'death',
      region = null,
    } = lastRunData;

    // Animate counting up
    animateValue(finalDistance, 0, Math.floor(distance), 1000, 'm');
    animateValue(finalScore, 0, Math.floor(score), 1200, '');
    animateValue(finalEssence, 0, essence, 800, '');

    // Update title based on reason
    const title = resultsScreen.querySelector('h2');
    if (title) {
      switch (reason) {
        case 'death':
          title.textContent = 'Run Over';
          break;
        case 'quit':
          title.textContent = 'Run Abandoned';
          break;
        case 'victory':
          title.textContent = 'Victory!';
          break;
        default:
          title.textContent = 'Results';
      }
    }

    // Show new records
    const save = roguelike.getSave();
    const bestDistance = save.bestDistances?.[region?.id] || 0;

    if (distance > 0 && distance >= bestDistance) {
      const newRecord = document.createElement('div');
      newRecord.className = 'new-record';
      newRecord.textContent = 'NEW BEST!';
      finalDistance.parentElement.appendChild(newRecord);

      // Animate new record
      setTimeout(() => {
        newRecord.classList.add('show');
      }, 1000);
    }
  }

  /**
   * Animate a numeric value counting up
   */
  function animateValue(element, start, end, duration, suffix = '') {
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * eased);

      element.textContent = current.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  /**
   * Setup event handlers
   */
  function setup() {
    retryBtn.addEventListener('click', () => {
      audio.playSfx('select');

      // Clear any new record indicators
      const newRecords = resultsScreen.querySelectorAll('.new-record');
      newRecords.forEach(el => el.remove());

      events.emit('screen:change', 'loadout');
    });

    menuBtn.addEventListener('click', () => {
      audio.playSfx('select');

      // Clear any new record indicators
      const newRecords = resultsScreen.querySelectorAll('.new-record');
      newRecords.forEach(el => el.remove());

      events.emit('screen:change', 'title');
    });

    // Keyboard shortcuts
    const handleKeypress = (e) => {
      if (!resultsScreen.classList.contains('active')) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        audio.playSfx('select');
        events.emit('screen:change', 'loadout');
      } else if (e.code === 'Escape') {
        audio.playSfx('select');
        events.emit('screen:change', 'title');
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

export default { createResultsScreen };
