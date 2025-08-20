const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');

// Firebase + secrets
admin.initializeApp();
const db = admin.firestore();

// 🔒 Secure secrets stored via Firebase CLI (.env)
const TRUELAYER_CLIENT_ID = defineSecret('TRUELAYER_CLIENT_ID');
const TRUELAYER_CLIENT_SECRET = defineSecret('TRUELAYER_CLIENT_SECRET');

// Allow cross-origin for local testing
const corsHandler = cors({ origin: true });

/**
 * =====================
 *  TOKEN EXCHANGE
 * =====================
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
      params.append('redirect_uri', redirect_uri); // must exactly match authorize
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
      });

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
 * =====================
 *  GENERIC FETCH (GLOBAL)
 * =====================
 */
const fetchFromTrueLayer = async (uid, urlPath, storeKey) => {
  console.log(`[${storeKey}] Starting fetch for UID: ${uid}`);

  const tokenSnap = await db.doc(`players/${uid}/financialData_TRUELAYER/token`).get();
  const token = tokenSnap.exists ? tokenSnap.data().access_token : null;

  if (!token) throw new Error('No access token found for user.');

  const apiUrl = `https://api.truelayer-sandbox.com${urlPath}`;
  console.log(`[${storeKey}] Calling API: ${apiUrl}`);
  console.log(`[${storeKey}] Using Token: ${token.slice(0, 6)}...${token.slice(-4)}`);

  const response = await axios.get(apiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[${storeKey}] Response status: ${response.status}`);

  await db.doc(`players/${uid}/financialData_TRUELAYER/${storeKey}`).set({
    data: response.data,
    lastUpdated: Date.now(),
  });

  return response.data;
};

const createFetchFunction = (path, key) =>
  onRequest({ region: 'europe-west2' }, async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'Missing UID' });

        console.log(`[${key}] Function triggered for UID: ${uid}`);
        const data = await fetchFromTrueLayer(uid, path, key);

        res.status(200).json({ success: true, data });
      } catch (err) {
        console.error(`[${key}] Fetch failed:`, err.response?.data || err.message);
        res.status(500).json({ error: 'Fetch failed', details: err.message });
      }
    });
  });

/**
 * =====================
 *  ACCOUNT-SPECIFIC FETCH
 * =====================
 */
const fetchPerAccount = async (uid, subPath, storeKey) => {
  console.log(`[${storeKey}] Fetching account-specific data for UID: ${uid}`);

  const tokenSnap = await db.doc(`players/${uid}/financialData_TRUELAYER/token`).get();
  const token = tokenSnap.exists ? tokenSnap.data().access_token : null;
  if (!token) throw new Error('No access token found.');

  // Get all accounts first
  const accountsRes = await axios.get(
    `https://api.truelayer-sandbox.com/data/v1/accounts`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const results = {};
  for (const acc of accountsRes.data.results) {
    const accId = acc.account_id;
    const fullPath = `https://api.truelayer-sandbox.com/data/v1/accounts/${accId}/${subPath}`;
    console.log(`[${storeKey}] Fetching ${subPath} for account ${accId}`);

    try {
      const res = await axios.get(fullPath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      results[accId] = res.data.results || [];
    } catch (err) {
      console.warn(`[${storeKey}] Failed for account ${accId}:`, err.response?.data || err.message);
      results[accId] = [];
    }
  }

  await db.doc(`players/${uid}/financialData_TRUELAYER/${storeKey}`).set({
    data: results,
    lastUpdated: Date.now(),
  });

  return results;
};

const createPerAccountFunction = (subPath, key) =>
  onRequest({ region: 'europe-west2' }, async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'Missing UID' });

        const data = await fetchPerAccount(uid, subPath, key);
        res.status(200).json({ success: true, data });
      } catch (err) {
        console.error(`[${key}] Fetch failed:`, err.response?.data || err.message);
        res.status(500).json({ error: 'Fetch failed', details: err.message });
      }
    });
  });

/**
 * =====================
 *  EXPORTS
 * =====================
 */
exports.fetchAccounts = createFetchFunction('/data/v1/accounts', 'accounts');
exports.fetchCards = createFetchFunction('/data/v1/cards', 'cards');

exports.fetchTransactions = createPerAccountFunction('transactions', 'transactions');
exports.fetchDirectDebits = createPerAccountFunction('direct_debits', 'direct_debits');
exports.fetchStandingOrders = createPerAccountFunction('standing_orders', 'standing_orders');

// 🧪 TEMP DEBUG (remove later)
exports.testPing = onRequest({ region: 'europe-west2' }, (req, res) => {
  res.send('Backend running fine!');
});

