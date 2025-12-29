import { getFeature } from '../../features/registry.js';

/**
 * createActions({ refresh })
 * - refresh() is a callback the screen host provides to re-render after actions.
 * - Actions stay thin and delegate to feature packs.
 */
export function createActions({ refresh } = {}) {
  const quests = () => getFeature('quests').api;

  return {
    'quests.setActiveTab': async ({ tabId }) => {
      await quests().setActiveTab(tabId);
      await refresh?.();
    },

    'quests.claim': async ({ questId }) => {
      await quests().claim(questId);
      await refresh?.();
    },

    'quests.primary': async ({ questId }) => {
      await quests().primary(questId);
      await refresh?.();
    }
  };
}
