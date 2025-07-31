import { auth, db } from './auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { logoutUser } from './auth.js';
import { categories, subCategories, incomeCategory, unallocatedRefName } from './config.js';
import { gapiLoaded, gisLoaded, extractSheetId, validateSheet, fetchSheetData, openGooglePicker  } from "./api.js";
import { saveManualTransactions, testManualTransaction } from "./transactions.js";
import playerDataManager from "./playerDataManager.js";


import { generateCashflowData, generateHudData, generateAvatarData  } from './calculations.js';  
import { renderProfile, hudBars, renderHUD, showManualEntryButton, hideManualEntryButton,showLinkAccountButton, 
    hideLinkAccountButton, hideUnlinkAccountButton , showUnlinkAccountButton, setSegmentsCount, openPaymentModal, 
    openLinkSheetModal, closeSheetModal, showTooltip, hideTooltip,updateTooltipPosition,
    submitPayment} from './ui.js';

const DataManager = {
  data: {},
  
  load() {
    const local = localStorage.getItem("gameData");
    this.data = local ? JSON.parse(local) : {};
    // Optional fallback from Firestore
  },

  get(key) {
    return this.data[key];
  },

  set(key, value) {
    this.data[key] = value;
    localStorage.setItem("gameData", JSON.stringify(this.data));
  },

  bulkSet(obj) {
    Object.assign(this.data, obj);
    localStorage.setItem("gameData", JSON.stringify(this.data));
  },

  syncToFirestore() {
    saveToFirestore(this.data);
  }
};

// Tooltips

// Add event listeners for elements with 'tooltip-target' class
// const tooltipElements = document.querySelectorAll('.tooltip-target');
// tooltipElements.forEach(element => {
//   element.addEventListener('mouseover', showTooltip);
//   element.addEventListener('mousemove', updateTooltipPosition); // Update tooltip position as cursor moves
//   element.addEventListener('mouseout', hideTooltip);
// });

// Utility: poll until the given checkFn returns true
function waitForLibrary(name, checkFn) {
    return new Promise(resolve => {
      (function poll() {
        if (checkFn()) return resolve();
        setTimeout(poll, 50);
      })();
    });
  }
  
  // Bootstrap Google APIs on DOM ready
  async function initGoogleStuff() {
    // 1) Wait for GAPI (api.js) to load
    await waitForLibrary('gapi', () => window.gapi && gapi.load);
    gapiLoaded();
  
    // 2) Wait for GIS library
    await waitForLibrary('gis', () => window.google?.accounts?.oauth2);
    gisLoaded();
  }
  
  window.addEventListener('DOMContentLoaded', initGoogleStuff);

  // Google Picker


window.addEventListener('DOMContentLoaded', async () => {
    await waitForLibrary('gapi', () => window.gapi?.load);
    gapiLoaded();
  
    await waitForLibrary('gis', () => window.google?.accounts?.oauth2);
    gisLoaded();
  });

  
// Link/Unlink Sheet Modal
document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('link-sheet-btn');
    ; // or pass a specific amount if you like
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { openLinkSheetModal()});
  });
  // Close Modal
document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('cancel-btn');
    ; // or pass a specific amount if you like
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { closeSheetModal()});
  });

  document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('unlink-sheet-btn');
    ; // or pass a specific amount if you like
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { unlinkSheet()});
  });

  document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('refresh-link-sheet-btn');
    ; // or pass a specific amount if you like
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { openGooglePicker()});
  });

  // --- Manual link handler ---
const confirmBtn  = document.getElementById('confirm-btn');
const sheetLinkIn = document.getElementById('sheet-link');

