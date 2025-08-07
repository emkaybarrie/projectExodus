import { auth, db, logoutUser } from '../core/auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { categories, subCategories, incomeCategory, unallocatedRefName } from './config.js';
import { gapiLoaded, gisLoaded, extractSheetId, validateSheet, fetchSheetData, openGooglePicker  } from "./api.js";
import { saveManualTransactions, testManualTransaction } from "../transactions.js";
import playerDataManager from "../playerDataManager.js";


import { generateCashflowData, generateHudData, generateAvatarData  } from './calculations.js';  
import { renderProfile, hudBars, renderHUD, showManualEntryButton, hideManualEntryButton,showLinkAccountButton, 
    hideLinkAccountButton, hideUnlinkAccountButton , showUnlinkAccountButton, setSegmentsCount, openPaymentModal, 
    openLinkSheetModal, closeSheetModal, showTooltip, hideTooltip,updateTooltipPosition,
    submitPayment} from '../ui.js';

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
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { openLinkSheetModal()});
  });
  // Close Modal
document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('cancel-btn');
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { closeSheetModal()});
  });

  document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('unlink-sheet-btn');
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { unlinkSheet()});
  });

  document.addEventListener('DOMContentLoaded', () => {
    const linksheetBtn = document.getElementById('refresh-link-sheet-btn');
    if (linksheetBtn) linksheetBtn.addEventListener('click', () => { openGooglePicker()});
  });

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
        // loadDashboard(playerData);

        
       
       
    }
});

export async function loadDashboard(playerData) {
   
    //const playerData = await getPlayerData()
    console.log("Initialising Dashboard...");

    if (playerData.alias !== undefined) {
                

                const monthsSinceStart = parseFloat((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30.44));


                playerDataManager.update({
                    monthsSinceStart: monthsSinceStart 
                });

          
                  playerDataManager.on('update', (player) => {
                    console.log('Player data updated:', player.hudData);
                    // Here you can call your HUD render/update logic to refresh UI
                  });

    } else {
        console.error("Alias or balance missing.");
        window.location.href = 'login.html';
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



// Update user data in Firestore
export async function updateUserData(income, expenses, balance, transactionStartDate) {
    const user = JSON.parse(localStorage.getItem('user'));
    const userDocRef = doc(db, "players", user.uid);
    const playerData = {
        financeSummary: { income, expensesByCategory: expenses, currentBalance: balance, transactionStartDate }
    };
    await setDoc(userDocRef, playerData, { merge: true });
    
}

  
