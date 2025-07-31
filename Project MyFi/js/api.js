// api.js
import { auth, db } from './auth.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { loadTransactionData, loadDashboard } from './dashboard.js';
import playerDataManager from './playerDataManager.js';

// ─── GCP Credentials ─────────────────────────────────────────────────────────
const API_KEY   = 'AIzaSyAZVC4hK92uYH8xQ5eB9GRWayUPcTJo84o';
const CLIENT_ID = '614299357486-ob6nre7ihvv3n5a410n8nfnm9an6koqg.apps.googleusercontent.com';
const APP_ID    = 'myfi-app-458119';
const DISCOVERY = [
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
  ];
const SCOPES    = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly';

// ─── Internal State ───────────────────────────────────────────────────────────
let sheetsTokenClient;
let gapiInited = false, gisInited = false, accessToken = null;

// ─── 1) Load GAPI client + Picker ─────────────────────────────────────────────
export function gapiLoaded() {
  gapi.load('client:auth2', initGapiClient);
}

async function initGapiClient() {
  await gapi.client.init({
    apiKey:        API_KEY,
    discoveryDocs: DISCOVERY
  });
  gapiInited = true;
  maybeEnablePicker();
}

// ─── 2) Initialize GIS ────────────────────────────────────────────────────────
export function gisLoaded() {
  sheetsTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  onSheetsTokenResponse
  });

  gisInited = true;
  maybeEnablePicker();
}

// ─── 3) Enable Picker button when ready ───────────────────────────────────────
function maybeEnablePicker() {
  if (gapiInited && gisInited) {
    const btn = document.getElementById('open-picker-btn');
    if (btn) {
      btn.disabled = false;
      btn.addEventListener('click', openGooglePicker);
    }
  }
}

// ─── 4) Access Token Flow ─────────────────────────────────────────────────────
function onSheetsTokenResponse(resp) {
  if (resp.error) {
    console.error('Token error', resp);
    return;
  }
  accessToken = resp.access_token;
  gapi.client.setToken({ access_token: accessToken });
}

export async function ensureSignedIn() {
  if (accessToken) return accessToken;

  return new Promise((resolve, reject) => {
    sheetsTokenClient.callback = resp => {
      if (resp.error) return reject(resp);
      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });
      resolve(accessToken);
    };
    sheetsTokenClient.requestAccessToken({ prompt: '' });
  });
}

// ─── 5) Google Drive UI ─────────────────────────────────────────────────────────
    
    export async function openGooglePicker() {
      const user = JSON.parse(localStorage.getItem('user'));
      const userDocRef = doc(db, "players", user.uid);
      const userDoc = await getDoc(userDocRef);
      const playerData = userDoc.data();


        try {
        const token = await ensureSignedIn();

        gapi.client.setToken({ access_token: token });  // Redundant safety line

        if(!playerData.sheetId){
    
        // Fetch list of spreadsheets
        const res = await gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
            fields: 'files(id, name)',
            pageSize: 10,
        });
    
        const sheets = res.result.files;
        if (!sheets.length) {
            alert('No spreadsheets found in your Google Drive.');
            return;
        }
    
        // Create a simple picker UI
        showCustomDrivePicker(sheets);
        } else {
          
          await fetchSheetData('1KBlioItkL-7zmjpKoalodUzpecNhsL_xtu7L16tPh7g');
        }
        } catch (err) {
        console.error('Error fetching Drive files:', err);
        alert('Failed to list Google Drive files.');
        }
    }


    function showCustomDrivePicker(sheets) {
        const modal = document.getElementById('picker-modal');
        const modalBody = document.getElementById('picker-modal-body');
      
        if (!modal || !modalBody) {
          console.error('Modal or modal body not found!');
          return;
        }
      
        // Clear previous entries
        modalBody.innerHTML = '';

        sheets.sort((a, b) => {
          if (a.name === "Monzo Transactions") return -1;
          if (b.name === "Monzo Transactions") return 1;
          return a.name.localeCompare(b.name);
        });
      
        // Add one button per sheet
        sheets.forEach((sheet) => {
          const btn = document.createElement('button');
          btn.textContent = sheet.name;
          btn.className = 'purple-button';
          btn.onclick = async () => {
            modal.style.display = 'none';
            await onCustomPickerSelect(sheet.id);
          };

          if (sheet.name === "Monzo Transactions") {
            //btn.style.boxShadow = '0 0 8px 2px rgba(168, 85, 247, 0.6)'; // subtle purple glow
            //btn.style.border = '2px solid white'; // optional white border for clarity
            //btn.style.background = '#9333ea'; // slightly deeper purple
            //btn.title = "Recommended: Monzo Transactions";
            const badge = document.createElement('span');
            badge.textContent = "★ Recommended";
            badge.style = `
              font-size: 12px; 
              color: white;
              background: #7c3aed;
              border-radius: 4px;
              padding: 2px 6px;
              margin-left: 8px;
            `;
            btn.appendChild(badge);
          }

          modalBody.appendChild(btn);
        });
      
        // Show modal
        modal.style.display = 'flex';
      }
      
      // Close button handler
      document.getElementById('close-picker-modal')?.addEventListener('click', () => {
        const modal = document.getElementById('picker-modal');
        if (modal) modal.style.display = 'none';
      });
      
      
      
      
  

      async function onCustomPickerSelect(sheetId) {
        const user = JSON.parse(localStorage.getItem('user'));
        await setDoc(doc(db, 'players', user.uid), { sheetId }, { merge: true });
      
        const link = document.createElement('a');
        link.href = `https://docs.google.com/spreadsheets/d/${sheetId}`;
        link.target = '_blank';
        link.click();
      
        await fetchSheetData(sheetId);
        document.dispatchEvent(new Event('sheetLinked'));
      }
      

