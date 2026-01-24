# Deployment Contract

Status: Canonical
Last Updated: 2026-01-24
Scope: Dev ⇄ Prod deployment rules for GitHub Pages (free tier)

---

## Strategy Implemented

**Strategy A: Single Pages site with `/dev/` subpath**

This was chosen because:
- Works within GitHub Pages free tier constraints (single source per repo)
- Both environments are always deployed together (consistency)
- Single workflow manages both environments
- No separate branches/repos needed for hosting

---

## Environment URLs

### Production (Prod)

| Resource | URL |
|----------|-----|
| **Branch** | `main` |
| **Site Root** | https://emkaybarrie.github.io/projectExodus/ |
| **Forge Portal** | https://emkaybarrie.github.io/projectExodus/The%20Forge/forge/portal/ |
| **MyFi App** | https://emkaybarrie.github.io/projectExodus/Project%20MyFi/ProjectMyFi_vLatest/ |

### Development (Dev)

| Resource | URL |
|----------|-----|
| **Branch** | `dev` |
| **Site Root** | https://emkaybarrie.github.io/projectExodus/dev/ |
| **Forge Portal** | https://emkaybarrie.github.io/projectExodus/dev/The%20Forge/forge/portal/ |
| **MyFi App** | https://emkaybarrie.github.io/projectExodus/dev/Project%20MyFi/ProjectMyFi_vLatest/ |

---

## Promotion Rules (Dev → Prod)

### Standard Promotion
1. Ensure `dev` branch has been tested via the Dev URL
2. Create a PR from `dev` → `main`
3. Review changes in the PR
4. Merge the PR (or use the Deploy workflow)
5. The `forge-pages-deploy.yml` workflow automatically deploys both environments

### Quick Promotion (Director override)
1. Go to: [Deploy to Production workflow](https://github.com/emkaybarrie/projectExodus/actions/workflows/forge-deploy-to-prod.yml)
2. Click "Run workflow"
3. Optionally enable auto-merge
4. This creates a PR or merges directly if auto-merge is enabled

### What Happens on Promotion
- Push to `main` triggers `forge-pages-deploy.yml`
- Workflow checks out both `main` and `dev` branches
- Builds unified artifact with both environments
- Deploys to GitHub Pages
- Both Prod and Dev URLs are updated

---

## Rollback Rules

### If Prod is broken after promotion:

**Option 1: Revert the merge (recommended)**
```bash
# Find the merge commit
git log --oneline main

# Revert it
git revert <merge-commit-sha>
git push origin main
```

**Option 2: Force push previous good commit**
```bash
# Find the last known good commit
git log --oneline main

# Reset to it (CAUTION: rewrites history)
git checkout main
git reset --hard <good-commit-sha>
git push --force origin main
```

**Option 3: Re-run workflow with previous commit**
- Go to Actions → `forge-pages-deploy.yml`
- Find a successful run from before the issue
- Click "Re-run all jobs"

### After rollback:
1. Verify Prod URL loads correctly
2. Investigate the issue on Dev
3. Fix and test on Dev before re-promoting

---

## What To Do If Deploy Fails

### 1. Check the workflow run
- Go to: [Actions](https://github.com/emkaybarrie/projectExodus/actions)
- Find the failed `forge-pages-deploy.yml` run
- Check which step failed

### 2. Common failure scenarios:

**Share Pack generation fails:**
- Check for syntax errors in modified `.md` or `.json` files
- Ensure `refresh-share-pack.mjs` works locally

**Validation fails:**
- Check that required files exist in both branches
- Ensure `index.html` exists at the root

**Pages deployment fails:**
- Check GitHub Pages settings: Settings → Pages
- Ensure "Source" is set to "GitHub Actions"
- Check for concurrent deployment conflicts

### 3. Manual recovery:
```bash
# If workflow keeps failing, deploy manually:
git checkout main
# Fix the issue
git commit -m "Fix deployment issue"
git push origin main
```

### 4. Escalation:
- If Pages itself is down, check: https://githubstatus.com
- If persistent issues, consider Strategy B (separate branches) as fallback

---

## Known Limitations

### GitHub Pages Free Tier
- Single deployment source per repo
- No authentication/access control
- No server-side processing (static only)
- Custom domain requires additional DNS setup

### This Strategy
- Both environments deploy together (can't deploy one without the other)
- Dev at `/dev/` means all internal links must be relative
- Large repos may have slower deploy times due to dual checkout

### Path Considerations
- All internal links should be **relative**, not absolute
- Hardcoded paths to `/` will break in Dev environment
- The Portal uses relative URLs which work in both environments

---

## Workflow Files

| Workflow | File | Purpose |
|----------|------|---------|
| **Unified Deploy** | `.github/workflows/forge-pages-deploy.yml` | Deploys both Prod and Dev |
| **Deploy to Prod** | `.github/workflows/forge-deploy-to-prod.yml` | Creates PR from dev → main |
| _(Deprecated)_ | `.github/workflows/forge-portal-pages.yml` | Old single-environment deploy |

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  dev branch ──push──> forge-pages-deploy.yml ──> /dev/     │
│       │                       │                             │
│       │                       └──────────────────> /        │
│       │                                                     │
│  main branch ─push──> forge-pages-deploy.yml ──> /         │
│       ▲                       │                             │
│       │                       └──────────────────> /dev/    │
│       │                                                     │
│  PR merge (dev → main) ─────────────────────────────────>  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

URLS:
  Prod Portal: .../projectExodus/The%20Forge/forge/portal/
  Dev Portal:  .../projectExodus/dev/The%20Forge/forge/portal/
```

---

## Cross-References

- [Forge Index](../FORGE_INDEX.md) — Forge navigation
- [Branching Playbook](./BRANCHING_PLAYBOOK.md) — Git branch discipline
- [Executor Playbook](./EXECUTOR_PLAYBOOK.md) — AI executor protocol

---

End of Deployment Contract.
