# Requirements Delta Report

**Generated:** 2026-01-29
**Context:** Portal Current State vs. Director Requirements (M4 Final)

---

## 1. Requirements Compliance Matrix

| # | Requirement | Status | Evidence | WO ID | Risk | Regression Surface |
|---|-------------|--------|----------|-------|------|-------------------|
| 1.1 | Repo-aware execution via job dispatch (Actions/self-hosted) | **Missing** | No dispatch trigger for executor; only `/execute` labels issue | FO-Forge-M4-1 | Medium | New workflow, button wiring |
| 1.2 | Full repo checkout (not snapshot packs) | **Partial** | `forge-wo-execute.yml` queues for executor but doesn't run code; manual executor picks up | FO-Forge-M4-1 | Medium | Executor infrastructure |
| 2.1 | Create WOs (copy markdown) | **Compliant** | `app.js:2396-2494` - Create WO form, copy markdown button | — | Low | — |
| 2.2 | Approve/Reject WOs (PAT optional) | **Compliant** | `app.js:218-283` - Direct API with PAT, copy fallback without | — | Low | — |
| 2.3 | Trigger Share Pack refresh | **Compliant** | `app.js:287-320` - Dispatches `forge-pages-deploy.yml` | — | Low | — |
| 2.4 | Import agent output (paste back) | **Compliant** | `app.js:404-540`, `app.js:2496-2690` - Parse, save, post to GitHub | — | Low | — |
| 2.5 | Show Observed / deploy status | **Compliant** | `app.js:1414-1615` - Observed panel with smoke checks, Deploy Status panel | — | Low | — |
| 2.6 | Run Repo-Aware Executor (dispatch workflow) | **Missing** | No button or workflow dispatch for repo-aware execution | FO-Forge-M4-1 | Medium | New button, workflow dispatch |
| 2.7 | Promote to Prod (dispatch workflow) | **Partial** | `handleDeploy()` opens Actions page; no direct dispatch | FO-Forge-M4-2 | Low | Button wiring, PAT dispatch |
| 3.1 | One-click copy Share Pack + WO pack | **Partial** | Agent Pack copy exists; no "Share Pack + WO" combined button | FO-Forge-M4-3 | Low | UI button, pack builder |
| 3.2 | One-click "open in AI" (optional) | **Missing** | No convenience links to AI interfaces | FO-Forge-M4-3 | Low | External URLs, optional |
| 3.3 | One-click import back + optionally post to GitHub | **Compliant** | Import Agent Output screen with Save + Post buttons | — | Low | — |
| 4.1 | In-portal "User Guide / How this works" section | **Missing** | No guide panel or link in Portal UI | FO-Forge-M4-4 | Low | New panel, static content |
| 4.2 | Guide matches current UI and flows | **Missing** | No guide exists | FO-Forge-M4-4 | Low | Documentation |
| 4.3 | Guide covers buttons, PAT safety, failure modes, 9-phase lifecycle | **Missing** | No guide exists | FO-Forge-M4-4 | Low | Documentation |

---

## 2. Gap Analysis

### Critical Gaps (Blocking Core Workflow)

#### Gap 1: No Repo-Aware Executor Dispatch
**Current:** `/execute` command adds `ready-for-executor` label; manual executor must pick up the issue and run locally.
**Required:** Portal button that dispatches a GitHub Actions workflow with full repo checkout, passing WO ID.
**Impact:** Repo-aware agents cannot be triggered from Portal; requires manual CLI execution.
**Fix:** Create `forge-repo-executor.yml` workflow with `workflow_dispatch`, add Portal button.

### Moderate Gaps (Degrades UX)

#### Gap 2: Promote to Prod Opens Actions Page (Not Dispatch)
**Current:** "Deploy to Prod" button opens Actions page in new tab.
**Required:** Direct workflow dispatch with status feedback.
**Impact:** User must manually trigger workflow on GitHub.
**Fix:** Wire `triggerDeployToProd()` similar to Share Pack refresh.

### Minor Gaps (Optional/Nice-to-Have)

#### Gap 3: No Combined Share Pack + WO Bundle
**Current:** "Copy Agent Pack" copies WO-specific pack; Share Pack is separate.
**Required:** Convenience button for non-repo agents to get everything in one click.
**Impact:** Extra steps for non-repo-aware workflow.
**Fix:** Add "Copy Non-Repo Agent Pack" button that bundles Share Pack URL + WO pack.

#### Gap 4: No "Open in AI" Links
**Current:** No external AI links.
**Required:** Optional convenience links (Claude, ChatGPT, etc.).
**Impact:** Manual copy-paste to AI interface.
**Fix:** Add configurable AI links to Agent Pack modal.

#### Gap 5: No In-Portal User Guide
**Current:** Users must find documentation in repo.
**Required:** In-portal guide section explaining all features.
**Impact:** New users confused by Portal purpose and workflow.
**Fix:** Create USER_GUIDE.md, add link/render in Portal Home tab.

---

## 3. Execution Waves

### Wave 1: Core Executor Dispatch (High Priority)
| WO ID | Task | Dependencies | Rollback |
|-------|------|--------------|----------|
| FO-Forge-M4-1a | Create `forge-repo-executor.yml` workflow | None | Delete workflow file |
| FO-Forge-M4-1b | Add "Run Repo-Aware Executor" button to Portal | M4-1a | Revert button addition |
| FO-Forge-M4-1c | Add execution status panel in Portal | M4-1b | Revert panel addition |

