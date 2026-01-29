# RECON REPORT — Mobile-Native Forge Workflow (M3)
**Type:** Executor Reconnaissance — NO CODE CHANGES
**Generated:** 2026-01-28
**Authoritative References:** FORGE_KERNEL.md, WORK_ORDER_LIFECYCLE_CONTRACT.md, E2E_WORKFLOW_PLAYBOOK.md, EXECUTOR_PLAYBOOK.md

---

## SECTION A — CURRENT STATE MAP

### A.1 Phase Transitions

| Phase | Current Implementation | Location | Trigger |
|-------|----------------------|----------|---------|
| **Draft** | Manual issue creation | GitHub Issues | User creates issue with `forge_work_order.yml` template |
| **Approved** | Manual label application | GitHub Issues | Director applies `approved` label, removes `pending-approval` |
| **Ready-for-Executor** | Workflow automation | `.github/workflows/forge-wo-execute.yml` | `/execute` comment triggers label add |
| **Executing** | Manual label application | EXECUTOR_PLAYBOOK.md protocol | Executor applies `executing`, removes `ready-for-executor` |
| **Executed** | Manual label application | EXECUTOR_PLAYBOOK.md protocol | Executor applies `executed`, removes `executing` |
| **Verified/Tested** | **NOT IMPLEMENTED** | — | No workflow exists |
| **Deployed (Dev)** | Push-triggered deployment | `.github/workflows/forge-pages-deploy.yml` | Push to `dev` branch |
| **Promoted** | **NOT IMPLEMENTED** | — | No workflow exists |
| **Deployed (Prod)** | PR + manual trigger | `.github/workflows/forge-deploy-to-prod.yml` | `/deploy` comment or workflow_dispatch |
| **Observed** | **NOT IMPLEMENTED** | — | No workflow exists |
| **Evolved** | **NOT IMPLEMENTED** | — | No workflow exists |
| **Blocked** | Manual label application | Any phase | Any actor applies `blocked` label |

**Key Finding:** Only 2 of 9 phases have workflow automation. Phases 4 (Verified), 6 (Promoted), 8 (Observed), 9 (Evolved) are fully manual or non-existent.

---

### A.2 Notifications

| Notification Type | Current Implementation | Location |
|------------------|----------------------|----------|
| **Phase transition comments** | **NOT IMPLEMENTED** | No `forge-phase-notify.yml` workflow exists |
| **Routing suggestions** | **NOT IMPLEMENTED** | No auto-routing workflow exists |
| **Execution pack generation** | IMPLEMENTED | `forge-wo-execute.yml` posts EXECUTION PACK comment |
| **Deploy status comments** | IMPLEMENTED | `forge-deploy-to-prod.yml` posts success/failure comments |
| **Blocker alerts** | Manual only | Executor posts blocker comment per EXECUTOR_PLAYBOOK |

**Key Finding:** Phase-specific notifications do not exist. The only automated comments are from `/execute` (execution pack) and `/deploy` (status).

---

### A.3 Observations (Current State)

| Observation Capability | Status | Details |
|----------------------|--------|---------|
| **Observation data generation** | **NOT IMPLEMENTED** | No `make-observation.mjs` script exists |
| **Observation storage** | **NOT IMPLEMENTED** | No `exports/observations/` directory exists |
| **Observation panel in portal** | **NOT IMPLEMENTED** | Portal has no observation UI |
| **Smoke checks** | **NOT IMPLEMENTED** | No automated health checks post-deploy |
| **Reporter role artifacts** | **NOT IMPLEMENTED** | Reporter phase is conceptual only |

**Key Finding:** The entire observation/reporting infrastructure is absent. Phase 8 (Observed) from the lifecycle contract has no implementation.

---

### A.4 Portal Read/Write Boundaries

#### READ Operations (Current)

| Data Source | Path | Usage |
|------------|------|-------|
| `share-pack.index.json` | `../exports/share-pack/share-pack.index.json` | System status (timestamp, commit) |
| `work-orders.index.json` | `../exports/share-pack/work-orders.index.json` | WO list, counts, status |
| `entities.json` | `./data/entities.json` | Entity registry |
| `environments.json` | `./data/environments.json` | Dev/prod URLs |
| `products.json` | `./data/products.json` | Product visibility |

**Limitation:** Portal reads ONLY static JSON files. No GitHub API integration exists.

#### WRITE Operations (Current)

| Write Type | Implementation | Scope |
|-----------|---------------|-------|
| **Clipboard** | `navigator.clipboard.writeText()` | Agent packs, WO body, commands |
| **localStorage** | PWA install dismissal state | 7-day TTL key |
| **Window navigation** | `window.open()` | Opens GitHub URLs (issues, workflows) |

