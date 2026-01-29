# FCL v2 Remediation Work Order Pack

**Generated:** 2026-01-29
**Source:** Full System Audit (FULL_SYSTEM_AUDIT_2026-01-29.md)
**Status:** Draft — Awaiting Director Approval

---

## Overview

This pack contains 6 Work Orders addressing gaps identified in the Full System Audit. Work Orders are prioritized by impact and ordered for optimal execution sequence.

**See Also:** [WO-PORTAL-WORLD-001.md](WO-PORTAL-WORLD-001.md) — World Model UX Alignment (drafted separately per ADDENDUM 3)

---

## WO-FCL-D1: Create Intent Persistence Layer

**Priority:** High
**Effort:** Small
**Lane:** Forge
**Status:** Draft

### Context

Director Intents are created via Portal but not persisted. The `state.intents` array exists in app.js but data is lost on page refresh. The DIRECTOR_INTENT_CONTRACT.md specifies storage at `The Forge/forge/exports/cognition/intents.json`.

### Acceptance Criteria

1. [ ] Create `intents.json` file at `The Forge/forge/exports/cognition/intents.json` with empty schema:
   ```json
   {
     "intentsType": "DirectorIntentIndex",
     "schemaVersion": "1.0.0",
     "generatedAt": "2026-01-29T00:00:00.000Z",
     "intents": [],
     "counts": { "total": 0, "active": 0, "completed": 0, "abandoned": 0 }
   }
   ```
2. [ ] Add Intent loading to Portal `loadData()` function (fetch intents.json)
3. [ ] Create localStorage queue pattern for Intent persistence (matches Chronicler pattern)
4. [ ] Implement `recordIntentCreation()` function in app.js
5. [ ] Create `flush-intents.mjs` script in `forge/ops/scripts/`
6. [ ] Verify Intent survives page refresh (via localStorage queue)

### Technical Notes

- Follow Chronicler pattern: localStorage queue → flush script → file
- Intent ID format: `DI-{timestamp}-{random4}`
- Portal can display queued (unsaved) vs persisted Intents differently

### Dependencies

None

---

## WO-FCL-D2: Complete Gate 5 (Continuation Contract Enforcement)

**Priority:** High
**Effort:** Small
**Lane:** Forge
**Status:** Draft

### Context

Gate 5 in `canTransition()` (app.js line 2558) is a stub with TODO comment. The gate should block WOs from being marked `executed` without a Continuation Contract.

### Acceptance Criteria

1. [ ] Complete Gate 5 implementation in `canTransition()`:
   ```javascript
   if (toStatus === 'executed') {
     const gateChecks = wo.gateChecks || {};
     if (!gateChecks.continuationContract?.present) {
       return { allowed: false, reason: 'Continuation Contract required before marking executed' };
     }
   }
   ```
2. [ ] Add `RR-CC-BLOCK` Reflex Rule for hard enforcement (or update existing RR-CC-MISSING)
3. [ ] Test that WO without CC cannot transition to executed status
4. [ ] Verify gate can be bypassed in 'observe' mode for legacy WOs
5. [ ] Update REFLEX_RULES_CONTRACT.md to document the enforcement change

### Technical Notes

- RR-CC-MISSING already exists with `enforcement: 'hard'` — may need behavioral alignment
- Consider adding a "Mark CC Present" action in Portal WO detail view

### Dependencies

None (can proceed in parallel with WO-FCL-D1)

---

## WO-FCL-D3: Add WO Spawn from Intent Flow

**Priority:** Medium
**Effort:** Medium
**Lane:** Forge
**Status:** Draft

### Context

Currently, WOs are created independently and manually linked to Intents via `intentId`. The DIRECTOR_INTENT_CONTRACT.md specifies that "Intents spawn WOs during requirements phase" and tracks them in `spawnedWOs` array.

### Acceptance Criteria

1. [ ] Add "Spawn WO" button to Intent detail view (visible when Intent is in requirements phase or later)
2. [ ] Create `spawnWOFromIntent(intentId)` function that:
   - Opens WO creation flow with `intentId` pre-filled
   - Adds new WO ID to Intent's `spawnedWOs` array
   - Records `intent_wo_spawned` event in Chronicler
3. [ ] Display spawned WOs in Intent detail view with status badges
4. [ ] Add "Link Existing WO" option for manually associating legacy WOs
5. [ ] Show Intent breadcrumb in WO detail view when `intentId` is present

### Technical Notes

- WO creation can use existing flow with added `intentId` parameter
- Consider showing Intent phase ribbon in WO detail when linked

### Dependencies

- WO-FCL-D1 (Intent persistence) should be complete first

---

