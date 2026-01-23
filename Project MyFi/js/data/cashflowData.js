import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

export async function updateIncome(amount, cadence) {
  console.log("amount:", amount, cadence)
  const daily = toDaily(amount, cadence);
  console.log("daily:", daily)
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'players', uid, 'cashflowData', 'dailyAverages');
  console.log("ref:", ref)
  await setDoc(ref, { dIncome: daily }, { merge: true });
}

export async function updateCoreExpenses(amount, cadence) {
  const daily = toDaily(amount, cadence);
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'players', uid, 'cashflowData', 'dailyAverages');
  await setDoc(ref, { dCoreExpenses: daily }, { merge: true });
}

// NEW: getters used by the menu
export async function getDailyIncome() {
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'players', uid, 'cashflowData', 'dailyAverages');
  const snap = await getDoc(ref);
  const v = snap.exists() ? snap.data().dIncome : null;
  return typeof v === 'number' ? v : 0;
}

export async function getDailyCoreExpenses() {
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'players', uid, 'cashflowData', 'dailyAverages');
  const snap = await getDoc(ref);
  const v = snap.exists() ? snap.data().dCoreExpenses : null;
  return typeof v === 'number' ? v : 0;
}

// helpers
function toDaily(amount, cadence) {
  const a = Number(amount) || 0;
  switch ((cadence || 'monthly').toLowerCase()) {
    case 'daily':   return a;
    case 'weekly':  return a / 7;
    default:        return a / 30; // monthly
  }
}
