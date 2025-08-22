import 'dotenv/config';
import { getDb } from '../utils/firebase.js';
import { buildPlayer, buildTransactions, buildVitalsBaseline } from '../utils/dataBuilders.js';

async function seedAuthUser() {
  const useEmu = String(process.env.USE_EMULATORS).toLowerCase() === 'true';
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;

  if (!useEmu) {
    console.log('Skipping Auth seeding for live project. Create the test user manually or wire Admin Auth if needed.');
    return { uid: 'manual-uid' };
  }

  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const url = `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error('Auth seed failed: ' + JSON.stringify(json));
  return { uid: json.localId };
}

async function main() {
  const db = getDb();
  const { uid } = await seedAuthUser();

  const player = buildPlayer({ uid });
  const vitals = buildVitalsBaseline();
  const txns = buildTransactions({ accountId: 'acct_001', count: 8 });

  const playersRef = db.collection('players').doc(uid);
  await playersRef.set(player);
  await playersRef.collection('vitals').doc('baseline').set(vitals);

  const txCol = db.collection('players').doc(uid).collection('transactions');
  const batch = db.batch();
  txns.forEach(t => batch.set(txCol.doc(t.id), t));
  await batch.commit();

  console.log('Seed complete for uid:', uid);
}

main().catch(err => { console.error(err); process.exit(1); });
