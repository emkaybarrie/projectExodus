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

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

// Keep this path the same to avoid regressions in your current UI
const targetCollection = "financialData_USER";

/**
 * addTransaction(data)
 * @param {{
 *   txType: "debit"|"credit",   // debit = expense (negative), credit = income (positive)
 *   txAmount: number,
 *   txDate?: string,            // "", ISO, or yyyy-mm-dd; if blank uses serverTimestamp()
 *   txDesc?: string,
 *   txPool?: ""|"stamina"|"mana"|"health"|"essence" // optional provisional choice
 * }} data
 */
export async function addTransaction(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  // 1) Normalise amount sign by type
  let amount = Number(data.txAmount);
  if (data.txType === "debit") {
    amount = -Math.abs(amount);     // expenses are negative
  } else if (data.txType === "credit") {
    amount = Math.abs(amount);      // income is positive
  } else {
    throw new Error("Invalid txType. Use 'debit' or 'credit'.");
  }

  // 2) Entry date → Firestore Timestamp (or server timestamp)
  let entryDate;
  if (!data.txDate || data.txDate === "") {
    entryDate = serverTimestamp();
  } else {
    const d = new Date(data.txDate);
    entryDate = isNaN(d.getTime()) ? serverTimestamp() : Timestamp.fromDate(d);
  }

  // 3) Create a unique ID we can reuse across both stores
  const txnID = `txn_manual_${Date.now()}`;

  // 4) USER-FACING STORE (keep shape/path to avoid regressions)
  //    NOTE: This writes a single document named "transactions" (your current pattern).
  //    If/when you migrate to a collection, we can switch to addDoc().
  const userFacingRef = doc(db, "players", user.uid, targetCollection, txnID);
  const transactionData = {
    description: data.txDesc || "No description provided",
    amount: Number(amount),
    entryDate,
    source: "user",
  };
  await setDoc(userFacingRef, {
    txnID,
    transactionData,
  });

  // 5) CLASSIFIED PIPELINE: goes into Update Log (pending during ghost window)
  const addedMs = Date.now();
  const ghostWindowMs = 1 * 60 * 60 * 1000; // 1 hour ghost window // 63 Mana
  const classified = {
    // Basic txn facts
    amount: Number(amount),
    dateMs: addedMs,                 // client-side ms; good enough for queue ordering
    source: "manual",
    accountId: null,

    // Queue/ghost lifecycle
    status: "pending",               // pending contributes to the ghost overlay
    addedMs,
    ghostWindowMs,
    ghostExpiryMs: addedMs + ghostWindowMs,
    autoLockReason: null,            // "expiry" | "queue_cap" (set later)

    // Tagging during the ghost window (not final)
    provisionalTag: {
      pool: data.txPool && data.txPool !== "" ? data.txPool : null,
      setAtMs: data.txPool && data.txPool !== "" ? addedMs : null,
    },
    // Final tag after lock
    tag: { pool: null, setAtMs: null },

    // Optional rules / hints (future)
    suggestedPool: null,
    rulesVersion: "v1",

    // Echo description for convenient UI rendering
    transactionData: {
      description: transactionData.description,
      // entryDate is a Firestore Timestamp; we keep the raw TS in this echo shape
      entryDate,
    },
  };

  // use the same txnID for a clean mapping across layers
  await setDoc(doc(db, "players", user.uid, "classifiedTransactions", txnID), classified);
}
