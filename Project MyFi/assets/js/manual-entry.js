import { auth, db } from './auth.js';
import { getDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { unallocatedRefName, categories, subCategories, incomeCategory } from './config.js';


auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    const user = JSON.parse(window.localStorage.getItem('user'));
    loadExistingData(user.uid);
    
    
  }
});


document.getElementById('saveManualEntry').addEventListener('click', handleManualEntry);

async function handleManualEntry() {
  const user = JSON.parse(window.localStorage.getItem('user'));
  const userDocRef = doc(db, "players", user.uid);
  const userDoc = await getDoc(userDocRef);
  const playerData = userDoc.data();
  const monthsSinceStart = playerData.monthsSinceStart; // This is the date when the user created the account

  const incomeInput = parseFloat(document.getElementById('incomeInput').value) || 0;
  const mandatoryInput = parseFloat(document.getElementById('mandatoryInput').value) || 0;
  const supplementaryInput = parseFloat(document.getElementById('supplementaryInput').value) || 0;

  const currentBalance = parseFloat(document.getElementById('currentBalanceInput').value) || 0;

  const discretionary = {};
  subCategories[categories.discretionary].forEach(subCat => {
      discretionary[subCat] = 0;
  });

  let financeSummary = {
      income: incomeInput,
      expensesByCategory: {
            [categories.mandatory]: mandatoryInput,
            [categories.supplementary]: supplementaryInput,
            [categories.discretionary]: discretionary,
        },
        manualEntryDetails: {
            incomeInput: incomeInput,
            mandatoryInput: mandatoryInput,
            supplementaryInput: supplementaryInput
        }
  };


  if (!user.googleSheetLink) {
      financeSummary.income *= monthsSinceStart;
      financeSummary.expensesByCategory[categories.mandatory] *= monthsSinceStart;
      financeSummary.expensesByCategory[categories.supplementary] *= monthsSinceStart;

      console.log(incomeInput, mandatoryInput, supplementaryInput)
      const unallocated = (playerData.monthsSinceStart * (incomeInput - (mandatoryInput + supplementaryInput))) - (currentBalance - playerData.startBalance);
      console.log(financeSummary.expensesByCategory)

      financeSummary.expensesByCategory[categories.discretionary][unallocatedRefName] = unallocated

      financeSummary.currentBalance = currentBalance
      
  }

  await setDoc(userDocRef, { financeSummary, currentBalance }, { merge: true });

  window.location.href = 'dashboard.html';
}

document.getElementById('backToDashboard').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});



async function loadExistingData(uid) {
  const userDocRef = doc(db, "players", uid);
  const userDoc = await getDoc(userDocRef);
  

  if (userDoc.exists()) {
    const data = userDoc.data();
    console.log(data)
    if (data?.financeSummary?.manualEntryDetails) {
      const details = data.financeSummary.manualEntryDetails;
      document.getElementById('incomeInput').value = details.incomeInput || 0;
      document.getElementById('mandatoryInput').value = details.mandatoryInput || 0;
      document.getElementById('supplementaryInput').value =details.supplementaryInput || 0;
      
      document.getElementById('currentBalanceInput').value = data.currentBalance || 0;

      console.log(details.incomeInput, details.mandatoryInput, details.supplementaryInput, data.currentBalance - data.startBalance )

    }
  }
}
