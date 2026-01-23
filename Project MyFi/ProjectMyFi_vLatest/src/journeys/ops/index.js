// ops/index.js — Op executor registry
// Part of I2-JourneyRunner-Phase1
// Spec: JOURNEYS_SPEC.md §6

import { execute as navigate } from './navigate.js';
import { execute as openModal } from './openModal.js';
import { execute as closeModal } from './closeModal.js';
import { execute as wait } from './wait.js';
import { execute as emit } from './emit.js';
import { execute as log } from './log.js';

/**
 * Map of op names to executor functions.
 * Each executor: async (step, ctx) => void
 */
const ops = {
  navigate,
  openModal,
  closeModal,
  wait,
  emit,
  log,
};

/**
 * Get executor for an operation.
 * @param {string} opName
 * @returns {function|null}
 */
export function getExecutor(opName) {
  return ops[opName] || null;
}

/**
 * Check if an operation is supported.
 * @param {string} opName
 * @returns {boolean}
 */
export function isSupported(opName) {
  return opName in ops;
}

/**
 * List all supported operations.
 * @returns {string[]}
 */
export function listOps() {
  return Object.keys(ops);
}

export default { getExecutor, isSupported, listOps };
