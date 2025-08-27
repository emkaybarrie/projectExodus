// index.js — drop-in replacement with TL fan-out (no regressions)

const { onRequest, onCall } = require('firebase-functions/v2/https');
const { onDocumentUpdated, onDocumentWritten} = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ------------------------- Secrets -------------------------
const TRUELAYER_CLIENT_ID = defineSecret('TRUELAYER_CLIENT_ID');
const TRUELAYER_CLIENT_SECRET = defineSecret('TRUELAYER_CLIENT_SECRET');
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// ------------------------- CORS ----------------------------
const corsHandler = cors({ origin: true });

/**
 * ====================================================================
 *  TRUE LAYER: TOKEN EXCHANGE
 * ====================================================================
 */
exports.exchangeToken = onRequest({
  region: 'europe-west2',
  secrets: [TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET],
}, async (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
      const { code, uid, redirect_uri } = req.body || {};
      if (!code || !uid || !redirect_uri) {
        return res.status(400).json({
          error: 'missing_params',
          details: { hasCode: !!code, hasUid: !!uid, hasRedirectUri: !!redirect_uri }
        });
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', TRUELAYER_CLIENT_ID.value());
      params.append('client_secret', TRUELAYER_CLIENT_SECRET.value());
      params.append('redirect_uri', redirect_uri);
      params.append('code', code);

      const response = await axios.post(
        'https://auth.truelayer-sandbox.com/connect/token',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const data = response.data;

      await db.doc(`players/${uid}/financialData_TRUELAYER/token`).set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        created_at: Date.now(),
      }, { merge: true });

      return res.status(200).json({ success: true });
    } catch (err) {
      const status = err.response?.status ?? 500;
      const details = err.response?.data ?? err.message;
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

// Keep your existing aggregate cache writes for compatibility.
// These functions ALSO trigger fan-out into per-account/card subcollections.
const fetchFromTrueLayer = async (uid, urlPath, storeKey) => {
  const tokenSnap = await db.doc(`players/${uid}/financialData_TRUELAYER/token`).get();
  const token = tokenSnap.exists ? tokenSnap.data().access_token : null;
  if (!token) throw new Error('No access token found for user.');

  const apiUrl = `https://api.truelayer-sandbox.com${urlPath}`;
  const response = await axios.get(apiUrl, { headers: { Authorization: `Bearer ${token}` } });

  // Keep old aggregate doc for your current UI
  await db.doc(`players/${uid}/financialData_TRUELAYER/${storeKey}`).set({
    data: response.data,
    lastUpdated: Date.now(),
  }, { merge: true });

  return response.data;
};

const createFetchFunction = (path, key) =>
  onRequest({ region: 'europe-west2' }, async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'Missing UID' });

        const data = await fetchFromTrueLayer(uid, path, key);

        // Fan-out for accounts/cards
        if (key === 'accounts') await upsertAccounts(uid, data);
        if (key === 'cards') await upsertCards(uid, data);

        res.status(200).json({ success: true, data });
      } catch (err) {
        console.error(`[${key}] Fetch failed:`, err.response?.data || err.message);
        res.status(500).json({ error: 'Fetch failed', details: err.message });
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
  const ghostWindowMs = 2 * 60 * 60 * 1000; // 12h
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
  const startMsRaw = await ensureStartMsServer(db, uid);              // you already have this
  const calcStartMs = calcStartMsFromStartDate(startMsRaw);           // you already have this

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
  const tokenSnap = await db.doc(`players/${uid}/financialData_TRUELAYER/token`).get();
  const token = tokenSnap.exists ? tokenSnap.data().access_token : null;
  if (!token) throw new Error('No access token found.');

  // 1) list accounts
  const accountsRes = await axios.get(
    `https://api.truelayer-sandbox.com/data/v1/accounts`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // upsert /accounts/items
  await upsertAccounts(uid, accountsRes.data);

  const results = {};
  for (const acc of (accountsRes.data.results || [])) {
    const accountIdRaw = acc.account_id;
    const accountId = safeId(accountIdRaw);

    // 2) fetch subresource per account
    const url = `https://api.truelayer-sandbox.com/data/v1/accounts/${accountIdRaw}/${subPath}`;
    let items = [];
    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      items = res.data.results || [];
    } catch (err) {
      console.warn(`[${kind}] Failed for account ${accountId}:`, err.response?.data || err.message);
    }

    // 3) fan-out into per-account subcollections
    if (kind === 'transactions') {
      await upsertTransactionsForAccount(uid, accountId, items);
    } else if (kind === 'direct_debits') {
      await upsertDirectDebitsForAccount(uid, accountId, items);
    } else if (kind === 'standing_orders') {
      await upsertStandingOrdersForAccount(uid, accountId, items);
    }

    results[accountId] = items;
  }

  // 4) keep your aggregate doc for compatibility
  await db.doc(`players/${uid}/financialData_TRUELAYER/${kind}`).set({
    data: results,
    lastUpdated: Date.now(),
  }, { merge: true });

  return results;
}

