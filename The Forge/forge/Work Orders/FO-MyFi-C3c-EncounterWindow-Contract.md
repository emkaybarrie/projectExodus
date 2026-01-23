📋 WORK ORDER

Task ID: FO-MyFi-C3c-EncounterWindow-Contract
Task Type: spec-sync
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Define the formal Part contract for EncounterWindow — the autobattler visibility zone
mounted in the Hub's encounterWindow slot. This contract establishes the boundary between
passive observation (Hub-owned) and active engagement (escalation to turn-based, out-of-Hub).

Scope of Work:
- Define EncounterWindow contract schema
- Specify input data shape for encounter states (idle, available, observing)
- Specify encounter summary display requirements (minimal stub)
- Specify allowed actions (engage only — dismiss omitted Phase 1)
- Define escalation boundary semantics
- Document constraints (what the Part must NOT assume or implement)
- Ensure contract supports Phase 1 placeholder while being future-ready

Allowed Files / Artifacts:
- New: /The Forge/myfi/specs/parts/contracts/ENCOUNTERWINDOW_CONTRACT.md

References:
- /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md (Section 6)
- /The Forge/myfi/specs/parts/HUB_PARTS_INDEX.md (Section 2.3)
- /The Forge/myfi/specs/parts/contracts/VITALSHUD_CONTRACT.md (pattern)
- /The Forge/myfi/specs/system/JOURNEYS_SPEC.md (action binding)
- /The Forge/myfi/MYFI_GLOSSARY.md

Director Decisions (LOCKED):
1. Encounter data shape: Option A — minimal stub (id, type, summary fields only)
2. Dismiss action: Option B — omit entirely until gameplay spec exists
3. Autobattler visibility: Option A — Part shows idle | available | observing

Success Criteria:
- ENCOUNTERWINDOW_CONTRACT.md exists and defines:
  - Part identity (ID, slot, category, phase status)
  - Input data shape (display state, encounter stub)
  - Display state semantics (idle, available, observing)
  - Action signatures (engage — escalation intent)
  - Escalation boundary (Part emits vs parent handles)
  - Constraints (what Part must NOT do)
  - Validation checklist
- Contract is implementation-agnostic
- Contract supports Phase 1 placeholder AND Phase 2+ functional Part
- No code is written

Forbidden Changes:
- No code changes in any folder
- No changes to HUB_SURFACE_SPEC.md, HUB_PARTS_INDEX.md, or sibling contracts
- No combat/gameplay rules (damage, resolution, RNG)
- No turn-based mechanics
- No Badlands mechanics
- No encounter generation or queue logic

Assumptions & Dependencies:
- C2 (Hub spec) is complete
- C3 (VitalsHUD contract) is complete
- C3b (StatusBar contract) is complete
- H2 (Journeys spec) is complete
- Encounter generation, combat rules, turn-based mechanics are future specs

Expected Outputs:
- ENCOUNTERWINDOW_CONTRACT.md

Agent Ownership:
- Director: Approval authority (done)
- Architect: Contract design / coherence review
- Executor (Claude): Implementation of spec artifacts

Review & Reflection Notes:
- EncounterWindow is the most gameplay-adjacent Hub Part
- Phase 1 is placeholder-only; contract must support future gameplay
- engage action is the critical boundary: Part emits; Journey handles navigation
- Minimal encounter stub avoids over-specification before gameplay specs exist
