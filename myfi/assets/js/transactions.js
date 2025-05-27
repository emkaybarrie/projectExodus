import { collection, query, where, getDocs, doc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from "./auth.js"; // adjust path if needed

function generateTransactionId(date, category, amount) {
  const input = `${date}-${category}-${amount}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `tx-${hash}`;
}

async function fetchExistingTransactionIds(userId) {
  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId),
    where("source", "==", "manual")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().transactionId);
}

async function saveManualTransactions(userId, entries) {
  const existingIds = await fetchExistingTransactionIds(userId);
  const existingSet = new Set(existingIds);

  const batch = writeBatch(db);

  entries.forEach(entry => {
    const transactionId = generateTransactionId(entry.date, entry.category, entry.amount);
    if (!existingSet.has(transactionId)) {
      const newDoc = doc(collection(db, "transactions")); // auto-ID
      batch.set(newDoc, {
        ...entry,
        userId,
        transactionId,
        source: "manual",
        entryDate: Timestamp.now()
      });
    }
  });

  await batch.commit();
}

async function testManualTransaction() {
  const user = auth.currentUser;
  if (!user) {
    console.log("No user is signed in.");
    return;
  }

  const testEntry = {
    date: "2025-05-26", // ISO format string
    category: "Needs",
    amount: -25.00
  };

  try {
    await saveManualTransactions(user.uid, [testEntry]);
    console.log("Test entry saved (if not duplicate).");
  } catch (err) {
    console.error("Error saving test entry:", err);
  }
}

let holdInterval;
let currentAmount = 0;
const incrementRate = 50; // ms between each increment
const incrementValue = 1;
let startY = 0;
let swipeThreshold = -30;
let currentCategory = '';

const amountDisplay = document.getElementById('amountDisplay');
const buttons = document.querySelectorAll('.circle-button');
const modal = document.getElementById('confirmationModal');
const modalCategory = document.getElementById('modalCategory');
const modalAmount = document.getElementById('modalAmount');

buttons.forEach(button => {
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    currentCategory = button.dataset.category;
    startY = e.clientY || e.touches?.[0]?.clientY || 0;
    currentAmount = 0;
    amountDisplay.textContent = currentAmount;

    holdInterval = setInterval(() => {
      currentAmount += incrementValue;
      amountDisplay.textContent = currentAmount;
    }, incrementRate);

    button.setPointerCapture(e.pointerId);
  });

//   button.addEventListener('pointerup', e => {
//     const endY = e.clientY || e.changedTouches?.[0]?.clientY || 0;
//     const deltaY = endY - startY;
//     clearInterval(holdInterval);

//     if (deltaY < swipeThreshold) {
//       showConfirmation();
//     } else {
//       resetAmount();
//     }
//   });

  button.addEventListener('pointerup', e => {
  const endY = e.clientY || e.changedTouches?.[0]?.clientY || 0;
  const deltaY = endY - startY;
  clearInterval(holdInterval);

    if (isTouchDevice) {
        if (deltaY < swipeThreshold) {
        showConfirmation();
        } else {
        resetAmount();
        }
    } else {
        // Desktop – auto-confirm on release
        showConfirmation();
    }
  });


  button.addEventListener('pointercancel', () => {
    clearInterval(holdInterval);
    resetAmount();
  });
});

function resetAmount() {
  currentAmount = 0;
  amountDisplay.textContent = 0;
}

function showConfirmation() {
  modalCategory.textContent = currentCategory;
  modalAmount.textContent = currentAmount;
  modal.classList.remove('hidden');
}

document.getElementById('confirmYes').addEventListener('click', () => {
  // 🔄 Placeholder: Save transaction
  const transaction = {
    category: currentCategory,
    amount: currentAmount
  };
  console.log('Transaction Saved:', transaction);

  modal.classList.add('hidden');
  resetAmount();
});

document.getElementById('confirmNo').addEventListener('click', () => {
  modal.classList.add('hidden');
  resetAmount();
});

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export { saveManualTransactions, testManualTransaction };
