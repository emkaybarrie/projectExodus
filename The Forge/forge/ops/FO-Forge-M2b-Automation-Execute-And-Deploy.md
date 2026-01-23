# WORK ORDER: FO-Forge-M2b-Automation-Execute-And-Deploy

Status: Executed
Executed: 2026-01-23
Executor: Claude (Opus 4.5)
Director Approval: Approved as written

---

## Task ID
FO-Forge-M2b-Automation-Execute-And-Deploy

## Task Type
implementation (automation)

## Intent Statement
Enable phone-first operation: Work Orders created via GitHub Issues and executed by repo-aware agent, with Pages deployment and Share Pack refresh automated.

## Scope of Work
A) GitHub Pages deployment (Portal live)
B) Share Pack auto-refresh (no stale packs)
C) Work Order execution trigger (phone UX)

## Locked Decisions Applied
- Branch: `main` is source of truth
- Pages deployment: GitHub Actions → `actions/deploy-pages`
- Execution trigger: issue_comment containing `/execute` AND issue has label `approved`

---

## Deliverables

### 1. Share Pack Generator Script
**File:** `The Forge/forge/ops/scripts/refresh-share-pack.mjs`

Features:
- Curated file list (Forge core, MyFi truth, specs, Work Orders)
- Directory and file copy support
- SHARE_PACK.md index generation
- SHA256 signature for pack verification
- Missing file handling (non-fatal)

### 2. Pages Deploy Workflow
**File:** `.github/workflows/forge-portal-pages.yml`

Triggers:
- Push to `main` branch
- Changes to `The Forge/forge/portal/**`

Actions:
- Checkout → Configure Pages → Upload artifact → Deploy

### 3. Share Pack Refresh Workflow
**File:** `.github/workflows/forge-share-pack-refresh.yml`

Triggers:
- Push to `main` branch
- Changes to `The Forge/forge/**` or `The Forge/myfi/**`

Actions:
- Checkout → Setup Node 20 → Run refresh script → Commit if changed

### 4. Work Order Execution Workflow
**File:** `.github/workflows/forge-wo-execute.yml`

Triggers:
- Issue comment containing `/execute`

Gates:
- Actor must have write/admin/maintain permission
- Issue must have `approved` label

Actions:
- Extract WO from issue body
- Acknowledge execution start (comment)
- Execute (placeholder - ready for Claude action integration)
- Report status (comment)

### 5. Labels Required Note
**File:** `The Forge/forge/ops/LABELS_REQUIRED.md`

Documents required labels:
- `approved` (must create manually)
- `work-order` (auto-created by template)
- `pending-approval` (auto-created by template)

---

## Post-Execution Setup Required

### 1. Create Labels
Go to https://github.com/emkaybarrie/projectExodus/labels and create:
- `approved` (green, #0e8a16)

### 2. Enable GitHub Pages
Go to Repository Settings → Pages:
- Source: GitHub Actions
- (No branch selection needed - workflow handles it)

### 3. Add Secrets (for full executor)
Go to Repository Settings → Secrets → Actions:
- `ANTHROPIC_API_KEY` (when Claude action is integrated)

### 4. Test Workflows
After merge to main:
- Pages: Check Actions tab, then visit Pages URL
- Share Pack: Check if exports/share-pack updated
- WO Execute: Create test issue, add `approved`, comment `/execute`

---

## Files Created

| File | Purpose |
|------|---------|
| `The Forge/forge/ops/scripts/refresh-share-pack.mjs` | Share Pack generator |
| `.github/workflows/forge-portal-pages.yml` | Pages deployment |
| `.github/workflows/forge-share-pack-refresh.yml` | Share Pack auto-refresh |
| `.github/workflows/forge-wo-execute.yml` | WO execution trigger |
| `The Forge/forge/ops/LABELS_REQUIRED.md` | Labels setup guide |

---

## Review & Reflection Notes
- All automation files created per WO spec
- Executor is placeholder-ready for Claude action integration
- No changes to MyFi canonical codebase (as required)
- Workflows are idempotent and deterministic
- Labels note provides clear Director action items

End of Work Order.