**Limitation:** Portal cannot write to GitHub. All mutations require manual GitHub interaction.

#### Explicit Boundaries

| Action | Portal Capability | Current Method |
|--------|------------------|----------------|
| Create WO | ❌ Cannot create directly | Generates URL → user submits in GitHub |
| Approve WO | ❌ Cannot apply labels | Manual GitHub label change |
| Execute WO | ❌ Cannot trigger | Copies `/execute` → user pastes in GitHub |
| Query issue status | ❌ No API access | Reads static JSON indices |
| Trigger deployment | ❌ Cannot dispatch | Opens workflow page → user triggers manually |

---

### A.5 AI Handoff Points

| Handoff Point | Implementation | Location |
|--------------|---------------|----------|
| **Agent Pack Generation** | IMPLEMENTED | `portal/app.js` → `copyAgentPack()` |
| **Phase Agent Packs** | IMPLEMENTED | `portal/app.js` → `copyPhaseAgentPack()` |
| **Execution Pack** | IMPLEMENTED | `forge-wo-execute.yml` → Issue comment |
| **Share Pack** | IMPLEMENTED | `refresh-share-pack.mjs` → JSON indices |
| **Agent Output Import** | **NOT IMPLEMENTED** | No import mechanism exists |
| **Agent Provenance Recording** | **NOT IMPLEMENTED** | No automated capture |

**Handoff Flow (Current):**
1. Portal generates agent pack markdown
2. User copies to clipboard
3. User pastes into external agent interface (Claude, etc.)
4. Agent executes work
5. User manually updates GitHub issue/PR
6. **No return path to portal**

---

### A.6 Implicit Behaviour (Code vs. Documentation)

| Behaviour | Documented | In Code | Gap |
|-----------|-----------|---------|-----|
| Lane detection from WO ID | Not explicit | `parseLane()` regex | Pattern: `FO-{LANE}-*` |
| Status fallback to "draft" | Not explicit | `parseWorkOrderStatus()` | Default when no match |
| Deduplication by WO ID | Not explicit | Set-based in refresh script | First occurrence wins |
| Label validation order | EXECUTOR_PLAYBOOK | `forge-wo-execute.yml` | Matches: approved → not pending → not already in pipeline |
| Permission gating | Not explicit | `forge-wo-execute.yml`, `forge-deploy-to-prod.yml` | Requires admin/maintain/write |
| Entity portal lane filtering | DERIVED_PORTALS.md | `myfi-app.js` | Hardcoded filter: `wo.id.includes('-MyFi-')` |

---

## SECTION B — GAP ANALYSIS

### B.1 FO-Forge-P5: Phase Transition Notifications

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Workflow** | Does not exist | Must create `forge-phase-notify.yml` |
| **Trigger** | — | `issues: [labeled]` event |
| **Labels monitored** | — | `approved`, `executing`, `executed`, `blocked` |
| **Comment format** | — | Must define format per WO spec |
| **Anti-spam logic** | — | Must implement (one comment per label event) |

**What partially exists:** `forge-wo-execute.yml` handles `ready-for-executor` transition with comment — could be extended or used as pattern.

**What would break if naïvely implemented:**
- Adding comments on ALL label events would spam issues
- Must filter to phase-specific labels only
- Must not double-comment if workflow runs multiple times

---

### B.2 FO-Forge-P6: Suggest-only Routing

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Routing logic** | Does not exist | Must implement capability detection |
| **Label-based capability** | Labels exist but not semantic | Need `repo-aware`, `non-repo-aware`, `verifier`, `architect` labels |
| **Suggestion comment** | Does not exist | Must define format |
| **No assignment** | — | Must NOT use GitHub assignees API |

**What partially exists:** EXECUTOR_PLAYBOOK mentions capability-based routing conceptually.

**What would break if naïvely implemented:**
- Assigning users would violate "suggest only" requirement
- Adding labels would violate requirement
- Running on non-`approved` labels would spam

---

### B.3 FO-Forge-P8: Portal Observed Panel

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Observation data fetch** | No URL defined | Must add `OBSERVATIONS_URL` |
| **Panel UI** | Does not exist | Must create panel in Forge OS tab |
| **Error handling** | — | Must show visible error (not silent fail) |
| **Data fields to display** | — | env, timestamp, pass/fail, commit, notes |

**What partially exists:** Portal has card/panel patterns for Share Pack status — can reuse pattern.

**What would break if naïvely implemented:**
- Fetching non-existent `observations/latest.json` without error handling → portal crash
- P8 depends on P9 producing the data file

