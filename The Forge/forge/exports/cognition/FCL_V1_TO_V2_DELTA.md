# FCL v1 to v2 Delta Analysis

**Generated:** 2026-01-29
**Status:** Audit Complete
**Scope:** Read-only analysis identifying gaps between FCL v1 (current) and FCL v2 (authority model)

---

## 1. INTENT GAP REPORT

### 1.1 Places Where "Director Idea" is Implied But Not Represented

| Location | Line(s) | Implied Concept | Structure Type |
|----------|---------|-----------------|----------------|
| `portal/app.js` | 1100-1101 | `wo-intent` textarea captures "WHY" but as WO field, not entity | Structural |
| `FORGE_KERNEL.md` | 285 | "Intent Capture" is Phase 1 but not tracked as artifact | Documentary |
| `CONTINUATION_CONTRACT.md` | 69 | `linked_wo_id` for follow-ups only, no parent-child grouping | Structural |
| `FORGE_OS_ROLE_SYSTEM.md` | 28 | "Absolute intent + arbitration" — Director authority, not entity | Documentary |
| `WORK_ORDER_LIFECYCLE_CONTRACT.md` | 153, 182 | Evolution proposals proxy for ideas but tied to WO lifecycle | Structural |
| `PRODUCT_STATE.md` | 75, 116 | "Idea quarry" folders — unstructured, no entity model | Structural |
| `FORGE_CAPSULE.md` | 186-192 | Dual-track mode (Track A/B) — implicit initiatives | Documentary |

### 1.2 Data Structures Involved

- **work-orders.index.json** — No `intentId` field
- **ChroniclerEntry schema** — No `intentId` in context
- **FSP genome section** — Artifacts not linked to originating intent
- **Continuation Contract** — `linked_wo_id` is optional and follow-up only

### 1.3 Minimal Insertion Points for Intent Artifact

| Insertion Point | Change Required | Impact |
|-----------------|-----------------|--------|
| **WORK_ORDER_INDEX_CONTRACT.md** | Add `intentId: string \| null` to WO Entry schema | LOW — additive field |
| **work-orders.index.json** | Populate `intentId` on new WOs | LOW — existing entries remain valid |
| **ChroniclerEntry schema** | Add `intentId` to context object | LOW — additive field |
| **FSP schema** | Add `intents[]` array to track active Director ideas | MEDIUM — new top-level section |
| **Portal** | New "Intent" entity creation flow | MEDIUM — new UI surface |

### 1.4 Proposed Intent Entity Schema

```json
{
  "intentType": "DirectorIntent",
  "schemaVersion": "1.0.0",
  "id": "DI-{timestamp}-{random}",
  "createdAt": "ISO8601",
  "createdBy": "director",

  "title": "short title",
  "narrative": "1-3 paragraphs of intent description",
  "successSignals": ["bullet points"],
  "riskFlags": ["optional risk flags"],

  "classification": "feature | refactor | exploration | governance | evolution",
  "status": "active | completed | abandoned",

  "spawnedWOs": ["FO-XXX-ID", "FO-YYY-ID"],
  "phase": "ideation | requirements | dissonance | design | execution | validation | finalisation | production | reflection"
}
```

---

## 2. PHASE AUTHORITY MAP

### 2.1 All Phase References Enumerated

#### E2E_PHASES Array Definition
- **File:** `portal/app.js:161-167`
- **Classification:** ADVISORY (UI reference data only)
- **Phases Defined:** draft, approved, executing, verified, deployed-dev, promoted, deployed-prod, observed, evolved

#### Status Field References

| Location | Code Pattern | Classification |
|----------|--------------|----------------|
| `app.js:560-561` | Filter: `['approved', 'ready-for-executor', 'executing']` | ADVISORY |
| `app.js:2596` | `if (state.woFilter !== 'all')` filter | ADVISORY |
| `app.js:3112` | `isPendingApproval = wo.status === 'pending-approval'` | SOFT_GATE |
| `app.js:3116-3170` | Director action section conditional | SOFT_GATE |
| `app.js:3222-3226` | Execute button: `wo.status === 'approved'` | **SOFT_GATE (critical)** |
| `app.js:5117` | Execute button duplicate conditional | SOFT_GATE |

