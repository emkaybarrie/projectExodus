
# TrueLayer Agent Evaluation Prep — Project MyFi

**Generated:** 2025-09-17 16:42 UTC
**Scope:** End-to-end changes, code snippets included. Use offline or paste into your wiki.

---

## 1) High-level status
- OAuth present but **no PKCE**; exchange doesn’t verify caller ID token.
- Fetchers cover **Accounts/Cards/Transactions/DDs/SOs** with ingestion to canonical.
- Callback overlay flow already implemented.
- Missing: **refresh/revoke**, **scheduler**, **agent copy**, **purge**, **admin ops**, **rules hardening**.

---

## 2) Ordered task list (with code)

### 2.1 Add PKCE to OAuth (P0) — E2E ✓
**truelayer.js**
```js
async function sha256(str){/*...*/}
function randomString(n=64){/*...*/}
async function makePkce(){/*...*/}

const { verifier, challenge } = await makePkce();
sessionStorage.setItem('tl_code_verifier', verifier);
const authUrl = TL_AUTH_BASE + /* include code_challenge & method=S256 */;
window.location.href = authUrl;
```

**callback.html**
```js
const code_verifier = sessionStorage.getItem('tl_code_verifier');
const idToken = await auth.currentUser.getIdToken();
await fetch(EXCHANGE_URL, {
  method:'POST',
  headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+idToken },
  body: JSON.stringify({ uid, code, redirect_uri, code_verifier })
});
```

**functions/index.js**
```js
params.append('code_verifier', req.body.code_verifier);
```

### 2.2 Verify caller on exchange (P0) — E2E ✓
```js
const idHeader = (req.headers.authorization||'').replace(/^Bearer\s+/,'').trim();
const decoded = await admin.auth().verifyIdToken(idHeader);
if(decoded.uid !== uid) return res.status(403).json({ error:'uid_mismatch' });
```

### 2.3 Refresh-on-401 (P1) — E2E ✓
**functions/index.js**
```js
exports.refreshToken = onRequest(/*...*/);
async function withAutoRefresh(uid, fn){/* try->catch 401 -> refresh -> retry */}
```

### 2.4 Revoke/Disconnect (P2)
**functions/index.js**
```js
exports.revokeToken = onRequest(/* revoke on TL, delete token doc, purge raw */);
```

---

## 3) Data API & ingestion

### 3.1 Accounts fan-out (P0) — E2E ✓
**dashboard**
```js
async function refreshAccounts(){ try{ await fetch(FETCH_ACCOUNTS_URL+'?uid='+uid);}catch(e){ showBanner('Bank unavailable'); } }
```

### 3.2 Transactions + canonical (P0) — E2E ✓
**adminDashboard**
```js
await fetch(INGEST_BACKFILL_URL+'?uid='+uid+'&sinceMs='+Date.parse(since));
await fetch(INGEST_RECENT_URL+'?uid='+uid+'&n='+Number(n));
```

---

## 4) Frontend UX

### 4.1 Consent modal (P0) — E2E ✓
```html
<dialog id="tlConsent">...</dialog>
<button id="connectBank">Connect your bank</button>
<script>
  connectBank.onclick=()=>tlConsent.showModal();
  tlAgree.onclick=()=>{ tlConsent.close(); connectTrueLayerAccount(); };
</script>
```

### 4.2 Transactions viewer + Refresh (P1) — E2E ✓
```html
<button id="refreshTx">Refresh transactions</button>
<table id="txTable">...</table>
<script>
  // loadTx() reads aggregate doc and fills table; refreshTx calls fetch + reload
</script>
```

---

## 5) Backend jobs & ops

### 5.1 Nightly scheduler (P0) — E2E ✓
```js
exports.nightlyTrueLayerRefresh = onSchedule("0 2 * * *", async () => { /* enumerate users, refresh with jitter */ });
```

### 5.2 Admin dashboard controls (P1)
```html
<!-- buttons for fetch/backfill/recent; <pre id="out"> for JSON -->
```

---

## 6) Security & retention

### 6.1 Token vault hardening (P0)
- Move token doc under `players/{uid}/secrets/truelayerToken`.
- Firestore rules: only server writes; client read optional or none.

### 6.2 Purge job (P1)
```js
exports.weeklyTrueLayerPurge = onSchedule("0 3 * * 0", async () => { /* delete TL raw older than 90d */ });
```

---

## 7) Regulatory & policy UX

### 7.1 Agent disclosure & branding (P0)
```html
<footer>Powered by <img src="/img/truelayer-logo.svg" alt="TrueLayer"/></footer>
```
Include wording in consent modal.

### 7.2 Privacy & Complaints (P1)
- Publish `/privacy.html` and `/complaints.html` and link them.

---

## 8) Demo & evidence
- 5‑minute script steps as listed in the sheet.
- Record iOS + Android runs and produce a ZIP with anonymized JSON samples.

---

## Appendix: File touchpoints
- `truelayer.js`, `callback.html`, `dashboard.html`, `adminDashboard.html`
- `functions/index.js` (exchange, refresh, revoke, scheduler, purge)
- Firestore Rules for `/players/{uid}/secrets/*`