**Dependency:** P9 must be implemented first or P8 will always show error state.

---

### B.4 FO-Forge-P9: Reporter Phase Minimal

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Observation script** | Does not exist | Must create `make-observation.mjs` |
| **Output directory** | Does not exist | Must create `exports/observations/` |
| **Deploy workflow integration** | Not present | Must modify `forge-pages-deploy.yml` |
| **Smoke checks** | Not implemented | Must implement fetch-based health checks |
| **Output JSON schema** | Not defined | Must match WO specification |

**What partially exists:**
- `refresh-share-pack.mjs` provides pattern for script-based generation
- `forge-pages-deploy.yml` has dual-environment structure (prod/dev)

**What would break if naïvely implemented:**
- Running smoke checks BEFORE deploy completes → false failures
- If checking live URLs during workflow (pre-deploy), URLs not yet updated
- Must use local file checks OR post-deploy verification

**Critical Decision Required:** Local integrity checks vs. remote smoke checks (per WO: "If executing smoke checks before deploy URL is live is unreliable, then use local integrity check")

---

### B.5 FO-Forge-M3a: Portal WO Creation Form

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Form UI** | Partially exists (`create-wo` screen) | Basic form exists with: Task ID, Type, Intent, Scope |
| **Full template fields** | Missing | Need: Allowed Files, Forbidden Changes, Success Criteria, Execution Mode, Agent Type, Dependencies |
| **GitHub URL generation** | Exists | `buildIssueUrl()` function present |
| **localStorage draft** | Does not exist | Must add form state persistence |
| **Preview mode** | Does not exist | Must show formatted WO markdown |

**What partially exists:** Create WO screen with 4 fields + GitHub URL generation.

**What would break if naïvely implemented:**
- URL query params have length limits — large forms may truncate
- GitHub issue template fields must match form fields for prefill to work

---

### B.6 FO-Forge-M3b: Portal Director Approval UI

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **PAT management** | Does not exist | Must add settings screen |
| **GitHub API calls** | Does not exist | Must implement label add/remove |
| **Approval buttons** | Does not exist | Must add to WO detail modal |
| **Fallback copy** | Does not exist | Must copy approval command if no PAT |
| **Security warnings** | — | Must warn about client-side token storage |

**What partially exists:** WO detail modal exists — can add buttons.

**What would break if naïvely implemented:**
- Storing PAT in plain localStorage → security risk (WO acknowledges: "user responsibility")
- API calls without error handling → silent failures
- Requires `issueNumber` in index — **M3h must be implemented first**

**Dependency:** M3h (WO Index GitHub Integration) must provide `issueNumber` field.

---

### B.7 FO-Forge-M3c: Portal Share Pack Refresh Trigger

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Workflow dispatch API** | Does not exist | Must implement GitHub Actions dispatch |
| **CLI command copy** | Does not exist | Must add copy action |
| **Agent prompt copy** | Does not exist | Must add copy action |
| **Status indicator** | Partially exists | Share pack panel shows timestamp |

**What partially exists:** Share pack status panel with timestamp.

**What would break if naïvely implemented:**
- Workflow dispatch requires PAT with `workflow` scope — **depends on M3b**
- Current `forge-share-pack-refresh.yml` has `contents: read` only — cannot commit

**Dependency:** M3b (PAT management) must be implemented first for workflow dispatch.

---

### B.8 FO-Forge-M3d: Structured Agent Pack Generator

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Agent pack generation** | Exists | `copyAgentPack()` and `copyPhaseAgentPack()` |
| **Output schema definition** | Does not exist | Must define JSON output format |
| **Full/Minimal/Context options** | Does not exist | Currently one format only |
| **Provenance inclusion** | Partially exists | Includes share pack commit |

**What partially exists:** Agent pack generation is functional but format differs from WO specification.

**What would break if naïvely implemented:**
- Changing existing format may break current workflows
- Should be additive (new options) not replacing current behaviour

---

### B.9 FO-Forge-M3e: Agent Output Import Form

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Import screen** | Does not exist | Must create new screen |
| **JSON validation** | Does not exist | Must implement schema validation |
| **Preview UI** | Does not exist | Must show parsed data |
| **GitHub comment posting** | Does not exist | Must implement via API |
| **Label update** | Does not exist | Must implement `executed` label add |
| **Fallback copy** | — | Must copy formatted markdown |

**What partially exists:** Nothing — entirely new feature.

**What would break if naïvely implemented:**
- Posting to wrong issue if `woId` doesn't match known WO
- Requires `issueNumber` in index — **depends on M3h**
- Requires PAT — **depends on M3b**

