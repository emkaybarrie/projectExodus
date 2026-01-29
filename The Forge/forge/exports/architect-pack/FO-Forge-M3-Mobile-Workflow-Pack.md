# MOBILE-NATIVE FORGE WORKFLOW — IMPLEMENTATION PACK
**Lane:** Forge OS
**Generated:** 2026-01-28
**Based on:** Repo Audit + Source WO Pack (P5, P6, P8, P9)

---

## AUDIT SUMMARY

### Current State
| Capability | Status | Notes |
|------------|--------|-------|
| Portal PWA (mobile-first) | **Operational** | Offline support, bottom nav, touch targets |
| Share Pack Generation | **CLI/CI only** | `refresh-share-pack.mjs` runs locally or in workflows |
| WO Index Display | **Read-only** | Portal displays WOs from indices |
| WO Creation | **GitHub only** | Issue template exists, no portal form |
| Director Approval | **Label-based** | External GitHub, no portal UI |
| Execution Trigger | **Comment-based** | `/execute` command in GitHub Issues |
| Deployment Trigger | **Comment-based** | `/deploy` command or workflow dispatch |
| Observations Panel | **Missing** | P8/P9 from source pack addresses this |
| Phase Notifications | **Missing** | P5 from source pack addresses this |
| Non-repo Agent Integration | **Partial** | Agent Pack copy exists, no import |

### Critical Gaps for Mobile-Native Workflow
1. **No portal-based WO creation** — Must use GitHub Issues directly
2. **No Director control gates in portal** — Approval requires GitHub label management
3. **No Share Pack refresh from portal** — Requires CLI or CI trigger
4. **No agent output import** — Can copy packs out, cannot paste results in
5. **No deployment status in portal** — Must check GitHub Actions manually
6. **No observations/reporting panel** — P8/P9 partially addresses

---

## STRATEGY: PHASED IMPLEMENTATION

### Phase A: Foundation (Source WOs P5, P6, P8, P9)
- Phase notifications via issue comments
- Routing suggestions on approval
- Observations panel in portal
- Reporter generating observation data

### Phase B: Mobile Director Controls (NEW)
- Portal WO creation form → GitHub Issues
- Portal approval/rejection UI → GitHub Labels
- Portal Share Pack refresh trigger
- Deployment status panel

### Phase C: Non-Repo Agent Integration (NEW)
- Structured Agent Pack format (copyable prompt)
- Agent Output Schema (pasteable results)
- Portal import form → GitHub Issue update
- Workflow automation for agent outputs

### Phase D: Reporting & Evolution (NEW)
- Evolution proposal submission from portal
- Reporting dashboard integration
- Historical observations archive

---

# WORK ORDERS

---

## WORK ORDER FO-Forge-P5 (FROM SOURCE PACK)
**ID:** FO-Forge-P5-Phase-Transition-Notifications-IssueComments
**Title:** Phase Transition Notifications (GitHub Issue Comments)
**Type:** Forge OS / Governance UX
**Status:** DRAFT → (Director Approved)

### Purpose
When a WO transitions via key labels, Forge posts a concise comment on the GitHub Issue.

### Implementation
Create new workflow:
- `.github/workflows/forge-phase-notify.yml`

**Trigger:** `issues: [labeled]`

**Behavior:**
- Only respond when newly-added label is one of: `approved`, `executing`, `executed`, `blocked`
- Do NOT add new labels in this WO

**Comment format:**
```
Forge: WO moved to <PHASE>. Trigger: label '<LABEL>'. Timestamp: <ISO>.
```

**Anti-spam:**
- Do not comment for non-phase labels
- Do not comment more than once per label addition event

### Acceptance Criteria
- Adding label "approved" to an issue creates a single comment
- Adding an unrelated label creates no comment

### Closure
- List files modified/created
- Provide sample comment output

---

## WORK ORDER FO-Forge-P6 (FROM SOURCE PACK)
**ID:** FO-Forge-P6-Auto-Routing-Suggest-Only
**Title:** Suggest-only Routing on Approval (No assignment)
**Type:** Forge OS / Routing
**Status:** DRAFT → (Director Approved)

### Purpose
On "approved" label, post a *suggestion* comment indicating recommended executor type.

### Rule (keep simple)
Use labels as capabilities. Detect:
- `repo-aware`
- `non-repo-aware`
- `verifier`
- `architect`

