import { getDb } from '../utils/firebase.js';
import 'dotenv/config';

async function main() {
  const db = getDb();
  const email = process.env.SEED_EMAIL;

  const snaps = await db.collection('players').where('email', '==', email).get();
  for (const doc of snaps.docs) {
    const uid = doc.id;
    // delete subcollections (transactions, vitals)
    const txCol = db.collection('players').doc(uid).collection('transactions');
    const txs = await txCol.get();
    for (const t of txs.docs) await t.ref.delete();

    const vitCol = db.collection('players').doc(uid).collection('vitals');
    const vits = await vitCol.get();
    for (const v of vits.docs) await v.ref.delete();

    await db.collection('players').doc(uid).delete();
    console.log('Deleted player', uid);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
