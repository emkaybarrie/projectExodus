import { initManualEntryButton} from "./modules/transactionsLogging.js";
import { triggerTrueLayerFetch } from "../core/truelayer.js";
import { loadTransactionsFromFirestore, processTransactions, loadClassifiedTransactionsFromFirestore} from "../core/firestore.js";
import { auth } from "../core/auth.js";
import { updateVitalsPools, initVitalsHUD, loadVitalsToHUD } from "./modules/vitals.js";

export async function initHUD() {
  // Initialize HUD components


  // const refreshBtn = document.getElementById('refresh-link');
  // refreshBtn.addEventListener("click", async () => {
  //   // Global (non-account-specific) fetchers
  //   await triggerTrueLayerFetch("Accounts");
  //   await triggerTrueLayerFetch("Cards");

  //   // Account-specific fetchers
  //   await triggerTrueLayerFetch("Transactions");
  //   await triggerTrueLayerFetch("DirectDebits");
  //   await triggerTrueLayerFetch("StandingOrders");
  // });

  const userId = auth.currentUser.uid;

  // Test for Truelayer Raw Data fetch and prcoessing
  //const transactions = await loadTransactionsFromFirestore(userId);
  //const processedTransactions = processTransactions(transactions);
  //console.log("Processed Truelayer Transactions:", processedTransactions)
  
  // Test for classified transactions fetch 
  //const classifiedTransactions = await loadClassifiedTransactionsFromFirestore(userId);
  //console.log("Classified Transactions:", classifiedTransactions);

  
  updateVitalsPools(userId);
  //loadVitalsToHUD(userId)
  initVitalsHUD(userId, 60)

  console.log("HUD initialized");
}
