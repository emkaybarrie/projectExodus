// index.js — drop-in replacement with TL fan-out (no regressions)

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated, onDocumentWritten, onDocumentDeleted} = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const Stripe = require('stripe');

const functions = require("firebase-functions");
const { DateTime } = require("luxon");
// add near other requires
const { onSchedule } = require("firebase-functions/v2/scheduler");


admin.initializeApp() || admin.apps.length;
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ONE place to control prod base at deploy time:
//   - Preferred: env var INVITE_BASE_URL (e.g. https://emkaybarrie.github.io/projectExodus/Project%20MyFi)
//   - Fallback constant if env var is missing (keeps behavior predictable)
const PROD_BASE_FALLBACK = 'https://emkaybarrie.github.io/projectExodus/Project%20MyFi';

// ------------------------- Alias -------------------------
const RESERVED = new Set([
  'admin','support','mod','myfi','system','null','undefined','owner','team'
]);

// ------------------------- Secrets -------------------------
const TRUELAYER_CLIENT_ID = defineSecret('TRUELAYER_CLIENT_ID');
const TRUELAYER_CLIENT_SECRET = defineSecret('TRUELAYER_CLIENT_SECRET');
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// ------------------------- CORS ----------------------------
const corsHandler = cors({ origin: true });

/**
 * ====================================================================
 *  ALIAS
 * ====================================================================
 */

function normalizeAlias(input) {
  const raw = String(input || '').trim();
  const ok = /^[A-Za-z0-9_\-]{3,32}$/.test(raw); // keep in sync with client
  if (!ok) throw new HttpsError('invalid-argument', 'Alias must be 3–32 chars [A–Z a–z 0–9 _ -].');
  const lower = raw.toLowerCase();
  if (RESERVED.has(lower)) throw new HttpsError('already-exists', 'That alias is reserved.');
  return { alias: raw, aliasLower: lower };
}

exports.setAlias = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to set alias.');
  const uid = auth.uid;

  const { alias, aliasLower } = normalizeAlias(req.data?.alias);

  // Read current player doc to know old aliasLower (if any)
  const playerRef = db.doc(`players/${uid}`);
  const handleRef = db.doc(`handles/${aliasLower}`);

  return await db.runTransaction(async (tx) => {
    const [playerSnap, newHandleSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(handleRef)
    ]);

    if (newHandleSnap.exists) {
      const currentOwner = newHandleSnap.get('uid');
      if (currentOwner !== uid) throw new HttpsError('already-exists', 'Alias already taken.');
      // If current owner calls with same alias, just echo back
    }

    const now = Date.now();

    // get old aliasLower (if any)
    const oldAliasLower = (playerSnap.exists && playerSnap.get('aliasLower')) || null;
    const oldHandleRef = oldAliasLower ? db.doc(`handles/${oldAliasLower}`) : null;

    // If changing to a new alias, ensure we create the new mapping first
    tx.set(handleRef, { uid }, { merge: false });
    tx.set(playerRef, {
      alias,
      aliasLower,
      updatedMs: now,
      createdMs: playerSnap.exists ? playerSnap.get('createdMs') || now : now
    }, { merge: true });

    // Clean up old mapping if it existed and differs
    if (oldHandleRef && oldAliasLower !== aliasLower) {
      tx.delete(oldHandleRef);
    }

    return { ok: true, alias, aliasLower };
  });
});



/** Maintenence **/

// SIMPLE admin callable — protect with a shared secret coming from req.data.secret
exports.backfillHandlesFromPlayers = onCall({ region: 'europe-west2' }, async (req) => {
  const SECRET = process.env.BACKFILL_SECRET || ''; // set with functions:config or secrets
  if (req.data?.secret !== SECRET) throw new HttpsError('permission-denied', 'Not allowed.');
  const db = admin.firestore();

  const batchSize = 400; // stay under limits
  let lastDoc = null, created = 0, skipped = 0, conflicts = 0;

  while (true) {
    let q = db.collection('players')
      .where('aliasLower', '!=', null)
      .orderBy('aliasLower').limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => {
      const uid = doc.id;
      const aliasLower = String(doc.get('aliasLower') || '').trim();
      if (!aliasLower) { skipped++; return; }
      const handleRef = db.doc(`handles/${aliasLower}`);
      batch.set(handleRef, { uid }, { merge: false }); // overwrite if mismatched? Your choice.

      created++;
      lastDoc = doc;
    });

    await batch.commit();
    if (snap.size < batchSize) break;
  }

  return { ok: true, created, skipped, conflicts };
});

// Unprotected version
exports.backfillHandlesFromPlayers_TEST = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();

  const batchSize = 400; // stay under limits
  let lastDoc = null, created = 0, skipped = 0;

  while (true) {
    let q = db.collection('players')
      .where('aliasLower', '!=', null)
      .orderBy('aliasLower')
      .limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => {
      const uid = doc.id;
      const aliasLower = String(doc.get('aliasLower') || '').trim();
      if (!aliasLower) { skipped++; return; }
      const handleRef = db.doc(`handles/${aliasLower}`);
      batch.set(handleRef, { uid }, { merge: false });
      created++;
      lastDoc = doc;
    });

    await batch.commit();
    if (snap.size < batchSize) break;
  }

  return { ok: true, created, skipped };
});

/**
 * GET/POST /backfillHandlesFromPlayersHttp?secret=XYZ&pageSize=400&startAfter=aliaslower
 * - pageSize: 100–1000 (default 400)
 * - startAfter: process after this aliasLower (for pagination)
 * - dryRun=1 to test without writing
 */
// https://backfillhandlesfromplayershttp-frxqsvlhwq-nw.a.run.app
exports.backfillHandlesFromPlayersHttp = onRequest({ region: 'europe-west2' }, async (req, res) => {
  // --- CORS (allow all origins for this one-off tool) ---
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    // --- Guard (keep while you run it; remove after) ---
    const SECRET = process.env.BACKFILL_SECRET || '';
    const secret = req.method === 'GET' ? req.query.secret : req.body?.secret;
    if (secret !== SECRET) { res.status(403).json({ ok:false, error:'Forbidden' }); return; }

    const db = admin.firestore();

    const pageSize = Math.min(1000, Math.max(100, Number((req.method==='GET'?req.query.pageSize:req.body?.pageSize) || 400)));
    const startAfter = String((req.method==='GET'?req.query.startAfter:req.body?.startAfter) || '').trim();
    const dryRun = String((req.method==='GET'?req.query.dryRun:req.body?.dryRun) || '') === '1';

    // Build query
    let q = db.collection('players')
      .where('aliasLower', '!=', null)
      .orderBy('aliasLower')
      .limit(pageSize);

    if (startAfter) {
      const snapFirst = await db.collection('players')
        .where('aliasLower', '>=', startAfter)
        .orderBy('aliasLower')
        .limit(1).get();

      if (!snapFirst.empty) {
        q = db.collection('players')
          .where('aliasLower', '!=', null)
          .orderBy('aliasLower')
          .startAfter(snapFirst.docs[0].get('aliasLower'))
          .limit(pageSize);
      }
    }

    const snap = await q.get();
    if (snap.empty) {
      res.json({ ok:true, message:'No players found for this page.', created:0, skipped:0, nextStartAfter:null, dryRun });
      return;
    }

    let created = 0, skipped = 0, lastAlias = null;
    const batch = db.batch();

    snap.docs.forEach(doc => {
      const uid = doc.id;
      const aliasLower = String(doc.get('aliasLower') || '').trim();
      if (!aliasLower) { skipped++; return; }
      const handleRef = db.doc(`handles/${aliasLower}`);
      if (!dryRun) batch.set(handleRef, { uid }, { merge: false });
      created++;
      lastAlias = aliasLower;
    });

    if (!dryRun) await batch.commit();

    const nextStartAfter = (snap.size < pageSize) ? null : lastAlias;

    res.json({ ok:true, created, skipped, pageSize, startAfter: startAfter || null, nextStartAfter, dryRun });
  } catch (err) {
    console.error('backfillHandlesFromPlayersHttp failed', err);
    res.status(500).json({ ok:false, error: err?.message || 'Internal error' });
  }
});

/**
 * HTTP maintenance: backfill aliasLower field on players
 * GET/POST /backfillAliasLower?secret=[SECRET]]&pageSize=400
 */
// https://europe-west2-myfi-app-7fa78.cloudfunctions.net/backfillAliasLower
exports.backfillAliasLower = onRequest({ region: 'europe-west2' }, async (req, res) => {
  // --- CORS (allow all origins for this one-off tool) ---
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  // ---- Guard (set a temporary secret; remove function after use) ----
  const SECRET = process.env.BACKFILL_SECRET || '';
  if ((req.query.secret || req.body?.secret) !== SECRET) {
    res.status(403).json({ ok: false, error: 'Forbidden' }); return;
  }

  const db = admin.firestore();
  const pageSize = Math.min(1000, Math.max(100, Number(req.query.pageSize || req.body?.pageSize || 400)));
  const dryRun = String(req.query.dryRun || req.body?.dryRun || '') === '1';

  try {
    // Fetch a batch of players with alias but missing aliasLower
    const snap = await db.collection('players')
      .where('alias', '!=', null)
      .limit(pageSize)
      .get();

    if (snap.empty) {
      res.json({ ok: true, updated: 0, skipped: 0, dryRun }); return;
    }

    let updated = 0, skipped = 0;
    const batch = db.batch();

    snap.docs.forEach(doc => {
      const data = doc.data() || {};
      const alias = (data.alias || '').trim();
      const aliasLower = (data.aliasLower || '').trim();

      if (alias && !aliasLower) {
        if (!dryRun) {
          batch.update(doc.ref, { aliasLower: alias.toLowerCase() });
        }
        updated++;
      } else {
        skipped++;
      }
    });

    if (!dryRun && updated > 0) await batch.commit();

    res.json({ ok: true, updated, skipped, pageSize, dryRun });
  } catch (err) {
    console.error('backfillAliasLower failed', err);
    res.status(500).json({ ok: false, error: err.message || 'Internal error' });
  }
});





/**
 * ====================================================================
 *  TRUE LAYER: TOKEN EXCHANGE
 * ====================================================================
 */

// DELETE all canonical transactions that originated from TrueLayer
// Usage: POST https://<region>-<project>.cloudfunctions.net/nukeTrueLayerCanonical  (Authorization: Bearer <idToken>)
// Optional body: { preview: true } to log what would be deleted without deleting.
// at top-level once
const allowCors = (handler) => async (req, res) => {
  const origin = req.headers.origin || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');

  // reflect requested headers so Authorization preflights succeed
  const reqHeaders = req.headers['access-control-request-headers'];
  res.set('Access-Control-Allow-Headers', reqHeaders || 'Authorization, Content-Type');

  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Max-Age', '3600');
  res.set('Access-Control-Allow-Credentials', 'true'); // safe: you’re not using cookies, but keeps browsers happy

  if (req.method === 'OPTIONS') return res.status(204).end();
  return handler(req, res);
};


exports.nukeTrueLayerCanonical = onRequest({ region: 'europe-west2', timeoutSeconds: 540 }, allowCors(async (req, res) => {
  try {
    const uid = await requireUidFromAuth(req);
    const preview = !!req.body?.preview;
    const root = db.collection(`players/${uid}/classifiedTransactions`);

    const q1 = root.where('source', '==', 'truelayer').limit(500);
    const q2 = root.where('providerRef.provider', '==', 'truelayer').limit(500);

    let total = 0, loops = 0;
    async function deleteQuery(q) {
      for (let i = 0; i < 1000; i++) {
        const snap = await q.get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        if (preview) {
          console.log('[PREVIEW] would delete batch size:', snap.size);
        } else {
          await batch.commit();
        }
        total += snap.size; loops++;
        if (snap.size < 500) break;
      }
    }

    await deleteQuery(q1);
    await deleteQuery(q2);

    res.status(200).json({ ok: true, preview, deleted: preview ? 0 : total, scannedBatches: loops });
  } catch (e) {
    const status = e.status || e.response?.status || 500;
    console.error('nukeTrueLayerCanonical error:', e.response?.data || e.message);
    res.status(status).json({ error: 'nuke_failed', details: e.message });
  }
}));


// ---- TrueLayer base URLs (switchable) ----
const TL_AUTH_BASE  = 'https://auth.truelayer-sandbox.com';
const TL_API_BASE   = 'https://api.truelayer-sandbox.com';

// If you promote to live:
// const TL_AUTH_BASE  = 'https://auth.truelayer.com';
// const TL_API_BASE   = 'https://api.truelayer.com';

// ---- Helpers: read Firebase ID token -> uid (enforce auth on HTTPS) ----
async function requireUidFromAuth(req) {
  const h = String(req.headers.authorization || '');
  if (!h.startsWith('Bearer ')) throw Object.assign(new Error('missing_auth'), { status: 401 });
  const idToken = h.slice('Bearer '.length).trim();
  const decoded = await admin.auth().verifyIdToken(idToken);
  if (!decoded?.uid) throw Object.assign(new Error('invalid_id_token'), { status: 401 });
  return decoded.uid;
}

// ---- Paths for token doc ----
function tlTokenRef(uid) {
  return db.doc(`players/${uid}/financialData_TRUELAYER/token`);
}

// ---- Persist tokens atomically ----
async function saveTokens(uid, payload) {
  const nowMs = Date.now();
  const expiresIn = Number(payload.expires_in || 0);
  const expiresAt = nowMs + expiresIn * 1000;
  const doc = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    scope: payload.scope || null,
    token_type: payload.token_type || 'Bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,      // ms since epoch
    created_at: nowMs,
    updated_at: nowMs,
  };
  await tlTokenRef(uid).set(doc, { merge: true });
  return doc;
}


// CONFIDENTIAL variant — includes client_secret
exports.exchangeToken = onRequest({
  region: 'europe-west2',
  secrets: [TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET],
}, async (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
      // Require Firebase ID token → derive uid (prevents spoofing)
      const uid = await requireUidFromAuth(req);

      const { code, redirect_uri, code_verifier } = req.body || {};
      if (!code || !redirect_uri || !code_verifier) {
        return res.status(400).json({
          error: 'missing_params',
          details: {
            hasCode: !!code,
            hasRedirectUri: !!redirect_uri,
            hasCodeVerifier: !!code_verifier
          }
        });
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', TRUELAYER_CLIENT_ID.value());
      params.append('client_secret', TRUELAYER_CLIENT_SECRET.value()); // confidential apps require this
      params.append('redirect_uri', redirect_uri);
      params.append('code', code);
      params.append('code_verifier', code_verifier); // PKCE still required

      console.log('[TL] exchange (CONFIDENTIAL) client_id=', TRUELAYER_CLIENT_ID.value(),
                  'redirect=', redirect_uri, 'hasVerifier=', !!code_verifier,
                  'hasSecret=', !!TRUELAYER_CLIENT_SECRET.value());

      const response = await axios.post(
        `${TL_AUTH_BASE}/connect/token`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const saved = await saveTokens(uid, response.data);
      return res.status(200).json({ success: true, expires_at: saved.expires_at });
    } catch (err) {
      const status  = err.status || err.response?.status || 500;
      const details = err.response?.data || err.message;
      console.error('Token exchange failed:', status, details);
      return res.status(status).json({ error: 'token_exchange_failed', details });
    }
  });
});



/**
 * ====================================================================
 *  TRUE LAYER: HELPERS (paths, normalisers)
 * ====================================================================
 */

const EXPIRY_SKEW_SEC = 60; // refresh a minute early

async function refreshTrueLayerToken(uid) {
  const snap = await tlTokenRef(uid).get();
  if (!snap.exists) throw Object.assign(new Error('no_token'), { status: 401 });
  const cur = snap.data() || {};
  if (!cur.refresh_token) throw Object.assign(new Error('no_refresh_token'), { status: 401 });

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', TRUELAYER_CLIENT_ID.value());
  params.append('refresh_token', cur.refresh_token);

  const response = await axios.post(
    `${TL_AUTH_BASE}/connect/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return await saveTokens(uid, response.data);
}

async function getValidAccessToken(uid) {
  const snap = await tlTokenRef(uid).get();
  if (!snap.exists) throw Object.assign(new Error('no_token'), { status: 401 });
  const t = snap.data();
  const now = Date.now();
  const skewMs = EXPIRY_SKEW_SEC * 1000;
  const isExpiring = !t.expires_at || (t.expires_at - now) <= skewMs;

  if (isExpiring) {
    const refreshed = await refreshTrueLayerToken(uid);
    return refreshed.access_token;
  }
  return t.access_token;
}

async function tlGet(uid, relativePath, config = {}) {
  const url = `${TL_API_BASE}${relativePath}`;
  let token = await getValidAccessToken(uid);

  try {
    const res = await axios.get(url, {
      ...config,
      headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) {
      // refresh and retry once
      token = (await refreshTrueLayerToken(uid)).access_token;
      const res2 = await axios.get(url, {
        ...config,
        headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` }
      });
      return res2.data;
    }
    throw err;
  }
}



// Keep your existing aggregate cache writes for compatibility.
// These functions ALSO trigger fan-out into per-account/card subcollections.
// Keep your aggregate cache writes for compatibility (unchanged externally)
const fetchFromTrueLayer = async (uid, urlPath, storeKey) => {
  const data = await tlGet(uid, urlPath);

  await db.doc(`players/${uid}/financialData_TRUELAYER/${storeKey}`).set({
    data,
    lastUpdated: Date.now(),
  }, { merge: true });

  return data;
};


const createFetchFunction = (path, key) =>
  onRequest({ region: 'europe-west2' }, async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const uid = await requireUidFromAuth(req);
        const data = await fetchFromTrueLayer(uid, path, key);
        if (key === 'accounts') await upsertAccounts(uid, data);
        if (key === 'cards')    await upsertCards(uid, data);
        res.status(200).json({ success: true, data });
      } catch (err) {
        const status = err.status || err.response?.status || 500;
        console.error(`[${key}] Fetch failed:`, err.response?.data || err.message);
        res.status(status).json({ error: 'Fetch failed', details: err.message });
      }
    });
  });

// Paths that match your screenshot layout:
// financialData_TRUELAYER has documents named 'accounts', 'cards', etc.
// We add subcollections under those docs: 'items', then per-item subcollections.
const tlPaths = {
  accountsRootDoc: (uid) => db.doc(`players/${uid}/financialData_TRUELAYER/accounts`),
  accountItemDoc:  (uid, accountId) => db.doc(`players/${uid}/financialData_TRUELAYER/accounts/items/${accountId}`),
  accountTx:       (uid, accountId, txnId) => db.doc(`players/${uid}/financialData_TRUELAYER/accounts/items/${accountId}/transactions/${txnId}`),
  accountDD:       (uid, accountId, ddId)  => db.doc(`players/${uid}/financialData_TRUELAYER/accounts/items/${accountId}/direct_debits/${ddId}`),
  accountSO:       (uid, accountId, soId)  => db.doc(`players/${uid}/financialData_TRUELAYER/accounts/items/${accountId}/standing_orders/${soId}`),

  cardsRootDoc:    (uid) => db.doc(`players/${uid}/financialData_TRUELAYER/cards`),
  cardItemDoc:     (uid, cardId) => db.doc(`players/${uid}/financialData_TRUELAYER/cards/items/${cardId}`),
  cardTx:          (uid, cardId, txnId) => db.doc(`players/${uid}/financialData_TRUELAYER/cards/items/${cardId}/transactions/${txnId}`),
};

const toMinor = (amt) => Math.round(Number(amt || 0) * 100);
const firstTs = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v) return admin.firestore.Timestamp.fromDate(new Date(v));
  }
  return null;
};
const safeId = (rawId, fallback = '') =>
  (String(rawId || fallback) || `${Date.now()}`).replace(/[^\w\-:.]/g, '_');

