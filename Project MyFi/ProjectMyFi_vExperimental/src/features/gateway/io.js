// be/gateway.js
// Thin IO layer around the vitals gateway doc: read, watch, and recompute.
// No DOM. No formatting. Just Firestore + calls into the BE math stub.

import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Reuse the recompute stub you already have (from legacy-migrated file)
import { recomputeVitalsGatewayStub, resolveDataSources } from "./beStub.js";
import { auth, db, waitForAuthUser  } from '../../core/firestore.js';

/** read once */
export async function getGatewayOnce(uid) {
  const u = uid || (await waitForAuthUser())?.uid || auth.currentUser?.uid;
  if (!u) return null;
  const ref = doc(db, `players/${u}/vitalsData/gateway`);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() || null) : null;
}

/** read once, but force a recompute beforehand (safe to call on page enter) */
export async function refreshAndGetGateway(uid) {
  const u = uid || (await waitForAuthUser())?.uid || auth.currentUser?.uid;
  if (!u) return null;
  try { await recomputeVitalsGatewayStub(u); } catch {}
  return await getGatewayOnce(u);
}

/** live watcher; returns unsubscribe() */
export async function watchGateway(uid, cb) {
  const u = uid || (await waitForAuthUser())?.uid || auth.currentUser?.uid;
  if (!u) return () => {};
  const ref = doc(db, `players/${u}/vitalsData/gateway`);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? (snap.data() || null) : null));
}

/** expose data-source resolver so FE/UI can ask for tx path when needed */
export { resolveDataSources } from "./beStub.js";
