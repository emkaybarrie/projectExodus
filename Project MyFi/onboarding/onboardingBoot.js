// Starts the wizard after auth, or bounces to dashboard if already complete.

import { auth, db } from "../js/core/auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

function gotoDashboard(){
  window.location.replace("../dashboard.html"); // replace so Back won't return here
}

async function checkAndStart(){
  const user = auth.currentUser;
  if (!user) return;

  try{
    const snap = await getDoc(doc(db, "players", user.uid));
    const done = snap.exists() && snap.data()?.onboarding?.architectWizardDone === true;
    if (done) return gotoDashboard();
  }catch{ /* tolerate failure and show wizard */ }

  if (window.MyFiOnboarding?.start){
    window.MyFiOnboarding.start(); // defaults to black background
  }
}

onAuthStateChanged(getAuth(), (user)=>{
  if (!user) return; // not signed in; your auth.html should handle this
  checkAndStart();
});
