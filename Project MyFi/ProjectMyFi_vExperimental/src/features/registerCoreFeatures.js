/**
 * Register core feature packs.
 * Keep this as the single place where "always-on" features are registered.
 *
 * Later, you can split this into optional bundles (demo-only, dev-only, etc).
 */
import { registerFeature } from './registry.js';

import authFeature from './auth/feature.js';

import gatewayFeature from './gateway/feature.js';

import vitalsFeature from './vitals/feature.js';
import profileFeature from './profile/feature.js';
import eventsFeature from './events/feature.js';


export function registerCoreFeatures() {
  registerFeature(authFeature);

  registerFeature(gatewayFeature);
  
  registerFeature(vitalsFeature);
  registerFeature(profileFeature);
  registerFeature(eventsFeature);
}
