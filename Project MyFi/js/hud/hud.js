import { triggerTrueLayerFetch } from "../core/truelayer.js";
import {
  loadTransactionsFromFirestore,
  processTransactions,
  loadClassifiedTransactionsFromFirestore
} from "../core/firestore.js";
import { auth } from "../core/auth.js";

// Import updated HUD vitals APIs
import {
  updateVitalsPools,
  initVitalsHUD,
  loadVitalsToHUD
} from "./modules/vitals.js";

export async function initHUD() {
  const userId = auth.currentUser.uid;

  // Ensure vitals snapshot exists and is fresh
  await updateVitalsPools(userId);

  // Start the animated HUD (includes live ghost + mode handling)
  initVitalsHUD(userId, 3600);

  console.log("HUD initialized");
}
