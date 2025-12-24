/**
 * Journey Catalog
 * Single place to list journeys available in the build.
 * Keeping this explicit makes it easy to audit demo coverage.
 */
import goldenDemo from './hub/goldenDemo.js';

export const journeys = [
  goldenDemo
];

export function getJourney(id) {
  return journeys.find(j => j.id === id);
}
