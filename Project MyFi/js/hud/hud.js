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
  startAliasListener,
  startLevelListener
} from "./modules/vitals.js";

export async function initHUD() {
  const userId = auth.currentUser.uid;

  startAliasListener(userId)
  startLevelListener(userId);

  // Ensure vitals snapshot exists and is fresh
  await updateVitalsPools(userId);

  // Start the animated HUD (includes live ghost + mode handling)
  initVitalsHUD(userId, 60);

  console.log("HUD initialized");
}
