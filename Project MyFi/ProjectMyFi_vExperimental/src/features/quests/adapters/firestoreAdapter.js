import { makeQuestsDemoDomain } from '../../../dev/demo-data/quests.demo.js';

/**
 * Firestore adapter (stub for now).
 * When you implement real data:
 * - load canonical quests domain state from Firestore
 * - keep return shape stable so UI never changes
 */
export const questsFirestoreAdapter = {
  id: 'firestore',
  async loadDomain(ctx) {
    // ctx should include: { user, db } (we'll pass these from feature)
    // For now: visible fallback (keeps Quests usable)
    console.warn('[questsFirestoreAdapter] Not implemented; falling back to demo domain.');
    return makeQuestsDemoDomain({ variant: 'default' });
  }
};