confirmBtn.addEventListener('click', async () => {
    const raw     = sheetLinkIn.value.trim();
    const sheetId = extractSheetId(raw);
    if (!sheetId) {
      return alert('Invalid Google Sheets URL.');
    }
  
    // 1) Save the sheetId
    const user = JSON.parse(localStorage.getItem('user'));
    await setDoc(doc(db, 'players', user.uid), { sheetId }, { merge: true });
  
    // 2) Fetch & display row 2, using API→CSV fallback
    try {
      await fetchSheetData(sheetId);
      alert('✅ Sheet linked and row 2 fetched!');
    } catch (err) {
      console.error('Both OAuth and CSV fetch failed:', err);
      alert('❌ Could not load Sheet. Is it publicly shared?');
    }
  
    // 3) Close modal & signal link complete
    document.dispatchEvent(new Event('sheetLinked'));
  });

// --- Listen for row2Fetched to update preview ---
window.addEventListener('row2Fetched', e => {
  document.getElementById('preview-row2').innerText =
    JSON.stringify(e.detail, null, 2);
});

document.addEventListener('sheetLinked', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const link = `https://docs.google.com/spreadsheets/d/${user.sheetId}`;
    const openBtn = document.createElement('button');
    openBtn.textContent = 'Open linked Sheet';
    openBtn.onclick = () => window.open(link, '_blank');
    document.body.appendChild(openBtn);
  });


// Core Code 
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
       
    } else {
        window.localStorage.setItem('user', JSON.stringify(user));
        
        const userRef = doc(db, 'players', user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            const startDate = new Date();
            await setDoc(userRef, { startDate: startDate }, { merge: true });
        }

        const playerData = await playerDataManager.init(user.uid).then((player) => {
            console.log("Player data loaded:", player.alias);
            return player
        });

       console.log(playerData)
        loadDashboard(playerData);

        
       
       
    }
});


