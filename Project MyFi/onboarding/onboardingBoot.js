// Ensures the wizard starts when the user is signed in.
// If the wizard is already complete, bounce to the dashboard.

import { auth, db } from "../js/core/auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

function gotoDashboard(){
  // Adjust this path if your dashboard file is named differently
  window.location.replace("../dashboard.html");
}

async function checkAndStart(){
  const user = auth.currentUser;
  if (!user) return; // wait for onAuthStateChanged below

  try{
    const snap = await getDoc(doc(db, "players", user.uid));
    const alreadyDone = snap.exists() && snap.data()?.onboarding?.architectWizardDone === true;
    if (alreadyDone) return gotoDashboard();
  }catch{
    // If reading fails, we'll try to show the wizard anyway
  }

  // Start the wizard (exposed globally by architectOnboarding.js)
  if (window.MyFiOnboarding?.start){
    window.MyFiOnboarding.start();
  }
}

onAuthStateChanged(getAuth(), async (user)=>{
  if (!user) return; // not signed in; your auth.html should handle this
  checkAndStart();
});
