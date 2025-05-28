import { collection, query, where, getDocs, doc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from "./auth.js"; // adjust path if needed
import playerDataManager from "./playerDataManager.js";
import {hudBars} from './ui.js';

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


document.addEventListener("DOMContentLoaded", () => {
  // Overlay buttons
  document.getElementById("income-btn").addEventListener("click", () => showOverlay('income'));
  document.getElementById("expenses-btn").addEventListener("click", () => showOverlay('expenses'));
  document.getElementById("spending-btn").addEventListener("click", () => showOverlay('spending'));

  // Income overlay
  document.getElementById("income-cancel-btn").addEventListener("click", () => closeOverlay("income"));
  document.getElementById("income-confirm-btn").addEventListener("click", saveIncome);

  // Expenses overlay
  document.getElementById("add-mandatory-btn").addEventListener("click", () => addEntry("mandatory"));
  document.getElementById("add-supplementary-btn").addEventListener("click", () => addEntry("supplementary"));
  document.getElementById("close-expenses-btn").addEventListener("click", () => closeOverlay("expenses"));
  document.getElementById("confirm-expenses-btn").addEventListener("click", saveExpenses);

  // Spending overlay
  document.querySelectorAll(".category-option").forEach(btn => {
    btn.addEventListener("click", () => selectOption(btn, "category"));
  });

  document.querySelectorAll(".group-option").forEach(btn => {
    btn.addEventListener("click", () => selectOption(btn, "group"));
  });

  document.getElementById("cancel-spending-btn").addEventListener("click", () => closeOverlay("spending"));
  document.getElementById("confirm-spending-btn").addEventListener("click", logSpending);

  // Handle remove button (for dynamically created entries)
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('remove-entry-btn')) {
      const entryDiv = e.target.closest('.expense-entry');
      if (entryDiv) entryDiv.remove();
    }
  });
});

// --- Overlays ---
function showOverlay(id) {
  document.getElementById(`${id}-overlay`).style.display = 'flex';
}

function closeOverlay(id) {
  document.getElementById(`${id}-overlay`).style.display = 'none';
}

// --- Income ---
function saveIncome() {
  const amount = document.getElementById("income-input").value;
  console.log("Income saved:", amount); // Replace with playerDataManager logic
  closeOverlay("income");
}

// --- Expenses ---
function addEntry(type) {
  const list = document.getElementById(`${type}-list`);
  const div = document.createElement("div");
  div.classList.add("expense-entry");

  const today = new Date();
  const currentDay = today.getDate();

  let dayOptions = "";
  for (let i = 1; i <= 31; i++) {
    dayOptions += `<option value="${i}" ${i === currentDay ? "selected" : ""}>${i}</option>`;
  }

  div.innerHTML = `
    <input type="text" placeholder="Name" class="entry-name" />
    <input type="number" placeholder="Amount" class="entry-amount" min="0" />
    <select class="entry-day">${dayOptions}</select>
    <button class="remove-entry-btn">X</button>
  `;

  list.appendChild(div);
}

function saveExpenses() {
  const expenseEntries = {
    mandatory: [],
    supplementary: []
  };

  ['mandatory', 'supplementary'].forEach(type => {
    const entries = document.querySelectorAll(`#${type}-list .expense-entry`);
    expenseEntries[type] = Array.from(entries).map(entry => ({
      name: entry.querySelector('.entry-name').value,
      amount: parseFloat(entry.querySelector('.entry-amount').value),
      date: parseInt(entry.querySelector('.entry-day').value)
    }));
  });

  console.log("Saved expenses:", expenseEntries); // Replace with playerDataManager logic
  closeOverlay("expenses");
}

// --- Spending ---
let spendingState = {
  category: null,
  group: null
};

function selectOption(button, field) {
  const buttons = button.parentNode.querySelectorAll("button");
  buttons.forEach(btn => btn.classList.remove("selected"));
  button.classList.add("selected");
  spendingState[field] = button.textContent;
}

// function logSpending() {
//   const amount = document.getElementById("spend-amount").value;
//   console.log("Spending logged:", { ...spendingState, amount }); // Replace with playerDataManager logic

//    hudBars['wants'].adjustAvailable(-parseInt(amount)); // increases 'wants' bar availableAmount by 10
//   closeOverlay("spending");
// }

function logSpending() {
  const amountInput = document.getElementById("spend-amount");
  const amount = parseInt(amountInput.value);

  if (!spendingState.category) {
    alert('Please select a category before logging spending.');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount greater than zero.');
    return;
  }

  console.log("Spending logged:", { ...spendingState, amount });

  const categoryKey = spendingState.category.toLowerCase();

  if (hudBars[categoryKey]) {
    hudBars[categoryKey].adjustAvailable(-amount);
  } else {
    console.warn(`No hudBar found for category: ${categoryKey}`);
  }

  // Reset inputs and state for next entry
  amountInput.value = '';
  spendingState.category = null;
  spendingState.group = null;

  // Clear selection highlights for category and group buttons
  document.querySelectorAll(".category-option, .group-option").forEach(btn => {
    btn.classList.remove("selected");
  });

  closeOverlay("spending");
}





export { saveManualTransactions, testManualTransaction };