// -----------------------------------------------------------------------------
// TL → Canonical ingestion helpers (idempotent, calc-start aware)
// -----------------------------------------------------------------------------

function canonicalIdFromTL(kind /* 'account' | 'card' */, parentId, txnId) {
  const p = String(parentId || '').replace(/[^\w\-:.]/g, '_');
  const t = String(txnId   || '').replace(/[^\w\-:.]/g, '_');
  return (kind === 'card') ? `tl_card_${p}__${t}` : `tl_acc_${p}__${t}`;
}

function mapTLTxnToCanonical({ kind, parentId, txn }) {
  const now = Date.now();
  const postedAtTs = txn.postedAt || null; // firestore.Timestamp from our upsert
  const dateMs = postedAtTs && typeof postedAtTs.toMillis === 'function'
    ? postedAtTs.toMillis()
    : now;

  const amountMinor = (typeof txn.amountMinor === 'number')
    ? txn.amountMinor
    : Math.round(Number(txn.raw?.amount || 0) * 100);

  // NOTE: canonical uses signed major units; TL amounts are already signed.
  const amount = Number((amountMinor || 0) / 100);

  const description = txn.description || txn.raw?.description || '';
  const merchantName = txn.merchantName || txn.raw?.merchant_name || null;
  const currency = txn.currency || txn.raw?.currency || 'GBP';
  const providerStatus = txn.status || txn.raw?.status || null;
  const transactionId = txn.transactionId || txn.raw?.transaction_id || 'unknown';
  const txTypeUpper = String(txn.txType || txn.raw?.transaction_type || '').toUpperCase();
  const isTransferCandidate =
   Boolean(txn.isTransferCandidate) ||
   txTypeUpper.includes('TRANSFER') ||
   /transfer/i.test(description || '');

  // We set suggestedPool only; tag/provisionalTag are added ONLY if missing on the canonical doc.
  const ghostWindowMs = 2 * 60 * 60 * 1000; // 2h
  const addedMs = now;

  const canonical = {
    amount,                 // signed major units
    dateMs,
    source: 'truelayer',
    status: 'pending',      // locker will confirm later
    addedMs,
    ghostWindowMs,
    ghostExpiryMs: addedMs + ghostWindowMs,
    rulesVersion: 'v1',
    suggestedPool: 'stamina', // default suggestion if no rule yet
    sourceSubtype: isTransferCandidate ? 'transfer' : null,
    isTransferCandidate: !!isTransferCandidate,
    transactionData: {
      description,
      merchantName,
      currency,
      providerStatus,
      entryDate: admin.firestore.Timestamp.fromMillis(dateMs),
    },
    providerRef: {
      provider: 'truelayer',
      kind,                    // 'account' | 'card'
      parentId,
      transactionId
    },
  };

  return canonical;
}

// Ingest a single TL txn doc into canonical, with calc-start filtering and no tag override
async function ingestOneTrueLayerTxn(db, {
  uid, kind /* 'account' | 'card' */, parentId, txnId, txnData
}) {
  // 1) calc-start (reuse your helpers already in this file)
  const calcStartMs = await getPayCycleStartMsServer(db, uid);


  const postedAtMs = txnData?.postedAt?.toMillis
    ? txnData.postedAt.toMillis()
    : (txnData?.raw?.timestamp ? (new Date(txnData.raw.timestamp)).getTime() : 0);

  if (!(postedAtMs >= calcStartMs)) {
    // below calc-start → ignore
    return { skipped: true, reason: 'before_calc_start' };
  }

  const canonicalId = canonicalIdFromTL(kind, parentId, txnId);
  const canonicalRef = db.doc(`players/${uid}/classifiedTransactions/${canonicalId}`);

  // 2) Build payload
  const payload = mapTLTxnToCanonical({ kind, parentId, txn: txnData });

  // 3) Non-destructive merge:
  //    - if tag or provisionalTag already exist (manual/user action), do NOT overwrite
  //    - if status is confirmed, do NOT revert to pending
  const cur = await canonicalRef.get();
  if (cur.exists) {
    const d = cur.data() || {};
    if (d?.tag)         delete payload.tag;
    if (d?.provisionalTag) delete payload.provisionalTag;
    if (d?.status === 'confirmed') delete payload.status;
    if (d?.suggestedPool) delete payload.suggestedPool; // keep earlier suggestion
  } else {
    // On first write we could seed a provisionalTag if you later add rules.
    // For now, we only set suggestedPool.
  }

  await canonicalRef.set(payload, { merge: true });
  return { ok: true, canonicalId };
}

/**
 * ====================================================================
 *  TRUE LAYER: FAN-OUT UPSERTS
 * ====================================================================
 */
async function upsertAccounts(uid, accountsPayload) {
  const results = accountsPayload?.results || [];
  const now = FieldValue.serverTimestamp();

  await tlPaths.accountsRootDoc(uid).set({ updatedAt: now }, { merge: true });

  const batch = db.batch();
  for (const acc of results) {
    const accountId = safeId(acc.account_id, acc.resource_id || acc.iban || acc.account_number);
    const ref = tlPaths.accountItemDoc(uid, accountId);
    batch.set(ref, {
      provider: 'truelayer',
      accountId,
      displayName: acc.display_name || acc.name || null,
      type: acc.account_type || acc.type || null,
      currency: acc.currency || 'GBP',
      sync: { status: 'ok', lastSyncedAt: null, cursor: null, updatedAt: now },
      raw: acc,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();
}

async function upsertCards(uid, cardsPayload) {
  const results = cardsPayload?.results || [];
  const now = FieldValue.serverTimestamp();

  await tlPaths.cardsRootDoc(uid).set({ updatedAt: now }, { merge: true });

  const batch = db.batch();
  for (const c of results) {
    const cardId = safeId(c.card_id || c.id);
    const ref = tlPaths.cardItemDoc(uid, cardId);
    batch.set(ref, {
      provider: 'truelayer',
      cardId,
      displayName: c.display_name || c.name || null,
      currency: c.currency || 'GBP',
      sync: { status: 'ok', lastSyncedAt: null, cursor: null, updatedAt: now },
      raw: c,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();
}

async function upsertTransactionsForAccount(uid, accountId, txns = []) {
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const t of txns) {
    const txnId = safeId(t.transaction_id, `${t.timestamp || t.posted || ''}:${t.amount}:${t.description || ''}`);
    const txType = String(t.transaction_type || t.type || '').toUpperCase();
    const cats   = Array.isArray(t.categories) ? t.categories : [];
    const isTransfer = txType.includes('TRANSFER') || cats.some(c => String(c).toUpperCase().includes('TRANSFER'));

    const ref = tlPaths.accountTx(uid, accountId, txnId);
    batch.set(ref, {
      provider: 'truelayer',
      accountId,
      transactionId: txnId,
      status: t.status || t.transaction_type || null,
      postedAt: firstTs(t, ['timestamp','posted','booked']),
      description: t.description || null,
      merchantName: t.merchant_name || null,
      amountMinor: toMinor(t.amount),
      currency: t.currency || 'GBP',
      runningBalanceMinor: t.running_balance ? toMinor(t.running_balance.amount) : null,
      categories: t.categories || null,
      txType,                   // e.g. "TRANSFER", "CARD_PAYMENT", ...
      isTransferCandidate: isTransfer,
      raw: t,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();

  await tlPaths.accountItemDoc(uid, accountId).set({
    sync: { status: 'ok', lastSyncedAt: now, updatedAt: now }
  }, { merge: true });
}

async function upsertDirectDebitsForAccount(uid, accountId, dds = []) {
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const d of dds) {
    const ddId = safeId(d.direct_debit_id || d.mandate_id, `${d.mandate_reference || d.reference || 'dd'}:${d.name || ''}`);
    const ref = tlPaths.accountDD(uid, accountId, ddId);
    batch.set(ref, {
      provider: 'truelayer',
      accountId,
      directDebitId: ddId,
      name: d.name || null,
      reference: d.mandate_reference || d.reference || null,
      status: d.status || null,
      lastPaymentAt: firstTs(d, ['last_payment_at','last_payment_date']),
      raw: d,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();

  await tlPaths.accountItemDoc(uid, accountId).set({
    sync: { status: 'ok', lastSyncedAt: now, updatedAt: now }
  }, { merge: true });
}

async function upsertStandingOrdersForAccount(uid, accountId, sos = []) {
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const s of sos) {
    const soId = safeId(s.standing_order_id, `${s.next_payment_date || ''}:${s.reference || ''}`);
    const ref = tlPaths.accountSO(uid, accountId, soId);
    batch.set(ref, {
      provider: 'truelayer',
      accountId,
      standingOrderId: soId,
      reference: s.reference || null,
      status: s.status || null,
      amountMinor: toMinor(s.amount),
      currency: s.currency || 'GBP',
      schedule: {
        interval: s.interval || s.frequency || null,
        day: s.day_of_month || s.day || null,
        nextAt: firstTs(s, ['next_payment_date','next_payment_at']),
      },
      raw: s,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  }
  await batch.commit();

  await tlPaths.accountItemDoc(uid, accountId).set({
    sync: { status: 'ok', lastSyncedAt: now, updatedAt: now }
  }, { merge: true });
}

/**
 * ====================================================================
 *  TRUE LAYER: PER-ACCOUNT FETCH (fan-out + keep aggregate)
 * ====================================================================
 */
async function fetchPerAccountAndUpsert(uid, subPath, kind) {
  // 1) list accounts
  const accountsRes = await tlGet(uid, `/data/v1/accounts`);
  await upsertAccounts(uid, accountsRes); // fan-out

  const results = {};
  for (const acc of (accountsRes.results || [])) {
    const accountIdRaw = acc.account_id;
    const accountId = safeId(accountIdRaw);

    // 2) fetch subresource per account
    const url = `/data/v1/accounts/${accountIdRaw}/${subPath}`;
    let items = [];
    try {
      const payload = await tlGet(uid, url);
      items = payload.results || [];
    } catch (err) {
      console.warn(`[${kind}] Failed for account ${accountId}:`, err.response?.data || err.message);
    }

    // 3) fan-out
    if (kind === 'transactions') {
      await upsertTransactionsForAccount(uid, accountId, items);
    } else if (kind === 'direct_debits') {
      await upsertDirectDebitsForAccount(uid, accountId, items);
    } else if (kind === 'standing_orders') {
      await upsertStandingOrdersForAccount(uid, accountId, items);
    }

    results[accountId] = items;
  }

  // 4) keep aggregate
  await db.doc(`players/${uid}/financialData_TRUELAYER/${kind}`).set({
    data: results,
    lastUpdated: Date.now(),
  }, { merge: true });

  return results;
}


const createPerAccountFunction = (subPath, key) =>
  onRequest({ region: 'europe-west2' }, async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const uid = await requireUidFromAuth(req);
        const data = await fetchPerAccountAndUpsert(uid, subPath, key);
        res.status(200).json({ success: true, data });
      } catch (err) {
        const status = err.status || err.response?.status || 500;
        console.error(`[${key}] Fetch failed:`, err.response?.data || err.message);
        res.status(status).json({ error: 'Fetch failed', details: err.message });
      }
    });
  });


/**
 * ====================================================================
 *  TRUE LAYER: EXPORTS (names preserved)
 * ====================================================================
 */
exports.fetchAccounts       = createFetchFunction('/data/v1/accounts', 'accounts'); // also fan-outs
exports.fetchCards          = createFetchFunction('/data/v1/cards', 'cards');       // also fan-outs
exports.fetchTransactions   = createPerAccountFunction('transactions', 'transactions');
exports.fetchDirectDebits   = createPerAccountFunction('direct_debits', 'direct_debits');
exports.fetchStandingOrders = createPerAccountFunction('standing_orders', 'standing_orders');

// POST /revokeTrueLayer  (Authorization: Bearer <idToken>)
exports.revokeTrueLayer = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const uid = await requireUidFromAuth(req);
      const snap = await tlTokenRef(uid).get();
      if (!snap.exists) return res.status(200).json({ ok: true, already: true });

      const tok = snap.data() || {};
      if (tok.refresh_token) {
        const params = new URLSearchParams();
        params.append('token', tok.refresh_token);
        params.append('client_id', TRUELAYER_CLIENT_ID.value());

        await axios.post(
          `${TL_AUTH_BASE}/connect/revoke`,
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
      }

      await tlTokenRef(uid).delete();
      return res.status(200).json({ ok: true, revoked: true });
    } catch (e) {
      const status = e.status || e.response?.status || 500;
      console.error('revokeTrueLayer error:', e.response?.data || e.message);
      return res.status(status).json({ error: 'revoke_failed', details: e.message });
    }
  });
});

// POST /disconnectTrueLayer  (Authorization: Bearer <idToken>)
// Optional: nuke stored TL data (default: keep). Send { purge: true } to delete.
exports.disconnectTrueLayer = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const uid = await requireUidFromAuth(req);
      const purge = !!req.body?.purge;

      // Best-effort revoke first
      try { await exports.revokeTrueLayer._callable({ headers: req.headers }); } catch (_) {}

      // Delete token doc
      await tlTokenRef(uid).delete().catch(()=>{});

      if (purge) {
        // Danger zone: remove TL subtree (accounts/cards/txs)
        const root = db.collection(`players/${uid}/financialData_TRUELAYER`);
        const snap = await root.get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(()=>{});
      }

      return res.status(200).json({ ok: true, purged: purge });
    } catch (e) {
      const status = e.status || e.response?.status || 500;
      console.error('disconnectTrueLayer error:', e.response?.data || e.message);
      return res.status(status).json({ error: 'disconnect_failed', details: e.message });
    }
  });
});

// Debug ping
exports.testPing = onRequest({ region: 'europe-west2' }, (req, res) => {
  res.send('Backend running fine!');
});

// -----------------------------------------------------------------------------
// Realtime ingestion: TL → classifiedTransactions (idempotent, calc-start aware)
// -----------------------------------------------------------------------------
exports.ingestTL_AccountTxn = onDocumentWritten({
  region: 'europe-west2',
  document: 'players/{uid}/financialData_TRUELAYER/accounts/items/{accountId}/transactions/{txnId}',
}, async (event) => {
  const after = event.data?.after;
  if (!after || !after.exists) return; // ignore deletes
  const uid = event.params.uid;
  const accountId = event.params.accountId;
  const txnId = event.params.txnId;
  const data = after.data() || {};
  try {
    await ingestOneTrueLayerTxn(db, {
      uid, kind: 'account', parentId: accountId, txnId, txnData: data
    });
  } catch (e) {
    console.error('ingestTL_AccountTxn error', { uid, accountId, txnId, e: e?.message });
  }
});

exports.ingestTL_CardTxn = onDocumentWritten({
  region: 'europe-west2',
  document: 'players/{uid}/financialData_TRUELAYER/cards/items/{cardId}/transactions/{txnId}',
}, async (event) => {
  const after = event.data?.after;
  if (!after || !after.exists) return;
  const uid = event.params.uid;
  const cardId = event.params.cardId;
  const txnId = event.params.txnId;
  const data = after.data() || {};
  try {
    await ingestOneTrueLayerTxn(db, {
      uid, kind: 'card', parentId: cardId, txnId, txnData: data
    });
  } catch (e) {
    console.error('ingestTL_CardTxn error', { uid, cardId, txnId, e: e?.message });
  }
});

// -----------------------------------------------------------------------------
// Backfill HTTPS: process TL transaction subcollections incrementally by watermark
//   GET .../ingestTrueLayerBackfill?uid=...&sinceMs=... (optional)
// -----------------------------------------------------------------------------
exports.ingestTrueLayerBackfill = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const uid = String(req.query.uid || '').trim();
      const sinceMsQ = Number(req.query.sinceMs || 0);
      if (!uid) return res.status(400).json({ error: 'Missing uid' });

      // calc-start
      const calcStartMs = await getPayCycleStartMsServer(db, uid);


      // helper: process any /items/* doc’s /transactions subcollection
      async function backfillFor(kind /* 'account'|'card' */) {
        const root = (kind === 'card')
          ? db.collection(`players/${uid}/financialData_TRUELAYER/cards/items`)
          : db.collection(`players/${uid}/financialData_TRUELAYER/accounts/items`);

        const itemsSnap = await root.get();
        let processed = 0, skipped = 0;

        for (const itemDoc of itemsSnap.docs) {
          const item = itemDoc.data() || {};
          const sync = item.sync || {};
          const watermarkMs = Number(sync.ingestWatermarkMs || 0);
          const since = Math.max(calcStartMs, watermarkMs, sinceMsQ);

          const txCol = itemDoc.ref.collection('transactions');
          let q = txCol.orderBy('postedAt').where('postedAt', '>=', admin.firestore.Timestamp.fromMillis(since));
          let last = null;
          let loopGuard = 0;

          while (loopGuard++ < 1000) {
            let q2 = q.limit(400);
            if (last) q2 = q2.startAfter(last);
            const snap = await q2.get();
            if (snap.empty) break;

            for (const txDoc of snap.docs) {
              const d = txDoc.data() || {};
              const txId = txDoc.id;
              const postedAtMs = d?.postedAt?.toMillis ? d.postedAt.toMillis() : 0;
              if (!(postedAtMs >= calcStartMs)) { skipped++; continue; }

              await ingestOneTrueLayerTxn(db, {
                uid, kind, parentId: itemDoc.id, txnId: txId, txnData: d
              });
              processed++;
            }

            last = snap.docs[snap.docs.length - 1];
            // advance watermark
            const lastMs = snap.docs[snap.docs.length - 1]?.data()?.postedAt?.toMillis?.() || since;
            await itemDoc.ref.set({ sync: { ...sync, ingestWatermarkMs: lastMs, updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
          }
        }
        return { processed, skipped };
      }

      const a = await backfillFor('account');
      const c = await backfillFor('card');

      return res.status(200).json({
        ok: true,
        calcStartMs,
        sinceMs: sinceMsQ || null,
        accounts: a,
        cards: c
      });
    } catch (e) {
      console.error('ingestTrueLayerBackfill error', e?.message);
      res.status(500).json({ error: 'ingest_failed', details: e?.message });
    }
  });
});

/**
 * ====================================================================
 *  CONTRIBUTIONS & STRIPE — (unchanged behaviour)
 * ====================================================================
 */

const toNum = (x, d = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
};

async function readAltruismMultiplier(db) {
  const envOverride = process.env.ALTRUISM_MULTIPLIER;
  if (envOverride && !Number.isNaN(Number(envOverride))) return Number(envOverride);
  try {
    const snap = await db.doc('appConfig/scoring').get();
    const m = snap.exists ? snap.data().altruismMultiplier : null;
    return typeof m === 'number' ? m : 1.0;
  } catch {
    return 1.0;
  }
}