**Logic:**
- If none present → "Unknown — missing capability labels."
- If "repo-aware" present → recommend "Repo-aware Executor"
- Else if "non-repo-aware" present → recommend "Non-repo-aware Executor"
- Else if "verifier" present → recommend "Verifier"
- Else if "architect" present → recommend "Architect"

### Implementation
- Extend `forge-phase-notify.yml` OR create `.github/workflows/forge-route-suggest.yml`
- Trigger: `issues: [labeled]` where label == approved

**Output comment:**
```
Forge Routing Suggestion: <TYPE>. Basis: labels=[...]
```

Do NOT assign a user. Do NOT add labels. Suggest only.

### Acceptance Criteria
- Approved issue gets exactly one routing suggestion comment
- No GitHub assignment happens

### Closure
- Document rule implemented
- Provide 2 examples

---

## WORK ORDER FO-Forge-P8 (FROM SOURCE PACK)
**ID:** FO-Forge-P8-Portal-Observed-Panel-Minimal
**Title:** Portal — Observed (Latest) Panel
**Type:** Portal UX
**Status:** DRAFT → (Director Approved)

### Purpose
Portal displays latest observation data at a glance.

### Implementation
Modify:
- `The Forge/forge/portal/app.js`
- `The Forge/forge/portal/styles.css` (badge styles)

Add:
```javascript
OBSERVATIONS_URL = new URL('../exports/observations/latest.json', import.meta.url).href
```

**In Forge OS tab UI:**
- Add a card/panel "Observed (Latest)"
- Fetch OBSERVATIONS_URL
- Render:
  - env (dev/prod)
  - timestamp
  - pass/fail badge
  - commit SHA short
  - notes
- If fetch fails: render error card with "Observed data not found" + attempted URL

No silent fail.

### Acceptance Criteria
- Portal loads and shows Observed panel
- Missing latest.json shows visible error card (not console only)

### Closure
- Files modified
- Screenshot or textual rendering description

---

## WORK ORDER FO-Forge-P9 (FROM SOURCE PACK - HYBRID)
**ID:** FO-Forge-P9-Reporter-Phase-Minimal-Hybrid
**Title:** Phase 8 Minimal Reporter — Dist Observation Now + Optional Persistence Later
**Type:** Forge OS / Automation Increment
**Status:** DRAFT → (Director Approved)

### Purpose
Produce "latest observation" JSON after deploy so Portal can display PASS/FAIL.

### Strategy
**P9-A (NOW, REQUIRED):** Generate observations into dist during deploy (ephemeral, but visible).
**P9-B (FOLLOW-UP, OPTIONAL):** Add commit-to-dev persistence workflow (NOT in this WO).

### P9-A — Dist Observation (NOW)
Add Node script: `The Forge/forge/ops/scripts/make-observation.mjs`

**CLI args/env:**
- ENV_NAME (dev|prod)
- DEPLOYED_BRANCH (dev|main)
- COMMIT_SHA
- TIMESTAMP_ISO (default now)
- BASE_URL (deployed site root for that env)

**Smoke checks (simple fetch GET):**
1. Portal index reachable
2. Share pack index reachable (share-pack.index.json)
3. Work orders index reachable (work-orders.index.json)

**Output JSON:**
```json
{
  "env": "dev|prod",
  "deployedBranch": "...",
  "timestamp": "...",
  "commitSha": "...",
  "smokePass": true|false,
  "checks": [
    {"name":"portal","ok":true|false,"url":"...","status":200,"note":"..."},
    {"name":"sharePackIndex", ...},
    {"name":"workOrdersIndex", ...}
  ],
  "notes": "short summary"
}
```

**Output location:** `The Forge/forge/exports/observations/latest.json`

**Integrate into deploy:** `.github/workflows/forge-pages-deploy.yml`

### P9-B — Persistence (FOLLOW-UP WO STUB)
Create follow-up WO stub: `FO-Forge-P9b-Commit-Observations-To-Dev.md`

### Acceptance Criteria
- After deploy, Portal can fetch `../exports/observations/latest.json`
- Observed panel renders PASS/FAIL based on smoke checks
- Missing indexes cause FAIL with notes

### Closure
- List files created/modified
- Include example latest.json

---

## WORK ORDER FO-Forge-M3a (NEW)
**ID:** FO-Forge-M3a-Portal-WO-Creation-Form
**Title:** Portal — Work Order Creation Form (Director Gate)
**Type:** Forge OS / Portal UX / Director Control
**Status:** DRAFT