const createPerAccountFunctionV2 = (subPath, key) =>
  onRequest({ region: 'europe-west2' }, async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'Missing UID' });
        const data = await fetchPerAccountAndUpsert(uid, subPath, key);
        res.status(200).json({ success: true, data });
      } catch (err) {
        console.error(`[${key}] Fetch failed:`, err.response?.data || err.message);
        res.status(500).json({ error: 'Fetch failed', details: err.message });
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
exports.fetchTransactions   = createPerAccountFunctionV2('transactions', 'transactions');
exports.fetchDirectDebits   = createPerAccountFunctionV2('direct_debits', 'direct_debits');
exports.fetchStandingOrders = createPerAccountFunctionV2('standing_orders', 'standing_orders');

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
      const startMsRaw = await ensureStartMsServer(db, uid);
      const calcStartMs = calcStartMsFromStartDate(startMsRaw);

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

    const historicUsage = (sumSnap.exists && sumSnap.data().historicUsage) || {
      health: 0, mana: 0, stamina: 0, essence: 0
    };

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

    // 4) usage summary bump
    historicUsage.essence = toNum(historicUsage.essence) + Math.abs(finalAmount);
    trx.set(summaryRef, { historicUsage, updatedAt: now }, { merge: true });
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

  const rawAmount = Number(req.data?.amountGBP || 0);
  if (!(rawAmount > 0)) throw new Error('Amount must be > 0');

  const available = await readAvailableEssenceMonthly(db, uid);
  const amountGBP = Math.min(rawAmount, available);
  if (amountGBP <= 0) throw new Error('Insufficient available Essence for contribution');

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
const MS_PER_DAY = 86_400_000;

function calcStartMsFromStartDate(startMs) {
  const d = new Date(startMs);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function sameYMD(aMs, bMs) {
  const a = new Date(aMs), b = new Date(bMs);
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function fractionOfDay(ms) {
  const d = new Date(ms);
  const sod = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.min(1, (ms - sod) / MS_PER_DAY));
}
async function ensureStartMsServer(db, uid) {
  try {
    const prof = await db.doc(`players/${uid}`).get();
    if (prof.exists) {
      const raw = prof.data().startDate;
      if (raw && typeof raw.toMillis === 'function') return raw.toMillis();
      if (raw instanceof Date) return raw.getTime();
      if (typeof raw === 'number') return raw;
    }
  } catch {}
  return Date.now();
}
async function elapsedDaysFromCalcStartServer(db, uid) {
  const startMs   = await ensureStartMsServer(db, uid);
  const calcStart = calcStartMsFromStartDate(startMs);
  return Math.max(0, (Date.now() - calcStart) / MS_PER_DAY);
}
async function daysTrackedFromCalcStartServer(db, uid) {
  const startMs   = await ensureStartMsServer(db, uid);
  const calcStart = calcStartMsFromStartDate(startMs);
  return Math.max(1, Math.floor((Date.now() - calcStart) / MS_PER_DAY));
}

function shouldApplySeedServer(pools) {
  const z = (x) => !x || Math.abs(Number(x)) < 0.000001;
  return z(pools?.health?.spentToDate) &&
         z(pools?.mana?.spentToDate) &&
         z(pools?.stamina?.spentToDate) &&
         z(pools?.essence?.spentToDate);
}
async function hasPostStartSpendServer(db, uid, startMs) {
  try {
    const snap = await db.collection(`players/${uid}/classifiedTransactions`)
      .where('status','==','confirmed')
      .where('amount','<',0)
      .where('dateMs','>=',startMs)
      .limit(1)
      .get();
    return !!snap.size;
  } catch { return false; }
}
async function getPoolSharesServer(db, uid, pools) {
  try {
    const snap = await db.doc(`players/${uid}/cashflowData/poolAllocations`).get();
    if (snap.exists) {
      const d = snap.data() || {};
      const mana = Number(d.manaAllocation ?? 0);
      const stamina = Number(d.staminaAllocation ?? 0);
      const essence = Number(d.essenceAllocation ?? 0);
      const sum = mana + stamina + essence;
      if (sum > 0) return { mana: mana/sum, stamina: stamina/sum, essence: essence/sum };
    }
  } catch {}
  const m1 = Number(pools?.mana?.regenBaseline || 0);
  const s1 = Number(pools?.stamina?.regenBaseline || 0);
  const e1 = Number(pools?.essence?.regenBaseline || 0);
  const sum = m1 + s1 + e1;
  return sum > 0 ? { mana: m1/sum, stamina: s1/sum, essence: e1/sum } : { mana:0, stamina:0, essence:0 };
}

// Used by readAvailableEssenceMonthly (kept active, not commented)
async function computeSeedCurrentsServer(db, uid, pools, mode, startMs, { p = 0.6 } = {}) {
  const calcStart   = calcStartMsFromStartDate(startMs);
  const daysAccrued = Math.max(0, (Date.now() - calcStart) / MS_PER_DAY);

  const fracDay1 = fractionOfDay(startMs);
  const isDay1   = sameYMD(startMs, Date.now());

  const m1 = Number(pools?.mana?.regenBaseline    || 0);
  const s1 = Number(pools?.stamina?.regenBaseline || 0);
  const e1 = Number(pools?.essence?.regenBaseline || 0);

  const Emax = e1 * daysAccrued;

  if (mode !== 'accelerated') {
    const essenceSafe = isDay1 ? (e1 * fracDay1) : (e1 * (1 + fracDay1));
    return { essence: { current: Math.min(Emax, essenceSafe), max: Emax } };
  }

  const essenceFloor = isDay1 ? (e1 * fracDay1) : 0;
  const A  = (m1 + s1 + e1) * daysAccrued;
  const R  = Math.max(0, A * (1 - Math.max(0, Math.min(1, p))));
  const sh = await getPoolSharesServer(db, uid, pools);
  const addE = R * (sh.essence || 0);

  const essenceCur = Math.min(Emax, essenceFloor + addE);
  return { essence: { current: Math.max(0, essenceCur), max: Emax } };
}

// Full-pools seeding (used elsewhere)
async function computeSeedCurrentsAllServer(db, uid, pools, mode, startMs, { p = 0.6 } = {}) {
  const calcStart   = calcStartMsFromStartDate(startMs);
  const daysAccrued = Math.max(0, (Date.now() - calcStart) / MS_PER_DAY);

  const fracDay1 = fractionOfDay(startMs);
  const isDay1   = sameYMD(startMs, Date.now());

  const h1 = Number(pools?.health?.regenBaseline   || 0);
  const m1 = Number(pools?.mana?.regenBaseline     || 0);
  const s1 = Number(pools?.stamina?.regenBaseline  || 0);
  const e1 = Number(pools?.essence?.regenBaseline  || 0);

  const Hmax = h1 * daysAccrued;
  const Mmax = m1 * daysAccrued;
  const Smax = s1 * daysAccrued;
  const Emax = e1 * daysAccrued;

  const fracOnly    = (x1) => x1 * fracDay1;
  const onePlusFrac = (x1) => x1 * (1 + fracDay1);

  if (mode !== 'accelerated') {
    const manaSafe    = isDay1 ? fracOnly(m1)    : onePlusFrac(m1);
    const staminaSafe = isDay1 ? fracOnly(s1)    : onePlusFrac(s1);
    const essenceSafe = isDay1 ? fracOnly(e1)    : onePlusFrac(e1);
    return {
      health:  { current: Hmax,                        max: Hmax },
      mana:    { current: Math.min(Mmax, manaSafe),    max: Mmax },
      stamina: { current: Math.min(Smax, staminaSafe), max: Smax },
      essence: { current: Math.min(Emax, essenceSafe), max: Emax },
    };
  }

  const manaFloor    = isDay1 ? fracOnly(m1) : 0;
  const staminaFloor = isDay1 ? fracOnly(s1) : 0;
  const essenceFloor = isDay1 ? fracOnly(e1) : 0;

  const Dsum = m1 + s1 + e1;
  const A = Dsum * daysAccrued;
  const R = Math.max(0, A * (1 - Math.max(0, Math.min(1, p))));
  const shares = await getPoolSharesServer(db, uid, pools);
  const addM = R * (shares.mana    || 0);
  const addS = R * (shares.stamina || 0);
  const addE = R * (shares.essence || 0);

  return {
    health:  { current: Hmax,                         max: Hmax },
    mana:    { current: Math.min(Mmax, manaFloor    + addM), max: Mmax },
    stamina: { current: Math.min(Smax, staminaFloor + addS), max: Smax },
    essence: { current: Math.min(Emax, essenceFloor + addE), max: Emax },
  };
}

async function readManualOpeningSummaryServer(db, uid) {
  const snap = await db.doc(`players/${uid}/manualSeed/openingSummary`).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return {
    total: Number(d.totalPrestartDiscretionary || 0),
    manaPct: Number(d.split?.manaPct ?? 0.4),
    staminaPct: Number(d.split?.staminaPct ?? 0.6),
  };
}
async function sumManualItemisedServer(db, uid, windowStart, windowEnd) {
  const qy = db.collection(`players/${uid}/classifiedTransactions`)
    .where('isPrestart','==',true)
    .where('dateMs','>=', windowStart)
    .where('dateMs','<',  windowEnd);
  const snap = await qy.get();
  let Pmana = 0, Pstamina = 0;
  snap.forEach(d => {
    const tx = d.data() || {};
    const amt = Number(tx.amount || 0);
    if (amt >= 0) return;
    const spend = Math.abs(amt);
    const pool  = (tx?.provisionalTag?.pool || tx?.tag?.pool || 'stamina');
    if (pool === 'mana') Pmana += spend; else Pstamina += spend;
  });
  return { Pmana, Pstamina };
}
async function applyManualAdjustmentsServer(db, uid, accelSeed, startMs) {
  const d = new Date(startMs);
  const startMonthStartMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  const summary = await readManualOpeningSummaryServer(db, uid);
  let Pmana = 0, Pstamina = 0;

  if (summary && summary.total > 0) {
    Pmana    += summary.total * (summary.manaPct || 0);
    Pstamina += summary.total * (summary.staminaPct || 0);
  }

  const itemised = await sumManualItemisedServer(db, uid, startMonthStartMs, startMs);
  Pmana    += itemised.Pmana;
  Pstamina += itemised.Pstamina;

  const H0 = accelSeed.health.current;
  const M0 = accelSeed.mana.current;
  const S0 = accelSeed.stamina.current;

  const S1    = Math.max(0, S0 - Pstamina);
  const spill = Math.max(0, Pstamina - S0);
  const M1    = Math.max(0, M0 - (Pmana + spill));

  return {
    health:  { current: H0, max: accelSeed.health.max },
    mana:    { current: M1, max: accelSeed.mana.max },
    stamina: { current: S1, max: accelSeed.stamina.max },
  };
}

async function ensureSeedCarryAndSeedSnapshotServer(db, uid, pools, mode, startMs, existingSeedCarry) {
  if ((existingSeedCarry && Object.keys(existingSeedCarry).length) || mode === 'true') {
    return { seedCarry: existingSeedCarry || {}, seed: null };
  }

  let needsSeeding = false;
  if (mode === 'safe' || mode === 'accelerated') {
    needsSeeding = shouldApplySeedServer(pools);
  } else if (mode === 'manual') {
    needsSeeding = !(await hasPostStartSpendServer(db, uid, startMs));
  }

  if (needsSeeding) {
    let seed = null;
    if (mode === 'manual') {
      const accel = await computeSeedCurrentsAllServer(db, uid, pools, 'accelerated', startMs, { p: 0.6 });
      const manual = await applyManualAdjustmentsServer(db, uid, accel, startMs);
      seed = { ...accel, ...manual, essence: accel.essence };
    } else {
      seed = await computeSeedCurrentsAllServer(db, uid, pools, mode, startMs, { p: 0.6 });
    }
    return { seedCarry: {}, seed };
  }

  const days = await elapsedDaysFromCalcStartServer(db, uid);
  let seedNow = null;
  if (mode === 'manual') {
    const accel = await computeSeedCurrentsAllServer(db, uid, pools, 'accelerated', startMs, { p: 0.6 });
    seedNow = await applyManualAdjustmentsServer(db, uid, accel, startMs);
  } else {
    seedNow = await computeSeedCurrentsAllServer(db, uid, pools, mode, startMs, { p: 0.6 });
  }

  const carry = {};
  for (const k of Object.keys(pools)) {
    const accrued = (pools[k]?.regenCurrent || 0) * days;
    const seedCur = Math.max(0, seedNow?.[k]?.current || 0);
    carry[k] = Math.max(0, accrued - seedCur);
  }
  return { seedCarry: carry, seed: null };
}

async function updateVitalsPoolsServer(db, uid) {
  const currentRef  = db.doc(`players/${uid}/cashflowData/current`);
  const currentSnap = await currentRef.get();
  let existingCarry = (currentSnap.exists && currentSnap.data().seedCarry) || {};

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
  let mode = 'safe';
  if (prof.exists) {
    const d = prof.data() || {};
    const m = String(d.vitalsMode || '').toLowerCase();
    if (['safe','accelerated','manual','true'].includes(m)) mode = m;
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


  let startMs = await ensureStartMsServer(db, uid);
  

  const { seedCarry, seed } =
    await ensureSeedCarryAndSeedSnapshotServer(db, uid, pools, mode, startMs, existingCarry);

  const payload = {
    pools,
    dailyAverages: { dailyDisposable: Number(dailyDisposable.toFixed(2)) },
    daysTracked,
    elapsedDays,
    lastSync: new Date().toISOString(),
    mode,
  };
  if (seedCarry && Object.keys(seedCarry).length) payload.seedCarry = seedCarry;
  if (seed) payload.seed = seed;

  await currentRef.set(payload, { merge: true });
  return payload;
}

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

async function recomputeSummaryServerV1(db, uid) {
  const col = db.collection(`players/${uid}/classifiedTransactions`);
  const snap = await col.where("status","==","confirmed").get();
  const all={health:0,mana:0,stamina:0,essence:0};
  const recent7={health:0,mana:0,stamina:0,essence:0};
  const since7=Date.now()-7*MS_PER_DAY;

  snap.forEach(d=>{
    const tx=d.data()||{};
    const alloc=tx.appliedAllocation||{};
    for(const k of Object.keys(all)) all[k]+=Number(alloc[k]||0);
    const when=tx.lockedAtMs||tx?.tag?.setAtMs||0;
    if(when>=since7){ for(const k of Object.keys(recent7)) recent7[k]+=Number(alloc[k]||0); }
  });

  await db.doc(`players/${uid}/classifiedTransactions/summary`).set({
    historicUsage:roundPools(all),
    recentUsage:roundPools(recent7),
    updatedAt:Date.now(),
  },{merge:true});
}

async function recomputeSummaryServer(db, uid) {
  const col = db.collection(`players/${uid}/classifiedTransactions`);
  const snap = await col.where("status","==","confirmed").get();

  const sumAll = {health:0,mana:0,stamina:0,essence:0};
  const sumAll7 = {health:0,mana:0,stamina:0,essence:0};

  const sumManual = {health:0,mana:0,stamina:0,essence:0};
  const sumManual7 = {health:0,mana:0,stamina:0,essence:0};

  const sumTL = {health:0,mana:0,stamina:0,essence:0};
  const sumTL7 = {health:0,mana:0,stamina:0,essence:0};

  const since7 = Date.now() - 7 * MS_PER_DAY;

  snap.forEach(d => {
    const tx = d.data() || {};
    const alloc = tx.appliedAllocation || {};
    const when = tx.lockedAtMs || tx?.tag?.setAtMs || 0;
    const src = (tx.source || '').toLowerCase();

    // all
    for (const k of Object.keys(sumAll)) sumAll[k] += Number(alloc[k] || 0);
    if (when >= since7) for (const k of Object.keys(sumAll7)) sumAll7[k] += Number(alloc[k] || 0);

    // manual stream = everything NOT from truelayer
    const isTL = (src === 'truelayer');
    const tgt = isTL ? sumTL : sumManual;
    const tgt7 = isTL ? sumTL7 : sumManual7;

    for (const k of Object.keys(tgt)) tgt[k] += Number(alloc[k] || 0);
    if (when >= since7) for (const k of Object.keys(tgt7)) tgt7[k] += Number(alloc[k] || 0);
  });

  await db.doc(`players/${uid}/classifiedTransactions/summary`).set({
    // legacy (unchanged)
    historicUsage: roundPools(sumAll),
    recentUsage:   roundPools(sumAll7),

    // new per-stream fields
    historicUsage_manual:    roundPools(sumManual),
    recentUsage_manual:      roundPools(sumManual7),
    historicUsage_truelayer: roundPools(sumTL),
    recentUsage_truelayer:   roundPools(sumTL7),

    updatedAt: Date.now(),
  }, { merge: true });
}

// -----------------------------------------------------------------------------
// Maintenance: recompute per-stream usage and immediately refresh vitals
// GET .../maintenanceRecomputeUsageAndVitals?uid=USER_ID
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
        updatedAt: Date.now(),
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
  const mode = String(cur.mode || 'safe').toLowerCase();
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
  const seedCarry = cur.seedCarry || {};
  const days = Number(cur.elapsedDays || (await elapsedDaysFromCalcStartServer(db, uid)));
  const carryFor = (pool) => (mode === 'true' ? 0 : Number((seedCarry[pool] || 0)));

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
    const seedCarry     = Number((cur.seedCarry || {}).essence || 0);
    const capMonthly    = regenBaseline * 30;

    const prof = await db.doc(`players/${uid}`).get();
    let startMs = Date.now();
    let mode    = 'safe';
    if (prof.exists) {
      const d = prof.data() || {};
      const raw = d.startDate;
      if (raw && typeof raw.toMillis === 'function') startMs = raw.toMillis();
      else if (raw instanceof Date) startMs = raw.getTime();
      else if (typeof raw === 'number') startMs = raw;

      const m = String(d.vitalsMode || '').toLowerCase();
      if (['safe','accelerated','manual','true'].includes(m)) mode = m;
    }

    if ((mode === 'safe' || mode === 'accelerated') && shouldApplySeedServer(pools)) {
      const seed = await computeSeedCurrentsServer(db, uid, pools, mode, startMs, { p: 0.6 });
      return Math.max(0, Math.min(capMonthly, Number(seed?.essence?.current || 0)));
    } else if (mode === 'manual') {
      const anyPostStart = await hasPostStartSpendServer(db, uid, startMs);
      if (!anyPostStart) {
        const seed = await computeSeedCurrentsServer(db, uid, pools, 'accelerated', startMs, { p: 0.6 });
        return Math.max(0, Math.min(capMonthly, Number(seed?.essence?.current || 0)));
      }
    }

    const days  = await elapsedDaysFromCalcStartServer(db, uid);
    const carry = (mode === 'true') ? 0 : seedCarry;
    const T = Math.max(0, regenCurrent * days - (spentToDate + carry));

    const r = capMonthly > 0 ? ((T % capMonthly) + capMonthly) % capMonthly : 0;
    return Math.max(0, r);
  } catch (e) {
    console.error('readAvailableEssenceMonthly error:', e);
    return 0;
  }
}
