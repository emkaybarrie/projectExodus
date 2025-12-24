/**
 * Modal Registry (canonical)
 * Purpose:
 * - Keep a single authoritative mapping of logical modal IDs -> opener functions.
 * - Prevent feature drift (UI + journeys use the same IDs).
 *
 * Opener signature:
 *   opener(args?, ctx?) -> Promise<any> | any
 */
const openers = new Map();

export function registerModalOpener(id, openerFn) {
  if (!id) throw new Error('registerModalOpener: missing id');
  if (typeof openerFn !== 'function') throw new Error(`registerModalOpener(${id}): openerFn must be a function`);
  openers.set(id, openerFn);
}

export function hasModal(id) {
  return openers.has(id);
}

export function listModals() {
  return Array.from(openers.keys()).sort();
}

export async function openModalById(id, args = {}, ctx = {}) {
  const fn = openers.get(id);
  if (!fn) throw new Error(`No modal registered for id: ${id}`);
  return fn(args, ctx);
}