### 2.2 Advisory vs Authoritative Classification

| Component | Classification | Reason |
|-----------|----------------|--------|
| E2E_PHASES array | ADVISORY | Display only, no enforcement |
| Status chip rendering | ADVISORY | Visual indication only |
| WO list filtering | ADVISORY | UI filtering, not data validation |
| `isPendingApproval` conditional | SOFT_GATE | Hides UI but no runtime block |
| Execute button conditional | SOFT_GATE | Button hidden if not approved, but no server validation |
| `approveWorkOrder()` function | **AUTHORITATIVE** | Actually changes GitHub labels |
| `rejectWorkOrder()` function | **AUTHORITATIVE** | Actually changes GitHub labels |
| `triggerDeployToProd()` | **AUTHORITATIVE** | Dispatches deployment workflow |

### 2.3 Hard Gating Insertion Points (Minimal Disruption)

| Location | Current State | Proposed Gate | Disruption Level |
|----------|---------------|---------------|------------------|
| `app.js:3222` | UI conditional only | Add `canTransition(woId, 'approved', 'executing')` check | LOW |
| `app.js:2738` | No deployment gate | Add `canDeploy(targetEnv)` → verify smoke PASS | MEDIUM |
| `app.js:364` | No approval prerequisites | Add `canApprove(woId)` → verify dissonance scan complete | MEDIUM |
| `handleExecute()` | Copies command only | Add async validation of current WO status | LOW |

### 2.4 Proposed `canTransition()` Function

```javascript
function canTransition(woId, fromPhase, toPhase) {
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (!wo) return { allowed: false, reason: 'WO not found' };

  // Phase order enforcement
  const phaseOrder = ['draft', 'pending-approval', 'approved', 'executing', 'executed'];
  const currentIdx = phaseOrder.indexOf(wo.status);
  const targetIdx = phaseOrder.indexOf(toPhase);

  if (targetIdx !== currentIdx + 1) {
    return { allowed: false, reason: `Cannot skip from ${wo.status} to ${toPhase}` };
  }

  // Gate-specific checks
  if (toPhase === 'approved' && !wo.dissonanceScanComplete) {
    return { allowed: false, reason: 'Dissonance scan required before approval' };
  }

  if (toPhase === 'executing' && !wo.continuationContract && wo.status === 'executed') {
    return { allowed: false, reason: 'Continuation Contract required for executed WOs' };
  }

  return { allowed: true };
}
```

---

## 3. WORK ORDER STRUCTURE DELTA

### 3.1 Contract vs Runtime Gap Analysis

| Field | In Contract | In Runtime | Gap |
|-------|-------------|------------|-----|
| `id` | Required | Implemented | None |
| `title` | Required | Implemented | None |
| `status` | Required | Implemented | None |
| `lastUpdated` | Required | Implemented | None |
| `filePath` | Required | Implemented | None |
| `repoUrl` | Required | Implemented | None |
| `lane` | Optional | Implemented | None |
| `entity` | Optional | Implemented | None |
| `issueUrl` | Optional | Implemented | None |
| `prUrl` | Optional | Implemented | None |
| `deploy` | Optional | Implemented | None |
| `agent` | Optional | Implemented | None |
| `intentId` | **NOT DEFINED** | Not implemented | **GAP** |
| `phase` | **NOT DEFINED** | Not implemented | **GAP** |
| `gateChecks` | **NOT DEFINED** | Not implemented | **GAP** |
| `continuationContract` | Implied | Not in index | **GAP** |
| `dissonanceScanComplete` | **NOT DEFINED** | Not implemented | **GAP** |

### 3.2 Required Fields for FCL v2

#### New Fields to Add to WORK_ORDER_INDEX_CONTRACT.md

