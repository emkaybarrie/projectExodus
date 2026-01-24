# Work Order: FO-Forge-M2c1-Portal-Data-Source-Fix-And-Index-Guarantee

**Status:** Executed
**Type:** fix
**Created:** 2026-01-23
**Executed:** 2026-01-23

---

## Intent

Portal relies on JSON indices from Share Pack. When opened locally or via GitHub Pages, the original `raw.githubusercontent.com` URLs fail (CORS for local, timing for Pages). Fix the data source to work in both environments and provide graceful error handling when indices are missing.

## Scope

- `The Forge/forge/portal/app.js` — data loading logic
- `The Forge/forge/portal/styles.css` — error display styling
- `The Forge/forge/portal/README.md` — local test instructions

## Changes Made

### 1. Relative URL Resolution (app.js)

Replaced hardcoded `raw.githubusercontent.com` URLs with relative path resolution using `import.meta.url`:

```javascript
// Before
const SHARE_PACK_BASE = 'https://raw.githubusercontent.com/.../share-pack';

// After
const SHARE_PACK_BASE = new URL('../exports/share-pack/', import.meta.url).href.replace(/\/$/, '');
```

This works for:
- **Local (Live Server)**: Resolves to `http://localhost:5500/The%20Forge/forge/exports/share-pack`
- **GitHub Pages**: Resolves to `https://<user>.github.io/projectExodus/The%20Forge/forge/exports/share-pack`

### 2. Graceful Error Handling (app.js)

Added `errorDetails` to state and improved `loadData()` to provide actionable instructions when indices are missing:

```javascript
if (!sharePack && !workOrders) {
  state.error = 'Share Pack indices not found.';
  state.errorDetails = `Looking for JSON at: ${SHARE_PACK_BASE}/

To generate indices, run from repo root:
  node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"

Then refresh this page.`;
}
```

### 3. Error Details Styling (styles.css)

Added `.error-details` class for monospace, pre-wrapped display of technical error information.

### 4. README Updates

Added "Step 1: Generate JSON Indices" to Local Development section with exact commands.

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Local (Live Server) opens without 404s | Ready (requires index generation) |
| GitHub Pages loads Work Orders list | Ready (after merge + workflow run) |
| Missing indices show helpful error | Implemented |

## Director Action Required

Before testing locally, generate the JSON indices:

```bash
cd "c:/Users/Azakai/Documents/GitHub/projectExodus"
node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"
```

Then open the portal via Live Server or another static file server.

## Locked Decisions

1. Portal uses `import.meta.url` for relative path resolution (no hardcoded domains)
2. Error state includes `errorDetails` for developer-friendly debugging
3. README documents index generation as Step 1 of local development

---

**Signed:** Claude (Architect)
**Work Order:** FO-Forge-M2c1-Portal-Data-Source-Fix-And-Index-Guarantee
