import { test, expect } from './fixtures';
import { stubTransactions } from './truelayer.stub';

const EMAIL = process.env.SEED_EMAIL!;
const PASSWORD = process.env.SEED_PASSWORD!;

// A clickable end-to-end that runs through your main player journey
// Includes TL stubbing and quick vitals view assertions

test('journey: TL sync → vitals update → log shows entries', async ({ page }) => {
  await page.goto('/auth.html');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.locator('#splash')).toBeHidden({ timeout: 12_000 });
  await expect(page.locator('#vitalsHUD')).toBeVisible();

  // Stub TL transactions before opening the sync
  await stubTransactions(page, { count: 5 });

  // Open Insights panel (replace with your actual control)
  await page.keyboard.press('KeyI');
  const refresh = page.getByRole('button', { name: /refresh bank data/i });
  if (await refresh.isVisible()) {
    await refresh.click();
  }

  // Validate Update Log reflects imported entries
  const log = page.locator('#updateLog');
  await expect(log).toBeVisible();
  const items = log.locator('.log-item');
  await expect(items).toHaveCount(5);

  // Mode engravings row + totals
  await expect(page.locator('#modeEngravings')).toBeVisible();
  await expect(page.locator('#vitalsTotals')).toBeVisible();
});
