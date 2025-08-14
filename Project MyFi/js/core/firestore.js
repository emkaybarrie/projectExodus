import { getFirestore, collection, doc, getDoc, getDocs} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * =====================
 *  PLAYER SOURCED
 * =====================
 */



/**
 * =====================
 *  TRUELAYER SOURCED
 * =====================
 */
// Function to load transactions from Firestore for a given user ID
export async function loadTransactionsFromFirestore(uid) {
  const db = getFirestore();
  const ref = doc(db, `players/${uid}/financialData_TRUELAYER/transactions`);

  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("No transaction document found for user:", uid);
      return {};
    }

    const payload = snap.data();

    if (!payload || typeof payload.data !== "object") {
      console.warn("Transaction structure missing or malformed:", payload);
      return {};
    }

    return payload.data;
  } catch (err) {
    console.error("Error loading transactions:", err);
    return {};
  }
}
// Function to process transactions and return grouped data, with summary - First transaction date, total income, and total outgoings
export function processTransactions(transactionsByAccount) {
  const result = {
    overall: {
      totalIncome: 0,
      totalOutgoings: 0,
      firstTransactionDate: null,
      transactions: []
    },
    accounts: {}
  };

  for (const [accountId, transactions] of Object.entries(transactionsByAccount)) {
    let accountIncome = 0;
    let accountOutgoings = 0;
    let accountFirstDate = null;

    for (const tx of transactions) {
      const amount = tx.amount || 0;
      const date = new Date(tx.timestamp || tx.transaction_time || tx.transaction_date);

      // Add to overall flat list
      result.overall.transactions.push({ ...tx, account_id: accountId });

      // Income or outgoings
      if (amount > 0) {
        accountIncome += amount;
        result.overall.totalIncome += amount;
      } else {
        const out = Math.abs(amount);
        accountOutgoings += out;
        result.overall.totalOutgoings += out;
      }

      // First transaction date (account-level)
      if (!accountFirstDate || date < accountFirstDate) {
        accountFirstDate = date;
      }

      // First transaction date (overall)
      if (!result.overall.firstTransactionDate || date < new Date(result.overall.firstTransactionDate)) {
        result.overall.firstTransactionDate = date.toISOString();
      }
    }

    result.accounts[accountId] = {
      summary: {
        totalIncome: accountIncome,
        totalOutgoings: accountOutgoings,
        firstTransactionDate: accountFirstDate?.toISOString() || null
      },
      transactions
    };
  }

  // DEBUG - Validate overall summary
  console.log("DEBUG - Validating Overall Summary:");
  console.log("First Transaction Date: ", result.overall.firstTransactionDate);
  console.log("Total Income: ", result.overall.totalIncome);
  console.log("Total Outgoings: ", result.overall.totalOutgoings);

  return result;
}

/**
 * =====================
 *  CLASSIFIED TRANSACTIONS
 * =====================
 */

/**
 * Loads all classified transaction documents for a user.
 * @param {string} uid - Firebase UID of the user.
 * @returns {Promise<Array>} Array of classified transactions with document IDs.
 */
export async function loadClassifiedTransactionsFromFirestore(uid) {
  const db = getFirestore();
  const colRef = collection(db, `players/${uid}/classifiedTransactions`);

  try {
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
      console.warn("No classified transactions found for user:", uid);
      return {};
    }

    const dataMap = {};

    snapshot.forEach((doc) => {
      dataMap[doc.id] = doc.data(); // ✅ Keyed by txn ID
    });

    return dataMap;
  } catch (err) {
    console.error("Error loading classified transactions:", err);
    return {};
  }
}