### Purpose
Enable Directors to create Work Orders directly from mobile portal, triggering GitHub Issue creation.

### Implementation

**Modify:** `The Forge/forge/portal/app.js`

**Add WO Creation Form UI:**
```javascript
// New screen: 'create-wo'
// Form fields matching forge_work_order.yml issue template:
- Task ID (auto-generated suggestion: FO-[Lane]-[Type][Num]-[Name])
- Task Type (dropdown)
- Lane (dropdown: Forge, MyFi, Forante)
- Intent Statement (textarea)
- Scope of Work (textarea)
- Allowed Files (textarea)
- Forbidden Changes (textarea)
- Success Criteria (textarea)
- Execution Mode (radio: code, docs-only)
- Agent Type (dropdown: repo-aware, non-repo-aware)
- Dependencies (optional textarea)
- Notes (optional textarea)
```

**Form Actions:**
1. **Preview** — Show formatted WO markdown
2. **Copy to Clipboard** — Copy GitHub-compatible format for manual paste
3. **Open GitHub** — Navigate to issue creation URL with prefilled params

**GitHub URL Generation:**
```javascript
function buildWOIssueUrl(formData) {
  const baseUrl = 'https://github.com/emkaybarrie/projectExodus/issues/new';
  const params = new URLSearchParams({
    template: 'forge_work_order.yml',
    title: `[WO] ${formData.taskId}`,
    // Additional fields as supported by issue template
  });
  return `${baseUrl}?${params}`;
}
```

**Storage:** Save draft to localStorage for session persistence

### Acceptance Criteria
- Form renders on mobile with touch-friendly inputs
- Preview shows properly formatted WO
- Copy action puts WO in clipboard
- Open GitHub navigates to issue creation with prefilled title
- Form state persists across page refresh (localStorage)

### Dependencies
- None

### Closure
- Files modified
- Screenshot of form on mobile viewport
- Example generated URL

---

## WORK ORDER FO-Forge-M3b (NEW)
**ID:** FO-Forge-M3b-Portal-Director-Approval-UI
**Title:** Portal — Director Approval/Rejection UI
**Type:** Forge OS / Portal UX / Director Control
**Status:** DRAFT

### Purpose
Enable Directors to approve or reject Work Orders from mobile portal, updating GitHub Issue labels.

### Implementation

**Prerequisite:** GitHub Personal Access Token (PAT) with `repo` scope stored in portal (localStorage, user-provided)

**Modify:** `The Forge/forge/portal/app.js`

**Add Token Management:**
```javascript
// Settings screen for PAT entry
// Token stored encrypted in localStorage
// Warning: PAT gives write access - user responsibility
```

**Add Approval Actions to WO Detail Modal:**
```javascript
// For WOs with status: pending-approval
- Approve Button → Adds 'approved' label, removes 'pending-approval'
- Reject Button → Adds 'rejected' label, removes 'pending-approval'
- Request Changes Button → Adds comment requesting clarification

// API calls via GitHub REST API
async function approveWO(issueNumber, token) {
  await addLabel(issueNumber, 'approved', token);
  await removeLabel(issueNumber, 'pending-approval', token);
}
```

**Fallback (No Token):**
- Show "Copy Approval Command" button
- Copies `/approve` or similar text for manual GitHub comment

**Security Considerations:**
- PAT stored client-side only
- Clear warning about token security
- Option to clear token
- No server-side storage

### Acceptance Criteria
- Directors can enter PAT in settings
- Approve/Reject buttons visible for pending-approval WOs
- Successful approval updates GitHub labels
- API errors show clear error message
- Fallback copy works without token

### Dependencies
- GitHub Issue must have `issueUrl` in work-orders.index.json
- WO Index must include GitHub Issue number

### Closure
- Files modified
- API call examples
- Error handling documentation

---

## WORK ORDER FO-Forge-M3c (NEW)
**ID:** FO-Forge-M3c-Portal-SharePack-Refresh-Trigger
**Title:** Portal — Share Pack Refresh Trigger
**Type:** Forge OS / Portal UX / Automation
**Status:** DRAFT

### Purpose
Enable users to trigger Share Pack refresh from portal, either via workflow dispatch or by generating a command.

### Implementation

**Modify:** `The Forge/forge/portal/app.js`

**Add Share Pack Actions Panel:**

