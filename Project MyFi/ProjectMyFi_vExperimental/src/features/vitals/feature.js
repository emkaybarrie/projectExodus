/**
 * Feature Pack: vitals
 * Responsibility: Build data models needed for Vitals UI.
 *
 * - buildHUDModel(gatewayDoc, mode): produces a plain JS object the UI can render.
 * - ensureFocusCache(mode): prepares Focus sums for non-core modes.
 *
 * MUST NOT:
 * - touch DOM
 * - open modals
 * - navigate
 *
 * NOTE: This is a wrapper (Phase 2A). Behaviour should remain unchanged.
 */
import * as vm from './hudModel.js';

export const vitalsFeature = {
  id: 'vitals',
  api: {
    buildHUDModel: vm.buildHUDModel,
    ensureFocusCache: vm.ensureFocusCache
  }
};

export default vitalsFeature;
