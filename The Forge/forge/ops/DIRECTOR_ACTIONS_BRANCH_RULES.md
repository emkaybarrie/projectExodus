# Director Actions: Branch Rules & Pages Setup

**Status:** Action Required
**Audience:** Director only
**Purpose:** GitHub UI configuration steps for branch protection and Pages

---

## Overview

This document provides exact steps for configuring GitHub repository settings to enforce the branching discipline defined in FO-Forge-S1.

---

## 1. Verify Default Branch

**Goal:** Ensure `dev` is the default branch (where new PRs target by default).

**Steps:**
1. Go to: https://github.com/emkaybarrie/projectExodus/settings
2. Scroll to "Default branch"
3. If not `dev`, click the swap icon
4. Select `dev` → Update

**Current Status:** ✅ Already set to `dev` (per audit)

---

## 2. Create Branch Protection Rule for `main`

**Goal:** Prevent direct pushes to `main`; require PRs.

**Steps:**
1. Go to: https://github.com/emkaybarrie/projectExodus/settings/branches
2. Click "Add branch protection rule"
3. Configure:

| Setting | Value |
|---------|-------|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ Enabled |
| Require approvals | Optional (1 if you want review) |
| Require status checks to pass | ✅ Enabled |
| Status checks that are required | `Validate Forge Assets` |
| Require branches to be up to date | ✅ Enabled |
| Include administrators | ✅ Enabled (recommended) |

4. Click "Create" or "Save changes"

**Result:** Direct pushes to `main` blocked. Must PR from `dev`.

---

## 3. Verify GitHub Pages Configuration

**Goal:** Confirm Pages deploys from GitHub Actions (not branch).

**Steps:**
1. Go to: https://github.com/emkaybarrie/projectExodus/settings/pages
2. Verify:

| Setting | Required Value |
|---------|----------------|
| Source | "GitHub Actions" |
| Custom domain | (optional) |
| Enforce HTTPS | ✅ Enabled |

3. If Source shows a branch, change to "GitHub Actions"

**Result:** Pages controlled by `forge-portal-pages.yml` workflow.

---

## 4. Create Required Labels

**Goal:** Enable WO execution workflow gates.

**Steps:**
1. Go to: https://github.com/emkaybarrie/projectExodus/labels
2. Create these labels if missing:

| Label | Color | Description |
|-------|-------|-------------|
| `approved` | `#0e8a16` (green) | Work Order approved for execution |
| `work-order` | `#7057ff` (purple) | Forge Work Order |
| `pending-approval` | `#fbca04` (yellow) | Awaiting Director approval |

**Detailed in:** `LABELS_REQUIRED.md`

---

## 5. Verify Environments

**Goal:** Ensure `github-pages` and `preview` environments exist.

**Steps:**
1. Go to: https://github.com/emkaybarrie/projectExodus/settings/environments
2. Verify `github-pages` environment exists (auto-created by Actions)
3. Optionally create `preview` environment for manual preview deploys

**Note:** Environments are auto-created by workflows on first run.

---

## 6. Test the Setup

### Test 1: Branch Protection

1. Try to push directly to `main`:
   ```bash
   git checkout main
   git commit --allow-empty -m "test"
   git push origin main
   ```
2. Should be rejected with protection error

### Test 2: PR Validation

1. Create a test PR from `dev` to `main`
2. Verify `Validate Forge Assets` check runs
3. Verify `Forge Portal Preview` workflow runs
4. Check for bot comment with preview instructions

### Test 3: Pages Deploy

1. Merge a PR to `main`
2. Check Actions tab for `Project Exodus → GitHub Pages` workflow
3. Verify site at: https://emkaybarrie.github.io/projectExodus/

---

## Rollback

If something breaks:

### Re-enable direct push to main (emergency)
1. Settings → Branches → Edit `main` rule
2. Uncheck "Require a pull request before merging"
3. Save

### Switch Pages back to branch deploy (emergency)
1. Settings → Pages → Source: Deploy from a branch
2. Select `main` / `/ (root)`
3. Save

---

## Checklist

- [ ] Default branch is `dev`
- [ ] Branch protection rule exists for `main`
- [ ] Status check `Validate Forge Assets` required
- [ ] Pages source is GitHub Actions
- [ ] Labels `approved`, `work-order`, `pending-approval` exist
- [ ] Tested PR workflow end-to-end
- [ ] Verified prod deployment works

---

**Created by:** FO-Forge-S1-DevMain-Branching-And-Pages-Discipline
**Date:** 2026-01-23
