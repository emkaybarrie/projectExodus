
import { auth } from "../core/auth.js";

// Import updated HUD vitals APIs
import {
  refreshVitals,
  initVitalsHUD,
  startAliasListener,
  startLevelListener,
  
} from "../../energy/energy-vitals.js";

export async function initHUD() {
  const userId = auth.currentUser.uid;

  startAliasListener(userId)
  startLevelListener(userId);

  // Ensure vitals snapshot exists and is fresh (server-authoritative)
  await refreshVitals(); // writes/returns server snapshot immediately

  // Start the animated HUD (includes live ghost + mode handling)
  initVitalsHUD(userId, 1); 
  
  console.log("HUD initialized");
}