**Option 1: Workflow Dispatch (requires PAT)**
```javascript
async function triggerSharePackRefresh(token) {
  // POST to GitHub Actions workflow dispatch API
  // Trigger: forge-share-pack-refresh.yml
  const response = await fetch(
    'https://api.github.com/repos/emkaybarrie/projectExodus/actions/workflows/forge-share-pack-refresh.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({ ref: 'dev' })
    }
  );
}
```

**Option 2: Copy CLI Command (no token needed)**
```javascript
function copyRefreshCommand() {
  const cmd = 'node "The Forge/forge/ops/scripts/refresh-share-pack.mjs"';
  navigator.clipboard.writeText(cmd);
  showToast('Command copied to clipboard');
}
```

**Option 3: Copy Agent Prompt**
```javascript
function copyRefreshPrompt() {
  const prompt = `Please run the Share Pack refresh script...`;
  navigator.clipboard.writeText(prompt);
}
```

**UI in Share Packs Panel:**
- "Refresh Share Pack" button
- Dropdown: Workflow Dispatch / Copy Command / Copy Prompt
- Status indicator: Last refresh timestamp from index

### Acceptance Criteria
- Button visible in Share Packs panel
- Workflow dispatch works with valid PAT
- Copy actions work without PAT
- Status shows current pack timestamp

### Dependencies
- FO-Forge-M3b (PAT management) for workflow dispatch option

### Closure
- Files modified
- Each option documented with example

---

## WORK ORDER FO-Forge-M3d (NEW)
**ID:** FO-Forge-M3d-Portal-Agent-Pack-Generator
**Title:** Portal — Structured Agent Pack Generator
**Type:** Forge OS / Portal UX / Non-Repo Agent Integration
**Status:** DRAFT

### Purpose
Generate structured, copyable prompts for non-repo-aware agents that include all context needed for WO execution.

### Implementation

**Modify:** `The Forge/forge/portal/app.js`

**Agent Pack Structure:**
```markdown
# AGENT INITIALIZATION PACK
Generated: <timestamp>
Environment: <dev|prod>
Share Pack Commit: <sha>

## CONTEXT DOCUMENTS
<List of key documents to request or reference>

## WORK ORDER
ID: <wo.id>
Title: <wo.title>
Status: <wo.status>
Lane: <wo.lane>

### Intent
<wo.intent>

### Scope
<wo.scope>

### Success Criteria
<wo.criteria>

### Forbidden Changes
<wo.forbidden>

## EXECUTION INSTRUCTIONS
1. Review the context documents listed above
2. Execute the work order scope
3. Produce outputs in the format below
4. Return the completed OUTPUT PACK for portal import

## OUTPUT PACK FORMAT
Return your results in this exact format:
\`\`\`json
{
  "woId": "<wo.id>",
  "status": "executed|blocked",
  "summary": "Brief description of what was done",
  "filesCreated": ["path1", "path2"],
  "filesModified": ["path3", "path4"],
  "testResults": "PASS|FAIL|N/A",
  "notes": "Any additional notes",
  "timestamp": "<ISO timestamp>"
}
\`\`\`
```

**UI Enhancements:**
- "Generate Agent Pack" button on WO detail modal
- Options: Full Pack / Minimal Pack / Context Only
- Copy to clipboard with toast confirmation
- Include Share Pack status badge

### Acceptance Criteria
- Agent Pack includes all WO metadata
- Output format is clearly specified
- Copy action works on mobile
- Pack includes timestamp and provenance

### Dependencies
- None

### Closure
- Files modified
- Example full agent pack
- Example output pack

---

## WORK ORDER FO-Forge-M3e (NEW)
**ID:** FO-Forge-M3e-Portal-Agent-Output-Import
**Title:** Portal — Agent Output Import Form
**Type:** Forge OS / Portal UX / Non-Repo Agent Integration
**Status:** DRAFT

### Purpose
Enable users to paste agent output (from non-repo agents) into portal, which then updates GitHub Issue with execution results.

### Implementation

**Modify:** `The Forge/forge/portal/app.js`

**Add Import Form Screen:**
```javascript
// Screen: 'import-agent-output'
// Textarea for pasting JSON output pack
// Parse and validate against schema
// Preview parsed data
// Submit to GitHub Issue as comment
```

**Import Flow:**
1. User pastes JSON output pack
2. Portal validates JSON structure
3. Portal shows preview of parsed data
4. User confirms submission
5. Portal posts formatted comment to GitHub Issue
6. Portal optionally adds 'executed' label (if PAT available)

