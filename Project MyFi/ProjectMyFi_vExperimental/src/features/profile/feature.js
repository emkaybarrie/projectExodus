/**
 * Feature Pack: profile
 * Responsibility:
 * - Provide profile summary models for UI (screens/modals/journeys).
 * - Own the data source (adapter) so UI never talks to Firestore directly.
 *
 * Current adapter: Firestore players/{uid} (light read).
 * Later: swap to Cloud Function / cached gateway without changing UI.
 */
import { auth, db } from '../../core/firestore.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function loadProfileSummary() {
  const user = auth?.currentUser;
  const uid = user?.uid;

  // Reasonable defaults for demos / first-run
  const summary = {
    uid: uid || null,
    alias: user?.displayName || 'Adventurer',
    firstName: '',
    lastName: '',
    displayName: user?.displayName || 'Adventurer',
    level: 1,
    emberward: {
      status: 'unknown', // 'active'|'low'|'none'|'unknown'
      note: 'Coming soon: essentials shield visualization.'
    }
  };

  if (!uid) return summary;

  try {
    const snap = await getDoc(doc(db, 'players', uid));
    if (!snap.exists()) return summary;

    const d = snap.data() || {};
    summary.alias = d.alias || summary.alias;
    summary.firstName = d.firstName || '';
    summary.lastName = d.lastName || '';
    summary.level = Number(d.level || 1);

    const name = `${summary.firstName} ${summary.lastName}`.trim();
    summary.displayName = name || summary.alias;

    // Optional: if you already store emberward-ish fields anywhere, map them here later
    // summary.emberward.status = d.emberwardStatus || summary.emberward.status;

    return summary;
  } catch (e) {
    console.warn('[profileFeature] loadProfileSummary failed', e);
    return summary;
  }
}

export const profileFeature = {
  id: 'profile',
  api: {
    getSummary: loadProfileSummary
  }
};

export default profileFeature;
