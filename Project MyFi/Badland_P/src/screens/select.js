// select.js — Region Selection Screen
// Choose which region to run

import regionsData from '../data/regions.json' assert { type: 'json' };

/**
 * Create region selection screen controller
 */
export function createSelectScreen(elements, audio, events, roguelike) {
  const { selectScreen, regionList, backBtn } = elements;
  let selectedRegion = null;

  /**
   * Show the selection screen
   */
  function show() {
    selectScreen.classList.remove('hidden');
    selectScreen.classList.add('active');
    renderRegions();
  }

  /**
   * Hide the selection screen
   */
  function hide() {
    selectScreen.classList.add('hidden');
    selectScreen.classList.remove('active');
  }

  /**
   * Render available regions
   */
  function renderRegions() {
    regionList.innerHTML = '';

    const save = roguelike.getSave();
    const unlockedRegions = save.unlockedRegions || ['frontier'];
    const essence = save.essence || 0;

    for (const region of regionsData.regions) {
      const isUnlocked = unlockedRegions.includes(region.id);
      const canUnlock = !isUnlocked && essence >= region.unlockCost;

      const card = document.createElement('div');
      card.className = `region-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      card.dataset.regionId = region.id;

      card.innerHTML = `
        <div class="region-icon" style="background: linear-gradient(135deg, ${region.theme.sky[0]}, ${region.theme.horizon})">
          <span class="difficulty">${'★'.repeat(region.difficulty)}</span>
        </div>
        <div class="region-info">
          <h3>${region.name}</h3>
          <p>${region.description}</p>
          ${!isUnlocked ? `<span class="unlock-cost">${region.unlockCost} Essence to unlock</span>` : ''}
        </div>
      `;

      if (isUnlocked) {
        card.addEventListener('click', () => selectRegion(region));
      } else if (canUnlock) {
        card.classList.add('can-unlock');
        card.addEventListener('click', () => unlockRegion(region));
      }

      regionList.appendChild(card);
    }

    // Add essence display
    const essenceDisplay = document.createElement('div');
    essenceDisplay.className = 'essence-display';
    essenceDisplay.innerHTML = `<span class="essence-icon">◆</span> ${essence} Essence`;
    regionList.insertBefore(essenceDisplay, regionList.firstChild);
  }

  /**
   * Select a region to play
   */
  function selectRegion(region) {
    selectedRegion = region;
    audio.playSfx('select');

    // Highlight selected
    regionList.querySelectorAll('.region-card').forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.regionId === region.id) {
        card.classList.add('selected');
      }
    });

    // Go to loadout or directly to game
    events.emit('screen:change', 'loadout');
    events.emit('region:selected', region);
  }

  /**
   * Unlock a region with essence
   */
  function unlockRegion(region) {
    const success = roguelike.unlockRegion(region.id, region.unlockCost);
    if (success) {
      audio.playSfx('pickup');
      renderRegions();
    } else {
      audio.playSfx('hit');
    }
  }

  /**
   * Get selected region
   */
  function getSelectedRegion() {
    return selectedRegion || regionsData.regions[0];
  }

  /**
   * Setup event handlers
   */
  function setup() {
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        audio.playSfx('select');
        events.emit('screen:change', 'title');
      });
    }

    // Keyboard navigation
    const handleKeypress = (e) => {
      if (!selectScreen.classList.contains('active')) return;

      if (e.code === 'Escape') {
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
    getSelectedRegion,
  };
}

export default { createSelectScreen };
