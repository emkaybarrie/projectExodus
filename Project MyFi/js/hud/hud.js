
import { triggerTrueLayerFetch } from "../core/truelayer.js";
import { loadTransactionsFromFirestore, processTransactions, loadClassifiedTransactionsFromFirestore} from "../core/firestore.js";
import { auth } from "../core/auth.js";
import { updateVitalsPools, initVitalsHUD, loadVitalsToHUD } from "./modules/vitals_v6.js";

export async function initHUD() {
  // Initialize HUD components

  const userId = auth.currentUser.uid;

  await updateVitalsPools(userId);
  //loadVitalsToHUD(userId)
  initVitalsHUD(userId, 60)

  console.log("HUD initialized");
}
