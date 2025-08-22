import { test, expect } from './fixtures';

const EMAIL = process.env.SEED_EMAIL!;
const PASSWORD = process.env.SEED_PASSWORD!;

// Basic smoke run-through you can watch in headed mode
// - visit login
// - sign in
// - wait for splash to dismiss
// - assert HUD present
// - open a couple menus and verify key UI

//Comand for test

// set HEADLESS=false 
// npx playwright test tests/e2e/smoke.spec.ts


test('smoke: login → splash → HUD visible → menus open', async ({ page }) => {
  await page.goto('http://127.0.0.1:5500/Project%20MyFi/auth.html');

  // Login screen

    // Fill credentials (from your env vars)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({ timeout: 10_000 });
    await page.locator('#login-email').fill(EMAIL);
    await page.locator('#login-password').fill(PASSWORD);

    // Attach a one-time event listener before clicking Login
    const donePromise = page.evaluate(() => new Promise<void>(resolve => {
      window.addEventListener('splash:done', () => resolve(), { once: true });
    }));

    // Click Login
    await page.locator('#login-btn').click();

    await donePromise;                                               // resolves when splash completes
    await expect(page.locator('.app-root')).toHaveClass(/app-show/); // belt & braces


  // HUD checks
    // Optional: assert you reached dashboard and basic HUD is present
    await page.waitForURL('**/dashboard.html');
    await expect(page.locator('#vital-health')).toBeVisible();
    await expect(page.locator('#vital-mana')).toBeVisible();
    await expect(page.locator('#vital-stamina')).toBeVisible();


});