**Dependencies:** M3b (PAT), M3d (output schema), M3h (issue integration).

---

### B.10 FO-Forge-M3f: Deployment Status Panel

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Status display** | Minimal | Only workflow link exists |
| **Observations integration** | Does not exist | Depends on P8/P9 |
| **GitHub Actions API** | Does not exist | Requires PAT for run queries |
| **Environment health** | Does not exist | No ping/check mechanism |
| **Action buttons** | Does not exist | Must trigger workflows |

**What partially exists:** Deploy workflow link in quick actions.

**What would break if naïvely implemented:**
- Fetching `observations/latest.json` before P9 implemented → errors
- GitHub Actions API requires PAT — **depends on M3b**

**Dependencies:** P8, P9, M3b.

---

### B.11 FO-Forge-M3g: Evolution Proposal Submission

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Evolution form** | Does not exist | Must create new screen |
| **Related WO dropdown** | Does not exist | Must query executed WOs |
| **Issue creation** | Does not exist | Must implement |
| **`evolution` label** | May not exist | Must verify/create in repo |

**What partially exists:** Create WO form pattern could be adapted.

**What would break if naïvely implemented:**
- `evolution` label must exist in repo
- Requires PAT — **depends on M3b**

---

### B.12 FO-Forge-M3h: WO Index GitHub Integration

| Aspect | Current State | Gap |
|--------|--------------|-----|
| **Issue URL parsing** | Does not exist | Must add to `refresh-share-pack.mjs` |
| **Issue number extraction** | Does not exist | Must parse from URL |
| **GitHub API query** | Does not exist | Optional: search issues by title |
| **Backward compatibility** | — | Fields must be optional |

**What partially exists:** `repoUrl` generation exists — can add parallel `issueUrl` logic.

**What would break if naïvely implemented:**
- Making `issueUrl` required would break existing WOs without issues
- API queries during share pack generation require auth — should remain optional

---

## SECTION C — RISK FLAGS

### C.1 Elevated Permissions Required

| WO | Permission | Scope | Risk Level |
|----|-----------|-------|------------|
| **P5** | `issues: write` | Comment on issues | LOW — Same as existing `forge-wo-execute.yml` |
| **P6** | `issues: write` | Comment on issues | LOW — Same as P5 |
| **P8** | None | Read-only portal | NONE |
| **P9** | `pages: write` | Deploy with observations | LOW — Same as existing `forge-pages-deploy.yml` |
| **M3a** | None | Portal form only | NONE |
| **M3b** | User PAT (client-side) | GitHub API write | **MEDIUM** — User-provided token stored in browser |
| **M3c** | User PAT + `workflow` scope | Workflow dispatch | **MEDIUM** — Requires elevated PAT scope |
| **M3d** | None | Clipboard only | NONE |
| **M3e** | User PAT | Comment + label API | **MEDIUM** — Same as M3b |
| **M3f** | User PAT | Actions API read | **LOW** — Read-only API |
| **M3g** | User PAT | Issue create API | **MEDIUM** — Same as M3b |
| **M3h** | None | Script modification | NONE |

### C.2 State Mutations Without Director Action

| WO | Mutation | Director Gate | Risk |
|----|----------|---------------|------|
| **P5** | Issue comments | No | **LOW** — Comments are informational |
| **P6** | Issue comments | No | **LOW** — Suggestion only, no label change |
| **P9** | `observations/latest.json` creation | No | **LOW** — Ephemeral, deploy-time only |
| **M3b** | Label changes via API | **YES** — Director uses UI | **HIGH** — Portal could change labels if misused |
| **M3e** | `executed` label add | **YES** — User confirms | **MEDIUM** — User must confirm submission |
| **M3g** | Issue creation | **YES** — User submits form | **LOW** — Explicit user action |

**Critical Risk:** M3b enables label mutations from portal. Must ensure:
- Only Director-role users have PAT
- Approval actions have confirmation modals
- No bulk operations without explicit action

### C.3 Potential Regressions to Existing Pipeline

| WO | Regression Risk | Mitigation |
|----|-----------------|------------|
| **P5** | New workflow may conflict with existing label handlers | Filter to specific labels only |
| **P6** | Could interfere with existing `/execute` flow if timing overlaps | Run AFTER P5, separate workflow |
| **P9** | Modifying `forge-pages-deploy.yml` could break deployments | Add observation step AFTER existing deploy succeeds |
| **M3b** | Portal API errors could leave labels in inconsistent state | Implement rollback on partial failure |
| **M3h** | Changing `refresh-share-pack.mjs` output could break portal | New fields must be optional |