export async function loadDashboard(playerData) {
   
    //const playerData = await getPlayerData()
    console.log("Initialising Dashboard...");

    if (playerData.alias !== undefined) {
                
                // ✅ Handle startDate
                let startDate = null
                if (playerData.financeSummary.transactionStartDate){
                    startDate = playerData.financeSummary.transactionStartDate
                    

                    const [day, month, year] = startDate.split("/");
                    startDate = new Date(`${year}-${month}-${day}`);
                 
                    
                } else {
                    startDate = playerData.startDate ? playerData.startDate.toDate() : null;
                    if (!startDate) {
                        console.error("Start date is missing!");
                        return;
                    }
                }

            
                const monthsSinceStart = parseFloat((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30.44));


                playerDataManager.update({
                    monthsSinceStart: monthsSinceStart 
                });

           

                if (playerData.sheetId) {
                    
                    console.log("Linked Account Detected.  Importing Transaction Data...")
            
                    loadTransactionData(playerData.sheetId);

                    hideManualEntryButton();
                    hideLinkAccountButton();

                    showUnlinkAccountButton();
                } else {
                    console.log("No Linked Account Detected.  Activating Manual Entry Mode...")
                    showManualEntryButton();
                    showLinkAccountButton();
                    hideUnlinkAccountButton();
                }

              
                    // Run every 5 seconds
                   // setInterval(hudAdjustment, 5000);
                    
                    // Calculate
                    console.log("Refreshing Cashflow Data...")
                     await generateCashflowData()
                    console.log("Refreshing HUD Data...")
                     await generateHudData()
                    console.log("Refreshing Avatar Data...")
                     await generateAvatarData()
                    //  setInterval(() => {
                    
                    //     generateCashflowData()
                    //      generateHudData()
                    //     const player = playerDataManager.get();
                    //         if (!player) {
                    //             console.warn('No player loaded yet');
                    //             return;
                    //         }

                    //         player.hudData ??= {};
                    //     const key = 'hudData.availableResource_Growth';
                    //     const current = player.hudData.availableResource_Growth ?? 0;
                    //     const cap = player.hudData.dSpendingCap_Growth ?? 100;
                    //     const newVal = Math.min(current + 1, cap);
                    //     playerDataManager.updateByKey(key, newVal);

                    // }, 500);

    
                    playerData = await playerDataManager.save();
               
                    // Render
                    //setInterval(() => {
                    // your regeneration or rendering logic here
                    renderProfile()
                    renderHUD()
                   // }, 1000);

                   testManualTransaction();




                  playerDataManager.on('update', (player) => {
                    console.log('Player data updated:', player.hudData);
                    // Here you can call your HUD render/update logic to refresh UI
                  });
            

                    // renderMetrics 

                        const cashflowData = playerData.financeSummary.cashflowData
                        const ctx = document.getElementById('metricsChart').getContext('2d');

                        const metricsChart = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: ['Income', 'Mandatory', 'Supplementary', 'Discretionary'],
                                datasets: [{
                                    label: 'Average Daily Totals',
                                    data: [cashflowData.dAvgIncome, cashflowData.dAvgSpending_Mandatory, cashflowData.dAvgSpending_Supplementary,cashflowData.dAvgSpending_Discretionary],
                                    backgroundColor: [
                                        '#6200ea',
                                        '#bb86fc',
                                        '#985eff',
                                        '#7f39fb',
                                        '#3700b3'
                                    ],
                                    borderRadius: 6
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false, // Let the parent container control size
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: { color: '#ccc' },
                                        grid: { color: '#444' }
                                    },
                                    x: {
                                        ticks: { color: '#ccc' },
                                        grid: { color: '#444' }
                                    }
                                },
                                plugins: {
                                    legend: {
                                        labels: {
                                            color: '#ccc'
                                        }
                                    }
                                },
                                animation: {
                                    duration: 2000, // milliseconds
                                    easing: 'easeOutBounce' // other options: 'linear', 'easeInOutQuart', etc.
                                },
                            }
                        });

                        const ctx2 = document.getElementById('metricsChart2').getContext('2d');

                        const metricsChart2 = new Chart(ctx2, {
                            type: 'line',
                            data: {
                                labels: ['Day 1', 'Day 3', 'Day 5', 'Day 7'],
                                datasets: [{
                                    label: 'Daily Spending',
                                    data: [cashflowData.dAvgIncome, cashflowData.dAvgSpending_Mandatory, cashflowData.dAvgSpending_Supplementary, cashflowData.dAvgSpending_Discretionary],
                                    backgroundColor: [
                                        '#6200ea',
                                        '#bb86fc',
                                        '#985eff',
                                        '#7f39fb',
                                        '#3700b3'
                                    ],
                                    borderRadius: 6
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false, // Let the parent container control size
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: { color: '#ccc' },
                                        grid: { color: '#444' }
                                    },
                                    x: {
                                        ticks: { color: '#ccc' },
                                        grid: { color: '#444' }
                                    }
                                },
                                plugins: {
                                    legend: {
                                        labels: {
                                            color: '#ccc'
                                        }
                                    }
                                },
                                animation: {
                                    duration: 2000, // milliseconds
                                    easing: 'easeOutBounce' // other options: 'linear', 'easeInOutQuart', etc.
                                },
                            }
                        });
                    
       

    } else {
        console.error("Alias or balance missing.");
        window.location.href = 'login.html';
    }


}


function hudAdjustment(){
  hudBars['wants'].adjustAvailable(7); // increases 'wants' bar availableAmount by 10
  hudBars['needs'].adjustAvailable(-5); // decreases 'needs' bar availableAmount by 5
}

