// Excerpt from: src/core/app.js (lines 14-26, 76-99)
// Hub controller creation and surface lifecycle

import { createHubController } from '../systems/hubController.js';

// Create Hub controller for integrated systems (autobattler, vitals sim)
const hubController = createHubController({
  actionBus,
  onStateChange: (state) => {
    // Broadcast state changes for parts that listen
    actionBus.emit('hub:stateChange', state);
  },
});
hubController.init();

// Register demo VM providers for surfaces
// Hub uses controller state if available, otherwise falls back to demo VM
registerVMProvider('hub', () => hubController.getState() || getHubDemoVM());

// Expose for debugging/testing BEFORE router starts
window.__MYFI_DEBUG__ = {
  actionBus,
  modalManager,
  journeyRunner,
  router,
  hubController,
};

// Start Hub controller when on hub surface
actionBus.subscribe('surface:mounted', ({ surfaceId }) => {
  if (surfaceId === 'hub') {
    hubController.start();
    console.log('[App] Hub controller started');
  }
});

actionBus.subscribe('surface:unmounted', ({ surfaceId }) => {
  if (surfaceId === 'hub') {
    hubController.stop();
    console.log('[App] Hub controller stopped');
  }
});
