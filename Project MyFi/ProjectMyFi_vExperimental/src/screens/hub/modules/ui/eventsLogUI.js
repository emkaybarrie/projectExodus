import { wireEventsLog } from './eventsLog.js';

export function createEventsLogUI(root, deps = {}) {
  // wire once, return render that triggers re-paint through event stream
  const unwire = wireEventsLog(deps.getGateway);
  return {
    render(vm) {},
    destroy() { try { unwire?.(); } catch {} }
  };
}