function setRandomHUDUpdate() {
    console.log('Random Update')
    const subCats = ['Wants'];
  const subCat = subCats[Math.floor(Math.random() * subCats.length)];
  const logicIndex = 2// Math.floor(Math.random() * 3);

  const player = playerDataManager.get();
  if (!player) {
    console.warn('No player loaded yet');
    return;
  }

  player.hudData ??= {};

  
  switch (logicIndex) {
    case 0:
      {
        const key = `hudData.availableResource_${subCat}`;
        const current = player.hudData[`availableResource_${subCat}`] ?? 0;
        const cap = player.hudData[`dSpendingCap_${subCat}`] ?? 100;
        const newVal = Math.min(current + 5, cap);
        playerDataManager.updateByKey(key, newVal);

      }
      break;
    case 1:
      {
        const key = `hudData.availableResource_${subCat}`;
        const current = player.hudData[`availableResource_${subCat}`] ?? 0;
        const newVal = Math.max(current - 10, 0);
        playerDataManager.updateByKey(key, newVal);
      }
      break;
    case 2:
      {
        const key = `hudData.storedDays_${subCat}`;
        const current = player.hudData[`storedDays_${subCat}`] ?? 0;
        const newVal = current + 1;
        playerDataManager.updateByKey(key, newVal);
      }
      break;
  }


}

  const modes = ['Daily', 'Weekly', 'Monthly'];
  const modeColors = {
    Daily: '#3498db',   // Blue
    Weekly: '#2ecc71',  // Green
    Monthly: '#e67e22'  // Orange
  };

  let currentModeIndex = 0;

  const modeButton = document.getElementById('modeToggle');

  function updateButtonUI(mode) {
    modeButton.textContent = `${mode}`;
    modeButton.style.backgroundColor = modeColors[mode];
  }

  function triggerModeLogic(mode) {
    console.log("Switched to mode:", mode);
    
    // TODO: Insert your logic here for each mode
    if (mode === 'Daily') {
      // triggerDailyLogic();
      playerDataManager.update({
          hudData: {
            mode: "Daily"
          } 
      });
      console.log(playerDataManager.get())
      
      setSegmentsCount(3)
    } else if (mode === 'Weekly') {
      // triggerWeeklyLogic();
      playerDataManager.update({
        hudData: {
          mode: "Weekly"
        } 
    });
  
      setSegmentsCount(7)
    } else if (mode === 'Monthly') {
      // triggerMonthlyLogic();
      setSegmentsCount(30.44)
      playerDataManager.update({
        hudData: {
          mode: "Monthly"
        } 
    });
      
    }
    const playerData = playerDataManager.get()
    generateHudData()
    loadDashboard(playerData)
  }

  modeButton.addEventListener('pointerdown', () => {
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    const newMode = modes[currentModeIndex];
    updateButtonUI(newMode);
    triggerModeLogic(newMode);
  });

  // Initialize on page load
  updateButtonUI(modes[currentModeIndex]);









// Logout and Manual Entry button setup
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    const manualBtn = document.getElementById('manual-entry-btn');

    if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);
    if (manualBtn) manualBtn.addEventListener('click', () => {
        window.location.href = 'manual-entry.html';
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const sendContributionBtn = document.getElementById('send-contribution-btn');
    const discretionaryData = JSON.parse(localStorage.getItem('discretionaryData'))
    // or pass a specific amount if you like
    if (sendContributionBtn) sendContributionBtn.addEventListener('click', () => { openPaymentModal(Math.round(discretionaryData.dContributionsTarget_Community)
    )});
  });
// IGC Purchases
  document.addEventListener('DOMContentLoaded', () => {
    const sendContributionBtn = document.getElementById('purchase-igc-btn');
    const discretionaryData = JSON.parse(localStorage.getItem('discretionaryData'))
    // or pass a specific amount if you like
    if (sendContributionBtn) sendContributionBtn.addEventListener('click', () => { openPaymentModal(Math.round(discretionaryData.dContributionsTarget_IGC)
    )});
  });
