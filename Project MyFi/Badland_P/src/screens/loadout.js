// loadout.js — Loadout Selection Screen
// Pre-run equipment and upgrades

import powerupsData from '../data/powerups.json' assert { type: 'json' };

/**
 * Create loadout screen controller
 */
export function createLoadoutScreen(elements, audio, events, roguelike) {
  const { loadoutScreen, upgradeList, startRunBtn, backBtn } = elements;

  /**
   * Show the loadout screen
   */
  function show() {
    loadoutScreen.classList.remove('hidden');
    loadoutScreen.classList.add('active');
    renderUpgrades();
  }

  /**
   * Hide the loadout screen
   */
  function hide() {
    loadoutScreen.classList.add('hidden');
    loadoutScreen.classList.remove('active');
  }

  /**
   * Render persistent upgrades
   */
  function renderUpgrades() {
    upgradeList.innerHTML = '';

    const save = roguelike.getSave();
    const essence = save.essence || 0;
    const upgrades = save.upgrades || {};

    // Header with essence
    const header = document.createElement('div');
    header.className = 'loadout-header';
    header.innerHTML = `
      <h2>Upgrades</h2>
      <div class="essence-display"><span class="essence-icon">◆</span> ${essence}</div>
    `;
    upgradeList.appendChild(header);

    // Render each upgrade
    for (const upgrade of powerupsData.persistentUpgrades) {
      const currentLevel = upgrades[upgrade.id] || 0;
      const isMaxed = currentLevel >= upgrade.maxLevel;
      const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
      const canAfford = essence >= cost;

      const card = document.createElement('div');
      card.className = `upgrade-card ${isMaxed ? 'maxed' : ''} ${canAfford && !isMaxed ? 'affordable' : ''}`;

      card.innerHTML = `
        <div class="upgrade-info">
          <h4>${upgrade.name}</h4>
          <p>${upgrade.description}</p>
          <div class="upgrade-level">
            Level ${currentLevel}/${upgrade.maxLevel}
            <div class="level-bar">
              <div class="level-fill" style="width: ${(currentLevel / upgrade.maxLevel) * 100}%"></div>
            </div>
          </div>
        </div>
        <button class="upgrade-btn" ${isMaxed || !canAfford ? 'disabled' : ''}>
          ${isMaxed ? 'MAX' : `${cost} ◆`}
        </button>
      `;

      const btn = card.querySelector('.upgrade-btn');
      if (!isMaxed && canAfford) {
        btn.addEventListener('click', () => purchaseUpgrade(upgrade.id, cost));
      }

      upgradeList.appendChild(card);
    }
  }

  /**
   * Purchase an upgrade
   */
  function purchaseUpgrade(upgradeId, cost) {
    const success = roguelike.purchaseUpgrade(upgradeId, cost);
    if (success) {
      audio.playSfx('pickup');
      renderUpgrades();
    } else {
      audio.playSfx('hit');
    }
  }

  /**
   * Get current stats with upgrades applied
   */
  function getStats() {
    const save = roguelike.getSave();
    const upgrades = save.upgrades || {};

    // Base stats
    const stats = {
      maxHealth: 100,
      startingMomentum: 0,
      essenceMultiplier: 1,
      damage: 1,
      momentumDecay: 1,
    };

    // Apply upgrades
    for (const upgrade of powerupsData.persistentUpgrades) {
      const level = upgrades[upgrade.id] || 0;
      if (level > 0) {
        const { stat, valuePerLevel } = upgrade.effect;
        stats[stat] = (stats[stat] || 0) + (valuePerLevel * level);
      }
    }

    return stats;
  }

  /**
   * Setup event handlers
   */
  function setup() {
    startRunBtn.addEventListener('click', () => {
      audio.playSfx('select');
      events.emit('screen:change', 'playing');
      events.emit('run:start', getStats());
    });

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        audio.playSfx('select');
        events.emit('screen:change', 'select');
      });
    }

    // Keyboard shortcut
    const handleKeypress = (e) => {
      if (!loadoutScreen.classList.contains('active')) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        audio.playSfx('select');
        events.emit('screen:change', 'playing');
        events.emit('run:start', getStats());
      } else if (e.code === 'Escape') {
        events.emit('screen:change', 'select');
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
    getStats,
  };
}

export default { createLoadoutScreen };
