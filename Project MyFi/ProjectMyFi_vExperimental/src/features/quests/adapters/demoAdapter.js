import { makeQuestsDemoDomain } from '../../../dev/demo-data/quests.demo.js';

export const questsDemoAdapter = {
  id: 'demo',
  async loadDomain(/* ctx */) {
    // You can extend ctx with demo variant selection later
    return makeQuestsDemoDomain({ variant: 'default' });
  }
};
