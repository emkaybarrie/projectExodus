import { test as base } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    // Route TrueLayer calls and stub if needed
    await context.route('**/truelayer/**', async route => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accounts: [{ account_id: 'acct_001', display_name: 'Seeded Account' }] })
      });
    });
    await use(context);
  }
});

export const expect = test.expect;