**Non-Regression Checklist (per FORGE_KERNEL Section 9A):**
- [ ] Does not weaken role separation
- [ ] Does not reduce verification gates
- [ ] Does not bypass provenance requirements
- [ ] Does not reduce reporting/observability
- [ ] Does not introduce silent automation without artifacts

---

## SECTION D — ALIGNMENT OPTIONS

### D.1 Implementation Assessment Matrix

| WO | Additive? | Refactor Required? | Rollback Trivial? | Notes |
|----|-----------|-------------------|-------------------|-------|
| **P5** | **YES** | NO | **YES** — Delete workflow | New workflow, no existing code modified |
| **P6** | **YES** | NO | **YES** — Delete workflow | Can extend P5 or separate workflow |
| **P8** | **YES** | NO | **YES** — Remove panel code | New portal panel, existing code untouched |
| **P9** | **YES** | PARTIAL | **YES** — Remove script + workflow step | New script + workflow modification |
| **M3a** | **YES** | PARTIAL | **YES** — Revert form changes | Extends existing create-wo screen |
| **M3b** | **YES** | NO | **YES** — Remove settings + API code | New feature, no existing code modified |
| **M3c** | **YES** | NO | **YES** — Remove panel additions | Extends existing share pack panel |
| **M3d** | **YES** | NO | **YES** — Revert pack format | Extends existing `copyAgentPack()` |
| **M3e** | **YES** | NO | **YES** — Remove import screen | Entirely new screen |
| **M3f** | **YES** | NO | **YES** — Remove status panel | New panel, depends on P8/P9 data |
| **M3g** | **YES** | NO | **YES** — Remove form screen | Entirely new screen |
| **M3h** | **YES** | PARTIAL | **YES** — Remove issueUrl parsing | Modifies `refresh-share-pack.mjs` |

### D.2 Dependency Graph

```
P9 (observations script) ───┐
                            ├──► P8 (observations panel) ───┐
                            │                                │
M3h (index integration) ────┼──► M3b (approval UI) ─────────┼──► M3e (import form)
                            │         │                      │
                            │         ├──► M3c (refresh)     │
                            │         │                      │
                            │         └──► M3f (deploy status)
                            │
P5 (notifications) ─────────┼──► P6 (routing suggest)
                            │
M3a (WO form) ──────────────┘
M3d (agent pack) ───────────────► M3e (import form)
M3g (evolution) ────────────────► M3b (PAT management)
```

### D.3 Recommended Execution Order (Respecting Dependencies)

**Wave 1 — No Dependencies:**
1. P5 (Phase Notifications) — New workflow
2. M3h (WO Index GitHub Integration) — Script modification
3. M3a (WO Creation Form) — Portal enhancement
4. M3d (Agent Pack Generator) — Portal enhancement

**Wave 2 — Depends on Wave 1:**
5. P6 (Routing Suggestions) — Depends on P5 patterns
6. P9 (Reporter Minimal) — New script + workflow modification
7. M3b (Director Approval UI) — Depends on M3h for issueNumber

**Wave 3 — Depends on Wave 2:**
8. P8 (Observations Panel) — Depends on P9 data
9. M3c (Share Pack Refresh) — Depends on M3b for PAT
10. M3e (Agent Output Import) — Depends on M3b, M3d, M3h

**Wave 4 — Depends on Wave 3:**
11. M3f (Deployment Status Panel) — Depends on P8, P9, M3b
12. M3g (Evolution Submission) — Depends on M3b

---

## SUMMARY

### Current State
- **Phase automation:** 2 of 9 phases have workflow support
- **Notifications:** None beyond execution pack
- **Observations:** Entirely absent
- **Portal:** Read-only with clipboard-mediated handoffs
- **AI handoff:** One-way (portal → agent), no return path

### Critical Gaps
1. **No `forge-phase-notify.yml`** — P5 must create this
2. **No `observations/` infrastructure** — P9 must create this
3. **No `issueNumber` in WO index** — M3h must add this
4. **No GitHub API in portal** — M3b must add PAT management

### Risk Assessment
- **LOW RISK:** P5, P6, P8, M3a, M3d, M3h (additive, isolated)
- **MEDIUM RISK:** P9, M3b, M3c, M3e, M3f, M3g (state mutations, API integration)
- **HIGH RISK:** None (all WOs are designed as additive)

### Executor Readiness
- All WOs can be implemented **additively**
- No major refactors required
- Rollback is trivial for all WOs
- Dependencies are well-defined and can be sequenced

---

**END OF RECON REPORT**

*This report documents current state only. No code changes have been made. Implementation requires Director approval per WO lifecycle.*
