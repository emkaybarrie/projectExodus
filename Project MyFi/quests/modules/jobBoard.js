// /quests/jobBoard.js
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const functions = getFunctions(undefined, "europe-west2");

/**
 * Fetch eligible quests for job board.
 * For v1 we’ll keep it simple: client reads catalog and locally filters by "availability.mode === manual",
 * and hides those the user already has in their log (from questEngine.getQuests()).
 * If you prefer server filtering, create a callable listEligibleQuests().
 */
export async function grantIfEligible(questId) {
  // For manual availability, we must call the server to verify and add to log.
  return httpsCallable(functions, "grantQuestIfEligible")({ questId });
}