```json
{
  "intentId": "DI-XXX-ID | null",
  "phase": "ideation | requirements | dissonance | design | execution | validation | finalisation | production | reflection",
  "gateChecks": {
    "dissonanceScan": { "completed": boolean, "timestamp": "ISO8601 | null" },
    "continuationContract": { "present": boolean, "woId": "WO-ID | null" },
    "verifierApproval": { "completed": boolean, "timestamp": "ISO8601 | null" }
  },
  "parentWoId": "FO-XXX-ID | null",
  "childWoIds": ["FO-XXX-ID"]
}
```

### 3.3 Malformed or Unenforced Assumptions

| Assumption | Where | Status |
|------------|-------|--------|
| WO has valid status value | Runtime | **UNENFORCED** — any string accepted |
| `lane` matches known lanes | Runtime | **UNENFORCED** — any string accepted |
| `issueUrl` is valid GitHub URL | Runtime | **UNENFORCED** — format not validated |
| Status transitions follow lifecycle | Contract | **UNENFORCED** — any transition allowed |
| Executed WO has Continuation Contract | Contract | **UNENFORCED** — Reflex warns but doesn't block |
| Approval requires Director role | Contract | **UNENFORCED** — PAT token is only gate |

---

## 4. PORTAL ACTION BINDINGS

### 4.1 All State-Changing Actions

| Action | Function | Location | State Changed | Precondition Check |
|--------|----------|----------|---------------|-------------------|
| Approve WO | `approveWorkOrder()` | app.js:364-389 | GitHub labels | `issueNumber` exists only |
| Reject WO | `rejectWorkOrder()` | app.js:391-417 | GitHub labels | `issueNumber` exists only |
| Execute WO | `handleExecute()` | app.js:2771-2777 | Triggers execution | **UI check only** |
| Deploy Prod | `triggerDeployToProd()` | app.js:2738-2769 | Deployment workflow | **PAT only** |
| Refresh Share Pack | `triggerSharePackRefresh()` | app.js:433-469 | System state | **PAT only** |
| Repo Executor Dispatch | `triggerRepoExecutorDispatch()` | app.js:696-732 | Repo operations | **No WO validation** |
| Post Agent Output | `submitAgentOutputToGitHub()` | app.js:932-960 | GitHub Issue | **No content validation** |
| Post Proposal | `handlePostProposalToGitHub()` | app.js:4484-4512 | GitHub Issue | **No auth check** |
| Run Heartbeat | `runHeartbeat()` | app.js:1120-1369 | Multiple systems | **No freshness check** |
| Add Chronicler Note | `addChroniclerNote()` | app.js:1912-1920 | Audit log | **No content validation** |
| Save PAT | `savePATFromModal()` | app.js:5624-5655 | System auth | Checkbox consent only |

### 4.2 Actions That Can Bypass Intended Process Order

| Action | Bypass Risk | Current Mitigation | Proposed Gate |
|--------|-------------|-------------------|---------------|
| `handleExecute()` | Can copy execution command for any WO | UI hides button if not approved | `canTransition()` check |
| `triggerDeployToProd()` | Can deploy without smoke test pass | Optional UI modal | `canDeploy()` check |
| `approveWorkOrder()` | Can approve without dissonance scan | None | `canApprove()` check |
| `triggerRepoExecutorDispatch()` | Can execute on any branch with any "WO ID" | None | WO existence validation |
| `handleImportAgentOutput()` | Can inject arbitrary content | None | Source verification |

### 4.3 Candidates for Disablement via `canTransition()`

```javascript
// Wrap handleExecute
window.handleExecuteWo = function(woId) {
  const check = canTransition(woId, 'approved', 'executing');
  if (!check.allowed) {
    showToast(`Cannot execute: ${check.reason}`, 'error');
    return;
  }
  const wo = state.workOrders?.workOrders?.find(w => w.id === woId);
  if (wo) handleExecute(wo);
};

// Wrap approveWorkOrder
async function approveWorkOrder(wo) {
  const check = canTransition(wo.id, 'pending-approval', 'approved');
  if (!check.allowed) {
    showToast(`Cannot approve: ${check.reason}`, 'error');
    return false;
  }
  // ... existing implementation
}

// Wrap triggerDeployToProd
async function triggerDeployToProd() {
  const check = canDeploy('prod');
  if (!check.allowed) {
    showToast(`Cannot deploy: ${check.reason}`, 'error');
    return;
  }
  // ... existing implementation
}
```

