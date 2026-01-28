# Reconciliation Gaps

Date: 2026-01-25
Source: RECONCILIATION_REPORT_2026-01-25.md
Purpose: Numbered gap list with severity, impacted roles, recommended lane, and suggested WO titles

---

## Gap Summary

| # | Gap | Severity | Blocking? |
|---|-----|----------|-----------|
| 1 | Automated Verifier–Tester | Medium | No |
| 2 | Automated Reporter Signals | Medium | No |
| 3 | Work Order Location Consolidation | Low | No |
| 4 | share-pack.index.json Automation | Low | No |
| 5 | Branch Protection Verification | Low | No |
| 6 | Agent Registry / Heartbeat | Low | No |
| 7 | Evolution Agent Tooling | Low | No |

---

## Gap Details

### Gap 1: Automated Verifier–Tester

**Severity:** Medium
**Impacted Roles:** Verifier–Tester, Director
**Recommended Lane:** Forge
**Current State:** Manual verification only — Verifier–Tester checks acceptance criteria by reading WO and reviewing artifacts.
**Desired State:** Automated test suite runs per-WO, results recorded as Reporter signals, gate authority enforced programmatically.

**Suggested WO Title:** `FO-Forge-V1-Automated-Verification-Pipeline`

**Scope:**
- Define test suite structure aligned to WO acceptance criteria
- Implement test runner (human-runnable + CI-runnable)
- Integrate with WO lifecycle (Verified phase gate)
- Emit structured signals to Reporter

---

### Gap 2: Automated Reporter Signals Collection

**Severity:** Medium
**Impacted Roles:** Reporter, Evolution Agent, Director
**Recommended Lane:** Forge
**Current State:** REPORTING_SIGNALS_CONTRACT.md defines signal schema, but no automated collection.
**Desired State:** Reporter automatically collects signals from WO lifecycle events, deployment logs, verification outcomes.

**Suggested WO Title:** `FO-Forge-R4-Reporter-Signals-Automation`

**Scope:**
- Implement signal collection from GitHub events (issues, PRs, deployments)
- Store signals in structured format (JSON)
- Provide query interface for Evolution Agent
- Surface trends in Director dashboard (portal)

---

### Gap 3: Work Order Location Consolidation

**Severity:** Low
**Impacted Roles:** Architect, Executor, Director
**Recommended Lane:** Forge
**Current State:** Work Orders are scattered across three locations:
- `Work Orders/` (legacy, 14 files)
- `ops/` (operational, 10 files)
- `work-orders/` (newer, 4 files)

**Desired State:** Single canonical location with clear naming convention.

**Suggested WO Title:** `FO-Forge-C3-WorkOrder-Location-Consolidation`

**Scope:**
- Decide canonical location (recommend `work-orders/`)
- Migrate existing WOs (preserve git history via move)
- Update work-orders.index.json with new paths
- Update portal to use consolidated paths
- Deprecate legacy locations

---

### Gap 4: share-pack.index.json Automation

**Severity:** Low
**Impacted Roles:** Reporter, non-repo-aware agents
**Recommended Lane:** Forge
**Current State:** share-pack.index.json requires manual refresh via Node.js script.
**Desired State:** Automatic refresh on commit/deploy (GitHub Actions).

**Suggested WO Title:** `FO-Forge-A3-SharePack-AutoRefresh-Pipeline`

**Scope:**
- Add GitHub Action to run refresh-share-pack.mjs on push to dev
- Commit updated indices automatically
- Validate index integrity before commit

**Note:** Currently blocked by Node.js availability in local environment. Can be resolved via GitHub Actions.

---

### Gap 5: Branch Protection Verification

**Severity:** Low
**Impacted Roles:** Director, Executor
**Recommended Lane:** Forge
**Current State:** Branch protection rules documented but not programmatically verified.
**Desired State:** Automated check confirms branch protection settings match documented contract.

**Suggested WO Title:** `FO-Forge-S4-BranchProtection-Automated-Audit`

**Scope:**
- Use GitHub API to query branch protection settings
- Compare against DEPLOYMENT_CONTRACT.md requirements
- Emit Reporter signal on drift detection
- Alert Director if protection is weakened

---

### Gap 6: Agent Registry / Heartbeat

**Severity:** Low
**Impacted Roles:** Forge (routing), Director
**Recommended Lane:** Forge
**Current State:** AGENT_ONBOARDING_CONTRACT.md describes "Phase 1: Config + Heartbeat" but no implementation.
**Desired State:** Agents registered via configuration, heartbeat confirms availability.

**Suggested WO Title:** `FO-Forge-A4-Agent-Registry-Heartbeat`

**Scope:**
- Define agent registry format (JSON)
- Implement heartbeat mechanism (API call or status file)
- Integrate with WO routing (check agent availability before assignment)
- Surface agent status in portal

---

### Gap 7: Evolution Agent Tooling

**Severity:** Low
**Impacted Roles:** Evolution Agent, Reporter
**Recommended Lane:** Forge
**Current State:** Evolution Agent role is defined but has no dedicated tooling.
**Desired State:** Evolution Agent has tools to query Reporter signals, draft proposals, track outcomes.

**Suggested WO Title:** `FO-Forge-E1-Evolution-Agent-Tooling`

**Scope:**
- Signal query interface (filter by category, time range, WO)
- Proposal template generator
- Outcome tracking (link proposal → implementation → measurement)
- Integration with learning closure workflow

---

## Prioritization Recommendation

For MyFi Hub baseline readiness, gaps are prioritized as:

**High Priority (address soon):**
- None required before MyFi Hub work

**Medium Priority (address during MyFi development):**
- Gap 1: Automated Verifier–Tester
- Gap 2: Automated Reporter Signals

**Low Priority (backlog):**
- Gap 3: WO Location Consolidation
- Gap 4: share-pack.index.json Automation
- Gap 5: Branch Protection Verification
- Gap 6: Agent Registry / Heartbeat
- Gap 7: Evolution Agent Tooling

---

## Relationship to MyFi Readiness

None of these gaps block MyFi Hub baseline development. The Forge can operate with manual processes for verification and reporting while automation is built out incrementally.

The Director may choose to address some gaps during MyFi development as "Track A" (Forge) work alongside "Track B" (MyFi product) work, per the Dual-Track operating mode.

---

End of Gaps Document.
