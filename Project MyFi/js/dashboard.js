import { auth, db, logoutUser } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";
import { createSplash } from './splash.js';

import "./core/truelayer.js";
import "./modal.js";
import "./settingsMenu.js";
import "./helpMenu.js";
import "./financesMenu.js";

// Initialise app
const shouldShowSplash = sessionStorage.getItem('showSplashNext') === '1';
if (shouldShowSplash) sessionStorage.removeItem('showSplashNext');
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'auth.html';
      return;
    }

    window.localStorage.setItem('user', JSON.stringify(user));

    // Show splash only once per tab/session. Change this if you want per-login.
    // const shouldShowSplash = !sessionStorage.getItem('splashShownThisSession');

    // Bundle your startup work into a single promise the splash can wait on.
    const vitalsPromise = (async () => {
      // Ensure player doc exists
      const userRef = doc(db, 'players', user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, { startDate: new Date() }, { merge: true });
      }

      // Load player data
      const playerData = await playerDataManager.init(user.uid).then((player) => {
        console.log("Player data loaded:", player.alias);
        return player;
      });

      // Portrait selection (kept as in your code)
      const portraitImage = document.querySelector(".portrait");
      let portraitKey = playerData.portraitKey || "default";

      if (playerData.firstName == "Emkay") {
        portraitKey = 'avatarEmkay';
      } else if (playerData.firstName == "Alie") {
        portraitKey = 'avatarAlie';
      } else if (playerData.firstName == "Mohammed") {
        portraitKey = 'avatarMohammed';
      } else if (playerData.firstName == "Jane") {
        portraitKey = 'avatarJane';
      } else if (playerData.firstName == "Amandeep") {
        portraitKey = 'avatarAmandeep';
      } else if (playerData.firstName == "Matthew") {
        portraitKey = 'avatarMatthew';
      } else if (playerData.firstName == "Gerard") {
        portraitKey = 'avatarGerard';
      } else if (playerData.firstName == "Sammi") {
        portraitKey = 'avatarSammi';
      } else {
        portraitKey = 'default';
      }

      console.log("Using portrait key:", portraitKey);
      if (portraitImage) {
        portraitImage.src = `./assets/portraits/${portraitKey}.png`;
      }

      // Initialise Dashboard modules (await even if initHUD is not async — it's safe)
      await initHUD(user.uid);
    })();

    if (shouldShowSplash) {
      createSplash({
        minDuration: 2500,      // feel tweak
        until: vitalsPromise,  // splash waits for your real init + minDuration
        allowSkip: false
      });
      // sessionStorage.setItem('splashShownThisSession', '1');
    } else {
      document.querySelector('.app-root')?.classList.add('app-show');
      await vitalsPromise;
    }

    // Modal setup (unchanged)
    const essenceBtn = document.getElementById("essence-btn");
    if (essenceBtn) {
      essenceBtn.addEventListener("click", () => {
        alert("Essence interaction coming soon...");
      });
    }
  });
});


if ('serviceWorker' in navigator) {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isLocal) {
    navigator.serviceWorker.register('./serviceWorker.js');
  } else {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}

// PWA INstall
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'flex';
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('installBtn');
  const dismissBtn = document.getElementById('dismissInstall');
  const banner = document.getElementById('installBanner');

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        console.log("User choice:", result.outcome);
        deferredPrompt = null;
        if (banner) banner.style.display = 'none';
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      if (banner) banner.style.display = 'none';
    });
  }
});