async function settleContributionTx(db, {
  uid,
  contributionId,
  amountGBP,
  provider,
  providerRef = null
}) {
  const contribRef   = db.doc(`players/${uid}/contributions/${contributionId}`);
  const statsRef     = db.doc(`players/${uid}`);
  const summaryRef   = db.doc(`players/${uid}/classifiedTransactions/summary`);
  const classifiedId = `contrib_${contributionId}`;
  const classifiedRef= db.doc(`players/${uid}/classifiedTransactions/${classifiedId}`);

  const multiplier   = await readAltruismMultiplier(db);
  const awardPts     = Math.round(toNum(amountGBP, 0) * multiplier);
  const now = Date.now();

  await db.runTransaction(async (trx) => {
    const [cSnap, sumSnap] = await Promise.all([trx.get(contribRef), trx.get(summaryRef)]);
    if (!cSnap.exists) throw new Error(`Contribution ${contributionId} not found for ${uid}`);
    const c = cSnap.data() || {};
    if ((c.status || 'pending') === 'succeeded') return;

    const docAmount  = c.amountGBP != null ? Number(c.amountGBP) : null;
    const finalAmount= docAmount == null ? toNum(amountGBP, 0) : toNum(docAmount, 0);
    if (!(finalAmount > 0)) throw new Error('Contribution amount must be > 0');

    // 1) classified txn
    trx.set(classifiedRef, {
      amount: -Math.abs(finalAmount),
      dateMs: now,
      source: provider,
      status: 'confirmed',
      addedMs: now,
      ghostWindowMs: 0,
      ghostExpiryMs: now,
      autoLockReason: 'contribution',
      tag: { pool: 'essence', setAtMs: now },
      provisionalTag: { pool: 'essence', setAtMs: now },
      appliedAllocation: { health: 0, mana: 0, stamina: 0, essence: Math.abs(finalAmount) },
      rulesVersion: 'v1',
      transactionData: {
        description: `Contribution (${provider})`,
        entryDate: admin.firestore.Timestamp.fromMillis(now),
      },
      providerRef: providerRef || null,
    }, { merge: true });

    // 2) award points
    trx.set(
      statsRef,
      { 'avatarData': { 'altruismPoints': admin.firestore.FieldValue.increment(awardPts) } },
      { merge: true }
    );

    // 3) mark contribution succeeded
    trx.set(contribRef, {
      amountGBP: finalAmount,
      provider,
      providerRef: providerRef || null,
      status: 'succeeded',
      settledAtMs: now,
      awardedPoints: awardPts
    }, { merge: true });

    // 4) usage summary bump — overall + per-stream (manual, truelayer)
    const su = (sumSnap.exists && sumSnap.data()) || {};
    const inc = Math.abs(finalAmount);

    const safePools = () => ({ health: 0, mana: 0, stamina: 0, essence: 0 });
    const historicUsage          = (su.historicUsage          || safePools());
    const historicUsage_manual   = (su.historicUsage_manual   || safePools());
    const historicUsage_truelayer= (su.historicUsage_truelayer|| safePools());
    const recentUsage            = (su.recentUsage            || safePools());
    const recentUsage_manual     = (su.recentUsage_manual     || safePools());
    const recentUsage_truelayer  = (su.recentUsage_truelayer  || safePools());

    // increment essence in all relevant buckets
    historicUsage.essence           = toNum(historicUsage.essence)           + inc;
    historicUsage_manual.essence    = toNum(historicUsage_manual.essence)    + inc;
    historicUsage_truelayer.essence = toNum(historicUsage_truelayer.essence) + inc;

    recentUsage.essence             = toNum(recentUsage.essence)             + inc;
    recentUsage_manual.essence      = toNum(recentUsage_manual.essence)      + inc;
    recentUsage_truelayer.essence   = toNum(recentUsage_truelayer.essence)   + inc;

    trx.set(summaryRef, {
      historicUsage,
      historicUsage_manual,
      historicUsage_truelayer,
      recentUsage,
      recentUsage_manual,
      recentUsage_truelayer,
      updatedAt: now
    }, { merge: true });
  });
}

exports.stripeWebhook = onRequest({
  region: 'europe-west2',
  secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
}, async (req, res) => {
  try {
    const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: '2024-06-20' });
    const sig = req.headers['stripe-signature'];
    const evt = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());

    if (evt.type === 'checkout.session.completed') {
      const session = evt.data.object;
      const uid = session.metadata?.uid;
      const contributionId = session.metadata?.contributionId || session.id;
      const providerRef = session.id;

      const amountGBP = session.amount_total ? Number(session.amount_total) / 100 : undefined;
      if (!uid) throw new Error('Missing uid in session.metadata');

      await settleContributionTx(db, {
        uid, contributionId, amountGBP, provider: 'stripe', providerRef
      });
    }

    if (evt.type === 'checkout.session.expired' || evt.type === 'checkout.session.async_payment_failed') {
      const session = evt.data.object;
      const uid = session.metadata?.uid;
      const contributionId = session.metadata?.contributionId || session.id;
      if (!uid) throw new Error('Missing uid in session.metadata');

      await db.doc(`players/${uid}/contributions/${contributionId}`).set({
        status: 'cancelled',
        cancelledAtMs: Date.now(),
        providerRef: session.id
      }, { merge: true });

      return res.json({ received: true });
    }


    res.json({ received: true });
  } catch (err) {
    console.error('stripeWebhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

exports.markManualContributionReceived = onCall({
  region: 'europe-west2',
}, async (req) => {
  const ctx = req.auth;
  if (!ctx?.token?.admin) {
    throw new Error('Permission denied: admin only.');
  }
  const { uid, contributionId, amountGBP, providerRef } = req.data || {};
  if (!uid || !contributionId) throw new Error('uid and contributionId are required');

  await settleContributionTx(db, {
    uid,
    contributionId,
    amountGBP,
    provider: 'manual_bank',
    providerRef: providerRef || null
  });

  return { ok: true };
});

exports.createContributionCheckout = onCall({
  region: 'europe-west2',
  secrets: [STRIPE_SECRET],
}, async (req) => {
  const ctx = req.auth;
  if (!ctx || !ctx.uid) throw new Error('Not authenticated');
  const uid = ctx.uid;

  const MIN_GBP = 2;

  const rawAmount = Number(req.data?.amountGBP || 0);
  if (!Number.isFinite(rawAmount)) throw new Error('Invalid amount');
  if (rawAmount < MIN_GBP) throw new Error(`Minimum Stripe contribution is £${MIN_GBP}.`);

  const available = await readAvailableEssenceMonthly(db, uid);
  if (available < MIN_GBP) throw new Error(`You need at least £${MIN_GBP} Essence to use card checkout.`);

  const amountGBP = Math.min(rawAmount, available);
  if (amountGBP < MIN_GBP) throw new Error(`Minimum Stripe contribution is £${MIN_GBP}.`);

  const contributionId = `c_${Date.now()}`;
  await db.doc(`players/${uid}/contributions/${contributionId}`).set({
    amountGBP,
    essenceCost: amountGBP,
    provider: 'stripe',
    providerRef: null,
    status: 'pending',
    createdAtMs: Date.now(),
  }, { merge: true });

  const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: '2024-06-20' });

  // Return URL handling
  let successUrl, cancelUrl;
  const clientReturn = String(req.data?.returnUrl || '').trim();
  if (clientReturn) {
    const refHeader = req.rawRequest?.headers?.referer || clientReturn;
    const ref = new URL(refHeader);
    const ret = new URL(clientReturn, ref.origin);
    if (ret.origin === ref.origin) {
      successUrl = ret.toString();
      cancelUrl  = ret.toString();
    }
  }
  if (!successUrl) {
    const refHeader = req.rawRequest?.headers?.referer || 'https://your.app/dashboard.html';
    const refUrl = new URL(refHeader);
    const base = `${refUrl.origin}${refUrl.pathname}`;
    successUrl = `${base}#vitals`;
    cancelUrl  = `${base}#vitals`;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'link'],
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: { name: 'MyFi Contribution' },
        unit_amount: Math.round(amountGBP * 100),
      },
      quantity: 1,
    }],
    metadata: { uid, contributionId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url, contributionId };
});

exports.onManualContributionOpsConfirm = onDocumentUpdated({
  region: 'europe-west2',
  document: 'players/{uid}/contributions/{contributionId}',
}, async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!after) return;

  if ((after.provider || '') !== 'manual_bank') return;

  const beforeConfirmed = !!(before && before.opsConfirmedAtMs);
  const afterConfirmed  = !!after.opsConfirmedAtMs;
  if (!afterConfirmed || beforeConfirmed) return;

  const uid = event.params.uid;
  const contributionId = event.params.contributionId;

  const amountGBP   = typeof after.amountGBP === 'number' ? after.amountGBP : undefined;
  const providerRef = after.providerRef || null;

  await settleContributionTx(db, {
    uid,
    contributionId,
    amountGBP,
    provider: 'manual_bank',
    providerRef
  });
});

/**
 * ====================================================================
 *  VITALS — server-authoritative (unchanged behaviour)
 * ====================================================================
 */

// Constants & helpers