## WO-FCL-D4: Implement Intent Phase Auto-Calculation

**Priority:** Medium
**Effort:** Medium
**Lane:** Forge
**Status:** Draft

### Context

Per DIRECTOR_INTENT_CONTRACT.md: "Phase is determined by most advanced spawned WO." Currently, Intent phase must be manually updated. This WO implements automatic phase derivation.

### Acceptance Criteria

1. [ ] Create `calculateIntentPhase(intent)` function that:
   - Examines all spawned WOs
   - Returns the most advanced phase based on WO statuses
   - Handles edge cases (no WOs, all WOs blocked, etc.)
2. [ ] Create WO status → Intent phase mapping:
   | WO Status | Intent Phase |
   |-----------|--------------|
   | draft | ideation |
   | pending-approval | requirements |
   | approved | dissonance |
   | executing | execution |
   | executed | validation |
   | deployed-dev | finalisation |
   | deployed-prod | production |
   | observed/evolved | reflection |
3. [ ] Auto-update Intent phase when spawned WO transitions
4. [ ] Record `intent_phase_change` event in Chronicler
5. [ ] Display calculated phase in Phase Cockpit with derivation source

### Technical Notes

- Phase can only advance forward (per contract)
- Director can manually advance phase ahead of WO-derived value

### Dependencies

- WO-FCL-D1 (Intent persistence)
- WO-FCL-D3 (WO spawn flow provides spawnedWOs tracking)

---

## WO-FCL-D5: Unify Phase Arrays in Portal

**Priority:** Low
**Effort:** Small
**Lane:** Forge
**Status:** Draft

### Context

Portal has two phase arrays:
- `E2E_PHASES` (line 219): 9 WO-centric phases
- `INTENT_PHASES` (referenced in renderPhaseRibbon): 9 Intent lifecycle phases

These should be unified or explicitly mapped to avoid confusion.

### Acceptance Criteria

1. [ ] Audit all phase array usages in app.js
2. [ ] Create unified `FCL_V2_PHASES` constant with both perspectives:
   ```javascript
   const FCL_V2_PHASES = [
     { id: 'ideation', woStatus: 'draft', name: 'Ideation', role: 'Director' },
     { id: 'requirements', woStatus: 'pending-approval', name: 'Requirements', role: 'Architect' },
     // ... etc
   ];
   ```
3. [ ] Deprecate separate `E2E_PHASES` and `INTENT_PHASES` arrays
4. [ ] Update all renderers to use unified array
5. [ ] Document phase mapping in code comments

### Technical Notes

- Ensure backward compatibility for screens still using E2E_PHASES
- Phase Cockpit should show Intent phases, WO cards show WO status

### Dependencies

None (can proceed independently)

---

## WO-FCL-D6: Document WO↔Intent Phase Mapping in Contract

**Priority:** Low
**Effort:** Small
**Lane:** Forge
**Status:** Draft

### Context

WORK_ORDER_LIFECYCLE_CONTRACT.md describes WO states but doesn't reference Intent phases. Adding a mapping table will clarify the relationship.

### Acceptance Criteria

1. [ ] Add new section to WORK_ORDER_LIFECYCLE_CONTRACT.md: "## Relationship to Director Intent Phases"
2. [ ] Include mapping table:
   | WO State | Intent Phase | Notes |
   |----------|--------------|-------|
   | Draft | ideation | WO not yet formalized |
   | Approved | dissonance | Post-requirements |
   | Executing | execution | Implementation |
   | Verified | validation | Acceptance testing |
   | Deployed Dev | finalisation | Pre-production |
   | Deployed Prod | production | Released |
   | Observed | reflection | Post-release |
3. [ ] Add cross-reference to DIRECTOR_INTENT_CONTRACT.md
4. [ ] Note that WO status is granular, Intent phase is aggregate

### Technical Notes

- This is documentation-only change
- No code changes required

### Dependencies

None (can proceed independently)

---

## Execution Order Recommendation

**Parallel Track A (High Priority):**
1. WO-FCL-D1 (Intent Persistence)
2. WO-FCL-D3 (WO Spawn Flow) — after D1
3. WO-FCL-D4 (Phase Auto-Calc) — after D3

**Parallel Track B (High Priority):**
1. WO-FCL-D2 (Gate 5 Completion)

**Independent (Low Priority):**
- WO-FCL-D5 (Phase Array Unification)
- WO-FCL-D6 (Contract Documentation)

---

## Approval

**Director Review Required**

To approve this pack:
1. Review each WO's acceptance criteria
2. Confirm priority assignments
3. Select execution order
4. Mark individual WOs as Approved

---

End of Remediation Pack.
