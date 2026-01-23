# WORK ORDER: FO-Forge-M2c-Portal-Live-Truth-And-Issues-UX

Status: Executed
Executed: 2026-01-23
Executor: Claude (Opus 4.5)
Director Approval: Approved as written

---

## Task ID
FO-Forge-M2c-Portal-Live-Truth-And-Issues-UX

## Task Type
implementation

## Intent Statement
Make Forge Portal operational as a mobile control room by reading live Share Pack artifacts and providing seamless GitHub Issue workflows (create/approve/execute).

## Scope of Work
1. Extend share-pack generator for JSON exports
2. Add work-orders.index.json generation
3. Build Portal JavaScript module for data loading and screens
4. Add Work Orders screen with filter chips
5. Add Create WO wizard with prefill + clipboard fallback
6. Add Execute affordance (copy + deep link)

## Locked Decisions Applied
1. Share Pack truth is machine-readable JSON first, markdown second
2. Portal does not depend on GitHub API for Phase 1
3. Issue creation uses querystring prefill + clipboard fallback

---

## Deliverables

### 1. Extended Share Pack Generator
**File:** `The Forge/forge/ops/scripts/refresh-share-pack.mjs`

New outputs:
- `share-pack.index.json`: timestamp, commit SHA, file hashes, headlines
- `work-orders.index.json`: WO list with id, title, status, dates, repo URLs

Features:
- Git commit SHA extraction
- Headlines extraction from Kernel and Product State
- Work Order parsing with status detection
- Per-file SHA256 hashes

### 2. Portal Application Module
**File:** `The Forge/forge/portal/app.js`

Features:
- Data loading from Share Pack JSON indices
- Screen navigation (dashboard, work-orders, create-wo)
- Work Orders filtering by status
- Create WO wizard with form handling
- Execute affordance (clipboard + deep link)
- Toast notifications
- Loading and error states

### 3. Updated Portal HTML
**File:** `The Forge/forge/portal/index.html`

Changes:
- Simplified to shell structure
- Dynamic content area for app.js rendering
- Loads app.js module
- Version bumped to v2.0

### 4. Extended Portal Styles
**File:** `The Forge/forge/portal/styles.css`

New components:
- Loading spinner and state
- Error state
- Button variants (primary, secondary, back)
- Filter chips
- Work Order items with status badges
- Create WO form styles
- Toast notifications

### 5. Updated Portal README
**File:** `The Forge/forge/portal/README.md`

Documented:
- All M2c features
- Data sources
- Locked decisions

---

## JSON Index Schemas

### share-pack.index.json
```json
{
  "generated": "ISO timestamp",
  "commit": "full SHA",
  "commitShort": "short SHA",
  "headlines": {
    "kernelVersion": "string",
    "myfiLastUpdated": "date",
    "myfiWorkOrders": "string"
  },
  "files": [
    { "path": "string", "hash": "SHA256", "size": "number", "modified": "ISO" }
  ],
  "missing": ["string"],
  "signature": "12-char SHA256"
}
```

### work-orders.index.json
```json
{
  "generated": "ISO timestamp",
  "commit": "short SHA",
  "workOrders": [
    {
      "id": "filename without .md",
      "title": "parsed title",
      "status": "draft|pending-approval|approved|executed",
      "lastUpdated": "ISO timestamp",
      "filePath": "relative path",
      "repoUrl": "GitHub blob URL"
    }
  ],
  "counts": {
    "total": "number",
    "draft": "number",
    "pendingApproval": "number",
    "approved": "number",
    "executed": "number"
  }
}
```

---

## UX Flows

### Create Work Order
1. User taps "Create Work Order" on dashboard
2. Form appears with Task ID, Type, Intent, Scope fields
3. User fills minimal fields
4. "Create Issue" opens GitHub with prefilled Issue Form URL
5. If popup blocked: "Copy to Clipboard" copies issue body markdown
6. Toast confirms action

### Execute Work Order
1. User navigates to Work Orders screen
2. Filters by "Approved" status
3. Taps "Execute" button on approved WO
4. "/execute" copied to clipboard
5. Opens GitHub issues filtered by work-order + approved labels
6. User pastes comment manually

---

## Success Criteria Met

- [x] Portal loads on phone and shows latest Share Pack + timestamp + commit
- [x] Portal shows list of WOs from index with filter chips
- [x] "Create WO" produces issue draft flow with clipboard fallback
- [x] "Execute" affordance works as copy + deep link
- [x] Share Pack refresh workflow produces JSON indices

---

## Review & Reflection Notes
- Clean separation: generator produces JSON, Portal consumes it
- No GitHub API auth needed for Phase 1
- Clipboard fallback handles mobile browser quirks
- Toast notifications provide immediate feedback
- Ready for future GitHub API integration (Phase 2)

End of Work Order.
