/**
 * Journey Runner
 * Thin orchestration layer. Journeys never contain business logic.
 *
 * Supported step types:
 * - { type:'navigate', screen:'hub' }
 * - { type:'modal', open:'energyMenu' , args:{...} }
 * - { type:'feature', feature:'vitals', call:'refresh', args:[...] }
 * - { type:'wait', ms:250 }
 *
 * You can extend this safely later.
 */
import { navigate } from '../core/router.js';
import { getFeature } from '../features/registry.js';

const modalOpeners = new Map();

/** Register modal openers by simple id so journeys don't import modal paths */
export function registerJourneyModal(id, openerFn) {
  modalOpeners.set(id, openerFn);
}

export async function runJourney(journey, ctx = {}) {
  const steps = journey?.steps || [];
  for (const step of steps) {
    switch (step.type) {
      case 'navigate':
        navigate(step.screen);
        break;

      case 'modal': {
        const open = modalOpeners.get(step.open);
        if (!open) throw new Error(`journey modal opener not registered: ${step.open}`);
        await open(step.args || {}, ctx);
        break;
      }

      case 'feature': {
        const f = getFeature(step.feature);
        const fn = f?.api?.[step.call];
        if (typeof fn !== 'function') throw new Error(`feature call missing: ${step.feature}.${step.call}`);
        await fn(...(step.args || []));
        break;
      }

      case 'wait':
        await new Promise(r => setTimeout(r, step.ms ?? 0));
        break;

      default:
        throw new Error(`unknown journey step type: ${step.type}`);
    }
  }
}
