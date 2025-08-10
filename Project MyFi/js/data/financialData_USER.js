import { getFirestore, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

const targetCollection = "financialData_USER";

export async function addTransaction(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const ref = doc(db, "players", user.uid, targetCollection, 'transactions');

  // Generate transaction ID - stubbed to  datetime for now
  const txnID = `txn_manual_${Date.now()}`;
  // Ensure amount is positive for income, negative for expenses
  if (data.txType === "debit") {
    data.txAmount = -Math.abs(data.txAmount); // Ensure income is positive
  } else if (data.txType === "credit") {
    data.txAmount = Math.abs(data.txAmount); // Ensure expenses are negative
  } else {
    throw new Error("Invalid transaction type. Use 'debit' for income and 'credit' for expenses.");
  }
  // Process date string and turn into timesatamp
  if (data.txDate == "" || new Date(data.txDate) == new Date) {data.txDate = serverTimestamp()} else {data.txDate = Timestamp.fromDate(new Date(data.txDate));}

  // Bundle Transaction Data
  const transactionData = {
      description: data.txDesc || "No description provided",
      amount: Number(data.txAmount),
      entryDate: data.txDate,
      source: "user",
  }

  await setDoc(ref, {
    "txnID": txnID,
    "transactionData": transactionData
  });

  // Classified Transactions Stub - Normilized
  const stubRef = doc(db, "players", user.uid, 'classifiedTransactions', txnID);
  // Set status base don tagging
  let status = "pending"
  if (data.txPool != "") { status = "confirmed"; }
  // Set intended pool based on player onboarding stage (stage 1: default to stamina)
  const intendedPool = "stamina"
  // Set pool to null if not provided
  let taggedPool = null;
  if (data.txPool != "") { taggedPool = data.txPool; }
  // Set confidence based on input
  let confidence = null
  if (data.txPool != null) { confidence = 1;} 
  // Set tag time if tag provided
  let tagTime = null
  if (data.txPool != null) { tagTime = serverTimestamp();} 
  // Update tag source if tagged by user
  let tagSource = null
  if (data.txPool != null) { tagSource = 'user'}

  await setDoc(stubRef, {
    "transactionData": transactionData,
    "assignmentData": {
      assignmentDeadline: Timestamp.fromMillis(Date.now() + 60 *60 * 1000), // Default to 1 hour from now
      status: "pending",
      intendedPool: intendedPool,
      tag:{
        confidence: confidence,
        overridden: false,
        pool: taggedPool,
        source: tagSource,
        taggedAt: tagTime,
      }
    }
  });
}
