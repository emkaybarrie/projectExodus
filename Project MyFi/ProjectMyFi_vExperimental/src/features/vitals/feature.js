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
import * as hubVM from '../../screens/hub/modules/hub-vm.js';

export const vitalsFeature = {
  id: 'vitals',
  api: {
    buildHUDModel: hubVM.buildHUDModel,
    ensureFocusCache: hubVM.ensureFocusCache
  }
};

export default vitalsFeature;
