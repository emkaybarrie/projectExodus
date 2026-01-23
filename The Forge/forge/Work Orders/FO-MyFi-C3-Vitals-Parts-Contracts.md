📋 WORK ORDER

Task ID: FO-MyFi-C3-Vitals-Parts-Contracts
Task Type: spec-sync
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Define the formal Part contract for VitalsHUD, specifying the required data shape,
view mode support, allowed actions, and constraints — without prescribing implementation.

Scope of Work:
- Define VitalsHUD contract.json schema
- Specify required input data shape (vitals object)
- Specify view mode contract (daily/weekly)
- Specify allowed actions and their signatures
- Document constraints (what the Part must NOT assume)
- Ensure contract is sufficient for implementation without ambiguity

Allowed Files / Artifacts:
- New: /The Forge/myfi/specs/parts/contracts/VITALSHUD_CONTRACT.md

References:
- /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md (slot requirements)
- /The Forge/myfi/specs/parts/HUB_PARTS_INDEX.md (hooks/actions summary)
- /The Forge/myfi/MYFI_GLOSSARY.md (Vitals semantics)
- /The Forge/myfi/MIGRATION_PARITY_MATRIX.md (parity requirements)
- Legacy: Project MyFi/vitals/vitals-screen-manager.js (operational reference)

Director Decisions (LOCKED):
1. StatusBar and EncounterWindow contracts: separate Work Orders (C3 remains VitalsHUD-only).
2. Essence softCap: input-only metadata; do NOT specify clamping/enforcement behaviour in the contract.
3. Delta indicators: optional for Phase 1 (delta stays optional).

Architect Refinements (APPLIED):
- Header block with partId and schemaVersion
- Numeric expectations: values may be non-integers; display rounding is implementation-defined
- Constraint: softCap is advisory display metadata; Part must not enforce economics/business rules

Success Criteria:
- VITALSHUD_CONTRACT.md exists and defines:
  - Input data shape (TypeScript-style interface, implementation-agnostic)
  - View mode requirements (daily/weekly switching)
  - Action signatures (setViewMode, openVitalDetail)
  - Constraints (what Part must NOT assume about data source)
- Contract is implementation-agnostic (no rendering specifics)
- Contract is sufficient for an implementer to build the Part
- No code is written

Forbidden Changes:
- No code changes in any folder
- No changes to HUB_SURFACE_SPEC.md or HUB_PARTS_INDEX.md
- No rendering/styling decisions
- No gameplay or Badlands mechanics

Assumptions & Dependencies:
- C2 is complete (Hub spec exists)
- Vitals semantics from GLOSSARY are authoritative
- Data will be provided by a Feature Pack (contract does not define the provider)

Expected Outputs:
- VITALSHUD_CONTRACT.md

Agent Ownership:
- Director: Approval authority (done)
- Architect: Contract design / coherence review (refinements applied)
- Executor (Claude): Implementation of spec artifacts

Review & Reflection Notes:
- This contract enables implementation Work Orders to follow
- StatusBar and EncounterWindow contracts are separate Work Orders
- Contract format should be reusable for future Parts
