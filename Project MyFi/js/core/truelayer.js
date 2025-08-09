import { auth } from "./auth.js";



export function connectTrueLayerAccount() {
  const user = auth.currentUser;
  if (!user) { alert("Please log in first."); return; }

  const clientId = "sandbox-projectmyfi-f89485";

  // Build the clean callback URL beside the current page (no query string)
  const rawRedirect = new URL('callback.html', window.location.href);
  rawRedirect.search = ''; // ensure no ?code&state on the string we use
  sessionStorage.setItem('tl_redirect_uri', rawRedirect.toString());

  const redirectUri = encodeURIComponent(rawRedirect.toString());
  const scope = encodeURIComponent("info accounts balance cards transactions direct_debits standing_orders offline_access");
  const state = encodeURIComponent(user.uid);
  const providers = encodeURIComponent("uk-cs-mock uk-ob-all uk-oauth-all");

  const authUrl =
    `https://auth.truelayer-sandbox.com/?response_type=code&client_id=${clientId}` +
    `&scope=${scope}&redirect_uri=${redirectUri}&state=${state}&providers=${providers}`;

  window.location.href = authUrl;
}

window.connectTrueLayerAccount = connectTrueLayerAccount; // <-- make it global



export async function triggerTrueLayerFetch(type) {
  const user = auth.currentUser;
  if (!user) return alert("Not signed in");

  const functionUrl = `https://europe-west2-myfi-app-7fa78.cloudfunctions.net/fetch${type}?uid=${user.uid}`;

  try {
    const res = await fetch(functionUrl);
    const json = await res.json();
    if (!json.success) throw json;
    console.log(`${type} data:`, json.data);

    // 🔍 Optional: process and render data per type here
    // e.g., if (type === 'Transactions') renderTransactions(json.data);

  } catch (err) {
    console.error(`Error fetching ${type}:`, err);
  }
}