**Director Gate:** Approve workflow design before implementation.

### Wave 2: Deploy Workflow Enhancement (Medium Priority)
| WO ID | Task | Dependencies | Rollback |
|-------|------|--------------|----------|
| FO-Forge-M4-2a | Add `triggerDeployToProd()` dispatch function | None | Remove function |
| FO-Forge-M4-2b | Wire "Deploy to Prod" button to dispatch | M4-2a | Revert to window.open |

**Director Gate:** Verify PAT scope requirements.

### Wave 3: Non-Repo Agent UX (Low Priority)
| WO ID | Task | Dependencies | Rollback |
|-------|------|--------------|----------|
| FO-Forge-M4-3a | Add combined Share Pack + WO copy function | None | Remove function |
| FO-Forge-M4-3b | Add "Open in AI" convenience links (optional) | None | Remove links |

**Director Gate:** None (low impact, optional).

### Wave 4: User Guide Integration (Low Priority)
| WO ID | Task | Dependencies | Rollback |
|-------|------|--------------|----------|
| FO-Forge-M4-4a | Create USER_GUIDE.md in Portal directory | None | Delete file |
| FO-Forge-M4-4b | Add Guide link to Home tab | M4-4a | Remove link |
| FO-Forge-M4-4c | (Optional) Render guide inline in Portal | M4-4b | Remove inline render |

**Director Gate:** Approve guide content before publishing.

---

## 4. Rollback Strategy

### Per-Wave Rollback
| Wave | Rollback Command | Expected State After |
|------|-----------------|---------------------|
| Wave 1 | `git revert` commits touching `forge-repo-executor.yml`, `app.js` (executor dispatch) | Portal works as current |
| Wave 2 | `git revert` commits touching `app.js` (deploy dispatch) | Deploy button opens Actions page |
| Wave 3 | `git revert` commits touching `app.js` (combined pack, AI links) | Current agent pack modal |
| Wave 4 | Delete USER_GUIDE.md, `git revert` Home tab changes | No guide visible |

### Full Rollback
```bash
git checkout dev -- "The Forge/forge/portal/app.js"
git checkout dev -- "The Forge/forge/portal/index.html"
git rm ".github/workflows/forge-repo-executor.yml"
git rm "The Forge/forge/portal/USER_GUIDE.md"
git commit -m "chore(forge): rollback M4 changes"
```

---

## 5. Director Gates

| Gate | Trigger | Approval Required For |
|------|---------|----------------------|
| G1 | Before Wave 1 implementation | Workflow dispatch design, PAT scope requirements |
| G2 | Before Wave 1 merge to dev | Workflow tested, no regressions |
| G3 | Before Wave 4 content publish | User Guide content accuracy |
| G4 | Before any promote to prod | All waves verified on dev |

---

## 6. Risk Assessment

### High-Risk Changes
| Change | Risk Factor | Mitigation |
|--------|-------------|-----------|
| New workflow dispatch | May fail silently if PAT lacks `actions:write` | Toast error message, fallback to Actions page |
| Executor workflow | Long-running job, resource consumption | Timeout limits, job concurrency rules |

### Medium-Risk Changes
| Change | Risk Factor | Mitigation |
|--------|-------------|-----------|
| Deploy dispatch | Could accidentally trigger prod deploy | Confirmation modal, labeled button |
| Status polling | Excessive API calls if implemented | Cache with TTL, manual refresh only |

### Low-Risk Changes
| Change | Risk Factor | Mitigation |
|--------|-------------|-----------|
| User Guide content | Outdated info if UI changes | Link to repo version, not static embed |
| AI links | External service dependency | Optional, clearly labeled as external |

---

## 7. Missing Secrets/Permissions

### Currently Available
- `GITHUB_TOKEN` (default, read + limited write)
- User-provided PAT (stored client-side)

### Required for New Features
| Feature | Secret/Permission | Workaround if Unavailable |
|---------|------------------|--------------------------|
| Repo-Aware Executor dispatch | PAT with `actions:write` OR workflow uses `GITHUB_TOKEN` | Open Actions page, manual trigger |
| Deploy to Prod dispatch | PAT with `actions:write` | Current behavior (opens page) |

### Minimal Viable Workaround
All new features can fall back to "open in GitHub" if PAT lacks required scopes. Portal remains functional without elevated permissions.

---

## 8. Top 10 Deltas Summary

1. **No Repo-Aware Executor dispatch button** — Core gap
2. **No repo-aware execution workflow** — Core gap
3. **Deploy to Prod opens page, not dispatch** — UX friction
4. **No execution status panel** — No visibility into running jobs
5. **No combined non-repo agent pack** — Extra steps for non-repo workflow
6. **No User Guide in Portal** — Onboarding gap
7. **No "Open in AI" convenience links** — Optional nice-to-have
8. **No guide covering 9-phase lifecycle** — Documentation gap
9. **No PAT troubleshooting guidance in UI** — Error handling gap
10. **No indication of current environment (dev/prod)** — Context awareness

---

*End of Requirements Delta Report*
