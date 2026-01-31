// storage.js — LocalStorage Abstraction
// Save/load game progression

const STORAGE_KEY = 'badlands_runner_save';

/**
 * Create a storage manager for save data
 */
export function createStorage() {
  /**
   * Save data to localStorage
   */
  function save(data) {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (e) {
      console.error('[Storage] Save failed:', e);
      return false;
    }
  }

  /**
   * Load data from localStorage
   */
  function load() {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      console.error('[Storage] Load failed:', e);
      return null;
    }
  }

  /**
   * Check if save exists
   */
  function exists() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Clear save data
   */
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    save,
    load,
    exists,
    clear,
  };
}

export default { createStorage };
