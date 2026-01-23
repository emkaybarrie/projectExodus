📋 WORK ORDER

Task ID: FO-MyFi-C2-Hub-Rebuild-Spec
Task Type: spec-sync
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Define the Hub surface composition under the Surfaces/Slots/Parts architecture,
establishing the canonical slot layout, part requirements, and interaction model
without writing implementation code.

Scope of Work:
- Define Hub surface purpose and role in MyFi UX
- Specify slot layout (regions within the Hub screen)
- Document interaction depth model as it applies to Hub
- Identify required Parts and their contracts (by name, not implementation)
- Separate "what must exist" (intent) from "how it renders" (implementation)

Allowed Files / Artifacts:
- New: /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md
- New: /The Forge/myfi/specs/parts/HUB_PARTS_INDEX.md
- Optional update: /The Forge/myfi/MIGRATION_PARITY_MATRIX.md (if new capabilities discovered)

References:
- /The Forge/myfi/reference/MYFI_REFERENCE_INDEX.json (sections: hub, vitals, interaction_continuum)
- /The Forge/myfi/MYFI_GLOSSARY.md
- /The Forge/myfi/MIGRATION_PARITY_MATRIX.md
- /The Forge/myfi/PRODUCT_STATE.md
- Legacy: Project MyFi/vitals/vitals-screen-manager.js (operational reference)
- Experimental: ProjectMyFi_vExperimental/src/parts/HubShell/ (idea quarry)

Director Decisions (LOCKED):
1. Shell vs slots: Hybrid, shell-aware approach. Hub spec defines Hub-owned inner slots. Header/footer may be provided by chrome/runtime but must be represented as boundaries in the spec.
2. Encounter window Phase 1: Placeholder acceptable. EncounterWindow must exist structurally and define the autobattler boundary, but gameplay may be minimal.
3. View modes: REQUIRED at the intent/spec level. Exact UX is implementation-defined.
4. Verified vs Unverified: Must be visible in the Hub via a StatusBar slot. Treated as player-facing state, not hidden global-only logic.

Additional Constraint:
- This spec must NOT define gameplay/combat rules or Badlands mechanics.

Success Criteria:
- HUB_SURFACE_SPEC.md exists and defines:
  - Hub purpose statement
  - Slot layout with named regions
  - Interaction depth model (HUD → autobattler boundary)
  - View mode requirements (daily/weekly or similar)
  - Verified vs Unverified mode distinction
- HUB_PARTS_INDEX.md exists and lists:
  - Required parts by name (e.g., VitalsHUD, EncounterWindow)
  - Data hooks each part requires
  - Actions each part may trigger
- No implementation code is written
- Spec is sufficient for an implementer to build the Hub without ambiguity

Forbidden Changes:
- No code changes in any folder
- No changes to existing surface.json files
- No new Parts implementations (contracts only)
- No changes to semantic intent from reference document
- No gameplay/combat rules or Badlands mechanics

Assumptions & Dependencies:
- C1 is complete (canonical codebase declared)
- Reference document sections "hub", "vitals", "interaction_continuum" are authoritative for intent
- Legacy implementation is reference-only (not to be copied verbatim)

Expected Outputs:
- HUB_SURFACE_SPEC.md
- HUB_PARTS_INDEX.md

Agent Ownership:
- Director: Approval authority (done)
- Architect: Spec drafting / coherence review
- Executor (Claude): May draft spec content once approved

Review & Reflection Notes:
- This WO gates C3 (Vitals Parts Contracts) — contracts cannot be defined until slots are known
- The spec should remain implementation-agnostic where possible
- Encounter window can be "placeholder-ready" for Phase 1 (minimal visual, no gameplay)
