/**
 * financialData_USER.js
 * ---------------------------------------------------------------------------
 * Purpose:
 * - Accept manual transaction input from the UI.
 * - Persist the "user-facing" transaction shape in players/{uid}/financialData_USER/transactions
 *   (kept as-is to avoid regressions).
 * - Create a normalized entry in players/{uid}/classifiedTransactions/{txnID}
 *   that joins the Update Log queue and participates in the HUD ghost preview.
 *
 * Model:
 * - Pending items (status: "pending") contribute to ghost overlay for ~1 hour.
 * - Users can set a provisional tag at creation (still pending/ghosting until lock).
 * - On expiry/queue-cap, we flip to confirmed and copy provisional tag → final tag.
 * ---------------------------------------------------------------------------
 */

/**
 * financialData_USER.js
 * Manual add txn with anchor/window guards.
 */

import { getFirestore, doc, getDoc, setDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();
const targetCollection = "financialSourceData_UNVERIFIED";

// Read server-computed anchor if present; fallback to today
async function getAnchorMs(uid) {
  try {
    const cur = await getDoc(doc(db, `players/${uid}/cashflowData/current`));
    if (cur.exists()) {
      const a = Number((cur.data() || {}).anchorMs || (cur.data() || {}).seedAnchor?.anchorMs || 0);
      if (Number.isFinite(a) && a > 0) return a;
    }
  } catch {}
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); // today
}


/**
 * addTransaction(data)
 * @param {Object} data
 * @param {"debit"|"credit"} data.txType
 * @param {number} data.txAmount
 * @param {string=} data.txDate  // "", ISO, or yyyy-mm-dd; if blank -> now
 * @param {string=} data.txDesc
 * @param {""|"stamina"|"mana"|"health"|"essence"} [data.txPool]
 */
export async function addTransaction(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  // 1) Amount sign by type
  let amount = Number(data.txAmount);
  if (data.txType === "debit") amount = -Math.abs(amount);
  else if (data.txType === "credit") amount =  Math.abs(amount);
  else throw new Error("Invalid txType. Use 'debit' or 'credit'.");

  // 2) Intended date (from user or now)
  let intendedMs;
  if (!data.txDate || data.txDate === "") {
    intendedMs = Date.now();
  } else {
    const d = new Date(data.txDate);
    intendedMs = isNaN(d.getTime()) ? Date.now() : d.getTime();
  }

  // 3) Clamp to [anchor, now] (no future, no pre-anchor)
  const anchorMs = await getAnchorMs(user.uid);
  const nowMs = Date.now();
  const clampedMs = Math.max(anchorMs, Math.min(intendedMs, nowMs));

  // 4) Build TS for echo
  const entryDate = Timestamp.fromMillis(clampedMs);

  // 5) Shared id
  const txnID = `txn_manual_${Date.now()}`;

  // 6) USER-FACING store
  const userFacingRef = doc(db, "players", user.uid, targetCollection, txnID);
  const transactionData = {
    description: data.txDesc || "No description provided",
    amount: Number(amount),
    entryDate,
    source: "user",
  };
  await setDoc(userFacingRef, { txnID, transactionData });

  // 7) Classified (pending → ghost → lock)
  const addedMs = nowMs;
  const ghostWindowMs = 1 * 60 * 60 * 1000; // 1h

  const classified = {
    amount: Number(amount),
    dateMs: clampedMs,             // IMPORTANT: clamped
    source: "manual",
    accountId: null,

    status: "pending",
    addedMs,
    ghostWindowMs,
    ghostExpiryMs: addedMs + ghostWindowMs,
    autoLockReason: null,

    provisionalTag: {
      pool: data.txPool && data.txPool !== "" ? data.txPool : null,
      setAtMs: data.txPool && data.txPool !== "" ? addedMs : null,
    },
    tag: { pool: null, setAtMs: null },

    suggestedPool: null,
    rulesVersion: "v1",

    transactionData: {
      description: transactionData.description,
      entryDate,
    },
  };

  await setDoc(doc(db, "players", user.uid, "financialData", 'processedTransactions', 'unverified', txnID), classified);
}




