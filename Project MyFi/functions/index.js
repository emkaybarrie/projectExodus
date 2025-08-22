const { onRequest, onCall } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const Stripe = require('stripe');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

// Firebase + secrets
admin.initializeApp();
const db = admin.firestore();

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

// Secrets
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

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
  const statsRef     = db.doc(`players/${uid}`);
  const summaryRef   = db.doc(`players/${uid}/classifiedTransactions/summary`);
  const classifiedId = `contrib_${contributionId}`;
  const classifiedRef= db.doc(`players/${uid}/classifiedTransactions/${classifiedId}`);

  const multiplier   = await readAltruismMultiplier(db);
  const awardPts     = Math.round(toNum(amountGBP, 0) * multiplier);
  const now = Date.now();

  await db.runTransaction(async (trx) => {
    // READS FIRST -------------------------------------------------------------
    const [cSnap, sumSnap] = await Promise.all([
      trx.get(contribRef),   // read contribution
      trx.get(summaryRef),   // read summary
    ]);

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

    // Compute summary baseline from the read snapshot (no more reads later)
    const historicUsage = (sumSnap.exists && sumSnap.data().historicUsage) || {
      health: 0, mana: 0, stamina: 0, essence: 0
    };

    // WRITES AFTER ALL READS ---------------------------------------------------
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
    trx.set(
      statsRef,
      { 'avatarData':{'altruismPoints': admin.firestore.FieldValue.increment(awardPts)} },
      { merge: true }
    );

    // 3) Mark contribution succeeded
    trx.set(contribRef, {
      amountGBP: finalAmount,
      provider,
      providerRef: providerRef || null,
      status: 'succeeded',
      settledAtMs: now,
      awardedPoints: awardPts
    }, { merge: true });

    // 4) Update summary using the pre-read snapshot
    historicUsage.essence = toNum(historicUsage.essence) + Math.abs(finalAmount);
    trx.set(summaryRef, { historicUsage, updatedAt: now }, { merge: true });
  });

}

// -----------------------------------------------------------------------------
// Stripe Webhook
// -----------------------------------------------------------------------------
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

// =============================================================================
// Parity helpers with vitals.js — calc-start + seedCarry (server-side)
// =============================================================================
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
  } catch {
    return false;
  }
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
  const A  = (m1 + s1 + e1) * daysAccrued;                       // accrued discretionary since calc-start
  const R  = Math.max(0, A * (1 - Math.max(0, Math.min(1, p)))); // remaining to split
  const sh = await getPoolSharesServer(db, uid, pools);
  const addE = R * (sh.essence || 0);

  const essenceCur = Math.min(Emax, essenceFloor + addE);
  return { essence: { current: Math.max(0, essenceCur), max: Emax } };
}

// -----------------------------------------------------------------------------
// Create Stripe Checkout Session (callable)
//   * Server-side guard mirrors client: blocks > available (not just cap)
// -----------------------------------------------------------------------------
async function readAvailableEssenceMonthly(db, uid) {
  try {
    // current pools (regen/spent + calculated carry)
    const curSnap = await db.doc(`players/${uid}/cashflowData/current`).get();
    const cur   = curSnap.exists ? (curSnap.data() || {}) : {};
    const pools = cur.pools || {};
    const ePool = pools.essence || {};

    const regenBaseline = Number(ePool.regenBaseline || 0);
    const regenCurrent  = Number(ePool.regenCurrent  || regenBaseline);
    const spentToDate   = Number(ePool.spentToDate   || 0);
    const seedCarry     = Number((cur.seedCarry || {}).essence || 0);
    const capMonthly    = regenBaseline * 30;

    // player mode + startDate
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

    // seeding parity (safe/accelerated), or manual with no confirmed post-start spend
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

    // truth path = regenCurrent * elapsedDaysFromCalcStart − (spentToDate + carry)
    const days  = await elapsedDaysFromCalcStartServer(db, uid);
    const carry = (mode === 'true') ? 0 : seedCarry;
    const T = Math.max(0, regenCurrent * days - (spentToDate + carry));

    // monthly wrap remainder (non-negative)
    const r = capMonthly > 0 ? ((T % capMonthly) + capMonthly) % capMonthly : 0;
    return Math.max(0, r);
  } catch (e) {
    console.error('readAvailableEssenceMonthly error:', e);
    return 0;
  }
}

exports.createContributionCheckout = onCall({
  region: 'europe-west2',
  secrets: [STRIPE_SECRET],
}, async (req) => {
  const ctx = req.auth;
  if (!ctx || !ctx.uid) {
    throw new Error('Not authenticated');
  }
  const uid = ctx.uid;

  const rawAmount = Number(req.data?.amountGBP || 0);
  if (!(rawAmount > 0)) {
    throw new Error('Amount must be > 0');
  }

  // Clamp server-side to *available* (mirrors client logic)
  const available = await readAvailableEssenceMonthly(db, uid);
  const amountGBP = Math.min(rawAmount, available);
  if (amountGBP <= 0) {
    throw new Error('Insufficient available Essence for contribution');
  }

  // Create pending contribution doc
  const contributionId = `c_${Date.now()}`;
  await db.doc(`players/${uid}/contributions/${contributionId}`).set({
    amountGBP: amountGBP,
    essenceCost: amountGBP,   // 1:1 for now
    provider: 'stripe',
    providerRef: null,
    status: 'pending',
    createdAtMs: Date.now(),
  }, { merge: true });

  // Create Checkout Session
  const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: '2024-06-20' });

  // Prefer explicit returnUrl from client (must be same origin for safety)
  let successUrl, cancelUrl;
  const clientReturn = String(req.data?.returnUrl || '').trim();
  if (clientReturn) {
    const refHeader = req.rawRequest?.headers?.referer || clientReturn;
    const ref = new URL(refHeader);
    const ret = new URL(clientReturn, ref.origin);
    // lock to same origin as referer to prevent open-redirects
    if (ret.origin === ref.origin) {
      successUrl = ret.toString();
      cancelUrl  = ret.toString();
    }
  }
  if (!successUrl) {
    // Fallback to referer path if client didn’t provide one
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
        unit_amount: Math.round(amountGBP * 100), // pence
      },
      quantity: 1,
    }],
    metadata: { uid, contributionId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url, contributionId };
});

// When ops confirm a manual-bank contribution (by setting opsConfirmedAtMs),
// settle it (idempotent). Do NOT use settledAtMs as the trigger.
exports.onManualContributionOpsConfirm = onDocumentUpdated({
  region: 'europe-west2',
  document: 'players/{uid}/contributions/{contributionId}',
}, async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!after) return;

  // Only manual-bank path
  if ((after.provider || '') !== 'manual_bank') return;

  // Fire once when opsConfirmedAtMs flips from falsy → truthy
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
