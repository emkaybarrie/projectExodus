# Portal Current-State Recon Report

**Generated:** 2026-01-29
**Target:** Forge Portal (Forante OS Console)
**Commit Context:** Session recon for M4 Final WO Pack

---

## 1. Navigation Map

### Tab Structure (Bottom Nav)
| Tab | Icon | Route | Description |
|-----|------|-------|-------------|
| Home | 🏠 | `home` | Welcome, system status, quick navigation |
| Forge OS | ⚙️ | `forge` | Institutional operations, WO management, E2E workflow |
| Entities | 🔨 | `entities` | Registered products/systems under governance |
| Governance | 📜 | `governance` | Constitutional layer (Forante Model 3) |

### Sub-Screens (from Forge OS tab)
| Screen | Route | Entry Point |
|--------|-------|-------------|
| Forge Governance | `forge-governance` | Forge OS → OS Sections → Governance |
| Forge Agents | `forge-agents` | Forge OS → OS Sections → Agents |
| Share Packs | `forge-sharepacks` | Forge OS → OS Sections → Share Packs |
| Entity Registry | `forge-registry` | Forge OS → OS Sections → Entity Registry |
| Work Orders | `work-orders` | Forge OS → View Forge WOs |
| Create WO | `create-wo` | Forge OS → + Create WO |
| Import Agent Output | `import-agent-output` | Forge OS → Agents → Import Agent Output |
| Evolution Proposal | `evolution-proposal` | Forge OS → Evolution → New Proposal |
| Deploy Status | `deploy-status` | Displayed inline on Forge tab |
| Settings | `settings` | Home → Settings card |

---

## 2. Feature Inventory

### 2.1 Work Order Management

#### View Work Orders
- **UI Entry Point:** Forge OS → View Forge WOs (or Entities → entity card → View Work Orders)
- **Data Source:** `share-pack/work-orders.index.json`
- **Storage:** Loaded into `state.workOrders` (in-memory)
- **GitHub Integration:** Links to WO document (`repoUrl`) and Issue (`issueUrl` if `issueNumber` present)
- **Failure Mode:** Shows "Share Pack indices not found" if JSON fetch fails; suggests CLI refresh

#### Create WO (Draft → GitHub)
- **UI Entry Point:** Forge OS → + Create WO
- **Data Source:** User input form
- **Storage:** None (drafts not persisted locally)
- **GitHub Integration:** Opens GitHub Issue form pre-populated, or copies markdown to clipboard
- **Failure Mode:** Copy to clipboard fallback if GitHub form redirect fails

#### Approve/Reject WO
- **UI Entry Point:** WO Detail Modal → Director Actions (visible only for `pending-approval` status)
- **Data Source:** Issue labels via GitHub API
- **Storage:** None
- **GitHub Integration:**
  - With PAT: Calls `POST /repos/{owner}/{repo}/issues/{number}/labels` and `POST .../comments`
  - Without PAT: Copies `/approve` or `/reject` command for manual paste
- **Required PAT Scopes:** `repo` (classic) or `issues:write` (fine-grained)
- **Failure Mode:** Toast error with API message; falls back to copy command

### 2.2 Agent Pack System

#### Copy Agent Pack
- **UI Entry Point:** WO Card → Copy Pack; WO Detail Modal → Copy Agent Pack
- **Data Source:** WO data from `state.workOrders`
- **Storage:** None (clipboard only)
- **Modes Available:**
  - **Full:** Complete pack with WO details + constitutional docs + checklist
  - **Minimal:** WO summary + constitutional reminders
  - **Context Only:** Governance refs for repo-aware agents
- **Failure Mode:** Toast "Copy failed" if clipboard API unavailable