**Comment Format:**
```markdown
## Agent Execution Report
**WO ID:** <woId>
**Status:** <status>
**Timestamp:** <timestamp>

### Summary
<summary>

### Files Created
- <file1>
- <file2>

### Files Modified
- <file3>
- <file4>

### Test Results
<testResults>

### Notes
<notes>

---
*Submitted via Forge Portal*
```

**Validation Rules:**
- JSON must parse successfully
- woId must match a known WO
- Required fields: woId, status, summary
- Optional fields: filesCreated, filesModified, testResults, notes

**Fallback (No PAT):**
- Generate formatted markdown
- Copy to clipboard for manual paste to GitHub

### Acceptance Criteria
- Paste area accepts JSON
- Invalid JSON shows clear error
- Valid output shows preview
- Submit posts comment to correct issue
- Fallback copy works without PAT

### Dependencies
- FO-Forge-M3b (PAT management)
- FO-Forge-M3d (Agent Pack format defines output schema)

### Closure
- Files modified
- Example import flow
- Error handling documentation

---

## WORK ORDER FO-Forge-M3f (NEW)
**ID:** FO-Forge-M3f-Portal-Deployment-Status-Panel
**Title:** Portal — Deployment Status Panel
**Type:** Forge OS / Portal UX
**Status:** DRAFT

### Purpose
Display current deployment status for dev and prod environments in the portal.

### Implementation

**Modify:** `The Forge/forge/portal/app.js`

**Add Deployment Status Panel to Forge OS tab:**

**Data Sources:**
1. `observations/latest.json` (from P9) — Smoke check results
2. GitHub Actions API — Recent workflow runs (optional, requires PAT)
3. Environment URLs — Direct health check pings

**Panel Contents:**
```
┌─────────────────────────────────────────┐
│ DEPLOYMENT STATUS                        │
├─────────────────────────────────────────┤
│ PRODUCTION                               │
│ ● Online | Commit: abc1234 | 2h ago     │
│ Smoke: PASS ✓                           │
│ [View] [Promote from Dev]               │
├─────────────────────────────────────────┤
│ DEVELOPMENT                              │
│ ● Online | Commit: def5678 | 30m ago    │
│ Smoke: PASS ✓                           │
│ [View] [Deploy Latest]                  │
├─────────────────────────────────────────┤
│ Recent Deployments                       │
│ • forge-pages-deploy #123 - success     │
│ • forge-pages-deploy #122 - success     │
└─────────────────────────────────────────┘
```

**Actions:**
- View → Opens deployed URL
- Promote from Dev → Triggers forge-deploy-to-prod.yml (requires PAT)
- Deploy Latest → Triggers forge-pages-deploy.yml (requires PAT)
- Fallback: Copy workflow dispatch command

### Acceptance Criteria
- Panel shows dev and prod status
- Smoke results from observations integrated
- Action buttons trigger workflows or copy commands
- Graceful degradation without PAT

### Dependencies
- FO-Forge-P8 (Observations panel)
- FO-Forge-P9 (Observations data)
- FO-Forge-M3b (PAT management) for actions

### Closure
- Files modified
- Panel screenshot
- API integration documentation

---

## WORK ORDER FO-Forge-M3g (NEW)
**ID:** FO-Forge-M3g-Portal-Evolution-Submission
**Title:** Portal — Evolution Proposal Submission
**Type:** Forge OS / Portal UX / Evolution
**Status:** DRAFT

### Purpose
Enable users to submit evolution proposals (improvements, lessons learned) from mobile portal.

### Implementation

**Modify:** `The Forge/forge/portal/app.js`

**Add Evolution Form:**
```javascript
// Screen: 'submit-evolution'
// Form fields:
- Related WO ID (optional, dropdown from executed WOs)
- Evolution Type (dropdown: improvement, lesson, pattern, anti-pattern)
- Title (text)
- Description (textarea)
- Impact Area (multiselect: Portal, Workflows, Contracts, Share Pack, Other)
- Priority (low, medium, high)
- Proposed Changes (textarea, optional)
```

**Submission Options:**
1. Create GitHub Issue with `evolution` label
2. Copy formatted proposal for manual submission
3. Add to local evolution backlog (localStorage)

