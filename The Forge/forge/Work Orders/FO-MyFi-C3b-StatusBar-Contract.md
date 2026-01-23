📋 WORK ORDER

Task ID: FO-MyFi-C3b-StatusBar-Contract
Task Type: spec-sync
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Define the formal Part contract for StatusBar, specifying the required data shape,
mode display requirements, and constraints — without prescribing implementation.

Scope of Work:
- Define StatusBar contract.json schema
- Specify required input data shape (mode, payCycle)
- Specify mode display requirements (Verified/Unverified)
- Specify ethical constraint: non-shaming presentation
- Specify allowed actions (if any)
- Document constraints (what the Part must NOT assume)
- Ensure contract is sufficient for implementation without ambiguity

Allowed Files / Artifacts:
- New: /The Forge/myfi/specs/parts/contracts/STATUSBAR_CONTRACT.md

References:
- /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md (slot requirements)
- /The Forge/myfi/specs/parts/HUB_PARTS_INDEX.md (hooks/actions summary)
- /The Forge/myfi/MYFI_GLOSSARY.md (mode definitions)
- /The Forge/myfi/PRODUCT_STATE.md (verified/unverified notes)

Success Criteria:
- STATUSBAR_CONTRACT.md exists and defines:
  - Input data shape (mode, payCycle)
  - Mode display semantics (Verified/Unverified)
  - Non-shaming presentation constraint
  - Action signatures (openModeInfo, optional)
  - Constraints (what Part must NOT assume)
- Contract is implementation-agnostic (no rendering specifics)
- Contract is sufficient for an implementer to build the Part
- No code is written

Forbidden Changes:
- No code changes in any folder
- No changes to HUB_SURFACE_SPEC.md, HUB_PARTS_INDEX.md, or VITALSHUD_CONTRACT.md
- No rendering/styling decisions
- No business rule definitions (mode enforcement)

Assumptions & Dependencies:
- C2 (Hub spec) is complete
- C3 (VitalsHUD contract) is complete
- Mode is determined upstream; StatusBar only displays

Expected Outputs:
- STATUSBAR_CONTRACT.md

Agent Ownership:
- Director: Approval authority (done)
- Architect: Contract design / coherence review
- Executor (Claude): Implementation of spec artifacts

Review & Reflection Notes:
- StatusBar is simpler than VitalsHUD; contract should be concise
- Non-shaming presentation is an ethical requirement, not a visual spec
- Pay cycle display is optional for Phase 1
