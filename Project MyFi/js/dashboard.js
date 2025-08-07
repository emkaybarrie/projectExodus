import { auth, db, logoutUser } from './core/auth.js';
import { getDoc, doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import playerDataManager from "./playerDataManager.js";
import { initHUD } from "./hud/hud.js";

// Initialise app
document.addEventListener("DOMContentLoaded", () => {
  

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'auth.html';
       
    } else {
        window.localStorage.setItem('user', JSON.stringify(user));
        
        const userRef = doc(db, 'players', user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            const startDate = new Date();
            await setDoc(userRef, { startDate: startDate }, { merge: true });
        }

        const playerData = await playerDataManager.init(user.uid).then((player) => {
            console.log("Player data loaded:", player.alias);
            return player
        });

       console.log(playerData)

       const portraitImage = document.querySelector(".portrait");
       let portraitKey = playerData.portraitKey || "default";

       if (playerData.firstName = "Emkay") {
        portraitKey = 'avatarEmkay';
       } else if (playerData.firstName = "Alie") {
        portraitKey = 'avatarAlie';
       } else if (playerData.firstName = "Mohammed") {  
        portraitKey = 'avatarMohammed';
       } else if (playerData.firstName = "Mohammed") {  
        portraitKey = 'avatarMohammed';
       }else {
        // Fallback to default portrait if no specific one is set 
        portraitKey = 'default';
       }
        portraitImage.src = `./assets/portraits/${portraitKey}.png`;



        initHUD(user.uid);
        // loadDashboard(playerData);

        document.getElementById("essence-btn").addEventListener("click", () => {
          alert("Essence interaction coming soon...");
        });

        document.getElementById("settings-btn").addEventListener("click", () => {
          alert("Settings placeholder");
        });

        document.getElementById("refresh-btn").addEventListener("click", () => {
          location.reload(); // Simple full page refresh
        });
       
       
    }
});
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./serviceWorker.js')
    .then(reg => console.log("SW registered", reg))
    .catch(err => console.error("SW failed", err));
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


