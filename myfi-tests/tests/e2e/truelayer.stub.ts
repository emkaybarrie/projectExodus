// Optional per-spec stub helpers (extend as you wire more endpoints)
export function stubTransactions(page: any, { count = 8 } = {}) {
  return page.route('**/truelayer/transactions**', (route: any) => {
    const now = Date.now();
    const list = Array.from({ length: count }, (_, i) => ({
      transaction_id: `tl_${i}_${now}`,
      amount: Math.round((Math.random() * 40 + 5) * 100) / 100,
      currency: 'GBP',
      timestamp: new Date(now - i * 86_400_000).toISOString(),
      merchant_name: i % 2 ? 'Grocer' : 'Fuel'
    }));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: list }) });
  });
}
