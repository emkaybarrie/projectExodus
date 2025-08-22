// Factories to generate consistent test data snapshots
export function buildPlayer({ uid, alias = 'Test Pilot' }) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    uid,
    alias,
    email: process.env.SEED_EMAIL,
    level: 1,
    startDate: startDate.toISOString(),
    vitalsStartDate: startDate.toISOString(),
    vitalsMode: 'daily',
    essenceBalance: 0
  };
}

export function buildTransactions({ accountId, count = 6 }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `txn_${i}_${Date.now()}`,
      accountId,
      amount: Math.round((Math.random() * 40 + 5) * 100) / 100,
      currency: 'GBP',
      category: i % 2 ? 'stamina' : 'mana',
      source: 'seed',
      ts: new Date(Date.now() - i * 86_400_000).toISOString()
    });
  }
  return out;
}

export function buildVitalsBaseline() {
  return {
    stamina: { regenBaseline: 20, spentToDate: 0 },
    mana: { regenBaseline: 15, spentToDate: 0 },
    health: { regenBaseline: 10, spentToDate: 0 },
    essence: { regenBaseline: 2, spentToDate: 0 }
  };
}
