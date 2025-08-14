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