// MS_PER_DAY: milliseconds in a day; used for converting ms↔days.
const MS_PER_DAY = 86_400_000;
// --- Estimated spend factors by mode (NEW) ---
const MODE_SPEND_FACTOR = {
  relaxed: 0.70,
  standard: 0.80,
  focused: 0.90,
  true: 0.80, // fallback; not used for seeding in true mode
};
// --- Pay-cycle helpers (NEW) ----------------------------------------------
// read lastPayDateMs saved by welcome.js
async function getLastPayDateMsServer(db, uid) {
  try {
    const prof = await db.doc(`players/${uid}`).get();
    const d = prof.exists ? (prof.data() || {}) : {};
    const lp = d?.incomeMeta?.lastPayDateMs;
    if (typeof lp === 'number' && lp > 0) return lp;
  } catch {}
  // fallback = first day of current calendar month (keeps old behaviour sane)
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

// find most recent cycle start (monthly cadence assumed) and its next start
function computePayCycleBounds(lastPayDateMs, nowMs = Date.now()) {
  const d0 = new Date(lastPayDateMs);
  // advance by whole months until start <= now < nextStart
  let y = d0.getFullYear(), m = d0.getMonth(), day = d0.getDate();
  let cycleStart = new Date(y, m, day).getTime();
  while (true) {
    const next = new Date(y, m + 1, day).getTime();
    if (nowMs < next) { 
      const cycleLen = Math.max(MS_PER_DAY, next - cycleStart);
      const frac = Math.max(0, Math.min(1, (nowMs - cycleStart) / cycleLen));
      const daysSince = Math.max(0, (nowMs - cycleStart) / MS_PER_DAY);
      return { cycleStartMs: cycleStart, nextCycleStartMs: next, cycleLenMs: cycleLen, cycleFrac: frac, daysSinceCycleStart: daysSince };
    }
    y = new Date(next).getFullYear(); m = new Date(next).getMonth();
    cycleStart = next;
  }
}

// Return the current pay-cycle start ms based on incomeMeta.lastPayDateMs
async function getPayCycleStartMsServer(db, uid) {
  const lp = await getLastPayDateMsServer(db, uid);
  const { cycleStartMs } = computePayCycleBounds(lp, Date.now());
  return cycleStartMs;
}

// elapsedDaysFromCalcStartServer(db, uid)  -> pay-cycle elapsed (float)
async function elapsedDaysFromCalcStartServer(db, uid) {
  const lp = await getLastPayDateMsServer(db, uid);
  const { daysSinceCycleStart } = computePayCycleBounds(lp, Date.now());
  return Math.max(0, daysSinceCycleStart);
}
// daysTrackedFromCalcStartServer(db, uid)  -> pay-cycle days (int, min 1)
async function daysTrackedFromCalcStartServer(db, uid) {
  const lp = await getLastPayDateMsServer(db, uid);
  const { daysSinceCycleStart } = computePayCycleBounds(lp, Date.now());
  return Math.max(1, Math.floor(daysSinceCycleStart));
}

// --- Anchor helpers (NEW) ----------------------------------------------
async function getAnchorMsServer(db, uid) {
  // anchor = when the player last set/confirmed their pay date
  try {
    const prof = await db.doc(`players/${uid}`).get();
    const d = prof.exists ? (prof.data() || {}) : {};
    const ts = d?.incomeMeta?.lastPaySavedAtMs; // may be number or firestore.Timestamp
    if (typeof ts === 'number' && ts > 0) return ts;
    if (ts?.toMillis) return ts.toMillis();
  } catch {}
  return Date.now(); // safe fallback
}

// Elapsed days helper that can stop at an explicit moment (defaults to now)
async function elapsedDaysUntilServer(db, uid, untilMs = Date.now()) {
  const lp = await getLastPayDateMsServer(db, uid);
  const { cycleStartMs } = computePayCycleBounds(lp, untilMs);
  return Math.max(0, (untilMs - cycleStartMs) / MS_PER_DAY);
}


// Seeding/eligibility helpers

function anchorsFromSnapshot(curDoc, mode, payCycleStartMs, rebaseKey=null) {
  const prev = (curDoc && curDoc.seedAnchor) || {};
  const prevStart = Number(prev.payCycleStartMs || 0);
  const prevMode  = String(prev.vitalsMode || '').toLowerCase();
  const prevKey   = prev.rebaseKey || null;
  const nextMode  = String(mode || '').toLowerCase();

  const changed = (prevStart !== Number(payCycleStartMs)) ||
                  (prevMode  !== nextMode) ||
                  (String(prevKey||'') !== String(rebaseKey||''));

  return { changed, prev, next: { payCycleStartMs, vitalsMode: nextMode, rebaseKey } };
}



// signed seedOffset builder (same as before), now returning the new anchor too
async function buildSeedOffsetServer(db, uid, pools, mode) {
  // True mode never seeds
  if (mode === 'true') {
    const startMs = await getPayCycleStartMsServer(db, uid);
    return { seedOffset: {}, seedAnchor: { payCycleStartMs: startMs, vitalsMode: 'true', rebaseKey: `true_${startMs}` } };
  }

  // 1) desired seeded currents (what the player should "see" at anchor)
  const desired = await computeSeedCurrentsAllServer(db, uid, pools, mode);

  // 2) elapsed ONLY up to anchor
  const anchorMs = await getAnchorMsServer(db, uid);
  const days = await elapsedDaysUntilServer(db, uid, anchorMs);

  // 3) signed offset so Truth(at anchor) == desired
  const out = {};
  for (const k of Object.keys(pools)) {
    const regen   = Number(pools[k]?.regenCurrent || 0);
    const accrued = regen * days; // only up to anchor
    const want    = Math.max(0, Number(desired?.[k]?.current || 0));
    out[k] = Number((accrued - want).toFixed(2));
  }

  const startMs = await getPayCycleStartMsServer(db, uid);
  // rebaseKey makes reseeding deterministic across pay-date reset / anchor moves
  return { seedOffset: out, seedAnchor: { payCycleStartMs: startMs, vitalsMode: String(mode).toLowerCase(), rebaseKey: String(anchorMs) } };
}


// computeSeedCurrentsAllServer(db, uid, pools, mode, startMs, { p=0.6 }):
// Full set (Health, Mana, Stamina, Essence) seeding snapshot used elsewhere. Original behavior:
// Max for each pool = regenBaseline * daysAccruedSinceMonthStart.
// Safe: Mana/Stamina/Essence current start at a small “day-fraction” floor (or 1+fraction if not day 1). Health starts at accrued max.
// Standard: Mana/Stamina/Essence start at day-1 floors (or 0 after day 1) plus a share of residual disposable (R = (m+s+e)*daysAccrued*(1-p)), capped by accrued max. Health starts at accrued max.
// Full-pools seeding (used elsewhere)
// Full-pools seeding (updated per your spec, with Essence based on current month progress)
async function computeSeedCurrentsAllServer(db, uid, pools, mode) {
  // Baselines
  const h1 = Number(pools?.health?.regenBaseline   || 0);
  const m1 = Number(pools?.mana?.regenBaseline     || 0);
  const s1 = Number(pools?.stamina?.regenBaseline  || 0);
  const e1 = Number(pools?.essence?.regenBaseline  || 0);

  // Pay-cycle framing
  const lp = await getLastPayDateMsServer(db, uid);
  const { cycleFrac, cycleLenMs } = computePayCycleBounds(lp, Date.now());
  const daysInCycle = cycleLenMs / MS_PER_DAY;

  // Max values over the current cycle
  const Hmax = h1 * daysInCycle;   // Health seeds to full cycle
  const Mmax = m1 * daysInCycle;
  const Smax = s1 * daysInCycle;
  const Emax = e1 * daysInCycle;

  // Expected spend factor by mode (70/80/90%)
  const F = MODE_SPEND_FACTOR[mode] ?? 0.80;

  // Health: full-cycle
  const Hcur = Hmax;

  // Mana/Stamina: expected burn proportional to cycle progress
  const Mcur_est = Math.max(0, Mmax - (Mmax * cycleFrac * F));
  const Scur_est = Math.max(0, Smax - (Smax * cycleFrac * F));

  // Essence: accrues with cycle progress
  const Ecur = Math.max(0, Emax * cycleFrac);

  return {
    health:  { current: Hcur,                     max: Hmax },
    mana:    { current: Math.min(Mmax, Mcur_est), max: Mmax },
    stamina: { current: Math.min(Smax, Scur_est), max: Smax },
    essence: { current: Ecur,                     max: Emax },
  };
}

// Maintenence Helpers
// Is the 'summary' doc?
function isSummaryDoc(txId) {
  return String(txId) === 'summary';
}

// Shallow compare only the fields that can change totals/windowing.
function differs(a, b) {
  const A = a ?? {};
  const B = b ?? {};
  // Only fields that affect summary math:
  //  - status         : must be 'confirmed' to be counted
  //  - dateMs         : pay-window filter
  //  - appliedAllocation : pooled amounts to sum
  //  - source         : split to manual/truelayer buckets
  //  - lockedAtMs/tag.setAtMs : used as fallback timing in your reducer
  // NOTE: stringify is fine here (values are small & numeric); avoids deep-walk code.
  const pick = (x) => ({
    status: x?.status ?? null,
    dateMs: Number(x?.dateMs ?? 0),
    source: String(x?.source ?? '').toLowerCase(),
    lockedAtMs: Number(x?.lockedAtMs ?? 0),
    tagSetAtMs: Number(x?.tag?.setAtMs ?? 0),
    appliedAllocation: x?.appliedAllocation ? JSON.stringify(x.appliedAllocation) : null,
  });
  const pa = pick(A), pb = pick(B);
  return JSON.stringify(pa) !== JSON.stringify(pb);
}




// Main recomputation
// updateVitalsPoolsServer(db, uid):
// Loads daily averages and pool allocations; builds per-pool regenBaseline (daily).
// Determines mode (safe default; allows standard, manual, true).
// Reads classified usage summary; derives 7-day usage and all-time usage for either desired stream (truelayer for True mode, otherwise Manual stream).
// calcRegen: nudges regenCurrent vs regenBaseline based on 7-day usage (slight up/down for underspend/overspend).
// Builds pools state (baselines, current regen, usage7, trend, spentToDate).
// Calls ensureSeedCarryAndSeedSnapshotServer to compute seedCarry and/or seed.
// Writes everything to cashflowData/current (merging), including daysTracked, elapsedDays, and mode.
async function updateVitalsPoolsServer(db, uid) {
  const currentRef  = db.doc(`players/${uid}/cashflowData/current`);
  const currentSnap = await currentRef.get();
  const curDoc = currentSnap.exists ? (currentSnap.data() || {}) : {};

  const dailySnap  = await db.doc(`players/${uid}/cashflowData/dailyAverages`).get();
  const allocSnap  = await db.doc(`players/${uid}/cashflowData/poolAllocations`).get();
  if (!dailySnap.exists || !allocSnap.exists) return null;

  const { dIncome = 0, dCoreExpenses = 0 } = dailySnap.data() || {};
  const { healthAllocation=0, manaAllocation=0, staminaAllocation=0, essenceAllocation=0 } = allocSnap.data() || {};
  const dailyDisposable = Number(dIncome) - Number(dCoreExpenses);

  const regenBaseline = {
    health:  dailyDisposable * healthAllocation,
    mana:    dailyDisposable * manaAllocation,
    stamina: dailyDisposable * staminaAllocation,
    essence: dailyDisposable * essenceAllocation,
  };

  const prof = await db.doc(`players/${uid}`).get();
  let mode = 'standard';
  if (prof.exists) {
    const d = prof.data() || {};
    const m = String(d.vitalsMode || '').toLowerCase();
    if (['relaxed','standard','focused','true'].includes(m)) mode = m;
  }
  const desiredSourceKey = (mode === 'true') ? 'truelayer' : 'manual';

  const sumSnap = await db.doc(`players/${uid}/classifiedTransactions/summary`).get();
  const usage7Day    = { health:0, mana:0, stamina:0, essence:0 };
  const usageAllTime = { health:0, mana:0, stamina:0, essence:0 };
  if (sumSnap.exists) {
    const d = sumSnap.data() || {};
    const recent = d[`recentUsage_${desiredSourceKey}`]   || d.recentUsage   || {};
    const hist   = d[`historicUsage_${desiredSourceKey}`] || d.historicUsage || {};
    for (const k of Object.keys(usage7Day)) {
      usage7Day[k]    = Number(recent[k]  || 0);
      usageAllTime[k] = Number(hist[k]|| 0);
    }
  }

  const calcRegen = (baseline, usage) => {
    if (usage > baseline * 1.15) return [baseline * 0.95, "overspending"];
    if (usage < baseline * 0.8 ) return [baseline * 1.05, "underspending"];
    return [baseline, "on target"];
  };

  const daysTracked = await daysTrackedFromCalcStartServer(db, uid);
  const elapsedDays = await elapsedDaysFromCalcStartServer(db, uid);

  const pools = {};
  for (const pool of ["health","mana","stamina","essence"]) {
    const baseline = Number(regenBaseline[pool] || 0);
    const [regenCurrent, trend] = calcRegen(baseline, Number(usage7Day[pool] || 0));
    const spent = Number(usageAllTime[pool] || 0);
    pools[pool] = {
      regenBaseline: Number(baseline.toFixed(2)),
      regenCurrent:  Number(regenCurrent.toFixed(2)),
      usage7Day:     Number((usage7Day[pool]||0).toFixed(2)),
      trend,
      spentToDate:   Number(spent.toFixed(2)),
    };
  }

    // decide if we need to recompute the seedOffset
    const payCycleStartMs = await getPayCycleStartMsServer(db, uid);
    const anchorMs = await getAnchorMsServer(db, uid);
    const rebaseKey = String(anchorMs);
    const { changed, next } = anchorsFromSnapshot(curDoc, mode, payCycleStartMs, rebaseKey);


  let seedOffset = curDoc.seedOffset || curDoc.seedCarry || {}; // legacy fallback
  let seedAnchor = curDoc.seedAnchor || null;

  if (changed || !seedAnchor) {
    const built = await buildSeedOffsetServer(db, uid, pools, mode);
    seedOffset = built.seedOffset;
    seedAnchor = built.seedAnchor;
  }

  // Always mirror the canonical anchor for display/debug:
seedAnchor = { ...seedAnchor, anchorMs };  // <-- mirror only

  const payload = {
    pools,
    dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
    daysTracked,
    elapsedDays,
    lastSync: FieldValue.serverTimestamp(),
    mode,
    seedOffset, // signed (can be negative or positive)
    seedAnchor, // now contains { payCycleStartMs, vitalsMode, rebaseKey }
    // hard clear legacy fields to avoid stale behavior:
    seed: FieldValue.delete(),
    seedCarry: FieldValue.delete(),
  };

  await currentRef.set(payload, { merge: true });
  return payload;

}

// Allocation helpers

// allocateSpendAcrossPoolsServer(spend, intent, availTruth):
// If intent is mana: fill Mana up to what’s available, then overflow to Health.
// Otherwise (stamina intent): fill Stamina first, overflow to Health.
function allocateSpendAcrossPoolsServer(spend, intent, availTruth) {
  const out = { health:0, mana:0, stamina:0, essence:0 };
  if (spend <= 0) return out;

  if (intent === "mana") {
    const toMana = Math.min(spend, Math.max(0, availTruth.mana));
    if (toMana > 0) { out.mana += toMana; availTruth.mana -= toMana; }
    const leftover = spend - toMana;
    if (leftover > 0) out.health += leftover;
    return out;
  }

  const toStamina = Math.min(spend, Math.max(0, availTruth.stamina));
  if (toStamina > 0) { out.stamina += toStamina; availTruth.stamina -= toStamina; }
  const toHealth = spend - toStamina;
  if (toHealth > 0) out.health += toHealth;
  return out;
}
// roundPools(p) / sumPools(a,b): small numeric helpers for pooling math.
function roundPools(p){ return {
  health:Number((p.health||0).toFixed(2)),
  mana:Number((p.mana||0).toFixed(2)),
  stamina:Number((p.stamina||0).toFixed(2)),
  essence:Number((p.essence||0).toFixed(2)),
};}
function sumPools(a,b){ return {
  health:(a.health||0)+(b.health||0),
  mana:(a.mana||0)+(b.mana||0),
  stamina:(a.stamina||0)+(b.stamina||0),
  essence:(a.essence||0)+(b.essence||0),
};}

// Usage summary

// recomputeSummaryServer(db, uid):
// Reads all confirmed transactions, folds each TX’s appliedAllocation into totals:
// Overall historic and last-7-days.
// Split by source stream: manual (anything not truelayer) and truelayer.
// Writes to classifiedTransactions/summary
async function recomputeSummaryServer(db, uid) {
  // window: anchor → now  (manual modes will only ever create txns in-window;
  // true mode also in-window, plus we inject a flattened pre-anchor spend)
  const lp = await getLastPayDateMsServer(db, uid);
  const { cycleStartMs } = computePayCycleBounds(lp, Date.now());
  const anchorMs = await getAnchorMsServer(db, uid);
  const windowStartMs = Math.max(cycleStartMs, anchorMs); // clamp to cycleStart

  // Read mode + pool allocations for flatten split
  const profSnap = await db.doc(`players/${uid}`).get();
  const prof = profSnap.exists ? (profSnap.data() || {}) : {};
  const mode = String(prof.vitalsMode || 'standard').toLowerCase();

  const allocSnap = await db.doc(`players/${uid}/cashflowData/poolAllocations`).get();
  const { healthAllocation=0, manaAllocation=0, staminaAllocation=0 } = allocSnap.exists ? (allocSnap.data() || {}) : {};
  const split = {
    health: Number(healthAllocation || 0),
    mana:   Number(manaAllocation   || 0),
    stamina:Number(staminaAllocation|| 0),
  };
  const splitSum = Math.max(1e-9, split.health + split.mana + split.stamina);

  // TRUE MODE: ensure single flattened txn for cycleStart→anchor (pre-window)
  if (mode === 'true') {
    await ensureFlattenedPreAnchorTrueLayerSpend(db, uid, cycleStartMs, windowStartMs, split, splitSum);
  } else {
    // In non-true modes, remove any stale flatten docs for safety (optional)
    await removeFlattenDocsForWindow(db, uid, cycleStartMs, windowStartMs);
  }

  // Aggregate confirmed classified txns in active window (>= anchor)
  const cycleStartFor7d = Math.max(windowStartMs, Date.now() - 7 * MS_PER_DAY);
  const col = db.collection(`players/${uid}/classifiedTransactions`);

  const snap = await col
    .where("status","==","confirmed")
    .where("dateMs",">=", windowStartMs)
    .get();

  const sumManual = {health:0,mana:0,stamina:0,essence:0};
  const sumManual7 = {health:0,mana:0,stamina:0,essence:0};
  const sumTL     = {health:0,mana:0,stamina:0,essence:0};
  const sumTL7    = {health:0,mana:0,stamina:0,essence:0};

  const addPools = (tgt, alloc) => {
    tgt.health  += Number(alloc.health  || 0);
    tgt.mana    += Number(alloc.mana    || 0);
    tgt.stamina += Number(alloc.stamina || 0);
    tgt.essence += Number(alloc.essence || 0);
  };

  snap.forEach(d => {
    const tx = d.data() || {};
    const alloc = tx.appliedAllocation || {};
    const when  = Number(tx.dateMs || tx.lockedAtMs || tx?.tag?.setAtMs || 0);
    const src   = String(tx.source || '').toLowerCase();

    if (src === 'truelayer') {
      addPools(sumTL, alloc);
      if (when >= cycleStartFor7d) addPools(sumTL7, alloc);
    } else {
      // anything not truelayer counts as manual (including contributions surfaced separately in your UI)
      addPools(sumManual, alloc);
      if (when >= cycleStartFor7d) addPools(sumManual7, alloc);
    }
  });

  await db.doc(`players/${uid}/classifiedTransactions/summary`).set({
    // keep legacy for continuity
    historicUsage: roundPools(sumManual),
    recentUsage:   roundPools(sumManual7),

    historicUsage_manual:    roundPools(sumManual),
    recentUsage_manual:      roundPools(sumManual7),
    historicUsage_truelayer: roundPools(sumTL),
    recentUsage_truelayer:   roundPools(sumTL7),

    updatedAt: FieldValue.serverTimestamp(),
    // helpful metadata for readers
    _window: { cycleStartMs, anchorMs: windowStartMs }
  }, { merge: true });
}

// NEW: build (or refresh) a single flattened TL spend for [cycleStartMs, anchorMs)
async function ensureFlattenedPreAnchorTrueLayerSpend(db, uid, cycleStartMs, anchorMs, split, splitSum) {
  if (!(anchorMs > cycleStartMs + 1000)) return; // nothing pre-anchor to flatten
  const flatId = `seed_flatten_${cycleStartMs}_${anchorMs}`;
  const flatRef = db.doc(`players/${uid}/classifiedTransactions/${flatId}`);

  // If already exists and still matches window, keep it
  const cur = await flatRef.get();
  if (cur.exists) {
    const d = cur.data() || {};
    if (d?.meta?.flatStartMs === cycleStartMs && d?.meta?.flatEndMs === anchorMs) return;
  }

  // Sum TL spends in TL subcollections for [cycleStart, anchor)
  let totalSpend = 0;
  async function sumFor(kind) {
    const root = (kind === 'card')
      ? db.collection(`players/${uid}/financialData_TRUELAYER/cards/items`)
      : db.collection(`players/${uid}/financialData_TRUELAYER/accounts/items`);
    const itemsSnap = await root.get();
    for (const itemDoc of itemsSnap.docs) {
      const txCol = itemDoc.ref.collection('transactions');
      const q = txCol
        .where('postedAt', '>=', admin.firestore.Timestamp.fromMillis(cycleStartMs))
        .where('postedAt', '<',  admin.firestore.Timestamp.fromMillis(anchorMs));
      const txs = await q.get();
      txs.forEach(t => {
        const raw = t.data() || {};
        const amtMinor = typeof raw.amountMinor === 'number'
          ? raw.amountMinor
          : Math.round(Number(raw.raw?.amount || 0) * 100);
        const amt = Number((amtMinor || 0) / 100);
        if (amt < 0) totalSpend += Math.abs(amt);
      });
    }
  }
  await sumFor('account');
  await sumFor('card');

  // Nothing to flatten → delete any stale doc and return
  if (totalSpend <= 0.0001) {
    if (cur.exists) await flatRef.delete();
    return;
  }

  const splitAmt = (p) => Number((totalSpend * (p / splitSum)).toFixed(2));
  const appliedAllocation = {
    health:  splitAmt(split.health),
    mana:    splitAmt(split.mana),
    stamina: splitAmt(split.stamina),
    essence: 0
  };

  // Upsert single confirmed flattened txn, dated at anchor so it’s inside recompute window
  await flatRef.set({
    amount: -Number(totalSpend.toFixed(2)),
    dateMs: anchorMs,
    source: 'truelayer',
    status: 'confirmed',
    addedMs: Date.now(),
    tag: { pool: 'stamina', setAtMs: Date.now() }, // harmless default
    appliedAllocation,
    meta: { flatSeed: true, flatStartMs: cycleStartMs, flatEndMs: anchorMs }
  }, { merge: true });
}

// Optional: clean stale flatten docs if not in true mode
async function removeFlattenDocsForWindow(db, uid, cycleStartMs, anchorMs) {
  const col = db.collection(`players/${uid}/classifiedTransactions`);
  // Best-effort: find any docs with our naming prefix; project is small so this is OK.
  const snap = await col.where('meta.flatSeed', '==', true).get();
  const batch = db.batch();
  snap.forEach(d => {
    const m = d.data()?.meta || {};
    const isCurrent = (m.flatStartMs === cycleStartMs && m.flatEndMs === anchorMs);
    if (!isCurrent) batch.delete(d.ref);
  });
  if (!batch._ops || !batch._ops.length) return;
  await batch.commit();
}



// -----------------------------------------------------------------------------
// Maintenance: recompute per-stream usage and immediately refresh vitals
// GET .../maintenanceRecomputeUsageAndVitals?uid=USER_ID
// "https://europe-west2-myfi-app-7fa78.cloudfunctions.net/maintenanceRecomputeUsageAndVitals?uid=24Nq8ULBihaaU0gutWO0bes1BVl2"
// -----------------------------------------------------------------------------
exports.maintenanceRecomputeUsageAndVitals = onRequest(
  { region: 'europe-west2' },
  async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const uid = String(req.query.uid || '').trim();
        if (!uid) return res.status(400).json({ error: 'missing_uid' });

        await recomputeSummaryServer(db, uid);             // writes per-stream fields
        const payload = await updateVitalsPoolsServer(db, uid); // reads per-stream + writes current

        return res.status(200).json({ ok: true, mode: payload?.mode, updatedAt: payload?.lastSync });
      } catch (e) {
        console.error('maintenanceRecomputeUsageAndVitals error:', e?.message);
        res.status(500).json({ error: 'recompute_failed', details: e?.message });
      }
    });
  }
);

// -----------------------------------------------------------------------------
// Maintenance: wipe classifiedTransactions (keep 'summary') and reset usage to 0
//   GET .../maintenanceResetClassified?uid=USER_ID&confirm=YES
// https://europe-west2-myfi-app-7fa78.cloudfunctions.net/maintenanceResetClassified?uid=24Nq8ULBihaaU0gutWO0bes1BVl2&confirm=YES
// -----------------------------------------------------------------------------
exports.maintenanceResetClassified = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const uid = String(req.query.uid || '').trim();
      const confirm = String(req.query.confirm || '').toUpperCase();
      if (!uid)   return res.status(400).json({ error: 'missing_uid' });
      if (confirm !== 'YES') {
        return res.status(400).json({
          error: 'confirmation_required',
          hint: 'Append &confirm=YES to actually perform the reset.'
        });
      }

      const colRef = db.collection(`players/${uid}/classifiedTransactions`);
      let totalDeleted = 0;
      // Delete in batches (keep 'summary')
      while (true) {
        const snap = await colRef.limit(400).get();
        if (snap.empty) break;

        const batch = db.batch();
        let deletable = 0;
        snap.docs.forEach(doc => {
          if (doc.id !== 'summary') {
            batch.delete(doc.ref);
            deletable++;
          }
        });

        if (deletable === 0) break; // only 'summary' remains
        await batch.commit();
        totalDeleted += deletable;

        // If we fetched fewer than our page size, we're likely done.
        if (snap.size < 400) break;
      }

      // Reset 'summary' usage fields to zero (legacy + per-stream)
      const zeros = { health: 0, mana: 0, stamina: 0, essence: 0 };
      await db.doc(`players/${uid}/classifiedTransactions/summary`).set({
        historicUsage: zeros,
        recentUsage: zeros,
        historicUsage_manual: zeros,
        recentUsage_manual: zeros,
        historicUsage_truelayer: zeros,
        recentUsage_truelayer: zeros,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Refresh vitals so HUD updates immediately
      const payload = await updateVitalsPoolsServer(db, uid);

      return res.status(200).json({
        ok: true,
        deleted: totalDeleted,
        mode: payload?.mode || null,
        updatedAt: payload?.lastSync || null
      });
    } catch (e) {
      console.error('maintenanceResetClassified error:', e?.message || e);
      res.status(500).json({ error: 'reset_failed', details: e?.message || String(e) });
    }
  });
});



// -----------------------------------------------------------------------------
// Ingest ONLY the most recent TrueLayer transactions (testing helper)
// Uses already-fetched TL subcollections; does NOT fetch from TL API.
//   GET .../ingestTrueLayerRecent?uid=USER_ID&n=10[&nTotal=25][&kind=account|card|both]
//   - n:      max per account/card (default 10, max 200)
//   - nTotal: optional global cap across all accounts/cards
//   - kind:   'account' | 'card' | 'both' (default 'both')
//https://europe-west2-myfi-app-7fa78.cloudfunctions.net/ingestTrueLayerRecent?uid=24Nq8ULBihaaU0gutWO0bes1BVl2&n=1
// -----------------------------------------------------------------------------
exports.ingestTrueLayerRecent = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const uid = String(req.query.uid || '').trim();
      if (!uid) return res.status(400).json({ error: 'missing_uid' });

      const nPer = Math.max(1, Math.min(Number(req.query.n || 10), 200));
      const nTotal = Math.max(0, Number(req.query.nTotal || 0)) || 0;
      const kindParam = String(req.query.kind || 'both').toLowerCase();
      const kinds = (kindParam === 'both') ? ['account','card']
                    : (kindParam === 'account' || kindParam === 'card') ? [kindParam] : ['account','card'];

      // Collect newest N per item (account/card)
      const collected = [];
      for (const kind of kinds) {
        const root = (kind === 'card')
          ? db.collection(`players/${uid}/financialData_TRUELAYER/cards/items`)
          : db.collection(`players/${uid}/financialData_TRUELAYER/accounts/items`);

        const itemsSnap = await root.get();
        for (const itemDoc of itemsSnap.docs) {
          const txSnap = await itemDoc.ref
            .collection('transactions')
            .orderBy('postedAt', 'desc')
            .limit(nPer)
            .get();

          txSnap.forEach(txDoc => {
            collected.push({
              kind,
              parentId: itemDoc.id,
              txnId: txDoc.id,
              data: txDoc.data() || {}
            });
          });
        }
      }

      // Global cap across all accounts/cards if requested
      collected.sort((a,b) => {
        const ams = a.data?.postedAt?.toMillis?.() || 0;
        const bms = b.data?.postedAt?.toMillis?.() || 0;
        return bms - ams; // newest first
      });
      const selected = nTotal > 0 ? collected.slice(0, nTotal) : collected;

      // Ingest (idempotent + calc-start aware)
      let processed = 0, skipped = 0;
      for (const t of selected) {
        const r = await ingestOneTrueLayerTxn(db, {
          uid, kind: t.kind, parentId: t.parentId, txnId: t.txnId, txnData: t.data
        });
        if (r?.skipped) skipped++; else processed++;
      }

      // Refresh aggregates so HUD reflects changes
      await recomputeSummaryServer(db, uid);
      const payload = await updateVitalsPoolsServer(db, uid);

      return res.status(200).json({
        ok: true,
        mode: payload?.mode || null,
        selected: selected.length,
        processed,
        skipped,
        note: "Reads from TL subcollections; run fetchTransactions first if empty."
      });
    } catch (e) {
      console.error('ingestTrueLayerRecent error:', e?.message || e);
      res.status(500).json({ error: 'ingest_recent_failed', details: e?.message || String(e) });
    }
  });
});

exports.onPlayerAnchorsChanged = onDocumentUpdated(
  { region: 'europe-west2', document: 'players/{uid}' },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after  = event.data?.after?.data()  || {};
    const uid    = event.params.uid;

    const beforePay = Number(before?.incomeMeta?.lastPayDateMs || 0);
    const afterPay  = Number(after?.incomeMeta?.lastPayDateMs  || 0);
    const beforeMode= String(before?.vitalsMode || '').toLowerCase();
    const afterMode = String(after?.vitalsMode  || '').toLowerCase();

    const payChanged  = beforePay !== afterPay;
    const modeChanged = beforeMode !== afterMode;

    if (!payChanged && !modeChanged) return;

    // Re-window spend and refresh vitals
    await recomputeSummaryServer(db, uid);
    await updateVitalsPoolsServer(db, uid);
  }
);

