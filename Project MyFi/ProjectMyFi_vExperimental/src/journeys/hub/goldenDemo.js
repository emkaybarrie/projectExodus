/**
 * Golden Demo Journey (Hub)
 * Goal: a reliable, replayable flow for demos and QA.
 *
 * This should remain "thin":
 * - navigate to hub
 * - open a couple of core modals
 * - pause for the user to see the UI
 *
 * No business logic here.
 */
export default {
  id: 'hub.goldenDemo',
  feature: 'hub',
  title: 'Golden Demo: Hub',
  steps: [
    { type: 'navigate', screen: 'hub' },
    { type: 'wait', ms: 400 },

    // Open unverified energy menu (swap to energyMenuVerified if needed)
    { type: 'modal', open: 'energyMenu', args: { source: 'journey' } },
    { type: 'wait', ms: 700 },

    // Open spirit menu
    { type: 'modal', open: 'spiritMenu', args: { source: 'journey' } },
    { type: 'wait', ms: 700 },

    // Optional: open Spirit Stone menu (comment out if you don’t want it in demo)
    // { type: 'modal', open: 'spiritStoneMenu', args: { source: 'journey' } },
    // { type: 'wait', ms: 700 }
  ]
};

