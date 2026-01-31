// roguelike.js — Roguelike Progression System
// Persistent upgrades, currency, and run tracking

// Default save state
const DEFAULT_STATE = {
  essence: 0,
  regionsUnlocked: 0,
  upgrades: {
    maxHealth: 0, // +20 HP per level (max 5)
    startMomentum: 0, // +10 starting momentum per level (max 5)
    attackDamage: 0, // +10% damage per level (max 5)
  },
  loadout: {
    weapon: null,
    armor: null,
    charm: null,
  },
  stats: {
    totalRuns: 0,
    totalDistance: 0,
    highScore: 0,
    longestRun: 0,
    enemiesDefeated: 0,
  },
};

// Upgrade costs (essence)
const UPGRADE_COSTS = {
  maxHealth: [100, 250, 500, 1000, 2000],
  startMomentum: [100, 250, 500, 1000, 2000],
  attackDamage: [150, 300, 600, 1200, 2500],
};

// Region unlock costs (essence)
const REGION_UNLOCK_COSTS = [0, 500, 2000];

/**
 * Create the roguelike progression system
 */
export function createRoguelikeSystem(storage) {
  let state = { ...DEFAULT_STATE };

  /**
   * Load saved state
   */
  function load() {
    const saved = storage.load();
    if (saved) {
      state = { ...DEFAULT_STATE, ...saved };
      console.log('[Roguelike] Loaded save:', state);
    }
  }

  /**
   * Save current state
   */
  function save() {
    storage.save(state);
    console.log('[Roguelike] Saved');
  }

  /**
   * Check if save exists
   */
  function hasSave() {
    return storage.exists();
  }

  /**
   * Get current essence
   */
  function getEssence() {
    return state.essence;
  }

  /**
   * Add essence
   */
  function addEssence(amount) {
    state.essence += amount;
  }

  /**
   * Spend essence (returns false if insufficient)
   */
  function spendEssence(amount) {
    if (state.essence < amount) return false;
    state.essence -= amount;
    return true;
  }

  /**
   * Get upgrade level
   */
  function getUpgradeLevel(upgradeName) {
    return state.upgrades[upgradeName] || 0;
  }

  /**
   * Get upgrade cost for next level
   */
  function getUpgradeCost(upgradeName) {
    const level = getUpgradeLevel(upgradeName);
    const costs = UPGRADE_COSTS[upgradeName];
    if (!costs || level >= costs.length) return null;
    return costs[level];
  }

  /**
   * Purchase upgrade
   */
  function purchaseUpgrade(upgradeName) {
    const cost = getUpgradeCost(upgradeName);
    if (cost === null) return false; // Max level
    if (!spendEssence(cost)) return false; // Insufficient funds

    state.upgrades[upgradeName]++;
    save();
    return true;
  }

  /**
   * Get progress info
   */
  function getProgress() {
    return {
      essence: state.essence,
      regionsUnlocked: state.regionsUnlocked,
      upgrades: { ...state.upgrades },
      stats: { ...state.stats },
    };
  }

  /**
   * Get loadout
   */
  function getLoadout() {
    return { ...state.loadout };
  }

  /**
   * Set loadout item
   */
  function setLoadoutItem(slot, itemId) {
    state.loadout[slot] = itemId;
    save();
  }

  /**
   * Record run completion
   */
  function recordRun(runStats) {
    state.stats.totalRuns++;
    state.stats.totalDistance += runStats.distance;
    state.stats.highScore = Math.max(state.stats.highScore, runStats.score);
    state.stats.longestRun = Math.max(state.stats.longestRun, runStats.distance);
    state.stats.enemiesDefeated += runStats.enemiesDefeated || 0;
  }

  /**
   * Unlock next region
   */
  function unlockRegion() {
    const nextRegion = state.regionsUnlocked + 1;
    if (nextRegion >= REGION_UNLOCK_COSTS.length) return false;

    const cost = REGION_UNLOCK_COSTS[nextRegion];
    if (!spendEssence(cost)) return false;

    state.regionsUnlocked = nextRegion;
    save();
    return true;
  }

  /**
   * Get calculated player stats with upgrades applied
   */
  function getPlayerStats() {
    return {
      maxHealth: 100 + state.upgrades.maxHealth * 20,
      startMomentum: state.upgrades.startMomentum * 10,
      damageMultiplier: 1 + state.upgrades.attackDamage * 0.1,
    };
  }

  /**
   * Reset save (for debugging)
   */
  function reset() {
    state = { ...DEFAULT_STATE };
    storage.clear();
    console.log('[Roguelike] Reset');
  }

  return {
    load,
    save,
    hasSave,
    getEssence,
    addEssence,
    spendEssence,
    getUpgradeLevel,
    getUpgradeCost,
    purchaseUpgrade,
    getProgress,
    getLoadout,
    setLoadoutItem,
    recordRun,
    unlockRegion,
    getPlayerStats,
    reset,
  };
}

export default { createRoguelikeSystem };