exports.guardManualTxnWindow = onDocumentWritten({
  region: 'europe-west2',
  document: 'players/{uid}/classifiedTransactions/{txId}',
}, async (event) => {
  const after = event.data?.after;
  if (!after || !after.exists) return;
  const uid = event.params.uid;
  try {
    const d = after.data() || {};
    const src = String(d.source || '').toLowerCase();
    if (src !== 'manual') return; // only manual entries
    const now = Date.now();
    const anchorMs = await getAnchorMsServer(db, uid);
    let dateMs = Number(d.dateMs || now);
    const clamped = Math.max(anchorMs, Math.min(dateMs, now));
    if (clamped !== dateMs) {
      await after.ref.set({ dateMs: clamped, meta: { ...(d.meta||{}), systemDateClamped: true } }, { merge: true });
    }
  } catch (e) {
    console.warn('guardManualTxnWindow error:', e?.message);
  }
});

// -----------------------------------------------------------------------------
// Reset pay cycle with choice to delete txns
//   GET .../maintenanceResetPayCycle?uid=...&payDateMs=...&delete=all|before_anchor|none
// -----------------------------------------------------------------------------
exports.maintenanceResetPayCycle = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const uid = String(req.query.uid || '').trim();
      const payDateMs = Number(req.query.payDateMs || 0);
      const del = String(req.query.delete || 'before_anchor').toLowerCase();
      if (!uid || !payDateMs) return res.status(400).json({ error: 'missing_params' });

      const now = Date.now();

      // 1) set pay date + anchor (now)
      await db.doc(`players/${uid}`).set({
        incomeMeta: {
          lastPayDateMs: payDateMs,
          lastPaySavedAtMs: now,
        }
      }, { merge: true });

      // 2) optional deletion
      const col = db.collection(`players/${uid}/classifiedTransactions`);
      if (del === 'all' || del === 'before_anchor') {
        const snap = await col.get();
        const batch = db.batch();
        snap.forEach(doc => {
          if (doc.id === 'summary') return;
          const d = doc.data() || {};
          if (del === 'all' || Number(d.dateMs || 0) < now) {
            batch.delete(doc.ref);
          }
        });
        await batch.commit();
      }

      // 3) recompute usage + vitals (flatten will be (re)built automatically in true mode)
      await recomputeSummaryServer(db, uid);
      const payload = await updateVitalsPoolsServer(db, uid);
      res.status(200).json({ ok: true, mode: payload?.mode || null, updatedAt: payload?.lastSync || null });
    } catch (e) {
      console.error('maintenanceResetPayCycle error:', e?.message);
      res.status(500).json({ error: 'reset_failed', details: e?.message });
    }
  });
});



// Auto-heal on ANY impactful change to classified txns
exports.onClassifiedTxnAutoHeal = onDocumentWritten(
  { region: 'europe-west2', document: 'players/{uid}/classifiedTransactions/{txId}' },
  async (event) => {
    const uid  = event.params.uid;
    const txId = event.params.txId;

    // Ignore the aggregated doc
    if (isSummaryDoc(txId)) return;

    const before = event.data?.before?.data() || null;
    const after  = event.data?.after?.data()  || null;

    // Fast exits:
    //  - Purely non-existent both sides (shouldn't happen) → ignore
    if (!before && !after) return;

    //  - Nothing that affects summary changed → ignore
    if (before && after && !differs(after, before)) return;

    //  - Only pending→pending edits that don't affect summary → ignore
    const wasConfirmed = String(before?.status || '').toLowerCase() === 'confirmed';
    const isConfirmed  = String(after?.status  || '').toLowerCase() === 'confirmed';

    // If neither side is confirmed and fields aren't relevant, we've already returned above.

    // From here on, we know the write *can* affect summary totals,
    // either because status flipped or relevant fields changed.
    try {
      await recomputeSummaryServer(db, uid);
      await updateVitalsPoolsServer(db, uid);
    } catch (e) {
      console.error('onClassifiedTxnAutoHeal error:', e?.message || e);
      // Don't rethrow; we don't want retries to storm recompute.
    }
  }
);

exports.onConfirmedTxnDeleted = onDocumentDeleted(
  { region: 'europe-west2', document: 'players/{uid}/classifiedTransactions/{txId}' },
  async (event) => {
    const uid  = event.params.uid;
    const txId = event.params.txId;
    if (isSummaryDoc(txId)) return;

    const old = event.data?.oldValue?.fields;
    const wasConfirmed = String(old?.status?.stringValue || '').toLowerCase() === 'confirmed';
    if (!wasConfirmed) return;

    try {
      await recomputeSummaryServer(db, uid);
      await updateVitalsPoolsServer(db, uid);
    } catch (e) {
      console.error('onConfirmedTxnDeleted error:', e?.message || e);
    }
  }
);

exports.vitals_getSnapshot = onCall({ region: 'europe-west2' }, async (req) => {
  if (!req.auth?.uid) throw new Error('unauthenticated');
  const uid = req.auth.uid;
  const payload = await updateVitalsPoolsServer(db, uid);
  return payload || {};
});

exports.vitals_lockPending = onCall({ region: 'europe-west2' }, async (req) => {
  if (!req.auth?.uid) throw new Error('unauthenticated');
  const uid = req.auth.uid;
  const queueCap = Number(req.data?.queueCap || 50);

  const col = db.collection(`players/${uid}/classifiedTransactions`);
  const now = Date.now();

  // STREAM-AWARE: read current mode first and pick the active stream
  const curSnap = await db.doc(`players/${uid}/cashflowData/current`).get();
  if (!curSnap.exists) return { locked: 0 };
  const cur = curSnap.data() || {};
  const mode = String(cur.mode || 'standard').toLowerCase();
  const desiredSource = (mode === 'true') ? 'truelayer' : 'manual';

  // Only consider pending from the selected stream
  const dueSnap = await col
    .where("status","==","pending")
    .where("source","==", desiredSource)
    .where("ghostExpiryMs","<=", now)
    .get();

  const pendAsc = await col
    .where("status","==","pending")
    .where("source","==", desiredSource)
    .orderBy("addedMs","asc")
    .get();

  const overflow = Math.max(0, pendAsc.size - queueCap);
  const toConfirm = [];
  dueSnap.forEach(d => toConfirm.push(d));
  if (overflow > 0) {
    let i = 0; pendAsc.forEach(d => { if (i++ < overflow) toConfirm.push(d); });
  }
  if (!toConfirm.length) return { locked: 0 };

  // Availability based on current pools + mode
  const pools = cur.pools || {};
  const seedOffset = cur.seedOffset || cur.seedCarry || {}; // legacy fallback
  const days = Number(cur.elapsedDays || (await elapsedDaysFromCalcStartServer(db, uid)));
  const carryFor = (pool) => (mode === 'true' ? 0 : Number(seedOffset[pool] || 0));

  const availTruth = {
    health:  Math.max(0, (pools.health?.regenCurrent  || 0) * days - ((pools.health?.spentToDate  || 0) + carryFor('health'))),
    mana:    Math.max(0, (pools.mana?.regenCurrent    || 0) * days - ((pools.mana?.spentToDate    || 0) + carryFor('mana'))),
    stamina: Math.max(0, (pools.stamina?.regenCurrent || 0) * days - ((pools.stamina?.spentToDate || 0) + carryFor('stamina'))),
    essence: Math.max(0, (pools.essence?.regenCurrent || 0) * days - ((pools.essence?.spentToDate || 0) + carryFor('essence'))),
  };

  const batch = db.batch();
  let locked = 0;
  let appliedTotals = { health:0, mana:0, stamina:0, essence:0 };

  // Order by oldest added first for fairness
  toConfirm.sort((a,b)=> (a.data()?.addedMs||0) - (b.data()?.addedMs||0));

  for (const d of toConfirm) {
    const tx = d.data() || {};
    const reason = (tx.ghostExpiryMs <= now) ? 'expiry' : 'queue_cap';
    const chosen = (tx?.provisionalTag?.pool || tx?.suggestedPool || 'stamina');

    if (Number(tx.amount || 0) >= 0) {
      // Heuristic: prefer explicit flags if present; fall back to desc regex
      const desc = String(tx?.transactionData?.description || '');
      const isTransfer =
        !!tx.isTransferCandidate ||
        tx.sourceSubtype === 'transfer' ||
        /transfer|to .*account|from .*account/i.test(desc);

      const update = {
        status: "confirmed",
        tag: { pool: chosen, setAtMs: now },
        autoLockReason: reason,
        lockedAtMs: now
      };

      if (isTransfer) {
        // Offset the spend: apply a negative allocation equal to the income
        const offset = Math.abs(Number(tx.amount || 0));
        const neg = { health:0, mana:0, stamina:0, essence:0 };
        neg[chosen] = -offset;
        update.appliedAllocation = roundPools(neg);

        // Optional: include in the client-side smoothing totals so HUD updates instantly
        appliedTotals = sumPools(appliedTotals, roundPools(neg));
      }

      batch.update(d.ref, update);
      locked++;
      continue;
    }


    const spend = Math.abs(Number(tx.amount || 0));
    const split = allocateSpendAcrossPoolsServer(spend, chosen, availTruth);
    appliedTotals = sumPools(appliedTotals, split);

    batch.update(d.ref, {
      status: "confirmed",
      tag: { pool: chosen, setAtMs: now },
      autoLockReason: reason,
      lockedAtMs: now,
      appliedAllocation: roundPools(split),
    });
    locked++;
  }

  await batch.commit();
  await recomputeSummaryServer(db, uid);
  await updateVitalsPoolsServer(db, uid);

  return { locked, appliedTotals: roundPools(appliedTotals) };
});


exports.vitals_getEssenceAvailableMonthly = onCall({ region: 'europe-west2' }, async (req) => {
  if (!req.auth?.uid) throw new Error('unauthenticated');
  const uid = req.auth.uid;
  const available = await readAvailableEssenceMonthly(db, uid);
  return { available };
});

async function readAvailableEssenceMonthly(db, uid) {
  try {
    const curSnap = await db.doc(`players/${uid}/cashflowData/current`).get();
    const cur   = curSnap.exists ? (curSnap.data() || {}) : {};
    const pools = cur.pools || {};
    const ePool = pools.essence || {};

    const regenBaseline = Number(ePool.regenBaseline || 0);
    const regenCurrent  = Number(ePool.regenCurrent  || regenBaseline);
    const spentToDate   = Number(ePool.spentToDate   || 0);
    const seedOffset = Number((cur.seedOffset || cur.seedCarry || {}).essence || 0);
    // const capMonthly    = regenBaseline * 30.44;

    // Total available Essence (can exceed one cycle):
    const days  = await elapsedDaysFromCalcStartServer(db, uid);
    const T = Math.max(0, (regenCurrent * days) - (spentToDate + seedOffset));
    return T;
  } catch (e) {
    console.error('readAvailableEssenceMonthly error:', e);
    return 0;
  }
}

/**
 * sendFriendRequest
 * Input: { target: string }  // v1: alias only
 * Writes: players/{toUid}/friendRequests/{fromUid__toUid}
 */
exports.sendFriendRequest = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();

  try {
    // ---- Auth guard
    const auth = req.auth;
    if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to add friends.');

    const fromUid = auth.uid;
    const raw = String(req.data?.target || '').trim();
    if (!raw) throw new HttpsError('invalid-argument', 'Missing target alias or code.');

    // ---- v1: alias only (normalise to lowercase)
    const aliasLower = raw.toLowerCase();

    const handleSnap = await db.collection('handles').doc(aliasLower).get();
    if (!handleSnap.exists) throw new HttpsError('not-found', 'No player with that alias.');

    const toUid = String(handleSnap.get('uid') || '');
    if (!toUid) throw new HttpsError('data-loss', 'Handle entry is malformed.');
    if (toUid === fromUid) throw new HttpsError('failed-precondition', 'You cannot friend yourself.');

    // ---- Blocks in either direction
    const [blockA, blockB] = await Promise.all([
      db.doc(`players/${fromUid}/blocks/${toUid}`).get(),
      db.doc(`players/${toUid}/blocks/${fromUid}`).get(),
    ]);
    if (blockA.exists || blockB.exists) throw new HttpsError('permission-denied', 'Friendship blocked.');

    // ---- Already friends?
    const friendEdge = await db.doc(`players/${fromUid}/friends/${toUid}`).get();
    if (friendEdge.exists) throw new HttpsError('already-exists', 'You are already friends.');

    // ---- Idempotent request id
    const reqId = `${fromUid}__${toUid}`;
    const pendingRef = db.doc(`players/${toUid}/friendRequests/${reqId}`);
    const pendingSnap = await pendingRef.get();
    const sentRef = db.doc(`players/${fromUid}/requestsSent/${reqId}`);
    if (pendingSnap.exists) {
      const now = Date.now();
      await sentRef.set({
        toUid,
        createdMs: now,
        status: 'pending',
        via: 'alias',
        target: aliasLower,
      }, { merge: true });
      return { requestId: reqId, toUid, status: 'pending' };
    }

    // When creating the pending request, also create the mirror
    const now = Date.now();
    await Promise.all([
      pendingRef.set({
        fromUid,
        createdMs: now,
        status: 'pending',
        via: 'alias',
        target: aliasLower,
      }),
      sentRef.set({
        toUid,
        createdMs: now,
        status: 'pending',
        via: 'alias',
        target: aliasLower,
      })
    ]);

    return { requestId: reqId, toUid, status: 'pending' };
  } catch (err) {
    console.error('sendFriendRequest failed', { message: err?.message, code: err?.code, stack: err?.stack });
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Unexpected error.');
  }
});

// Input: { requestId: "<fromUid>__<toUid>" }  (caller must be fromUid)
exports.cancelFriendRequest = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const requestId = String(req.data?.requestId || '').trim();

  const [fromUid, toUid] = requestId.split('__');
  if (!fromUid || !toUid) throw new HttpsError('invalid-argument', 'Bad requestId.');
  if (fromUid !== auth.uid) throw new HttpsError('permission-denied', 'Not your request.');

  const pendingRef = db.doc(`players/${toUid}/friendRequests/${requestId}`);
  const sentRef    = db.doc(`players/${fromUid}/requestsSent/${requestId}`);

  await Promise.allSettled([ pendingRef.delete(), sentRef.delete() ]);
  return { ok: true, status: 'cancelled' };
});



// Accept/decline a friend request.
// Input: { requestId: string, accept: boolean }
// - requestId format: "<fromUid>__<toUid>"
// Behavior:
//  - Auth user must be the "toUid"
//  - If accept: create friend edges both ways, then delete request
//  - If decline: just delete request
//  - Idempotent: if edges already exist, returns accepted
exports.respondToFriendRequest = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();

  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const requestId = String(req.data?.requestId || '').trim();
  const accept    = !!req.data?.accept;

  const parts = requestId.split('__');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new HttpsError('invalid-argument', 'Bad requestId.');
  }
  const fromUid = parts[0];
  const toUid   = parts[1];

  if (toUid !== auth.uid) {
    throw new HttpsError('permission-denied', 'You cannot action requests not addressed to you.');
  }

  const reqRef          = db.doc(`players/${toUid}/friendRequests/${requestId}`);
  const inverseReqRef   = db.doc(`players/${fromUid}/friendRequests/${toUid}__${fromUid}`); // <— PATCH
  const sentFromRef     = db.doc(`players/${fromUid}/requestsSent/${fromUid}__${toUid}`);   // <— PATCH
  const sentToRef       = db.doc(`players/${toUid}/requestsSent/${toUid}__${fromUid}`);     // <— PATCH

  const [reqSnap, blockA, blockB] = await Promise.all([
    reqRef.get(),
    db.doc(`players/${fromUid}/blocks/${toUid}`).get(),
    db.doc(`players/${toUid}/blocks/${fromUid}`).get(),
  ]);

  if (!reqSnap.exists) {
    // maybe already handled; check if already friends
    const alreadyA = await db.doc(`players/${toUid}/friends/${fromUid}`).get();

    // PATCH: if it’s already accepted, clean up any leftover mirrors/inverse quietly
    if (alreadyA.exists) {
      await Promise.allSettled([
        inverseReqRef.delete(),
        sentFromRef.delete(),
        sentToRef.delete(),
      ]);
    }
    return { requestId, status: alreadyA.exists ? 'accepted' : 'absent' };
  }

  if (blockA.exists || blockB.exists) {
    await Promise.allSettled([ reqRef.delete(), inverseReqRef.delete(), sentFromRef.delete(), sentToRef.delete() ]);
    throw new HttpsError('permission-denied', 'Friendship blocked.');
  }

  if (!accept) {
    await Promise.allSettled([ reqRef.delete(), sentFromRef.delete() ]); // <— also remove sender's mirror
    return { requestId, status: 'declined' };
  }

  // Accept: write both edges + delete request (and clean inverse + mirrors) atomically
  const now = Date.now();
  const friendARef = db.doc(`players/${toUid}/friends/${fromUid}`);
  const friendBRef = db.doc(`players/${fromUid}/friends/${toUid}`);

  await db.runTransaction(async (trx) => {
    const [a, b] = await Promise.all([trx.get(friendARef), trx.get(friendBRef)]);
    if (!a.exists) trx.set(friendARef, { createdMs: now });
    if (!b.exists) trx.set(friendBRef, { createdMs: now });

    // PATCH: clear current request, inverse request, and both sent mirrors
    trx.delete(reqRef);
    trx.delete(inverseReqRef);
    trx.delete(sentFromRef);
    trx.delete(sentToRef);
  });

  return { requestId, status: 'accepted' };
});


exports.setFriendTrust = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const me = auth.uid;
  const friendUid = String(req.data?.friendUid || '').trim();
  const trusted   = !!req.data?.trusted;
  if (!friendUid) throw new HttpsError('invalid-argument', 'Missing friendUid.');
  if (friendUid === me) throw new HttpsError('failed-precondition', 'Not applicable.');

  // ensure they are friends (idempotent check)
  const edgeRef = db.doc(`players/${me}/friends/${friendUid}`);
  const edgeSnap = await edgeRef.get();
  if (!edgeSnap.exists) throw new HttpsError('failed-precondition', 'Not friends.');

  await edgeRef.set({ trusted, updatedMs: Date.now() }, { merge: true });

  return { ok:true, trusted };
});


exports.removeFriend = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const me = auth.uid;
  const other = String(req.data?.uid || '').trim();
  if (!other) throw new HttpsError('invalid-argument', 'Missing uid.');
  if (other === me) throw new HttpsError('failed-precondition', 'Cannot unfriend yourself.');

  const aRef = db.doc(`players/${me}/friends/${other}`);
  const bRef = db.doc(`players/${other}/friends/${me}`);

  const reqAToB = db.doc(`players/${other}/friendRequests/${me}__${other}`);
  const reqBToA = db.doc(`players/${me}/friendRequests/${other}__${me}`);

  // (Optional) you could also create a "blocks" entry here if you want "Remove & Block".
  let existed = false;

  await db.runTransaction(async (trx) => {
    const [aSnap, bSnap] = await Promise.all([trx.get(aRef), trx.get(bRef)]);
    existed = aSnap.exists || bSnap.exists;

    // delete both edges (idempotent)
    trx.delete(aRef);
    trx.delete(bRef);

    // clean any pending requests in either direction
    trx.delete(reqAToB);
    trx.delete(reqBToA);
  });

  return { ok: true, status: existed ? 'removed' : 'not-friends' };
});

// Invite to MyFi
//


