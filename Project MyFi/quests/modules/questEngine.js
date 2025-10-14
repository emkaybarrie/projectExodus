// /quests/questEngine.js
import { app, auth, db } from "../../js/core/auth.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { on, emit, QuestEvents } from "./events.js";

const functions = getFunctions(app, "europe-west2");

let unsub = null;
let state = { list: [], byId: {} };

export function getQuests() { return state.list; }

export async function initQuestEngine() {
  const u = auth.currentUser;
  if (!u) return;

  // Make sure there’s a token before the first callable
  try { await u.getIdToken(/* forceRefresh */ false); } catch (e) { console.warn("[quests] getIdToken failed", e); }

  // Seed catalog (idempotent)
  try { await httpsCallable(functions, "seedQuestCatalog")({}); }
  catch (e) { console.warn("[quests] seed err", e?.message || e); }

  // Subscribe to user quests
  unsub?.();
  const qRef = collection(db, `players/${u.uid}/quests`);
  const q = query(qRef, orderBy("createdAt", "asc"));
  unsub = onSnapshot(q, snap => {
    const list = [];
    const byId = {};
    snap.forEach(d => {
      const v = { id: d.id, ...d.data() };
      byId[v.questId || v.id] = v;
      list.push(v);
    });
    state = { list, byId };
    emit("QUESTS_UPDATED", { list });
  });

  // Wire events → server progress
  const progress = httpsCallable(functions, "progressQuest");
  const fwd = async (name, payload) => {
    try { await progress({ event: name, metadata: payload || {} }); }
    catch (e) { console.warn("[quests] progress error", name, e?.message || e); }
  };

  Object.values(QuestEvents).forEach(evt => on(evt, p => fwd(evt, p)));
}

export async function claimQuestReward(questId) {
  await httpsCallable(functions, "claimReward")({ questId });
}

export async function acceptQuest(questId) {
  await httpsCallable(functions, "acceptQuest")({ questId });
}