// =============================================================================
// Contributions settlement (Stripe webhook + Admin callable for manual bank)
// =============================================================================
const { onRequest, onCall } = require('firebase-functions/v2/https');
const { defineSecret: defineSecret_ } = require('firebase-functions/params'); // alias only to be explicit
const Stripe = require('stripe');

// Secrets (keep consistent with your TrueLayer approach)
const STRIPE_SECRET = defineSecret_('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret_('STRIPE_WEBHOOK_SECRET');

// Helper: number coercion
const toNum = (x, d = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
};

// Read altruism multiplier from Firestore (with env override)
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

/**
 * Idempotent settlement inside a Firestore transaction:
 * - Writes a confirmed spend in classifiedTransactions (negative amount, pool: essence)
 * - Increments players/{uid}/stats.altruismPoints by amount*multiplier
 * - Sets players/{uid}/contributions/{contributionId} to status="succeeded"
 * - Bumps players/{uid}/classifiedTransactions/summary.historicUsage.essence
 */
async function settleContributionTx(db, {
  uid,
  contributionId,   // document id in players/{uid}/contributions
  amountGBP,        // number (major units)
  provider,         // 'stripe' | 'manual_bank' | 'truelayer'
  providerRef = null
}) {
  const contribRef   = db.doc(`players/${uid}/contributions/${contributionId}`);
  const statsRef     = db.doc(`players/${uid}/stats`);
  const summaryRef   = db.doc(`players/${uid}/classifiedTransactions/summary`);
  const classifiedId = `contrib_${contributionId}`;
  const classifiedRef= db.doc(`players/${uid}/classifiedTransactions/${classifiedId}`);

  const multiplier   = await readAltruismMultiplier(db);
  const awardPts     = Math.round(toNum(amountGBP, 0) * multiplier);
  const now = Date.now();

  await db.runTransaction(async (trx) => {
    const cSnap = await trx.get(contribRef);
    if (!cSnap.exists) {
      throw new Error(`Contribution ${contributionId} not found for ${uid}`);
    }
    const c = cSnap.data() || {};
    const status = c.status || 'pending';

    // Idempotent
    if (status === 'succeeded') return;

    // Prefer amount stored on doc; fallback to provided
    const docAmount = c.amountGBP != null ? Number(c.amountGBP) : null;
    const finalAmount = docAmount == null ? toNum(amountGBP, 0) : toNum(docAmount, 0);
    if (!(finalAmount > 0)) throw new Error('Contribution amount must be > 0');

    // 1) Classified transaction (confirmed essence spend)
    const classified = {
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
    };
    trx.set(classifiedRef, classified, { merge: true });

    // 2) Award altruism points
    trx.set(statsRef, {
      altruismPoints: admin.firestore.FieldValue.increment(awardPts)
    }, { merge: true });

    // 3) Mark contribution succeeded
    trx.set(contribRef, {
      amountGBP: finalAmount,
      provider,
      providerRef: providerRef || null,
      status: 'succeeded',
      settledAtMs: now,
      awardedPoints: awardPts
    }, { merge: true });

    // 4) Bump historicUsage.essence so HUD stays in sync
    const sumSnap = await trx.get(summaryRef);
    const historicUsage = (sumSnap.exists && sumSnap.data().historicUsage) || { health:0, mana:0, stamina:0, essence:0 };
    historicUsage.essence = toNum(historicUsage.essence) + Math.abs(finalAmount);
    trx.set(summaryRef, { historicUsage, updatedAt: now }, { merge: true });
  });
}

// -----------------------------------------------------------------------------
// Stripe Webhook (v2 onRequest) — set secrets in console/CLI.
// NOTE: do NOT JSON.parse the body; use req.rawBody for signature verification.
// -----------------------------------------------------------------------------
exports.stripeWebhook = onRequest({
  region: 'europe-west2',
  secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
  // No CORS needed; Stripe posts server→server. Leave body as-is for signature.
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

      // amount_total is in minor units
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

// -----------------------------------------------------------------------------
// Admin callable to settle MANUAL bank transfers.
// Security: require auth with custom claim { admin: true }.
// -----------------------------------------------------------------------------
exports.markManualContributionReceived = onCall({
  region: 'europe-west2',
}, async (req) => {
  const ctx = req.auth;
  if (!ctx?.token?.admin) {
    throw new Error('Permission denied: admin only.');
  }
  const { uid, contributionId, amountGBP, providerRef } = req.data || {};
  if (!uid || !contributionId) {
    throw new Error('uid and contributionId are required');
  }

  await settleContributionTx(db, {
    uid,
    contributionId,
    amountGBP,                      // optional if already on doc
    provider: 'manual_bank',
    providerRef: providerRef || null
  });

  return { ok: true };
});