---

## 5. REFLEX → ENFORCEMENT UPLIFT

### 5.1 Current Reflex Rules

| Rule ID | Current Severity | Current Enforcement | Description |
|---------|------------------|---------------------|-------------|
| RR-CC-MISSING | warning | soft | Executed WO without Continuation Contract |
| RR-WO-STUCK | caution | soft | WO unchanged for 7+ days |
| RR-SMOKE-FAIL | alert | soft | Production smoke tests failing |
| RR-FSP-STALE | info | soft | FSP not refreshed in 48+ hours |
| RR-RISK-UNMITIGATED | warning | soft | High-severity risk without mitigation |

### 5.2 Proposed Severity Mapping (v2)

| Rule ID | v1 Severity | v2 Severity | v2 Enforcement | Rationale |
|---------|-------------|-------------|----------------|-----------|
| RR-CC-MISSING | warning | **warning** | **block** | FCL v1 contract: "Without CC, WO is not complete" |
| RR-WO-STUCK | caution | caution | warn | Advisory only, no structural requirement |
| RR-SMOKE-FAIL | alert | **alert** | **block** | Cannot deploy to prod with smoke failing |
| RR-FSP-STALE | info | info | warn | Advisory, no blocking justification |
| RR-RISK-UNMITIGATED | warning | **alert** | **block** (for critical) | Critical risks must have mitigation |

### 5.3 New Rules to Add for v2

| Rule ID | Severity | Enforcement | Trigger |
|---------|----------|-------------|---------|
| RR-DISSONANCE-MISSING | warning | **block** | WO approved without dissonance scan |
| RR-PHASE-SKIP | alert | **block** | WO attempts to skip phases |
| RR-INTENT-ORPHAN | caution | warn | WO without `intentId` |
| RR-GATE-BYPASS | alert | **block** | Action attempted without gate clearance |

### 5.4 Implementation Pattern

```javascript
// In REFLEX_RULES array
{
  id: 'RR-PHASE-SKIP',
  name: 'Phase Skip Attempted',
  description: 'Detects attempts to skip lifecycle phases',
  trigger: {
    condition: 'transition.fromPhase not adjacent to transition.toPhase',
    source: 'portal_action',
    frequency: 'on_action'
  },
  violation: {
    contract: 'WORK_ORDER_LIFECYCLE_CONTRACT.md',
    invariant: 'Phases cannot be skipped',
    severity: 'alert'
  },
  enforcement: 'hard',  // NEW: v2 enforcement level
  enabled: true
}

// In evaluateReflexRules, add enforcement check
if (rule.enforcement === 'hard' && triggered) {
  return { blocked: true, reason: warning.message };
}
```

---

## 6. CHRONICLER EXTENSION POINTS

### 6.1 Current ChroniclerEntry Schema

```json
{
  "entryType": "ChroniclerEntry",
  "schemaVersion": "1.0.0",
  "id": "chr-{timestamp}-{random}",
  "timestamp": "ISO8601",
  "eventType": "heartbeat | sentinel_warning | navigator_guidance | wo_transition | arc_change | risk_detected | manual_note",
  "domain": "system | workOrders | observations | risks | genome | agents | fsp",
  "summary": "one-line summary",
  "details": { ... },
  "context": {
    "activeArc": "arc at time",
    "fspVersion": "version",
    "healthScore": "score"
  },
  "source": "heartbeat | sentinel | navigator | portal | manual",
  "actor": "system | director | executor | agent-name"
}
```

### 6.2 Grouping by `intentId` — Extension Proposal

