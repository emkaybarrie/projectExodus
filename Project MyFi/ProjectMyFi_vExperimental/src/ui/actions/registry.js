import { getFeature } from '../../features/registry.js';

/**
 * createActions({ refresh })
 * - refresh() is a callback the screen host provides to re-render after actions.
 * - Actions stay thin and delegate to feature packs.
 */
export function createActions({ vmStore, refresh } = {}) {

  const quests = () => getFeature('quests').api;

  return {
    'quests.setActiveTab': async ({ tabId }) => {
      await quests().setActiveTab(tabId);
      if (vmStore) await vmStore.refresh();
      else await refresh?.();
    },

    'quests.claim': async ({ questId }) => {
      await quests().claim(questId);
      if (vmStore) await vmStore.refresh();
      else await refresh?.();
    },

    'quests.primary': async ({ questId }) => {
      await quests().primary(questId);
      if (vmStore) await vmStore.refresh();
      else await refresh?.();
    }
  };
}