function makeInviteCode(uid) {
  // Short deterministic-ish seed + random chunk. Adjust length if you prefer.
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${uid.slice(0,3)}-${rand}`.replace(/[^A-Z0-9-]/g, ''); // e.g., "abc-1F7K3L"
}

// keep trailing slash; safer for URL resolving
function normDir(u=''){ const s=String(u||''); return s.endsWith('/') ? s : (s + '/'); 

}

function pickInviteBase(req) {
    // 1) Hints from callable payload (best for local path)
  const hint = req?.data?.baseHint || req?.data?.refererHint;
  if (hint) {
    try {
      const u = new URL(String(hint));
      // keep the directory the hint page lives in
      const dir = u.pathname.endsWith('/') ? u.pathname : u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
      if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
        return normDir(`${u.protocol}//${u.host}${dir}`); // e.g. http://127.0.0.1:5500/Project%20MyFi/
      }
      // If not local, we still allow a path-aware hint (useful in staging)
      return normDir(`${u.protocol}//${u.host}${dir}`);
    } catch {}
  }

  const raw = req?.rawRequest;
  const hdr = raw?.headers || {};
  const referer = (hdr.referer || '').toString();
  const origin  = (hdr.origin  || '').toString();

  // Local: prefer referer (has the path), e.g. /Project%20MyFi/start.html -> /Project%20MyFi/
  if (referer) {
    try {
      const u = new URL(referer);
      if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
        const dir = u.pathname.endsWith('/') ? u.pathname : u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
        return normDir(`${u.protocol}//${u.host}${dir}`);
      };
    } catch {};
  };

  // If no referer but we’re local, default to /Project%20MyFi/
  if (origin) {
    try {
      const u = new URL(origin);
      if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
        return normDir(`${u.protocol}//${u.host}/Project%20MyFi/`);
      }
    } catch {};
  };

  // Prod/staging: unchanged — use ENV override first, else fallback constant
  const envBase = (process.env.INVITE_BASE_URL || '').toString().replace(/\/+$/, '');
  if (envBase) return normDir(envBase);
  return normDir(PROD_BASE_FALLBACK.replace(/\/+$/, ''));
};



function isLocalBase(baseStr) {
  try { const u = new URL(baseStr); return /^(localhost|127\.0\.0\.1)$/i.test(u.hostname); }
  catch { return false; }
}

exports.ensureInviteCode = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const playerRef = db.doc(`players/${uid}`);
  const snap = await playerRef.get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Player profile missing.');

  const base = pickInviteBase(req);
  const local = isLocalBase(base);

  let { inviteCode, inviteUrl } = snap.data() || {};
  if (!inviteCode) {
    // allocate code (unchanged) …
    for (let i=0; i<5; i++) {
      const code = makeInviteCode(uid);
      const invRef = db.doc(`invites/${code}`);
      if ((await invRef.get()).exists) continue;

      const url = new URL(`start.html?invite=${encodeURIComponent(code)}`, base).href;
      const now = Date.now();

      await db.runTransaction(async (trx) => {
        trx.set(invRef, { ownerUid: uid, createdMs: now, uses: 0, lastUseMs: null, status: 'active' });
        // Only persist inviteUrl if NOT local
        const updates = local ? { inviteCode: code } : { inviteCode: code, inviteUrl: url };
        trx.update(playerRef, updates);
      });

      return { inviteCode: code, inviteUrl: url };
    }
    throw new HttpsError('resource-exhausted', 'Could not allocate invite code. Try again.');
  }

  // Already has a code → compute a fresh URL for the current environment
  const desired = new URL(`start.html?invite=${encodeURIComponent(inviteCode)}`, base).href;
  if (!local && inviteUrl !== desired) {
    // Only write to Firestore in non-local envs
    await playerRef.update({ inviteUrl: desired }).catch(()=>{});
    return { inviteCode, inviteUrl: desired };
  }
  // Local: return computed URL without writing
  return { inviteCode, inviteUrl: local ? desired : (inviteUrl || desired) };
});



exports.inviteRedirect = onRequest({ region: 'europe-west2' }, async (req, res) => {
  try {
    const code = String(req.path.replace(/^\//, '') || req.query.code || '').trim();
    if (!code) { res.status(400).send('Missing code'); return; }

    const db = admin.firestore();
    const invRef = db.doc(`invites/${code}`);
    const invSnap = await invRef.get();
    if (!invSnap.exists) { res.status(404).send('Invalid invite'); return; }

    invRef.update({
      uses: admin.firestore.FieldValue.increment(1),
      lastUseMs: Date.now(),
    }).catch(()=>{});

    const base = pickInviteBase({ rawRequest: req });
    const landing = new URL(`start.html?invite=${encodeURIComponent(code)}`, base).href;

    res.redirect(302, landing);
  } catch (e) {
    console.error('inviteRedirect error', e);
    res.status(500).send('Error');
  }
});



/**
 * captureInviteOnSignup
 * Input: { inviteCode: string }
 * Behavior:
 *  - new user (auth.uid) claims an invite code (once)
 *  - looks up invites/{code} -> ownerUid
 *  - prevents self-referral, prevents double-claim
 *  - writes:
 *      players/{uid}: { referredBy, inviteCodeUsed, referredAtMs }
 *      players/{ownerUid}/referrals/{uid}: { inviteCode, createdMs, milestones:{} , status:'pending' }
 *      invites/{code}: { signups: ++ }
 */
exports.captureInviteOnSignup = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();

  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const inviteCode = String(req.data?.inviteCode || '').trim();
  if (!inviteCode) throw new HttpsError('invalid-argument', 'Missing invite code.');

  const playerRef = db.doc(`players/${uid}`);
  const inviteRef = db.doc(`invites/${inviteCode}`);

  const [playerSnap, inviteSnap] = await Promise.all([playerRef.get(), inviteRef.get()]);
  if (!playerSnap.exists) throw new HttpsError('failed-precondition', 'Player profile missing.');
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invalid invite code.');

  const ownerUid = String(inviteSnap.get('ownerUid') || '');
  if (!ownerUid) throw new HttpsError('data-loss', 'Invite doc malformed.');
  if (ownerUid === uid) throw new HttpsError('failed-precondition', 'Self-referral is not allowed.');

  const already = playerSnap.get('referredBy') || playerSnap.get('inviteCodeUsed');
  if (already) {
    // Idempotent success: if already tied to the same code/owner, return ok.
    const same = (playerSnap.get('inviteCodeUsed') === inviteCode);
    return { ok: true, status: same ? 'already-captured' : 'already-referred' };
  }

  const now = Date.now();
  const refDoc = db.doc(`players/${ownerUid}/referrals/${uid}`);

  await db.runTransaction(async (trx) => {
    const refSnap = await trx.get(refDoc);
    // Basic write-once protection
    if (refSnap.exists) {
      // If it already exists, we still set the player fields if missing (idempotent).
      trx.update(playerRef, {
        referredBy: ownerUid,
        inviteCodeUsed: inviteCode,
        referredAtMs: now,
      });
      // Ensure invite counter is consistent (best-effort in outer update)
      return;
    }

    trx.update(playerRef, {
      referredBy: ownerUid,
      inviteCodeUsed: inviteCode,
      referredAtMs: now,
    });

    trx.set(refDoc, {
      referredUid: uid,
      inviteCode: inviteCode,
      createdMs: now,
      status: 'pending',           // pending -> qualified -> rewarded
      milestones: {
        signupMs: now,             // first milestone
        manualLegitMs: null,       // fill when manual user passes legitimacy checks
        bankLinkedMs: null,        // fill when bank is linked
      }
    }, { merge: false });
  });

  // Aggregate counters on invites/{code} (best-effort, outside the trx)
  await inviteRef.update({
    signups: admin.firestore.FieldValue.increment(1),
    lastUseMs: now
  }).catch(() => {});

  return { ok: true, status: 'captured', ownerUid };
});

/**
 * markReferralMilestone
 * Input: { referredUid?: string, milestone: 'manualLegit'|'bankLinked', whenMs?: number }
 * Caller must be the inviter (owner) OR the referred user, depending on your policy.
 * Simplest: allow referred user to mark their own milestones; also let backend jobs call via Admin SDK.
 */
exports.markReferralMilestone = onCall({ region: 'europe-west2' }, async (req) => {
  const db = admin.firestore();
  const callerUid = req.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const milestone = String(req.data?.milestone || '');
  const whenMs = Number.isFinite(req.data?.whenMs) ? Number(req.data.whenMs) : Date.now();
  const referredUid = String(req.data?.referredUid || callerUid); // default: caller is the referred user

  const referredPlayerRef = db.doc(`players/${referredUid}`);
  const referredSnap = await referredPlayerRef.get();
  if (!referredSnap.exists) throw new HttpsError('not-found', 'Referred player not found.');

  const ownerUid = referredSnap.get('referredBy');
  const codeUsed = referredSnap.get('inviteCodeUsed');
  if (!ownerUid || !codeUsed) {
    throw new HttpsError('failed-precondition', 'This account is not associated with a referral.');
  }

  // Only allow: the referred user themselves OR the owner (inviter)
  if (callerUid !== referredUid && callerUid !== ownerUid) {
    throw new HttpsError('permission-denied', 'Not allowed to update this referral.');
  }

  const refDoc = db.doc(`players/${ownerUid}/referrals/${referredUid}`);

  const updates = {};
  if (milestone === 'manualLegit') updates['milestones.manualLegitMs'] = whenMs;
  else if (milestone === 'bankLinked') updates['milestones.bankLinkedMs'] = whenMs;
  else throw new HttpsError('invalid-argument', 'Unknown milestone.');

  // Optionally auto-qualify when conditions met
  // Example policy: qualify when (manualLegit OR bankLinked) within 30 days of signup
  updates['status'] = 'qualified';

  await refDoc.set(updates, { merge: true });
  return { ok: true, updated: Object.keys(updates) };
});


function norm(v='') { return String(v||'').trim(); }

function readBool(x) {
  if (typeof x === 'boolean') return x;
  const s = String(x||'').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}



// Prefer localhost when the caller is local, otherwise env/prod
function pickInviteBaseForMaintenance(req, qBaseOverride) {
  if (qBaseOverride) return normDir(qBaseOverride);

  const hdr = req.headers || {};
  const referer = (hdr.referer || '').toString();
  const origin  = (hdr.origin  || '').toString();

  // 1) Prefer referer (has path) when local, e.g. /Project%20MyFi/start.html
  if (referer) {
    try {
      const u = new URL(referer);
      if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
        const dir = u.pathname.endsWith('/')
          ? u.pathname
          : u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
        return normDir(`${u.protocol}//${u.host}${dir}`);
      }
    } catch {}
  }

  // 2) Fallback: origin only (no path). Hard-code local folder.
  if (origin) {
    try {
      const u = new URL(origin);
      if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
        return normDir(`${u.protocol}//${u.host}/Project%20MyFi/`);
      }
    } catch {}
  }

  // 3) Prod: ENV override, else fallback constant
  const envBase = (process.env.INVITE_BASE_URL || '').toString().replace(/\/+$/, '');
  if (envBase) return normDir(envBase);

  return normDir(PROD_BASE_FALLBACK.replace(/\/+$/, ''));
}



// ---------- 1) Backfill: create invite codes/urls for players missing them ----------
/**
 * HTTP GET/POST
 * Params:
 *   secret       : string   (required)
 *   pageSize     : number   (default 400)
 *   startAfterUid: string   (optional; for pagination)
 *   dryRun       : 0|1      (default 0)
 *   base         : string   (optional; override base e.g. https://…/Project%20MyFi/)
 *   refreshUrl   : 0|1      (default 0; if 1, keep code but refresh inviteUrl to current base)
 *
 * NOTE: When base resolves to localhost/127.0.0.1, we do NOT persist inviteUrl;
 *       we still create codes and return the computed URL for your UI, but
 *       we only write inviteUrl in non-local environments (prod/staging).
 */
exports.backfillInvitesForPlayersHttp = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
  try {
    const method = req.method.toUpperCase();
    const q = method === 'GET' ? req.query : (req.body || {});
    const SECRET = process.env.BACKFILL_SECRET || '';
    if (norm(q.secret) !== SECRET) return res.status(403).json({ ok:false, error:'Forbidden' });

    const db = admin.firestore();
    const pageSize = Math.max(1, Math.min(1000, Number(q.pageSize || 400)));
    const startAfterUid = norm(q.startAfterUid);
    const dryRun = readBool(q.dryRun);
    const refreshUrl = readBool(q.refreshUrl);

    // Pick base as before (path-aware) then decide local/prod behavior
    const base = pickInviteBaseForMaintenance(req, norm(q.base));
    const local = isLocalBase(base);

    let qRef = db.collection('players').orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (startAfterUid) qRef = qRef.startAfter(startAfterUid);

    const snap = await qRef.get();
    if (snap.empty) return res.json({ ok:true, done:true, created:0, refreshed:0, refreshedNoWrite:0, skipped:0, base, local });

    let created = 0, refreshed = 0, refreshedNoWrite = 0, skipped = 0, lastUid = null;

    // Read existing invite codes to avoid rare collisions
    const existSnap = await db.collection('invites').select().get();
    const existingCodes = new Set(existSnap.docs.map(d => d.id));

    const batch = db.batch();
    const now = Date.now();

    for (const doc of snap.docs) {
      lastUid = doc.id;
      const d = doc.data() || {};
      const hasCode = !!d.inviteCode;
      const hasUrl  = !!d.inviteUrl;

      if (!hasCode) {
        // Generate a unique code
        let code; let tries = 0;
        do { code = makeInviteCode(doc.id); tries++; } while (existingCodes.has(code) && tries < 7);
        if (existingCodes.has(code)) { skipped++; continue; }
        existingCodes.add(code);

        const url = new URL(`start.html?invite=${encodeURIComponent(code)}`, base).href;

        if (!dryRun) {
          // Create invites/{code}
          batch.set(db.doc(`invites/${code}`), {
            ownerUid: doc.id, createdMs: now, uses: 0, lastUseMs: null, status: 'active'
          });

          // Always persist inviteCode; only persist inviteUrl when NOT local
          const updates = local
            ? { inviteCode: code }
            : { inviteCode: code, inviteUrl: url };

          batch.update(doc.ref, updates);
        }

        created++;
        continue;
      }

      // Already has a code — maybe refresh URL
      const desired = new URL(`start.html?invite=${encodeURIComponent(d.inviteCode)}`, base).href;

      if ((refreshUrl && d.inviteUrl !== desired) || (!hasUrl)) {
        if (!dryRun) {
          if (!local) {
            batch.update(doc.ref, { inviteUrl: desired });
            refreshed++;
          } else {
            // Local run: we don’t write inviteUrl to Firestore, but count the would-be refresh
            refreshedNoWrite++;
          }
        } else {
          // Dry run — just count as refreshed (or not) without writing
          if (!local) refreshed++; else refreshedNoWrite++;
        }
      } else {
        skipped++;
      }
    }

    if (!dryRun) await batch.commit();

    const nextStartAfterUid = (snap.size === pageSize) ? lastUid : null;
    res.json({
      ok: true,
      base,
      local,                    // helpful in the UI to see which mode was used
      created,
      refreshed,
      refreshedNoWrite,         // how many refreshes were skipped because local
      skipped,
      page: snap.size,
      nextStartAfterUid
    });
  } catch (e) {
    console.error('backfillInvitesForPlayersHttp', e);
    res.status(500).json({ ok:false, error: e.message || String(e) });
  }
})
});


// ---------- 2) Reset/Clear: targeted or global invite maintenance ----------
/**
 * HTTP GET/POST
 * Params:
 *   secret : string (required)
 *   action : 'deleteAllInvites' | 'deleteInviteByCode' | 'clearOwnerInvite' | 'purgeOwnerReferrals'
 *   code   : string (when action == deleteInviteByCode)
 *   ownerUid: string (when action == clearOwnerInvite | purgeOwnerReferrals)
 *   pageSize: number (deleteAllInvites batching; default 500)
 *
 * Effects:
 *  - deleteAllInvites      : Deletes invites/* (batched). Does NOT touch players fields.
 *  - deleteInviteByCode    : Deletes invites/{code} and clears players/{owner}.inviteCode/inviteUrl if matched.
 *  - clearOwnerInvite      : For ownerUid, deletes invites/{inviteCode} and clears owner’s inviteCode/inviteUrl.
 *  - purgeOwnerReferrals   : Deletes players/{ownerUid}/referrals/* (batched).
 */

exports.resetInvitesMaintenanceHttp = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
  try {
    const method = req.method.toUpperCase();
    const q = method === 'GET' ? req.query : (req.body || {});
    const SECRET = process.env.BACKFILL_SECRET || '';
    if (norm(q.secret) !== SECRET) return res.status(403).json({ ok:false, error:'Forbidden' });

    const action = norm(q.action);
    const db = admin.firestore();

    if (action === 'deleteAllInvites') {
      const pageSize = Math.max(1, Math.min(1000, Number(q.pageSize || 500)));
      const alsoClearPlayers = String(q.alsoClearPlayers || '0') === '1';

      const snap = await db.collection('invites').limit(pageSize).get();
      if (snap.empty) return res.json({ ok:true, done:true, deleted:0 });

      const batch = db.batch();
      let clearedPlayers = 0;

      snap.docs.forEach(d => {
        batch.delete(d.ref);
        if (alsoClearPlayers) {
          const ownerUid = String(d.get('ownerUid') || '');
          if (ownerUid) {
            const ownerRef = db.doc(`players/${ownerUid}`);
            batch.update(ownerRef, {
              inviteCode: admin.firestore.FieldValue.delete(),
              inviteUrl: admin.firestore.FieldValue.delete(),
            });
            clearedPlayers++;
          }
        }
      });

      await batch.commit();
      return res.json({
        ok: true,
        deleted: snap.size,
        clearedPlayers: alsoClearPlayers ? clearedPlayers : 0,
        nextHint: 'repeat until 0 returned'
      });
    }

    if (action === 'deleteInviteByCode') {
      const code = norm(q.code);
      if (!code) return res.status(400).json({ ok:false, error:'Missing code' });

      const invRef = db.doc(`invites/${code}`);
      const invSnap = await invRef.get();
      if (!invSnap.exists) return res.json({ ok:true, deleted:false, reason:'not-found' });

      const ownerUid = invSnap.get('ownerUid');
      const batch = db.batch();
      batch.delete(invRef);

      if (ownerUid) {
        const ownerRef = db.doc(`players/${ownerUid}`);
        batch.update(ownerRef, { inviteCode: admin.firestore.FieldValue.delete(), inviteUrl: admin.firestore.FieldValue.delete() });
      }

      await batch.commit();
      return res.json({ ok:true, deleted:true, ownerUid: ownerUid || null });
    }

    if (action === 'clearOwnerInvite') {
      const ownerUid = norm(q.ownerUid);
      if (!ownerUid) return res.status(400).json({ ok:false, error:'Missing ownerUid' });

      const ownerRef = db.doc(`players/${ownerUid}`);
      const ownerSnap = await ownerRef.get();
      if (!ownerSnap.exists) return res.json({ ok:true, cleared:false, reason:'owner-not-found' });

      const inviteCode = ownerSnap.get('inviteCode') || '';
      const batch = db.batch();
      if (inviteCode) batch.delete(db.doc(`invites/${inviteCode}`));
      batch.update(ownerRef, { inviteCode: admin.firestore.FieldValue.delete(), inviteUrl: admin.firestore.FieldValue.delete() });
      await batch.commit();
      return res.json({ ok:true, cleared:true, inviteCode: inviteCode || null });
    }

    if (action === 'purgeOwnerReferrals') {
      const ownerUid = norm(q.ownerUid);
      if (!ownerUid) return res.status(400).json({ ok:false, error:'Missing ownerUid' });

      const list = await db.collection(`players/${ownerUid}/referrals`).limit(500).get();
      if (list.empty) return res.json({ ok:true, deleted:0, done:true });

      const batch = db.batch();
      list.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return res.json({ ok:true, deleted:list.size, nextHint:'repeat until 0 returned' });
    }

    if (action === 'clearStalePlayerInviteFields') {
      const pageSize = Math.max(1, Math.min(1000, Number(q.pageSize || 500)));
      const startAfterUid = String(q.startAfterUid || '').trim();

      let qRef = db.collection('players')
        .where('inviteCode', '!=', null)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(pageSize);

      if (startAfterUid) qRef = qRef.startAfter(startAfterUid);

      const snap = await qRef.get();
      if (snap.empty) return res.json({ ok:true, done:true, checked:0, cleared:0 });

      const batch = db.batch();
      let cleared = 0, lastUid = null;

      for (const doc of snap.docs) {
        lastUid = doc.id;
        const code = String(doc.get('inviteCode') || '').trim();
        if (!code) continue;
        const invSnap = await db.doc(`invites/${code}`).get();
        if (!invSnap.exists) {
          batch.update(doc.ref, {
            inviteCode: admin.firestore.FieldValue.delete(),
            inviteUrl: admin.firestore.FieldValue.delete(),
          });
          cleared++;
        }
      }

      if (cleared > 0) await batch.commit();
      const nextStartAfterUid = (snap.size === pageSize) ? lastUid : null;

      return res.json({
        ok: true,
        checked: snap.size,
        cleared,
        nextStartAfterUid
      });
  }


    return res.status(400).json({ ok:false, error:'Unknown action' });
  } catch (e) {
    console.error('resetInvitesMaintenanceHttp', e);
    res.status(500).json({ ok:false, error: e.message || String(e) });
  }
});
});