// ─── 6) Sheets Fetch ─────────────────────────────────────────────────────────
export async function fetchSheetData(sheetId) {
  let headerRow = [];
  let rowData = [];

  try {
    const metadataResponse = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetNames = metadataResponse.result.sheets.map(sheet => sheet.properties.title);

    const sheetName = sheetNames.includes("Personal Account Transactions")
      ? "Personal Account Transactions"
      : sheetNames[1];

    const range = `${sheetName}!A1:Z`;

    await ensureSignedIn();
    const resp = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });

    headerRow = resp.result.values?.[0] || [];
    rowData = resp.result.values || [];

  } catch (e) {
    console.warn('Sheets API failed, falling back to CSV:', e);
    alert('Failed to fetch sheet data, falling back to CSV.');
    const allRows = await fetchPublicSheet(sheetId);
    headerRow = allRows[0] || [];
    rowData = allRows || [];
  }


  document.getElementById('preview-row2').innerText = JSON.stringify(headerRow, null, 2);
  document.dispatchEvent(new CustomEvent('row2Fetched', { detail: rowData }));
  // Save player data to localStorage
  saveTransactionDataToLocalStorage(rowData, sheetId);
}

export async function fetchPublicSheet(sheetId) {
  // This part needs the correct sheet name, but CSV fetch doesn't support ranges
  // You can simply fetch the entire CSV data, but we'll apply some additional filtering if needed
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  // Fetch CSV content
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);

  const text = await res.text();
  // Convert CSV text to rows, splitting by new line and comma
  const rows =  text.trim().split('\n').map(line =>
    line.split(',').map(cell => cell.replace(/^"|"$/g, ''))
  );

  // Define the target header row content for the "Personal Account Transactions" sheet
  const targetHeader = [
    "Transaction ID", "Date", "Time", "Type", "Name", "Emoji", "Category", "Amount", 
    "Currency", "Local amount", "Local currency", "Notes and #tags", "Address", 
    "Receipt", "Description", "Category split"
  ];

  // Find the index of the header row for the target sheet
  const targetHeaderIndex = rows.findIndex(row => {
    return row.length === targetHeader.length &&
      targetHeader.every((header, index) => row[index] === header);
  });

  if (targetHeaderIndex === -1) {
    console.warn("Target header not found in CSV.");
    return [];
  }

  // Extract the rows starting after the header row
  const dataRows = rows.slice(targetHeaderIndex + 1); // Skip the header row itself

  return dataRows;
}

// ─── 7) Helpers ───────────────────────────────────────────────────────────────
export function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] || null;
}

export async function validateSheet(sheetId) {
  try {
    await gapi.client.sheets.spreadsheets.get({ spreadsheetId: sheetId });
    return true;
  } catch (e) {
    alert('⚠️ Cannot access that Sheet: ' + e.message);
    return false;
  }
}

// Function to save player data to localStorage
function saveTransactionDataToLocalStorage(data, sheetId) {
  // Check if data is valid
  if (data && typeof data === 'object') {
      // Store the data as a JSON string in localStorage
      localStorage.setItem('transactionDataSourceID', JSON.stringify(sheetId));
      localStorage.setItem('transactionData', JSON.stringify(data));
      console.log('Player source data saved to localStorage.');

      loadTransactionData();
      const user = JSON.parse(window.localStorage.getItem('user'));
      const playerData = playerDataManager.get()
      loadDashboard(playerData)
      return null; // Return null if no data is found
  } else {
      console.error('Invalid data format for localStorage.');
  }

}