// Enter The Badlands
document.addEventListener('DOMContentLoaded', () => {
    const enterBadlandsBtn = document.getElementById('enter-badlands-btn');
    if (enterBadlandsBtn) enterBadlandsBtn.addEventListener('click', () => { window.open('https://emkaybarrie.github.io/foranteGamesStudio/badlands/', '_blank')});
  });

  const paymentMethodSelect = document.getElementById('paymentMethod');
  const paymentDetailsDiv = document.getElementById('paymentDetails');
  const qrCodeDiv = document.getElementById('qrCode');


  const paymentInfo = {
    monzo: {
      label: "Pay via Monzo.Me",
      link: "https://monzo.me/emkaybarrie?amount=10.00&d=Reference+Test"
    },
    bank: {
      label: "Bank Transfer: Sort 12-34-56 Acc 12345678",
      link: "SortCode:123456;AccNo:12345678"
    },
    paypal: {
      label: "Pay via PayPal",
      link: "https://paypal.me/emkaybarrie@gmail.com/5"
    },
    crypto: {
      label: "Send USDC to wallet address below",
      link: "0xYourEthereumWalletAddressHere"
    }
  };

  const qr = new QRious({
    element: document.createElement('canvas'),
    size: 200,
    value: ''
  });

  paymentMethodSelect.addEventListener('change', (e) => {
    const method = e.target.value;
    const { label, link } = paymentInfo[method];

    paymentDetailsDiv.innerText = label;

    // Update QR code value
    qr.value = link;

    // Clear and re-add QR
    qrCodeDiv.innerHTML = '';
    qrCodeDiv.appendChild(qr.element);

    const submit = document.getElementById('submit-payment');
    if (submit) submit.style.display = 'block';
    const qrHeader = document.getElementById('qrHeader');
    if (qrHeader) qrHeader.style.display = 'block';

  });


document.getElementById('close-payment-modal').addEventListener('click', () => {
    document.getElementById('payment-modal').style.display = 'none';
    const qrHeader = document.getElementById('qrHeader');
    if (qrHeader) qrHeader.style.display = 'none';
  });


export function saveToLocalStorage(storageReference, value){
    window.localStorage.setItem(storageReference, JSON.stringify(value))
    return JSON.parse(localStorage.getItem(storageReference))
}

export function loadFromLocalStorage(storageReference){
    return JSON.parse(localStorage.getItem(storageReference))
}

export async function saveAvatarDataToFireStore(avatarDataInput = null){
    const avatarData = avatarDataInput ?  avatarDataInput : loadFromLocalStorage('avatarData')
    
    console.log("Data to Save to Attributes: ", avatarData )

    const user = JSON.parse(localStorage.getItem('user'));
    const playerRef = doc(db, 'players', user.uid);

    try {
    await setDoc(playerRef, {
    avatarData: avatarData
    }, { merge: true });

    window.localStorage.setItem('avatarData', avatarData)

    const user = JSON.parse(localStorage.getItem('user'));
    //fetchDataAndRenderMyFiDashboard(user.uid)
    //alert("Your attributes have been saved!");
    } catch (err) {
    console.error("Error saving to Firestore:", err);
    //alert("There was an error saving your choices.");
    }
}

export async function getPlayerData(){ // Check local then fallback to DB
    const user = JSON.parse(localStorage.getItem('user'));
    const userRef = doc(db, 'players', user.uid);

    try {
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const playerData = userDoc.data();
      
            return playerData
            
        }
    } catch (error) {
        console.error("Error fetching Firestore document:", error);
    }
}

export async function saveAttributesToFirestore(attributeDataInput = null) {
    

    const attributeData = attributeDataInput ?  attributeDataInput : loadFromLocalStorage('attributeData')
    
    console.log("Data to Save to Attributes: ", attributeData )

    const confirmed = confirm("Are you sure you want to lock in your choices? This cannot be undone.");
    if (!confirmed) return;

    const user = JSON.parse(localStorage.getItem('user'));
    const playerRef = doc(db, 'players', user.uid);

    try {
    await setDoc(playerRef, {
    attributePoints: attributeData
    }, { merge: true });

    window.localStorage.setItem('attributeData', attributeData)

    const user = JSON.parse(localStorage.getItem('user'));
    fetchDataAndRenderMyFiDashboard(user.uid)
    alert("Your attributes have been saved!");
    } catch (err) {
    console.error("Error saving to Firestore:", err);
    alert("There was an error saving your choices.");
    }
}

