# Branching Playbook

**Status:** Canonical
**Audience:** Director, Developers, Agents
**Purpose:** Daily workflow for dev → main branching discipline

---

## Branch Roles

| Branch | Role | Deploy Target |
|--------|------|---------------|
| `dev` | Daily work, experiments, WIP | None (validation only) |
| `main` | Production, approved work | GitHub Pages (prod) |

---

## Daily Workflow

### 1. Working on `dev`

```bash
# Ensure you're on dev
git checkout dev
git pull origin dev

# Make changes, commit
git add <files>
git commit -m "Your message"

# Push to trigger validation
git push origin dev
```

**What happens:** `forge-dev-validate.yml` runs automatically:
- Generates Share Pack
- Validates JSON syntax
- Checks Portal files
- Uploads artifacts

### 2. Phone Check: Test Dev Work

After pushing to `dev`, verify your changes locally:

```bash
# Generate indices locally
node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"

# Start local server (VS Code Live Server or)
python -m http.server 8080

# Open Portal
# http://localhost:8080/The%20Forge/forge/portal/
```

**On Phone (same network):**
```bash
# Find your IP
ipconfig getifaddr en0  # Mac
hostname -I             # Linux
ipconfig                # Windows (look for IPv4)

# On phone browser:
# http://<your-ip>:8080/The%20Forge/forge/portal/
```

### 3. Promote `dev` → `main` via PR

```bash
# Ensure dev is up to date
git checkout dev
git pull origin dev

# Create PR via GitHub CLI
gh pr create --base main --head dev --title "Merge dev to main" --body "## Summary
- List changes here

## Test Plan
- [ ] Validated locally
- [ ] Portal loads indices
"
```

**Or via GitHub Desktop:**
1. Branch → Create Pull Request
2. Set base: `main`, compare: `dev`
3. Fill in title and description
4. Create Pull Request

**What happens:**
- `forge-dev-validate.yml` runs (PR check)
- `forge-portal-preview.yml` runs (preview artifact)
- Preview instructions posted as PR comment

### 4. After Merge: Prod Updates

When PR is merged to `main`:

1. `forge-portal-pages.yml` runs automatically
2. Share Pack generated fresh
3. Site deployed to GitHub Pages

**Verify prod:**
- https://emkaybarrie.github.io/projectExodus/
- https://emkaybarrie.github.io/projectExodus/The%20Forge/forge/portal/

---

## Troubleshooting

### "Failed to load data" in Portal

**Local:**
```bash
# Regenerate indices
node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"
# Refresh browser
```

**Production:**
1. Check Actions tab for failed workflows
2. Verify `main` has latest indices
3. Re-run `forge-portal-pages.yml` workflow manually

### PR Preview Not Working

1. Check PR for bot comment with instructions
2. Download artifact from workflow run
3. Unzip and serve locally

### Validation Failing

Check the workflow logs for specific errors:
- JSON syntax errors → Fix the JSON file
- Missing files → Ensure all required files exist
- Syntax errors in app.js → Check JavaScript

---

## GitHub Desktop Workflow

### Switching Branches
1. Current Branch dropdown → Select `dev` or `main`
2. Fetch origin to get latest

### Creating PR
1. Branch → Create Pull Request
2. Opens GitHub in browser
3. Complete PR form there

### Viewing Workflow Status
1. After push, click "View on GitHub" in Desktop
2. Or check: https://github.com/emkaybarrie/projectExodus/actions

---

## Quick Reference

| Action | Command |
|--------|---------|
| Switch to dev | `git checkout dev` |
| Pull latest | `git pull origin dev` |
| Push changes | `git push origin dev` |
| Create PR | `gh pr create --base main --head dev` |
| Generate indices | `node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"` |
| Local server | `python -m http.server 8080` |

---

**Created by:** FO-Forge-S1-DevMain-Branching-And-Pages-Discipline
**Date:** 2026-01-23
