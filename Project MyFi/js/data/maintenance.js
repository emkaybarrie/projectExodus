// js/maintenance/resetVitals.js
// Client-side "vitals reset" (no admin privileges needed).
// - Deletes MANUAL classified txns (keeps TrueLayer + contributions)
// - Resets classified summary buckets to 0
// - Clears financialData_USER (root docs + /transactions subcollection)
// - Zeros cashflowData/dailyAverages
// - (Optional) resets poolAllocations to a safe default if missing
// - (Optional) sets anchor to today via incomeMeta.lastPayDateMs
// - Recomputes vitals via callable

import { auth, db } from '../core/auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  writeBatch, serverTimestamp, query, where, orderBy, startAfter, limit,
  deleteDoc, deleteField
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const functions = getFunctions(undefined, "europe-west2");

/* ————————————————— helpers ————————————————— */

async function deleteByPagedQuery(qb, pageSize = 400) {
  let total = 0, last = null;
  while (true) {
    let qy = qb;
    if (!qy._queryOptions?.orderBy || !qy._queryOptions?.orderBy?.length) {
      // ensure a stable cursor
      qy = query(qy, orderBy('__name__'));
    }
    if (last) qy = query(qy, startAfter(last));
    qy = query(qy, limit(pageSize));

    const snap = await getDocs(qy);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    total += snap.size;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return total;
}

async function deleteDocsByIdPrefix(colRef, prefix, pageSize = 400) {
  // Fall-back pass when we can’t reliably filter by field.
  // Paginates by doc id and filters client-side.
  let last = null;
  let deleted = 0;
  while (true) {
    let qy = query(colRef, orderBy('__name__'), limit(pageSize));
    if (last) qy = query(colRef, orderBy('__name__'), startAfter(last), limit(pageSize));
    const snap = await getDocs(qy);
    if (snap.empty) break;

    const batch = writeBatch(db);
    let any = 0;
    for (const d of snap.docs) {
      if (String(d.id).startsWith(prefix)) {
        batch.delete(d.ref);
        any++; deleted++;
      }
    }
    if (any) await batch.commit();

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return deleted;
}

function midnightTodayMs() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/* ————————————————— main ————————————————— */

export async function resetVitalsToNow(opts = {}) {
  const {
    setAnchorToToday = true,
    anchorDateMs = null,          // NEW: explicit anchor (local midnight ms)
    resetAllocationsIfMissing = true,
    resetItemised = false
  } = opts;

  

  const uid = auth?.currentUser?.uid ?? opts.uid; // allow explicit uid from caller too
  if (!uid) throw new Error('Not signed in.');

  // 1) Remove all MANUAL classified txns (keep TrueLayer + contributions)
  const classifiedCol = collection(db, `players/${uid}/classifiedTransactions`);

  // 1a) delete where source == 'manual'
  const deletedBySource = await deleteByPagedQuery(
    query(classifiedCol, where('source', '==', 'manual'))
  );

  // 1b) fallback: IDs that start with txn_manual_* (older docs may lack 'source')
  const deletedByPrefix = await deleteDocsByIdPrefix(classifiedCol, 'txn_manual_');

  // 2) Reset summary buckets (legacy + per-stream) to 0
  const zeros = { health: 0, mana: 0, stamina: 0, essence: 0 };
  await setDoc(
    doc(db, `players/${uid}/classifiedTransactions/summary`),
    {
      historicUsage: zeros,
      recentUsage: zeros,
      historicUsage_manual: zeros,
      recentUsage_manual: zeros,
      historicUsage_truelayer: zeros,
      recentUsage_truelayer: zeros,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 3) Clear financialData_USER (root docs + transactions subcollection)
  const finUserCol = collection(db, `players/${uid}/financialData_USER`);
  await deleteByPagedQuery(query(finUserCol)); // root docs if any

  // Doesn't exist and was causing error but lft as placeholder if required in future
  //const finUserTxCol = collection(db, `players/${uid}/financialData_USER/transactions`);
  //await deleteByPagedQuery(query(finUserTxCol)); // manual tx staging area (your add-txn UI)

  // 4) Zero daily averages
  await setDoc(
    doc(db, `players/${uid}/cashflowData/dailyAverages`),
    { dIncome: 0, dCoreExpenses: 0, updatedAt: serverTimestamp() },
    { merge: true }
  );

  // 5) Ensure poolAllocations exists (don’t second-guess user’s current mix)
  const allocRef = doc(db, `players/${uid}/cashflowData/poolAllocations`);
  const allocSnap = await getDoc(allocRef);
  if (!allocSnap.exists() && resetAllocationsIfMissing) {
    await setDoc(allocRef, {
      healthAllocation: 0.1,
      manaAllocation: 0.3,
      staminaAllocation: 0.5,
      essenceAllocation: 0.1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } else {
    // Sets existing allocations to system defaults
    await setDoc(allocRef, {
      healthAllocation: 0.1,
      manaAllocation: 0.3,
      staminaAllocation: 0.5,
      essenceAllocation: 0.1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  // 6) Drop any seed/seedCarry so the server can cleanly reseed/flip
  await setDoc(
    doc(db, `players/${uid}/cashflowData/current`),
    { seedCarry: {}, seed: deleteField(), lastSync: serverTimestamp() },
    { merge: true }
  );

  // 7) Re-anchor the cycle according to caller intent:
  //    - if anchorDateMs is provided -> use it
  //    - else if setAnchorToToday -> use today
  //    - else do nothing (keep stored lastPayDateMs)
  try {
    const now = new Date();
    const clampToMidnight = (ms) => {
      if (!Number.isFinite(ms)) return null;
      const d = new Date(ms);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    let anchor = Number.isFinite(anchorDateMs) ? clampToMidnight(anchorDateMs) : null;
    if (anchor === null && setAnchorToToday) {
      anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }

    if (anchor !== null) {
      await setDoc(
        doc(db, `players/${uid}`),
        { incomeMeta: { lastPayDateMs: anchor, lastPaySavedAtMs: serverTimestamp() }, vitalsMode: 'standard' },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn('[resetVitals] failed to set anchor date (non-fatal):', e);
  }

  // 8) Reset vitalsMode 'standard' (if not already)
  // await setDoc(
  //       doc(db, `players/${uid}`),
  //       { vitalsMode: 'standard' },
  //       { merge: true }
  // );

  // 9) Ask the server to recompute vitals now (authoritative)
  try {
    const getSnap = httpsCallable(functions, 'vitals_getSnapshot');
    await getSnap();
  } catch (e) {
    console.warn('[resetVitals] vitals_getSnapshot failed; will self-heal later:', e);
  }

  return {
    deletedManualBySource: deletedBySource,
    deletedManualByPrefix: deletedByPrefix
  };
}