// ---------- 3) Full Player Reset (HTTP): delete player graph by uid/alias/email, or batch delete with exclusions ----------
/**
 * HTTP GET/POST
 * Params:
 *   secret        : string (required)
 *   mode          : 'byUid' | 'byAlias' | 'byEmail' | 'batchAllExcept'
 *   uid           : string (when mode = byUid)
 *   alias         : string (when mode = byAlias)    // case-insensitive; matches players.aliasLower
 *   email         : string (when mode = byEmail)
 *   excludeUids   : string (CSV when mode = batchAllExcept)
 *   pageSize      : number (batchAllExcept paging; default 400)
 *   dryRun        : 0|1 (default 0)
 *
 * Effects:
 *  - Removes:
 *      players/{uid} main doc
 *      ALL subcollections under players/{uid} (via listCollections)
 *      handles/{aliasLower} if owned by uid
 *      invites/* where ownerUid == uid
 *      players/{ownerUid}/referrals/{uid} if this user was referred by someone
 *      reciprocal entries in players//friends/{uid} (best-effort)
 * 
 * 
 */

exports.fullPlayerResetHttp = onRequest({ region: 'europe-west2' }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const method = req.method.toUpperCase();
      const q = method === 'GET' ? req.query : (req.body || {});
      const SECRET = process.env.BACKFILL_SECRET || '';
      if (norm(q.secret) !== SECRET) return res.status(403).json({ ok:false, error:'Forbidden' });

      const dryRun = String(q.dryRun || '0') === '1';
      const mode = String(q.mode || '').trim();

      const db = admin.firestore();

      async function resolveUidByAlias(aliasRaw) {
        const alias = String(aliasRaw || '').trim();
        if (!alias) return null;
        const aliasLower = alias.toLowerCase();
        // Prefer aliasLower exact match
        const s1 = await db.collection('players').where('aliasLower', '==', aliasLower).limit(1).get();
        if (!s1.empty) return s1.docs[0].id;
        // Fallback: alias exact (in case aliasLower missing)
        const s2 = await db.collection('players').where('alias', '==', alias).limit(1).get();
        return s2.empty ? null : s2.docs[0].id;
      }

      async function resolveUidByEmail(email) {
        const e = String(email || '').trim().toLowerCase();
        if (!e) return null;
        const s = await db.collection('players').where('email', '==', e).limit(1).get();
        return s.empty ? null : s.docs[0].id;
      }

      async function deleteCollection(ref, pageSize = 300) {
        // Delete a collection under a known parent (1 level deep)
        let total = 0;
        while (true) {
          const snap = await ref.limit(pageSize).get();
          if (snap.empty) break;
          const batch = db.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          total += snap.size;
          if (snap.size < pageSize) break;
        }
        return total;
      }

      async function deleteSubcollections(docRef) {
        // List all direct subcollections and delete their docs
        const subs = await docRef.listCollections();
        let count = 0;
        for (const col of subs) {
          count += await deleteCollection(col);
        }
        return count;
      }

      async function removeHandle(d, uid) {
        try {
          const aliasLower = String(d?.aliasLower || '').trim();
          if (!aliasLower) return { removed:false };
          const ref = db.doc(`handles/${aliasLower}`);
          const snap = await ref.get();
          if (snap.exists && String(snap.get('uid') || '') === uid) {
            if (!dryRun) await ref.delete();
            return { removed:true };
          }
        } catch {}
        return { removed:false };
      }

      async function removeInvites(uid) {
        // Delete invites where ownerUid == uid
        let deleted = 0;
        while (true) {
          const snap = await db.collection('invites').where('ownerUid','==',uid).limit(400).get();
          if (snap.empty) break;
          const batch = db.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          if (!dryRun) await batch.commit();
          deleted += snap.size;
          if (snap.size < 400) break;
        }
        return deleted;
      }

      async function unlinkFromInviter(d, uid) {
        // If this user was referred by someone, remove the referral doc under that inviter
        const ownerUid = String(d?.referredBy || '').trim();
        if (!ownerUid) return { removed:false };
        const ref = db.doc(`players/${ownerUid}/referrals/${uid}`);
        const snap = await ref.get();
        if (snap.exists) {
          if (!dryRun) await ref.delete();
          return { removed:true, ownerUid };
        }
        return { removed:false };
      }

      async function removeFriendEdges(uid) {
        // Best-effort: delete reciprocal friend docs if your schema uses players/{uid}/friends/{friendUid}
        let removed = 0;
        try {
          const friendsCol = db.collection(`players/${uid}/friends`);
          const snap = await friendsCol.limit(500).get();
          if (!snap.empty) {
            const batch = db.batch();
            snap.docs.forEach(d => {
              const friendUid = d.id;
              batch.delete(d.ref); // forward edge
              // reciprocal (best-effort): players/{friendUid}/friends/{uid}
              batch.delete(db.doc(`players/${friendUid}/friends/${uid}`));
            });
            if (!dryRun) await batch.commit();
            removed += snap.size;
          }
        } catch {}
        return removed;
      }

      async function deletePlayerByUid(uid) {
        const docRef = db.doc(`players/${uid}`);
        const snap = await docRef.get();
        if (!snap.exists) return { ok:true, uid, existed:false };

        const data = snap.data() || {};

        // Clean related indices / edges
        const [handleRes, invitesDeleted, inviterRes, friendsRemoved] = await Promise.all([
          removeHandle(data, uid),
          removeInvites(uid),
          unlinkFromInviter(data, uid),
          removeFriendEdges(uid),
        ]);

        // Delete subcollections then main doc
        const subDeleted = await deleteSubcollections(docRef);
        if (!dryRun) await docRef.delete();

        return {
          ok: true,
          uid,
          existed: true,
          removed: {
            subDocs: subDeleted,
            handleRemoved: handleRes.removed || false,
            invitesDeleted,
            referralUnlinked: inviterRes.removed || false,
            referralOwnerUid: inviterRes.ownerUid || null,
            friendEdgesRemoved: friendsRemoved
          }
        };
      }

      // ---- Modes
      if (mode === 'byUid') {
        const uid = String(q.uid || '').trim();
        if (!uid) return res.status(400).json({ ok:false, error:'Missing uid' });
        const result = await deletePlayerByUid(uid);
        return res.json({ dryRun, ...result });
      }

      if (mode === 'byAlias') {
        const alias = String(q.alias || '').trim();
        if (!alias) return res.status(400).json({ ok:false, error:'Missing alias' });
        const uid = await resolveUidByAlias(alias);
        if (!uid) return res.json({ ok:true, dryRun, found:false, reason:'alias_not_found' });
        const result = await deletePlayerByUid(uid);
        return res.json({ dryRun, resolvedUid: uid, ...result });
      }

      if (mode === 'byEmail') {
        const email = String(q.email || '').trim();
        if (!email) return res.status(400).json({ ok:false, error:'Missing email' });
        const uid = await resolveUidByEmail(email);
        if (!uid) return res.json({ ok:true, dryRun, found:false, reason:'email_not_found' });
        const result = await deletePlayerByUid(uid);
        return res.json({ dryRun, resolvedUid: uid, ...result });
      }

      if (mode === 'batchAllExcept') {
        const pageSize = Math.max(1, Math.min(1000, Number(q.pageSize || 400)));
        const exclude = new Set(String(q.excludeUids || '').split(',').map(s=>s.trim()).filter(Boolean));
        const snap = await db.collection('players').orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize).get();
        if (snap.empty) return res.json({ ok:true, dryRun, deleted:0, page:0, done:true });

        let deleted = 0, skipped = 0, results = [];
        for (const doc of snap.docs) {
          const uid = doc.id;
          if (exclude.has(uid)) { skipped++; continue; }
          const r = await deletePlayerByUid(uid);
          results.push({ uid, existed: r.existed });
          if (r.existed) deleted++;
        }
        return res.json({ ok:true, dryRun, deleted, skipped, page: snap.size, details: results });
      }

      return res.status(400).json({ ok:false, error:'Unknown mode' });
    } catch (e) {
      console.error('fullPlayerResetHttp', e);
      res.status(500).json({ ok:false, error: e.message || String(e) });
    }
  });
});

/**
 * ====================================================================
 *  Quests
 * ====================================================================
 */

const { QUESTS_CFG, COMMUNITY_PAYOUT_MODES } = require("./questsConfig.js");

/* =========================
 * CONFIG
 * ========================= */
const CFG = QUESTS_CFG;
//const COMMUNITY_PAYOUT_MODES = COMMUNITY_PAYOUT_MODES;

/* =========================
 * PREDICATE REGISTRY
 * (Extend freely; keep pure & testable)
 * ========================= */
const predicates = {
  // Example: ensure user finished avatar formation
  hasAvatarFormed: async ({ uid }) => {
    const snap = await db.doc(`players/${uid}`).get();
    return !!snap.exists && !!(snap.data()?.avatar?.formedAt);
  },
  // TrueLayer linked (TODO: wire your own linkage check)
  hasTrueLayer: async ({ uid }) => {
    const tl = await db.doc(`players/${uid}/integrations/tl`).get();
    const active = tl.exists && tl.data()?.status === "active";
    return !!active;
  },
  notCompletedQuest: async ({ uid }, { questId }) => {
    const q = await db.doc(`players/${uid}/quests/${questId}`).get();
    return !(q.exists && q.data()?.completed);
  },
  featureFlagOn: async ({ uid }, { flag }) => {
    const u = await db.doc(`players/${uid}`).get();
    return (u.data()?.flags || []).includes(flag);
  },
  minLevel: async ({ uid }, { min }) => {
    const u = await db.doc(`players/${uid}`).get();
    return (u.data()?.level || 0) >= (min || 0);
  },
  // Country predicate (if you store country)
  countryIs: async ({ uid }, { country }) => {
    const u = await db.doc(`players/${uid}`).get();
    return (u.data()?.country || "").toUpperCase() === String(country || "").toUpperCase();
  },
};

/* =========================
 * HELPERS
 * ========================= */
function safeArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