async function unlinkSheet() {
    const confirmed = confirm("Are you sure you want to unlink your Google Sheet?");
    if (!confirmed) return;

    const user = JSON.parse(window.localStorage.getItem('user'));
    if (!user || !user.uid) {
        alert("User not found or not logged in.");
        return;
    }

    const userDocRef = doc(db, "players", user.uid);

    try {
        await updateDoc(userDocRef, {
            sheetId: deleteField(),
            transactionStartDate: deleteField()

        });
        alert("Your Google Sheet has been successfully unlinked.");
    } catch (error) {
        console.error("Error unlinking Google Sheet:", error);
        alert("An error occurred while unlinking. Please try again.");
    }

    fetchDataAndRenderMyFiDashboard(user.uid)
}



// MOVE TO GGOGLE API FILE
    // Fetch Transactions from Google Sheets

// Fetch Transactions from Google Sheets
export async function loadTransactionData(storedDataSourceID = null) {
    //const storedDataSourceID = localStorage.getItem('transactionDataSourceID');
    const storedData = localStorage.getItem('transactionData');
      
        if (storedData) {
            // Parse the stored data
             const parsedData = JSON.parse(storedData);
             //console.log('Stored Data available', parsedData )
             if (Array.isArray(parsedData)) {
                const transactions = parsedData.slice(1).map(row => ({
                    date: row[1], // assuming column B is date
                    category: row[6], // assuming column G is category
                    amount: parseFloat(row[7]), // assuming column H is amount
                }));
    
            

                const { totalIncome, expensesByCategory, balance, transactionStartDate } = await processTransactions(transactions);
                await updateUserData(totalIncome, expensesByCategory, balance, transactionStartDate);


            } else {
                console.error('Data structure is not an array.');
            }

            
        } else {
            fetchSheetData(storedDataSourceID)
        }
  
}

// ✍️ Process and Store Transactions in Firestore
export async function processTransactions(transactions) {
    const user = JSON.parse(window.localStorage.getItem('user'));
    const userDocRef = doc(db, "players", user.uid);

    
    const transactionStartDate = "01/04/2025"//transactions[0].date - need to figure out either system to work well with first start date or sync to first day if month of  account opening date

    let expensesByCategory = {
        [categories.mandatory]: 0,
        [categories.supplementary]: 0,
        [categories.discretionary]: {},
    };

    // Initialize discretionary subcategories
    subCategories[categories.discretionary].forEach(subCat => {
        expensesByCategory[categories.discretionary][subCat] = 0;
    });

    let totalIncome = 0;
    let balance = 0
    const startDateStr = transactionStartDate
    const [day, month, year] = startDateStr.split('/');
    const monitoringStartDate = new Date(`${year}-${month}-${day}`); // Replace with your actual start date 

    transactions.forEach(transaction => {
        const dateStr = transaction.date
        const [day, month, year] = dateStr.split('/');
        const transactionDate = new Date(`${year}-${month}-${day}`); // Format to YYYY-MM-DD//new Date(transaction.date);

    
        if (transactionDate < monitoringStartDate) return; // Skip if after monitoring start

        if (transaction.amount > 0) {
            totalIncome += transaction.amount;
        } else {
            const category = transaction.category || unallocatedRefName;

            if (category === categories.mandatory) {
                expensesByCategory[categories.mandatory] += Math.abs(transaction.amount);
            } else if (category === categories.supplementary) {
                expensesByCategory[categories.supplementary] += Math.abs(transaction.amount);
            } else if (subCategories[categories.discretionary].includes(category)) {
                expensesByCategory[categories.discretionary][category] += Math.abs(transaction.amount);
            } else {
                expensesByCategory[categories.discretionary][unallocatedRefName] += Math.abs(transaction.amount);
            }
        }

        balance += transaction.amount
    });
    
    return { totalIncome, expensesByCategory, balance, transactionStartDate };

}

// Update user data in Firestore
export async function updateUserData(income, expenses, balance, transactionStartDate) {
    const user = JSON.parse(localStorage.getItem('user'));
    const userDocRef = doc(db, "players", user.uid);
    const playerData = {
        financeSummary: { income, expensesByCategory: expenses, currentBalance: balance, transactionStartDate }
    };
    await setDoc(userDocRef, playerData, { merge: true });
    
}


        
        
        
        

        
        
