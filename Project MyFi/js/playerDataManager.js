import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.4/+esm";

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* -----------------------------------------------------------
   Firebase singletons
----------------------------------------------------------- */
const auth = getAuth();
const firestore = getFirestore();

/* -----------------------------------------------------------
   In-memory store
----------------------------------------------------------- */
const memoryStore = {
  player: null,
  lastSaved: 0,
};

/* -----------------------------------------------------------
   Dexie (local cache) — store timestamps as millis
----------------------------------------------------------- */
const db = new Dexie("PlayerDataDB");
db.version(1).stores({
  playerData: "&id, lastUpdated",
});

/* -----------------------------------------------------------
   Timestamp helpers (cache-safe)
----------------------------------------------------------- */
function isSecondsNanosMap(v) {
  return (
    v &&
    typeof v === "object" &&
    Number.isInteger(v.seconds) &&
    Number.isInteger(v.nanoseconds)
  );
}

function tsToMillis(ts) {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (isSecondsNanosMap(ts))
    return ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6);
  if (typeof ts === "number") return ts;
  return null;
}

function millisToTimestamp(ms) {
  return typeof ms === "number" ? Timestamp.fromMillis(ms) : null;
}

// Prepare object for cache (convert Firestore Timestamps to millis)
function normalizeForCache(player) {
  if (!player || typeof player !== "object") return player;
  const copy = { ...player };
  if ("startDate" in copy)    copy.startDate    = tsToMillis(copy.startDate);
  if ("createdAt" in copy)    copy.createdAt    = tsToMillis(copy.createdAt);
  if ("updatedAt" in copy)    copy.updatedAt    = tsToMillis(copy.updatedAt);
  if (copy.onboarding && typeof copy.onboarding === "object") {
    if ("welcomeDoneAt" in copy.onboarding) {
      copy.onboarding = { ...copy.onboarding, welcomeDoneAt: tsToMillis(copy.onboarding.welcomeDoneAt) };
    }
  }
  return copy;
}

// Prepare object for in-app use (convert millis to Timestamps)
function normalizeFromCache(cached) {
  if (!cached || typeof cached !== "object") return cached;
  const copy = { ...cached };
  if ("startDate" in copy)    copy.startDate    = millisToTimestamp(copy.startDate);
  if ("createdAt" in copy)    copy.createdAt    = millisToTimestamp(copy.createdAt);
  if ("updatedAt" in copy)    copy.updatedAt    = millisToTimestamp(copy.updatedAt);
  if (copy.onboarding && typeof copy.onboarding === "object") {
    if ("welcomeDoneAt" in copy.onboarding) {
      copy.onboarding = { ...copy.onboarding, welcomeDoneAt: millisToTimestamp(copy.onboarding.welcomeDoneAt) };
    }
  }
  return copy;
}

/* -----------------------------------------------------------
   Utils
----------------------------------------------------------- */
function getCurrentUserId() {
  const user = auth.currentUser;
  return user?.uid || null;
}

function createDefaultPlayer(id) {
  return {
    id,
    level: 1,
    lastUpdated: Date.now(),
    portraitKey: "default",
    // NOTE: startDate/onboardedAt are set server-side only.
  };
}

function deepMerge(target, updates) {
  for (const key in updates) {
    if (
      typeof updates[key] === "object" &&
      updates[key] !== null &&
      !Array.isArray(updates[key])
    ) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], updates[key]);
    } else {
      target[key] = updates[key];
    }
  }
  return target;
}

/* -----------------------------------------------------------
   Transaction-safe startDate create/repair (IMMUTABLE)
----------------------------------------------------------- */
async function ensureStartDateOnce(uid) {
  const ref = doc(firestore, "players", uid);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      // create minimal doc with immutable startDate
      tx.set(ref, {
        startDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return;
    }
    const sd = snap.data().startDate;
    if (!sd) {
      tx.set(ref, { startDate: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }
    // if present as a proper Timestamp, do nothing.
  });
}

async function repairStartDateIfNeeded(uid) {
  const ref = doc(firestore, "players", uid);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const sd = snap.data().startDate;
    if (!sd) return;

    const isTs = typeof sd?.toMillis === "function";
    const looksLikeMap =
      sd && typeof sd === "object" && Number.isInteger(sd.seconds) && Number.isInteger(sd.nanoseconds);

    if (looksLikeMap && !isTs) {
      const ms = sd.seconds * 1000 + Math.floor(sd.nanoseconds / 1e6);
      tx.update(ref, { startDate: Timestamp.fromMillis(ms) });
    }
  });
}