function applyRewardToUserTrx(trx, userRef, reward = {}, { forbidCurrency = false } = {}) {
  const { credits = 0, xp = 0, materials = [], flags = [], cosmetics = [] } = reward;

  // Currency-like rewards (respect the "forbidCurrency" switch for personal quests)
  if (!forbidCurrency) {
    if (credits && credits > 0) {
      trx.set(userRef, {
        creditsBalance: admin.firestore.FieldValue.increment(Math.floor(credits)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (xp && xp > 0) {
      trx.set(userRef, {
        xp: admin.firestore.FieldValue.increment(Math.floor(xp)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const mats = (materials || []).slice(0, CFG.maxMaterialsPerReward);
    for (const m of mats) {
      if (!m?.id || !Number.isFinite(m?.qty)) continue;
      trx.set(userRef, {
        [`materials.${m.id}`]: admin.firestore.FieldValue.increment(Math.floor(m.qty)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  // Harmless grants always allowed
  if (flags?.length) {
    trx.set(userRef, {
      flags: admin.firestore.FieldValue.arrayUnion(...flags),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  if (cosmetics?.length) {
    trx.set(userRef, {
      cosmetics: admin.firestore.FieldValue.arrayUnion(...cosmetics),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}


async function upsertQuestDefs(defs = []) {
  const batch = db.batch();
  defs.forEach(d => {
    const ref = db.doc(`questDefs/${d.id}`);
    batch.set(ref, d, { merge: true });
  });
  await batch.commit();
}

/* =========================
 * QUESTS CATALOGS (minimal; expand later)
 * ========================= */
const STARTER_DEFS = [
  // a) Set energy source (income)
  {
    id: "starter-income-set",
    type: "starter",
    availability: { mode: "auto", requiresQuests: [] },
    steps: [{ id: "INCOME_SET", target: 1 }],
    rewards: { credits: 5, flags: ["income_ready"] },
    unlocksQuests: ["starter-wardfire-set"],
    chainGroup: "starter",
    chainIndex: 1,
  },
  // b) Set Emberward (core expenses)
  {
    id: "starter-wardfire-set",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-income-set"] },
    steps: [{ id: "WARDFIRE_SET", target: 1 }],
    rewards: { credits: 5, flags: ["wardfire_ready"] },
    unlocksQuests: ["starter-avatar-formed"],
    chainGroup: "starter",
    chainIndex: 2,
  },
  // c) Select / Form Avatar
  {
    id: "starter-avatar-formed",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-wardfire-set"] },
    steps: [{ id: "AVATAR_FORMED", target: 1 }],
    rewards: { credits: 5, flags: ["onboarding_completed"] },
    unlocksQuests: [
      "starter-tl-connect",
      "starter-first-tag",
      "starter-visit-all",
      "starter-use-skill",
      "starter-essence-contribute", // just an event; no Credits awarded here unless you want
      "starter-buy-credits",
      "starter-empower-avatar",
      "starter-invite-converts",
      "starter-friend-added",
      "starter-enter-badlands"
    ],
    chainGroup: "starter",
    chainIndex: 3,
  },
  // d) Connect bank (TrueLayer)
  {
    id: "starter-tl-connect",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "TRUELAYER_CONNECTED", target: 1 }],
    rewards: { credits: 10, flags: ["true_mode_unlocked"] },
  },
  // e) Log + tag first transaction
  {
    id: "starter-first-tag",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "FIRST_TX_TAGGED", target: 1 }],
    rewards: { credits: 5 },
  },
  // f) Navigate to every screen from hub
  {
    id: "starter-visit-all",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "ALL_SCREENS_VISITED", target: 1 }],
    rewards: { credits: 5 },
  },
  // g) Equip / Use first skill
  {
    id: "starter-use-skill",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "FIRST_SKILL_USED", target: 1 }],
    rewards: { credits: 5 },
  },
  // h) First contribution via essence menu (no Credits by design; can add flag/cosmetic)
  {
    id: "starter-essence-contribute",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "ESSENCE_CONTRIBUTION_MADE", target: 1 }],
    rewards: { flags: ["altruism_seeded"] },
  },
  // i) Purchase Credits
  {
    id: "starter-buy-credits",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "CREDITS_PURCHASED", target: 1 }],
    rewards: { materials: [{ id: "voucher_shard", qty: 1 }] }, // example material
  },
  // j) Empower avatar (consumes Credits → cosmetics unlock)
  {
    id: "starter-empower-avatar",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "AVATAR_EMPOWERED", target: 1 }],
    rewards: { cosmetics: ["empower_glow_01"] },
  },
  // k) Invite a friend who signs up + connects TL
  {
    id: "starter-invite-converts",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "FRIEND_INVITE_CONVERTED", target: 1 }],
    rewards: { credits: 20, materials: [{ id: "ally_token", qty: 1 }] },
  },
  // l) Add a friend
  {
    id: "starter-friend-added",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "FRIEND_ADDED", target: 1 }],
    rewards: { credits: 5 },
  },
  // m) Enter the Badlands
  {
    id: "starter-enter-badlands",
    type: "starter",
    availability: { mode: "auto", requiresQuests: ["starter-avatar-formed"] },
    steps: [{ id: "BADLANDS_ENTERED", target: 1 }],
    rewards: { materials: [{ id: "ember_fragment", qty: 1 }] },
  },
  // o) Secret: Listen to hub music in full (hidden until done; appears completed)
  {
    id: "secret-hub-music",
    type: "secret",
    availability: { mode: "auto" }, // secret gating is event-driven
    steps: [{ id: "HUB_MUSIC_LISTENED_FULL", target: 1 }],
    rewards: { cosmetics: ["music_bg_card"] },
    secret: true,
  },
];

// 2) CYCLICAL (Daily / Weekly / Monthly)
// Reset logic handled by resetCyclicalQuests; these start 'active' and get reissued/reset.
const CYCLICAL_SAMPLES = [
  {
    id: "daily-check-in",
    type: "cyclical",
    subType: "daily",
    availability: { mode: "auto" },
    steps: [{ id: "DAILY_CHECKIN", target: 1 }],
    rewards: { xp: 5 }, // lightweight XP
    cycleMeta: { label: "Daily Check-in" }
  },
  {
    id: "weekly-budget-review",
    type: "cyclical",
    subType: "weekly",
    availability: { mode: "auto" },
    steps: [{ id: "WEEKLY_BUDGET_REVIEWED", target: 1 }],
    rewards: { credits: 3, xp: 10 },
    cycleMeta: { label: "Weekly Budget Review" }
  },
  {
    id: "monthly-close",
    type: "cyclical",
    subType: "monthly",
    availability: { mode: "auto" },
    steps: [{ id: "MONTH_END_CLOSE_DONE", target: 1 }],
    rewards: { credits: 5, materials: [{ id: "ledger_stamp", qty: 1 }] },
    cycleMeta: { label: "Month-End Close" }
  }
];

// 3) MILESTONE — event might be server-evaluated rather than emitted by FE
const MILESTONE_SAMPLES = [
  {
    id: "milestone-account-age-30",
    type: "milestone",
    availability: {
      mode: "auto",
      predicateKey: "notCompletedQuest",
      predicateArgs: { questId: "milestone-account-age-30" }
    },
    steps: [{ id: "ACCOUNT_AGE_30", target: 1 }],
    rewards: { xp: 25, materials: [{ id: "veteran_mark", qty: 1 }] },
    meta: { desc: "30 days since account creation" }
  }
];

// 4) NARRATIVE — simple chain: prologue -> path choice -> first mission
const NARRATIVE_SAMPLES = [
  {
    id: "narrative-prologue",
    type: "narrative",
    availability: { mode: "auto" },
    steps: [{ id: "MEET_ARCHITECT", target: 1 }],
    rewards: { xp: 15, flags: ["prologue_seen"] },
    unlocksQuests: ["narrative-choose-path"],
    chainGroup: "narrative-ch1",
    chainIndex: 1
  },
  {
    id: "narrative-choose-path",
    type: "narrative",
    availability: { mode: "auto", requiresQuests: ["narrative-prologue"] },
    steps: [{ id: "PATH_CHOSEN", target: 1 }],
    rewards: { flags: ["path_locked_in"] },
    // Choosing the path will emit an event the server can use to unlock the right branch:
    // unlocksQuests intentionally omitted to show "dynamic branch" handled by server event
    chainGroup: "narrative-ch1",
    chainIndex: 2
  },
  // Branch A mission (unlocked by server when PATH_A_SELECTED event fires)
  {
    id: "narrative-path-a-01",
    type: "narrative",
    availability: { mode: "auto", requiresQuests: ["narrative-choose-path"] },
    steps: [{ id: "PATH_A_MISSION_DONE", target: 1 }],
    rewards: { xp: 20, cosmetics: ["cloak_a_01"] },
    chainGroup: "narrative-ch1",
    chainIndex: 3
  },
  // Branch B mission
  {
    id: "narrative-path-b-01",
    type: "narrative",
    availability: { mode: "auto", requiresQuests: ["narrative-choose-path"] },
    steps: [{ id: "PATH_B_MISSION_DONE", target: 1 }],
    rewards: { xp: 20, cosmetics: ["cloak_b_01"] },
    chainGroup: "narrative-ch1",
    chainIndex: 3
  }
];

// 5) COMMUNITY — Global and Local samples
const COMMUNITY_SAMPLES = [
  // Global: everyone contributes to one pool
  {
    id: "community-global-contrib-1k",
    type: "community",
    subType: "global",
    availability: { mode: "auto" },
    steps: [{ id: "COMMUNITY_CONTRIBUTION", target: 1000 }], // target in aggregate
    rewards: { flags: ["global_forge_warmed"] }, // global unlock toggled elsewhere
    community: { payoutMode: "proportional" }    // distribution handled by server job
  },
  // Local: instance created by clan/admin; memberIds tracked at instance doc
  {
    id: "community-local-clan-drive",
    type: "community",
    subType: "local",
    availability: { mode: "manual" }, // local instances created via admin flow
    steps: [{ id: "CLAN_DRIVE_PROGRESS", target: 500 }],
    rewards: { credits: 0 }, // optional; see payoutMode below
    community: { payoutMode: COMMUNITY_PAYOUT_MODES[0] }, // "proportional"
  }
];

// 6) CONTRACT — appears on Job Board, must be accepted first
const CONTRACT_SAMPLES = [
  {
    id: "contract-recruit-ally",
    type: "contract",
    availability: {
      mode: "manual",                 // show on job board if predicates pass
      predicateKey: "minLevel",
      predicateArgs: { min: 2 }
    },
    steps: [{ id: "ALLY_RECRUITED", target: 1 }],
    rewards: { credits: 15, xp: 10 },
    meta: { source: "central" }       // or "partner", "player"
  }
];

// 7) EVENT — limited-time window, auto-accepted if eligible
const EVENT_SAMPLES = [
  {
    id: "event-flame-festival-2025",
    type: "event",
    availability: {
      mode: "auto",
      timeWindow: { start: "2025-10-01T00:00:00Z", end: "2025-10-07T23:59:59Z" }
    },
    steps: [{ id: "FESTIVAL_TOKEN_COLLECTED", target: 10 }],
    rewards: { materials: [{ id: "festival_token", qty: 10 }], cosmetics: ["festival_aura_25"] },
    meta: { label: "Flame Festival Week" }
  }
];

// 8) SECRET — you already have "secret-hub-music" in Starter pack; no extra needed.

// 9) PERSONAL — created per-user via callable (no catalog entry needed).
//   (We show a dummy template doc if you want to render presets on UI)
const PERSONAL_TEMPLATE = [
  {
    id: "personal-template-dummy",
    type: "personal",
    availability: { mode: "manual" }, // UI-only template; not granted directly
    steps: [{ id: "PERSONAL_PROGRESS", target: 1 }],
    rewards: { flags: [] },
    meta: { hint: "Use the Personal tab to create your own quest" }
  }
];

// Merge everything into one array you already seed:
const EXAMPLES_DEFS = [
  ...CYCLICAL_SAMPLES,
  ...MILESTONE_SAMPLES,
  ...NARRATIVE_SAMPLES,
  ...COMMUNITY_SAMPLES,
  ...CONTRACT_SAMPLES,
  ...EVENT_SAMPLES,
  ...PERSONAL_TEMPLATE
];

// When seeding, include both Starter and Examples:
const ALL_QUEST_DEFS = [
  ...STARTER_DEFS,           // from your existing starter set
  ...EXAMPLES_DEFS
];


/* =========================
 * EVENT → STEP MAP
 * (Canonical names from your spec)
 * ========================= */
const EVENT_STEP_MAP = {
  INCOME_SET:             [{ questId: "starter-income-set", stepId: "INCOME_SET" }],
  WARDFIRE_SET:           [{ questId: "starter-wardfire-set", stepId: "WARDFIRE_SET" }],
  AVATAR_FORMED:          [{ questId: "starter-avatar-formed", stepId: "AVATAR_FORMED" }],
  TRUELAYER_CONNECTED:    [{ questId: "starter-tl-connect", stepId: "TRUELAYER_CONNECTED", requiresTL: true }],
  FIRST_TX_TAGGED:        [{ questId: "starter-first-tag", stepId: "FIRST_TX_TAGGED" }],
  ALL_SCREENS_VISITED:    [{ questId: "starter-visit-all", stepId: "ALL_SCREENS_VISITED" }],
  FIRST_SKILL_USED:       [{ questId: "starter-use-skill", stepId: "FIRST_SKILL_USED" }],
  ESSENCE_CONTRIBUTION_MADE: [{ questId: "starter-essence-contribute", stepId: "ESSENCE_CONTRIBUTION_MADE" }],
  CREDITS_PURCHASED:      [{ questId: "starter-buy-credits", stepId: "CREDITS_PURCHASED" }],
  AVATAR_EMPOWERED:       [{ questId: "starter-empower-avatar", stepId: "AVATAR_EMPOWERED" }],
  FRIEND_INVITE_CONVERTED:[{ questId: "starter-invite-converts", stepId: "FRIEND_INVITE_CONVERTED" }],
  FRIEND_ADDED:           [{ questId: "starter-friend-added", stepId: "FRIEND_ADDED" }],
  BADLANDS_ENTERED:       [{ questId: "starter-enter-badlands", stepId: "BADLANDS_ENTERED" }],
  HUB_MUSIC_LISTENED_FULL:[{ questId: "secret-hub-music", stepId: "HUB_MUSIC_LISTENED_FULL" }],
};

Object.assign(EVENT_STEP_MAP, {
  // Cyclical
  DAILY_CHECKIN:            [{ questId: "daily-check-in", stepId: "DAILY_CHECKIN" }],
  WEEKLY_BUDGET_REVIEWED:   [{ questId: "weekly-budget-review", stepId: "WEEKLY_BUDGET_REVIEWED" }],
  MONTH_END_CLOSE_DONE:     [{ questId: "monthly-close", stepId: "MONTH_END_CLOSE_DONE" }],

  // Milestone (could be server-evaluated instead)
  ACCOUNT_AGE_30:           [{ questId: "milestone-account-age-30", stepId: "ACCOUNT_AGE_30" }],

  // Narrative
  MEET_ARCHITECT:           [{ questId: "narrative-prologue", stepId: "MEET_ARCHITECT" }],
  PATH_CHOSEN:              [{ questId: "narrative-choose-path", stepId: "PATH_CHOSEN" }],
  PATH_A_MISSION_DONE:      [{ questId: "narrative-path-a-01", stepId: "PATH_A_MISSION_DONE" }],
  PATH_B_MISSION_DONE:      [{ questId: "narrative-path-b-01", stepId: "PATH_B_MISSION_DONE" }],

  // Community aggregate increments generally go through tallyCommunityProgress(),
  // but if you do event-forwarding too, you could map to a "user-side" step
  // that the server ignores for completion and just uses tally instead.

  // Contract
  ALLY_RECRUITED:           [{ questId: "contract-recruit-ally", stepId: "ALLY_RECRUITED" }],

  // Event (time-limited)
  FESTIVAL_TOKEN_COLLECTED: [{ questId: "event-flame-festival-2025", stepId: "FESTIVAL_TOKEN_COLLECTED" }],
});


/* =========================
 * CORE: seed catalog & ensure per-user quest doc
 * ========================= */
async function ensureUserQuest(trx, uid, def) {
  const ref = db.doc(`players/${uid}/quests/${def.id}`);
  const snap = await trx.get(ref);
  if (snap.exists) return ref;

  // Default state: auto-accept if not optional (contracts/personal/community-local are manual)
  const isManual = (def?.type === "contract") || (def?.type === "personal") ||
                   (def?.availability?.mode === "manual");
  const state = isManual ? "available" : "active"; // auto-accept implies active

  const payload = {
    questId: def.id,
    type: def.type,
    state,
    steps: (def.steps || []).map(s => ({ id: s.id, qty: 0, target: s.target || 1, done: false })),
    completed: false,
    rewarded: false,
    serverLocked: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    rewards: def.rewards || {},
    subType: def.subType || null,
    chainGroup: def.chainGroup || null,
    chainIndex: def.chainIndex || null,
    secret: !!def.secret,
  };
  trx.set(ref, payload, { merge: true });
  return ref;
}

/* =========================
 * CALLABLES
 * ========================= */

// Seed the initial catalog (idempotent), then grant starter chain availability
exports.seedQuestCatalog = functions.https.onCall({ region: 'europe-west2' }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  await upsertQuestDefs(ALL_QUEST_DEFS);
  return { ok: true };
});

// Grant (or auto-accept) a quest if eligible (server decides & writes)
exports.grantQuestIfEligible = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { questId } = request.data || {};
  if (!questId) throw new HttpsError("invalid-argument", "Missing questId");

  const defSnap = await db.doc(`questDefs/${questId}`).get();
  if (!defSnap.exists) throw new HttpsError("not-found", "Quest def missing");
  const def = defSnap.data();

  // availability checks...
  const av = def.availability || {};
  for (const req of (av.requiresQuests || [])) {
    const q = await db.doc(`players/${uid}/quests/${req}`).get();
    if (!(q.exists && q.data()?.completed)) {
      throw new HttpsError("failed-precondition", `Requires quest ${req}`);
    }
  }
  if (av.predicateKey && predicates[av.predicateKey]) {
    const ok = await predicates[av.predicateKey]({ uid }, av.predicateArgs || {});
    if (!ok) throw new HttpsError("failed-precondition", "Predicate failed");
  }
  if (av.timeWindow && (av.timeWindow.start || av.timeWindow.end)) {
    const now = new Date();
    const startOk = !av.timeWindow.start || now >= new Date(av.timeWindow.start);
    const endOk   = !av.timeWindow.end   || now <= new Date(av.timeWindow.end);
    if (!(startOk && endOk)) throw new HttpsError("failed-precondition", "Quest is outside its time window");
  }

  await db.runTransaction(async (trx) => {
    await ensureUserQuest(trx, uid, def);
  });

  return { ok: true };
});


// Accept an available (optional) quest → state becomes "accepted" or "active"
exports.acceptQuest = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { questId } = request.data || {};
  if (!questId) throw new HttpsError("invalid-argument", "Missing questId");

  const ref = db.doc(`players/${uid}/quests/${questId}`);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Quest not in log");
    const q = snap.data();
    if (q.state !== "available") throw new functions.https.HttpsError("failed-precondition", "Not available to accept");

    // Optional: some types go straight to active
    const next = (q.type === "contract" || q.type === "community") ? "accepted" : "active";
    trx.update(ref, {
      state: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

// Progress via canonical event (server validates sensitive events)
exports.progressQuest = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { event, metadata } = request.data || {};
  if (!event) throw new HttpsError("invalid-argument", "Missing event");

  const targets = EVENT_STEP_MAP[event] || [];
  if (!targets.length) return { ok: true, info: "no-op" };

  // Example: special validate for TL
  if (targets.some(t => t.requiresTL)) {
    const ok = await predicates.hasTrueLayer({ uid });
    if (!ok) throw new functions.https.HttpsError("failed-precondition", "TrueLayer not linked");
  }

  // For each target quest, tick the step if quest is active/accepted (or secret special-case)
  for (const t of targets) {
    const qRef = db.doc(`players/${uid}/quests/${t.questId}`);
    await db.runTransaction(async (trx) => {
      const snap = await trx.get(qRef);
      if (!snap.exists) {
        // Secret quests: create on event and complete immediately
        const defSnap = await db.doc(`questDefs/${t.questId}`).get();
        if (!defSnap.exists) return;
        const def = defSnap.data();
        if (def.type === "secret") {
          await ensureUserQuest(trx, uid, def);
        } else {
          return; // non-secret must be granted first
        }
      }
      const q = (snap.exists ? snap.data() : (await qRef.get()).data());
      // Only allow progress when active/accepted, or secret quests
      const progressAllowed = q?.type === "secret" || ["active", "accepted"].includes(q?.state);
      if (!progressAllowed) return;

      const steps = (q.steps || []).map(s => {
        if (s.id === t.stepId) {
          const nextQty = Math.min((s.qty || 0) + 1, s.target || 1);
          return { ...s, qty: nextQty, done: nextQty >= (s.target || 1) };
        }
        return s;
      });
      const allDone = steps.length > 0 && steps.every(s => s.done === true);
      const newState = allDone ? "completed" : (q.state === "accepted" ? "active" : q.state);

      trx.set(qRef, {
        steps,
        state: newState,
        completed: allDone,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: allDone && !q.completedAt ? admin.firestore.FieldValue.serverTimestamp() : q.completedAt || null
      }, { merge: true });

      // Auto-enqueue unlocked quests on completion
      if (allDone) {
        const defSnap = await db.doc(`questDefs/${q.questId}`).get();
        const def = defSnap.exists ? defSnap.data() : null;
        for (const nxt of safeArray(def?.unlocksQuests)) {
          const nextDefSnap = await db.doc(`questDefs/${nxt}`).get();
          if (nextDefSnap.exists) {
            await ensureUserQuest(trx, uid, nextDefSnap.data());
          }
        }
      }
    });
  }

  return { ok: true };
});

// Claim rewards (credits, xp, materials, flags, cosmetics)
exports.claimReward = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { questId } = request.data || {};
  if (!questId) throw new HttpsError("invalid-argument", "Missing questId");

  const qRef = db.doc(`players/${uid}/quests/${questId}`);
  const userRef = db.doc(`players/${uid}`);

  

  await db.runTransaction(async (trx) => {
    const qSnap = await trx.get(qRef);
    if (!qSnap.exists) throw new functions.https.HttpsError("not-found", "Quest not found");
    const q = qSnap.data();

    const forbidCurrency = q.type === "personal";

    if (!q.completed) throw new functions.https.HttpsError("failed-precondition", "Not completed");
    if (q.rewarded) throw new functions.https.HttpsError("failed-precondition", "Already rewarded");

    applyRewardToUserTrx(trx, userRef, q.rewards || {}, {forbidCurrency});
    trx.update(qRef, {
      rewarded: true,
      rewardsClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

// -------- Personal quests (no currency) --------
exports.createPersonalQuest = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { title, notes, target = 1, deadline = null, recurring = false } = request.data || {};
  if (!title || !Number.isFinite(target)) throw new HttpsError("invalid-argument", "Bad payload");

  const qid = `personal-${db.collection("_").doc().id}`;
  const ref = db.doc(`players/${uid}/quests/${qid}`);
  await ref.set({
    questId: qid,
    type: "personal",
    state: "active", // personal is auto-accepted
    steps: [{ id: "PERSONAL_PROGRESS", qty: 0, target: Math.max(1, Math.floor(target)), done: false }],
    completed: false,
    rewarded: false, // no currency will be added anyway
    rewards: { flags: [] }, // enforce: no credits/materials here
    title,
    notes: notes || "",
    recurring: !!recurring,
    deadline: deadline || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, questId: qid };
});

exports.updatePersonalQuest = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { questId, title, notes, target, deadline, recurring } = request.data || {};
  if (!questId) throw new HttpsError("invalid-argument", "Missing questId");

  const ref = db.doc(`players/${uid}/quests/${questId}`);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Quest missing");
    const q = snap.data();
    if (q.type !== "personal") throw new functions.https.HttpsError("failed-precondition", "Not personal");

    const patch = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (typeof title === "string") patch.title = title;
    if (typeof notes === "string") patch.notes = notes;
    if (deadline !== undefined) patch.deadline = deadline;
    if (typeof recurring === "boolean") patch.recurring = recurring;
    if (Number.isFinite(target) && target > 0 && !(q.completed || q.rewarded)) {
      patch.steps = [{ id: "PERSONAL_PROGRESS", qty: Math.min(q.steps?.[0]?.qty || 0, Math.floor(target)), target: Math.floor(target), done: false }];
    }
    trx.update(ref, patch);
  });

  return { ok: true };
});

exports.abandonQuest = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const { questId } = request.data || {};
  if (!questId) throw new HttpsError("invalid-argument", "Missing questId");

  const ref = db.doc(`players/${uid}/quests/${questId}`);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Quest missing");
    trx.update(ref, {
      state: "abandoned",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// -------- Community tally (global + local) --------
exports.tallyCommunityProgress = onCall({ region: "europe-west2" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { questId, localInstanceId = null, amount = 1 } = request.data || {};
  if (!questId || !Number.isFinite(amount)) throw new HttpsError("invalid-argument", "Bad payload");

  const targetRef = localInstanceId
    ? db.doc(`communityQuests/${questId}/locals/${localInstanceId}`)
    : db.doc(`communityQuests/${questId}`);

  await db.runTransaction(async (trx) => {
    const snap = await trx.get(targetRef);
    const cur = snap.exists ? snap.data() : { progress: 0, target: 0, payoutMode: "proportional", memberIds: [] };
    const progress = (cur.progress || 0) + Math.max(0, Math.floor(amount));

    trx.set(targetRef, {
      ...cur,
      progress,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // completion payout trigger could be here or in a separate onWrite
    // You’ll define target & payout in the catalog for the community quest
  });

  return { ok: true };
});

// -------- Cyclical reset (scheduled) --------
// Set Cloud Scheduler to hit this HTTP endpoint daily at e.g. 00:10 UTC
exports.resetCyclicalQuests = onSchedule( 
  { region: 'europe-west2', schedule: "every 1 hours", timeZone: "Etc/UTC" }, // we compute per-user tz inside
  async () => {
  // Strategy: run hourly; for each user, compute if a boundary passed in their timezone.
  // To keep it short, here’s a sketch you can expand:
  const players = await db.collection("players").limit(500).get();
  const nowUtc = DateTime.utc();

  const batch = db.batch();
  for (const doc of players.docs) {
    const u = doc.data() || {};
    const tz = u?.settings?.tz || CFG.defaultTimezone;
    const useLocal = (u?.settings?.useLocalTzForCycles ?? CFG.useLocalTzForCyclesDefault) === true;

    // Compute cycle boundaries in tz (daily/weekly/monthly); here we demo daily
    const nowLocal = useLocal ? nowUtc.setZone(tz) : nowUtc.setZone(CFG.defaultTimezone);
    const isResetWindow = nowLocal.hour === CFG.cyclicalResetHourLocal; // plus minute window if desired
    if (!isResetWindow) continue;

    // Reset user’s cyclical quests
    const qSnap = await db.collection(`players/${doc.id}/quests`).where("type", "==", "cyclical").get();
    for (const q of qSnap.docs) {
      const data = q.data();
      // If expired or completed, just start new cycle; else mark expired then reset
      const steps = (data.steps || []).map(s => ({ ...s, qty: 0, done: false }));
      batch.set(q.ref, {
        steps,
        state: "active",
        completed: false,
        rewarded: false,
        cycleId: (data.cycleId || 0) + 1,
        windowStart: admin.firestore.FieldValue.serverTimestamp(),
        windowEnd: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
  await batch.commit();
  return null;

});




