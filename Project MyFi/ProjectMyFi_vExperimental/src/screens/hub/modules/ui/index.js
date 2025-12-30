/**
 * Hub UI composition
 * Owns creation and cleanup of hub UI components.
 */
import { createVitalsUI } from './vitalsUI.js';
import { createEventsLogUI } from './eventsLogUI.js';

export function createHubUI(root, deps = {}) {
  const vitals = createVitalsUI(root, deps);
  //const events = createEventsLogUI(root, deps);

  return {
    render(vm) {
      vitals.render(vm);
      //events.render(vm);
    },
    destroy() {
      //events.destroy();
      vitals.destroy();
    }
  };
}