/* -----------------------------------------------------------
   Player Data Manager (public API unchanged)
----------------------------------------------------------- */
const playerDataManager = (() => {
  let syncInterval = null;
  const saveFrequency_Minutes = 10;
  const syncFrequencyMs = saveFrequency_Minutes * 60 * 1000;

  const listeners = { update: [], save: [], load: [] };

  function on(event, callback) {
    if (listeners[event]) listeners[event].push(callback);
  }
  function trigger(event, data) {
    listeners[event]?.forEach((cb) => {
      try { cb(data); } catch (err) { console.error(`Error in ${event} listener:`, err); }
    });
  }

  async function init(playerId = null) {
    if (!playerId) {
      playerId = getCurrentUserId();
      if (!playerId) throw new Error("No player ID or authenticated user found.");
    }

    // Always ensure/repair startDate first, then heal onboardedAt if needed.
    await ensureStartDateOnce(playerId);
    await repairStartDateIfNeeded(playerId);

    // Try cache first
    const local = await db.playerData.get(playerId);
    if (local) {
      memoryStore.player = normalizeFromCache({ ...local, id: playerId });
    } else {
      const ref = doc(firestore, "players", playerId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const live = snap.data();
        memoryStore.player = { ...live, id: playerId };
        await db.playerData.put({ ...normalizeForCache(memoryStore.player), id: playerId });
      } else {
        // brand new — write minimal defaults (WITHOUT startDate/onboardedAt) then cache
        const fresh = createDefaultPlayer(playerId);
        memoryStore.player = fresh;
        await db.playerData.put(normalizeForCache(fresh));
        await setDoc(ref, { ...fresh, updatedAt: serverTimestamp() }, { merge: true });
      }
    }

    startAutoSync();
    trigger("load", memoryStore.player);
    return memoryStore.player;
  }

  function get() {
    return memoryStore.player;
  }

  function update(updates = {}, replace = false) {
    if (!memoryStore.player) return;
    if (replace) {
      memoryStore.player = { ...updates, id: memoryStore.player.id, lastUpdated: Date.now() };
    } else {
      deepMerge(memoryStore.player, updates);
      memoryStore.player.lastUpdated = Date.now();
    }
    trigger("update", memoryStore.player);
  }

  function updateByKey(path, value) {
    if (!memoryStore.player) return;

    const keys = path.split(".");
    let obj = memoryStore.player;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
    memoryStore.player.lastUpdated = Date.now();
    trigger("update", memoryStore.player);
  }

  // Save to Dexie and Firestore.
  // IMPORTANT: Never write startDate/createdAt/onboardedAt from cache (immutable).
  async function save(andLocalStorage = false) {
    if (!memoryStore.player) return;
    const id = memoryStore.player.id;

    // 1) Local cache — normalize timestamps to millis
    await db.playerData.put({ ...normalizeForCache(memoryStore.player), id });

    // 2) Cloud save — strip immutable fields and set updatedAt
    const {
      startDate,
      createdAt,
      onboardedAt,
      id: _dropId,
      ...rest
    } = memoryStore.player || {};

    const safePatch = { ...rest, updatedAt: serverTimestamp() };

    await setDoc(doc(firestore, "players", id), safePatch, { merge: true });

    if (andLocalStorage) saveToLocalStorage();

    memoryStore.lastSaved = Date.now();
    trigger("save", memoryStore.player);
    console.log("Backing up to cloud storage");
    return memoryStore.player;
  }

  function saveToLocalStorage() {
    try {
      const p = memoryStore.player;
      if (p) {
        localStorage.setItem(
          "playerSnapshot",
          JSON.stringify({
            id: p.id,
            alias: p.alias || "",
            avatarData: p.avatarData,
            coins: p.coins,
            lastUpdated: p.lastUpdated,
          })
        );
        console.log("Storing playerData to Local Storage: playerSnapshot");
      }
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  async function forceLoadFromCloud(playerId = null) {
    if (!playerId) {
      playerId = getCurrentUserId();
      if (!playerId) throw new Error("No player ID or authenticated user found.");
    }

    // Heal immutables before reloading
    await ensureStartDateOnce(playerId);
    await repairStartDateIfNeeded(playerId);


    const ref = doc(firestore, "players", playerId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const live = snap.data();
      memoryStore.player = { ...live, id: playerId };
      await db.playerData.put({ ...normalizeForCache(memoryStore.player), id: playerId });
      trigger("load", memoryStore.player);
      return memoryStore.player;
    }
    return null;
  }

  function startAutoSync() {
    stopAutoSync();
    syncInterval = setInterval(() => {
      console.log("Auto-Backup triggered...");
      save();
    }, syncFrequencyMs);
  }

  function stopAutoSync() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  async function clearAll() {
    await db.playerData.clear();
    memoryStore.player = null;
  }

  return {
    init,
    get,
    update,
    updateByKey,
    save,
    clearAll,
    forceLoadFromCloud,
    startAutoSync,
    stopAutoSync,
    on,
  };
})();

export default playerDataManager;
