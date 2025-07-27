import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.4/+esm";


import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth();
const firestore = getFirestore();

const memoryStore = {
  player: null,
  lastSaved: 0,
};

const db = new Dexie("PlayerDataDB");
db.version(1).stores({
  playerData: "&id, lastUpdated"
});

function getCurrentUserId() {
  const user = auth.currentUser;
  return user?.uid || null;
}

function createDefaultPlayer(id) {
  return {
    id,
    score: 0,
    level: 1,
    coins: 0,
    unspentPoints: 5,
    attributes: {
      strength: 0,
      agility: 0,
      intelligence: 0
    },
    financeData: {},
    avatarData: {},
    heroData: {},
    lastUpdated: Date.now(),
    actions: {
      equipped: [],
      available: [],
      configVersion: "grid"
    },
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

const playerDataManager = (() => {
  let syncInterval = null;
  const saveFrequency_Minutes = 10
  const syncFrequencyMs = saveFrequency_Minutes * 60 * 1000

  // Event listeners storage for hooks
  const listeners = {
    update: [],
    save: [],
    load: []
  };

  // Register a listener callback for events: 'update', 'save', 'load'
  function on(event, callback) {
    if (listeners[event]) {
      listeners[event].push(callback);
    }
  }

  // Trigger all listeners for a specific event with optional data
  function trigger(event, data) {
    listeners[event]?.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in ${event} listener:`, err);
      }
    });
  }

  async function init(playerId = null) {
    if (!playerId) {
      playerId = getCurrentUserId();
      if (!playerId) throw new Error("No player ID or authenticated user found.");
    }

    const local = await db.playerData.get(playerId);
    if (local) {
     memoryStore.player = local;
   } else {
      const docRef = doc(firestore, "players", playerId);
      const userDoc = await getDoc(docRef);

      if (userDoc.exists()) {
        memoryStore.player = userDoc.data();
        await db.playerData.put({ ...memoryStore.player, id: playerId });
      } else {
        memoryStore.player = createDefaultPlayer(playerId);
        await db.playerData.put(memoryStore.player);
        await setDoc(docRef, memoryStore.player);
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
      memoryStore.player = { ...updates, lastUpdated: Date.now() };
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

  async function save(andLocalStorage = false) {
    if (!memoryStore.player) return;
    const id = memoryStore.player.id;
    await db.playerData.put(memoryStore.player);
    await setDoc(doc(firestore, "players", id), memoryStore.player);
    if (andLocalStorage){
      saveToLocalStorage(); // 👈 Add this
    }
    memoryStore.lastSaved = Date.now();
    trigger("save", memoryStore.player);

    console.log('Backing up to cloud storage')
    return memoryStore.player
  }

  function saveToLocalStorage() {
  try {
    const player = memoryStore.player;
    if (player) {
      localStorage.setItem("playerSnapshot", JSON.stringify({
        id: player.id,
        alias: player.alias || "",
        avatarData: player.avatarData,
        coins: player.coins,
        lastUpdated: player.lastUpdated
      }));
      console.log("Storing playerData to Local Storage: playerSnapshot" )
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

    const docRef = doc(firestore, "players", playerId);
    const userDoc = await getDoc(docRef);

    if (userDoc.exists()) {
      memoryStore.player = userDoc.data();
      await db.playerData.put({ ...memoryStore.player, id: playerId });

      trigger("load", memoryStore.player);
      return memoryStore.player;
    }

    return null;
  }

  function startAutoSync() {
    stopAutoSync();
    syncInterval = setInterval(() => {
      console.log('Auto-Backup triggered...')
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
    on // expose event listener registration
  };
})();

export default playerDataManager;