**GitHub Issue Format:**
```markdown
## Evolution Proposal

**Type:** <type>
**Related WO:** <woId or N/A>
**Impact Area:** <areas>
**Priority:** <priority>

### Description
<description>

### Proposed Changes
<proposed changes>

---
*Submitted via Forge Portal*
```

### Acceptance Criteria
- Form renders on mobile
- Related WO dropdown shows executed WOs
- Submit creates GitHub Issue with correct labels
- Fallback copy works without PAT

### Dependencies
- FO-Forge-M3b (PAT management)

### Closure
- Files modified
- Example evolution proposal
- Issue label configuration

---

## WORK ORDER FO-Forge-M3h (NEW)
**ID:** FO-Forge-M3h-WO-Index-GitHub-Integration
**Title:** Work Order Index — GitHub Issue Integration
**Type:** Forge OS / Data Schema
**Status:** DRAFT

### Purpose
Enhance work-orders.index.json to include GitHub Issue URLs, enabling portal write actions.

### Implementation

**Modify:** `The Forge/forge/ops/scripts/refresh-share-pack.mjs`

**Add Issue URL Resolution:**
```javascript
// For each WO, attempt to find corresponding GitHub Issue
// Method 1: Parse issue URL from WO markdown (if present)
// Method 2: Search GitHub Issues API by WO ID title

async function resolveIssueUrl(woId, woContent) {
  // Check WO content for explicit issue URL
  const urlMatch = woContent.match(/Issue:\s*(https:\/\/github\.com\/[^\s]+)/i);
  if (urlMatch) return urlMatch[1];

  // Fallback: return null (issue URL unknown)
  return null;
}
```

**Enhanced Index Entry:**
```json
{
  "id": "FO-MyFi-I3-QuestsSurface",
  "title": "...",
  "status": "approved",
  "issueUrl": "https://github.com/emkaybarrie/projectExodus/issues/234",
  "issueNumber": 234,
  ...
}
```

**Backward Compatibility:**
- `issueUrl` and `issueNumber` are optional
- Portal handles missing fields gracefully
- No breaking changes to existing consumers

### Acceptance Criteria
- Index includes issueUrl where available
- Missing issue URLs are null (not error)
- Portal can use issueNumber for API calls

### Dependencies
- None

### Closure
- Files modified
- Example enriched index entry

---

# EXECUTION SEQUENCE

## Phase A: Foundation (Source WOs)
**Order:** P5 → P6 → P9 → P8
1. **P5** — Phase notifications establish event stream
2. **P6** — Routing suggestions layer on P5 workflow
3. **P9** — Generate observations data (required for P8)
4. **P8** — Display observations in portal

## Phase B: Mobile Director Controls
**Order:** M3h → M3a → M3b → M3c → M3f
1. **M3h** — Index enhancement (enables issue linking)
2. **M3a** — WO creation form (no dependencies)
3. **M3b** — Approval UI (enables write actions)
4. **M3c** — Share Pack refresh (uses M3b PAT)
5. **M3f** — Deployment status (uses M3b, P8/P9)

## Phase C: Non-Repo Agent Integration
**Order:** M3d → M3e
1. **M3d** — Agent Pack generator (defines output schema)
2. **M3e** — Agent Output import (uses M3d schema, M3b PAT)

## Phase D: Evolution
**Order:** M3g
1. **M3g** — Evolution submission (uses M3b PAT)

---

# NON-REGRESSION REQUIREMENTS

1. **Portal continues to load** — All data fetching graceful
2. **Share Pack generation works** — No schema breaks
3. **Existing workflows succeed** — No trigger interference
4. **WO Index backward compatible** — New fields optional
5. **Mobile UX preserved** — Touch targets, safe areas, offline

---

# FOLLOW-UP WO STUBS (NOT IN THIS PACK)

## FO-Forge-P9b-Commit-Observations-To-Dev
Persistence layer for observations — commit to dev branch.

## FO-Forge-M4-Reporting-Dashboard
Historical observations, trend analysis, deployment metrics.

## FO-Forge-M5-Bulk-WO-Operations
Multi-select WO approval, bulk status updates.

## FO-Forge-M6-Real-Time-Updates
WebSocket/polling for live WO status changes.

---

# EXECUTOR OUTPUT REQUIREMENTS

For each WO executed:
1. List of files created/modified
2. Proof of functionality (screenshot, console output, or test result)
3. Non-regression verification (portal loads, indices valid)
4. API documentation (for new endpoints/integrations)
