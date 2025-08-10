import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

export async function updateIncome(newIncome, frequency) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const ref = doc(db, "players", user.uid, "cashflowData", "dailyAverages");

    if (frequency === "daily") {

    } else if (frequency === "weekly") {
      newIncome = newIncome / 7; // Convert weekly to daily 
    } else if (frequency === "monthly") {
      newIncome = newIncome / 30; // Convert monthly to daily   
    }

  await updateDoc(ref, {
    "dIncome": Number(newIncome)
  });
}

export async function updateCoreExpenses(newExpenses, frequency) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const ref = doc(db, "players", user.uid, "cashflowData", "dailyAverages");

    if (frequency === "daily") {

    } else if (frequency === "weekly") {
      newExpenses = newExpenses / 7; // Convert weekly to daily 
    } else if (frequency === "monthly") {
      newExpenses = newExpenses / 30; // Convert monthly to daily   
    }

  await updateDoc(ref, {
    "dCoreExpenses": Number(newExpenses)
  });
}
