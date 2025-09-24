// /quests/personal.js
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
const functions = getFunctions(undefined, "europe-west2");

export async function createPersonalQuest({ title, notes = "", target = 1, deadline = null, recurring = false }) {
  return httpsCallable(functions, "createPersonalQuest")({ title, notes, target, deadline, recurring });
}
export async function updatePersonalQuest({ questId, title, notes, target, deadline, recurring }) {
  return httpsCallable(functions, "updatePersonalQuest")({ questId, title, notes, target, deadline, recurring });
}
export async function abandonQuest(questId) {
  return httpsCallable(functions, "abandonQuest")({ questId });
}
