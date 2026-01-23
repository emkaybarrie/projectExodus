# WORK ORDER: FO-Forge-S1-DevMain-Branching-And-Pages-Discipline

**Status:** Executed
**Type:** implementation (repo governance + CI)
**Created:** 2026-01-23
**Executed:** 2026-01-23
**Executor:** Claude (Opus 4.5)

---

## Intent Statement

Make `dev` the daily coding branch and `main` the production/deploy branch, with GitHub Pages served from `main` only and a clear Forge-compliant workflow supporting phone-first governance.

---

## Deliverables Created

| Deliverable | Path | Status |
|-------------|------|--------|
| Audit Report | `The Forge/forge/ops/reports/BRANCH_PAGES_AUDIT.md` | ✅ |
| Dev Validation Workflow | `.github/workflows/forge-dev-validate.yml` | ✅ |
| PR Preview Workflow | `.github/workflows/forge-portal-preview.yml` | ✅ |
| Updated Pages Workflow | `.github/workflows/forge-portal-pages.yml` | ✅ |
| Branching Playbook | `The Forge/forge/ops/BRANCHING_PLAYBOOK.md` | ✅ |
| Director Actions Guide | `The Forge/forge/ops/DIRECTOR_ACTIONS_BRANCH_RULES.md` | ✅ |

---

## Implementation Summary

### Workflow Architecture

```
dev (daily work)
  │
  ├─ push → forge-dev-validate.yml
  │         ├─ Generate Share Pack (validation)
  │         ├─ Validate JSON syntax
  │         ├─ Check Portal files
  │         └─ Upload artifacts
  │
  └─ PR to main → forge-portal-preview.yml
                  ├─ Build preview artifact
                  ├─ Post PR comment with instructions
                  └─ (Optional) Deploy to preview environment

main (after merge)
  │
  └─ push → forge-portal-pages.yml
            ├─ Generate Share Pack (fresh)
            ├─ Validate indices exist
            └─ Deploy to GitHub Pages
```

### Preview Approach: Option B Implemented

GitHub Pages does not natively support per-PR preview URLs. Implemented Option B:

1. **PR Preview Workflow** creates downloadable artifact
2. **Bot comment** posts instructions for local testing
3. **Optional workflow_dispatch** for manual preview deploy

This approach:
- Requires no external services
- Works with phone testing (via local network)
- Keeps prod URL stable

---

## Pages URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://emkaybarrie.github.io/projectExodus/` |
| **Portal (Prod)** | `https://emkaybarrie.github.io/projectExodus/The%20Forge/forge/portal/` |
| **Preview** | Download artifact, serve locally |

---

## Director Actions Required

Before branching discipline is fully enforced, Director must:

### Immediate

1. **Merge current branch to `main`** to trigger first prod deployment
2. **Verify Pages settings** (Settings → Pages → Source: GitHub Actions)

### After First Deployment

1. **Create branch protection rule** for `main` (see `DIRECTOR_ACTIONS_BRANCH_RULES.md`)
2. **Create required labels** (see `LABELS_REQUIRED.md`)
3. **Test PR workflow** end-to-end

---

## Verification Log

### What Was Audited

- Default branch: `dev` ✓
- Both `main` and `dev` exist ✓
- Pages workflow targets `main` only ✓
- Share pack refresh targets `main` only ✓

### What Was Implemented

- Dev validation workflow (validates without deploying) ✓
- PR preview (artifact + instructions comment) ✓
- Pages workflow generates fresh indices before deploy ✓
- Playbooks documented ✓

---

## Locked Decisions

1. **Prod deploy branch:** `main` only
2. **Dev working branch:** `dev`
3. **Preview approach:** Option B (artifact download + local serve)
4. **Share Pack timing:** Generated fresh during Pages deploy (not dependent on separate refresh workflow)

---

## Next Draft Work Orders (Session Wind-Down)

### 1. FO-Forge-S2-Branch-Protection-Verification

**Type:** ops-verification
**Intent:** After Director configures branch protection, verify rules work as expected (direct push blocked, required checks enforced).

### 2. FO-Forge-M3-Claude-Executor-Integration

**Type:** implementation
**Intent:** Replace placeholder in `forge-wo-execute.yml` with actual Claude Code Action to enable automated Work Order execution from phone.

### 3. FO-MyFi-UI-Dashboard-Sync

**Type:** implementation
**Intent:** Sync the latest Portal patterns (mobile-first, dark theme, touch targets) into the main MyFi dashboard for visual consistency.

---

## Completion Confirmation

- [x] Audit report created
- [x] Dev validation workflow created
- [x] PR preview workflow created
- [x] Pages workflow updated with fresh index generation
- [x] Branching playbook documented
- [x] Director actions guide documented
- [x] Next WOs proposed

---

**Signed:** Claude (Architect)
**Work Order:** FO-Forge-S1-DevMain-Branching-And-Pages-Discipline
