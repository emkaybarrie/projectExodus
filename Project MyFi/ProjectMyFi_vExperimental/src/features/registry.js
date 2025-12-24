/**
 * Feature Registry
 * Central place to access shared capabilities, without hard-coding import paths everywhere.
 *
 * Usage:
 *   import { getFeature } from '../features/registry.js';
 *   getFeature('vitals').api.refresh(...)
 */
const featureMap = new Map();

export function registerFeature(feature) {
  if (!feature?.id) throw new Error('feature missing id');
  featureMap.set(feature.id, feature);
}

export function getFeature(id) {
  const f = featureMap.get(id);
  if (!f) throw new Error(`feature not registered: ${id}`);
  return f;
}

export function listFeatures() {
  return Array.from(featureMap.keys()).sort();
}