#### Copy Phase Agent Pack (E2E)
- **UI Entry Point:** Forge OS → E2E Workflow → Select Phase → Copy Phase Agent Pack
- **Data Source:** `E2E_PHASES` constant + optional WO selection
- **Failure Mode:** Phase not found error (shouldn't occur with valid UI)

### 2.3 Share Pack Refresh

#### Trigger Share Pack Refresh
- **UI Entry Point:** Forge OS → Share Packs → Refresh Share Pack
- **Data Source:** Triggers `forge-pages-deploy.yml` workflow
- **Storage:** None
- **GitHub Integration:**
  - With PAT: `POST /repos/{owner}/{repo}/actions/workflows/forge-pages-deploy.yml/dispatches`
  - Without PAT: Copy CLI command or link to Actions page
- **Required PAT Scopes:** `repo` or `actions:write`
- **Failure Mode:** Toast with error message; fallback to manual options modal

### 2.4 Import Agent Output

#### Import Execution Results
- **UI Entry Point:** Forge OS → Agents → Import Agent Output
- **Data Source:** User paste + WO selection
- **Storage:** `localStorage` key `forge_portal_agent_outputs`
- **Parse Modes:** Minimal (raw) or Structured (extracts Summary, Files Changed, Risks, Next Steps, Test Results)
- **GitHub Integration:**
  - With PAT: Posts formatted comment to linked Issue
  - Without PAT: Copies formatted markdown for manual paste
- **Failure Mode:** Toast error; storage quota exceeded handled gracefully

### 2.5 Observations / Deploy Status

#### Observed Panel
- **UI Entry Point:** Forge OS tab (inline panel)
- **Data Source:** `exports/observations/latest.json` (fetched via HTTPS)
- **Storage:** Cached to `localStorage` key `forge_portal_deploy_status_cache`
- **Fields Displayed:** env, branch, commit, timestamp, smokePass, checks array
- **Failure Mode:** Shows error card with guidance to run deploy

#### Deployment Status Panel
- **UI Entry Point:** Forge OS tab (inline panel, below Observed)
- **Data Source:** Same as Observed; uses cached data if live fetch fails
- **GitHub Integration:** Links to Actions workflows
- **Failure Mode:** "Showing cached data (offline mode)" banner if using cache

### 2.6 Evolution Proposals

#### Draft Evolution Proposal
- **UI Entry Point:** Forge OS → Evolution → New Proposal
- **Data Source:** User input form
- **Storage:** `localStorage` key `forge_portal_evolution_proposals`
- **GitHub Integration:**
  - With PAT + linked Issue: Posts comment to Issue
  - Without: Copies markdown for manual paste
- **Failure Mode:** Toast error; form validation prevents empty submissions

### 2.7 Deploy to Prod

#### Trigger Deploy Workflow
- **UI Entry Point:** Forge OS → Quick Actions → Deploy to Prod
- **Data Source:** Opens `forge-deploy-to-prod.yml` Actions page
- **Storage:** None
- **GitHub Integration:** Opens Actions URL in new tab (no API call from Portal)
- **Failure Mode:** Browser popup blocker may prevent new tab

### 2.8 Settings / PAT Management

#### Configure GitHub PAT
- **UI Entry Point:** Settings screen (from Home → Settings)
- **Data Source:** User input
- **Storage:** `localStorage` keys `forge_portal_github_pat`, `forge_portal_pat_consent`
- **Security Model:**
  - Stored unencrypted in localStorage
  - Only transmitted to GitHub API
  - Consent acknowledgment required before first save
- **Failure Mode:** Invalid token format rejected; storage errors shown

---

## 3. Data Sources

### JSON Indices (from Share Pack)
| File | URL Pattern | Generated By |
|------|-------------|--------------|
| `share-pack.index.json` | `{base}/The Forge/forge/exports/share-pack/share-pack.index.json` | `refresh-share-pack.mjs` |
| `work-orders.index.json` | `{base}/The Forge/forge/exports/share-pack/work-orders.index.json` | `refresh-share-pack.mjs` |

### Static Data (Portal-local)
| File | Path | Purpose |
|------|------|---------|
| `entities.json` | `portal/data/entities.json` | Entity registry |
| `environments.json` | `portal/data/environments.json` | Env URLs and workflow refs |
| `products.json` | `portal/data/products.json` | Product metadata (unused in current UI) |

### Observations (Generated at Deploy)
| File | Path | Generated By |
|------|------|--------------|
| `latest.json` | `exports/observations/latest.json` | `make-observation.mjs` during `forge-pages-deploy.yml` |

---

## 4. localStorage Keys

| Key | Purpose | Structure |
|-----|---------|-----------|
| `forge_portal_github_pat` | GitHub Personal Access Token | String |
| `forge_portal_pat_consent` | PAT security consent flag | `"true"` or absent |
| `forge_portal_agent_outputs` | Imported agent outputs | `{ woId: [entries] }` |
| `forge_portal_deploy_status_cache` | Cached observations for offline | Observation object |
| `forge_portal_evolution_proposals` | Saved evolution proposals | `{ woId: [proposals] }` |
| `forante-pwa-dismissed` | PWA install banner dismissal | Timestamp (ms) |

---

## 5. GitHub Workflow Inventory

### forge-pages-deploy.yml
- **Trigger:** Push to `main` or `dev` (with path filters), or `workflow_dispatch`
- **Permissions:** `contents:read`, `pages:write`, `id-token:write`
- **Actions:**
  1. Checkout main → generate Share Pack & Observations → copy to `dist/`
  2. Checkout dev → generate Share Pack & Observations → copy to `dist/dev/`
  3. Validate structure
  4. Deploy to GitHub Pages
- **Outputs:** Deployed site URLs

### forge-deploy-to-prod.yml
- **Trigger:** `workflow_dispatch` (manual) or `issue_comment` containing `/deploy`
- **Permissions:** `contents:write`, `pull-requests:write`, `issues:write`
- **Actions:**
  1. Validate commenter permissions (if comment-triggered)
  2. Check for changes between dev and main
  3. Check for existing PR
  4. Create PR (dev → main) if needed
  5. Optionally auto-merge
- **Gate:** Requires write permission on repo

### forge-wo-execute.yml
- **Trigger:** `issue_comment` containing `/execute`
- **Permissions:** `contents:read`, `issues:write`
- **Actions:**
  1. Gate: Only repo members
  2. Validate: Must have `approved` label, must not have `pending-approval`
  3. Apply `ready-for-executor` label
  4. Post Execution Pack comment with structured instructions
- **Gate:** Requires `approved` label on issue

### forge-phase-notify.yml
- **Trigger:** Issue `labeled` event
- **Permissions:** `contents:read`, `issues:write`
- **Actions:**
  1. Detect phase label (from predefined map)
  2. Post phase transition notification comment
- **Supported Phases:** pending-approval, approved, ready-for-executor, executing, executed, verified, deployed-dev, promoted, deployed-prod, observed, evolved

### forge-route-suggest.yml
- **Trigger:** Issue `labeled` with `approved` label
- **Permissions:** `contents:read`, `issues:write`
- **Actions:**
  1. Check for capability labels (repo-aware, non-repo-aware, verifier, architect)
  2. Post routing suggestion comment
- **Purpose:** Recommends executor type based on WO capability labels

### forge-observations-commit.yml
- **Trigger:** `workflow_run` after `forge-pages-deploy.yml` succeeds, or `workflow_dispatch`
- **Permissions:** `contents:write`
- **Actions:**
  1. Regenerate observations
  2. Commit to dev branch (if changed)
- **Purpose:** Persist ephemeral observations for historical tracking

---

## 6. Critical Constraints

### Workflows Cannot Commit
- `forge-pages-deploy.yml` generates artifacts but does NOT commit back to source
- `forge-observations-commit.yml` is the ONLY workflow that commits to dev

### Read-Only Surfaces
- Portal cannot write to repository files directly
- WO creation drafts only (user must complete on GitHub)
- All mutations go through GitHub API with PAT

### PAT-Gated Features
| Feature | Without PAT | With PAT |
|---------|-------------|----------|
| View WOs | ✓ | ✓ |
| Copy Agent Packs | ✓ | ✓ |
| Create WO draft | ✓ | ✓ |
| Approve/Reject WO | Copy command | Direct API |
| Trigger Share Pack Refresh | Manual via Actions | Direct dispatch |
| Post Agent Output to Issue | Copy markdown | Direct comment |
| Post Evolution Proposal | Copy markdown | Direct comment |

### Issue Number Dependency
- WOs without `issueNumber` in their metadata cannot use direct approval/rejection
- Portal displays warning and offers copy-command fallback

---

## 7. File → Feature Map

| Portal File | Line Range | Features |
|-------------|------------|----------|
| `app.js:96-142` | PAT storage functions | Settings, approval |
| `app.js:150-214` | GitHub API helpers | All PAT-gated actions |
| `app.js:218-283` | Approve/Reject WO | Director actions |
| `app.js:287-400` | Share Pack refresh | Refresh modal and API |
| `app.js:404-540` | Agent output import | Parse, save, post |
| `app.js:583-793` | Data loading | All data sources |
| `app.js:1001-1188` | WO detail modal | Agent pack modes |
| `app.js:1414-1615` | Observed/Deploy panels | Status display |
| `app.js:1619-1828` | Evolution proposals | Form and storage |
| `app.js:1833-2038` | Home/Forge tabs | Main navigation |
| `app.js:2040-2321` | Governance/Entities tabs | Constitutional docs |
| `app.js:2325-2494` | Work Orders screen | List and create |
| `app.js:2496-2690` | Import Agent Output | Form handling |
| `app.js:2692-2899` | Settings screen | PAT modal |

---

## 8. Summary Statistics

| Metric | Count |
|--------|-------|
| Navigation tabs | 4 |
| Sub-screens | 11 |
| Workflow files | 6 |
| localStorage keys | 6 |
| Data JSON files | 5 |
| PAT-gated features | 4 |
| E2E phases tracked | 9 |

---

*End of Current State Recon Report*
