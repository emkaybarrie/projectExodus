# MyFi Tests

## Prereqs
- Node 18+
- (Recommended) Firebase Emulators running for Firestore + Auth
- Your app running locally (set BASE_URL in `.env`)

## 1) Install

```bash
cd myfi-tests
cp .env.example .env
# edit .env to set BASE_URL and other values
npm i      # or pnpm i / yarn
npm run prep   # installs Playwright browsers
```

## 2) Seed data

```bash
npm run seed
```

This creates a test user (when using emulators) and seeds Firestore with a player, vitals baseline, and sample transactions.

## 3) Run unit tests

```bash
npm test
```

## 4) Run E2E (headless)

```bash
npm run e2e
```

## 5) Run E2E (headed you can watch)

```bash
npm run e2e:headed
```

See `playwright-report/` for HTML report, video, and traces.

## 6) Cleanup

```bash
npm run cleanup
```

## Notes
- `tests/e2e/fixtures.ts` intercepts `**/truelayer/**` URLs—align this to your actual endpoints or turn off if you want real calls.
- If your app exposes keyboard shortcuts, update the tests to click visible buttons instead for robustness.
- To target production for pre‑deploy checks, set `USE_EMULATORS=false` and provide a limited **testing** project + service account.