#### Minimal Metadata Additions

```json
{
  "context": {
    "activeArc": "arc at time",
    "fspVersion": "version",
    "healthScore": "score",
    "intentId": "DI-XXX-ID | null",      // NEW: Link to Director Intent
    "woId": "FO-XXX-ID | null",          // NEW: Link to Work Order
    "phase": "current phase | null"       // NEW: Lifecycle phase at time
  }
}
```

#### New Event Types for Intent Tracking

| Event Type | When Recorded | Domain |
|------------|---------------|--------|
| `intent_created` | Director creates new Intent | intents |
| `intent_wo_spawned` | WO created from Intent | intents |
| `intent_phase_change` | Intent moves to new phase | intents |
| `intent_completed` | Intent marked complete | intents |
| `intent_abandoned` | Intent abandoned with reason | intents |

### 6.3 Synthesis Query Patterns

```javascript
// Get all entries for a specific Intent
function getEntriesForIntent(intentId) {
  return state.chronicler.filter(e => e.context?.intentId === intentId);
}

// Get timeline for Intent
function getIntentTimeline(intentId) {
  return getEntriesForIntent(intentId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Synthesize Intent summary from Chronicler
function synthesizeIntentSummary(intentId) {
  const entries = getEntriesForIntent(intentId);
  const woSpawned = entries.filter(e => e.eventType === 'intent_wo_spawned').length;
  const phaseChanges = entries.filter(e => e.eventType === 'wo_transition');
  const warnings = entries.filter(e => e.eventType === 'sentinel_warning');

  return {
    intentId,
    totalEntries: entries.length,
    workOrdersSpawned: woSpawned,
    phaseTransitions: phaseChanges.length,
    warningsEncountered: warnings.length,
    timeline: getIntentTimeline(intentId)
  };
}
```

### 6.4 Recording Points to Add

| Function | Current Recording | Add Recording |
|----------|-------------------|---------------|
| `recordChroniclerEntry()` | Generic entry | Add `intentId` from WO context |
| `recordHeartbeatEntry()` | Heartbeat completion | Include `intentId` from active WO if any |
| New: `recordIntentCreation()` | N/A | Full intent creation record |
| New: `recordWOSpawn()` | N/A | Link WO to parent Intent |
| New: `recordPhaseTransition()` | N/A | Track phase changes with Intent context |

---

## 7. SUMMARY: DELTA SCOPE

### 7.1 Additive Changes (LOW disruption)

- Add `intentId` field to WO Index schema
- Add `intentId` to ChroniclerEntry context
- Add new event types for intent tracking
- Add `canTransition()` function (wrapper, not replacement)

### 7.2 Schema Extensions (MEDIUM disruption)

- Create DirectorIntent entity and contract
- Add `phase` field to WO Index schema
- Add `gateChecks` object to WO Index schema
- Extend Reflex Rules with `enforcement: hard` option

### 7.3 Behavioral Changes (MEDIUM disruption)

- Wrap state-changing actions with gate checks
- Escalate specific Reflex Rules from warn → block
- Add phase validation before transitions

### 7.4 NOT Recommended (HIGH disruption)

- Rewriting existing WO entries (violates migration rules)
- Removing soft enforcement (breaks backward compatibility)
- Mandatory Intent for all WOs (too disruptive for v2)

---

## 8. IMPLEMENTATION ORDER

1. **WORK_ORDER_INDEX_CONTRACT.md** — Add `intentId`, `phase`, `gateChecks` fields (additive)
2. **DirectorIntent Contract** — New canonical contract for Intent entity
3. **FSP schema** — Add `intents[]` section
4. **ChroniclerEntry schema** — Add `intentId`, `woId`, `phase` to context
5. **Reflex Rules** — Add `enforcement` field, new rules
6. **Portal `canTransition()`** — Implement gate function
7. **Portal action wrappers** — Wrap critical actions with gate checks
8. **Intent UI** — Add Intent creation/tracking to Portal

---

**End of Delta Analysis.**
