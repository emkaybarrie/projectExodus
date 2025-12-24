/**
 * Journey Modal Registration
 * Journeys open modals by logical id using the canonical modal registry.
 * This prevents UI/journey drift.
 */
import { registerJourneyModal } from './runner.js';
import { openModalById } from '../modals/registry.js';

export function registerJourneyModals() {
  registerJourneyModal('energyMenu',        (args, ctx) => openModalById('energyMenu', args, ctx));
  registerJourneyModal('spiritMenu',        (args, ctx) => openModalById('spiritMenu', args, ctx));
  registerJourneyModal('spiritStoneMenu',   (args, ctx) => openModalById('spiritStoneMenu', args, ctx));
  registerJourneyModal('settings',          (args, ctx) => openModalById('settings', args, ctx));
  registerJourneyModal('help',              (args, ctx) => openModalById('help', args, ctx));
  registerJourneyModal('logout',            (args, ctx) => openModalById('logout', args, ctx));
  registerJourneyModal('social',            (args, ctx) => openModalById('social', args, ctx));
  registerJourneyModal('music',             (args, ctx) => openModalById('music', args, ctx));
}
