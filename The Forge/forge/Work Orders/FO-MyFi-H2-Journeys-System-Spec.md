📋 WORK ORDER

Task ID: FO-MyFi-H2-Journeys-System-Spec
Task Type: spec-sync
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Define the Journeys system for MyFi — the thin orchestration layer that coordinates
navigation, modals, and surface transitions in response to Part-emitted actions.

Scope of Work:
- Define Journey purpose and role in MyFi architecture
- Define when Journeys are used vs direct wiring
- Define Journey lifecycle (start, step, end)
- Define Journey schema (JSON format)
- Define interaction with Surfaces, Parts, and Actions
- Define boundaries (what Journeys must NOT do)
- Ensure spec is sufficient for implementation without ambiguity

Allowed Files / Artifacts:
- New: /The Forge/myfi/specs/system/JOURNEYS_SPEC.md

References:
- /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md
- /The Forge/myfi/specs/parts/contracts/VITALSHUD_CONTRACT.md
- /The Forge/myfi/MYFI_GLOSSARY.md
- /The Forge/myfi/PRODUCT_STATE.md
- /The Forge/myfi/MIGRATION_PARITY_MATRIX.md
- Experimental: ProjectMyFi_vExperimental/src/journeys/ (idea quarry)
- Experimental: tools/surfaces-studio/modules/journeyRunner.js (idea quarry)

Director Decisions (LOCKED):
1. Trigger binding: Auto-bind via trigger field
2. Conditionals: None in Phase 1 (purely sequential)
3. Error handling: Minimal cancel/timeout semantics
4. Discovery: Hybrid (manifest registration + convention discovery)

Success Criteria:
- JOURNEYS_SPEC.md exists and defines:
  - Journey purpose and architectural role
  - Use cases (when to use Journeys)
  - Lifecycle model (start → steps → end)
  - JSON schema for journey definition
  - Supported operations (navigate, openModal, wait, etc.)
  - Action binding (how Parts trigger Journeys)
  - Constraints (what Journeys must NOT do)
- Spec is implementation-agnostic (no runtime assumptions)
- Spec works with existing Part contracts (VitalsHUD actions)
- No code is written

Forbidden Changes:
- No code changes in any folder
- No changes to existing specs (HUB_SURFACE_SPEC, VITALSHUD_CONTRACT)
- No gameplay or combat logic
- No business rule definitions
- No router/framework assumptions

Assumptions & Dependencies:
- C2 (Hub spec) is complete
- C3 (VitalsHUD contract) is complete
- Parts emit actions upward; Journeys respond

Expected Outputs:
- JOURNEYS_SPEC.md

Agent Ownership:
- Director: Approval authority (done)
- Architect: Spec design / coherence review
- Executor (Claude): Implementation of spec artifacts

Review & Reflection Notes:
- This spec unlocks implementation of the Journey runtime
- Keep schema minimal; extend via versioning if needed
- Journeys should be human-readable for QA/demo authoring
