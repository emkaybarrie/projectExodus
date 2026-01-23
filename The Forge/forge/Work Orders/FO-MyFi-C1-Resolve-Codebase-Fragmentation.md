📋 WORK ORDER

Task ID: FO-MyFi-C1-Resolve-Codebase-Fragmentation
Task Type: design · spec-sync
Intent Statement: Establish a single canonical MyFi codebase and formally define the rebuild strategy and status of legacy/experimental folders to eliminate architectural ambiguity for humans and agents.
Scope of Work:
- Declare canonical MyFi codebase location and rebuild strategy.
- Document the status and intended usage of:
  - legacy implementation folder(s)
  - experimental folder(s)
- Update MyFi canonical product truth to reflect the decision.
- Create migration strategy + parity matrix artifacts to support rebuild-from-scratch.
Allowed Files / Artifacts:
- The Forge/myfi/PRODUCT_STATE.md
- The Forge/myfi/MYFI_ARCHITECTURE_MAP.md
- New: The Forge/myfi/MIGRATION_STRATEGY.md
- New: The Forge/myfi/MIGRATION_PARITY_MATRIX.md
References:
- The Forge/forge/FORGE_KERNEL.md (authority + process)
- The Forge/myfi/MYFI_CAPSULE.md
- The Forge/myfi/MYFI_STATUS_MATRIX.md
- The Forge/myfi/reference/MYFI_MASTER_REFERENCE.docx
- The Forge/myfi/reference/MYFI_REFERENCE_INDEX.json
Success Criteria:
- Canonical codebase is explicitly declared as: ProjectMyFi_vLatest/
- Rebuild-from-scratch strategy is explicitly declared and bounded.
- Legacy and experimental folders have explicit documented status and allowed use.
- A parity matrix exists to ensure required functionality is not lost during rebuild.
- No code is changed as part of this Work Order (documentation/spec only).
Forbidden Changes:
- No code changes in any /Project MyFi/ folders
- No refactors or file moves in codebase
- No changes to semantic intent of MyFi reference document
Assumptions & Dependencies:
- Director decision is final and recorded in this work order.
Expected Outputs:
- Updated PRODUCT_STATE.md
- Updated MYFI_ARCHITECTURE_MAP.md
- MIGRATION_STRATEGY.md
- MIGRATION_PARITY_MATRIX.md
Agent Ownership:
- Director: Approval authority (done)
- Architect: Guidance + coherence review
- Executor (Claude): May implement these doc changes once allowed by Director
Review & Reflection Notes:
- This WO is a gate to unlock subsequent WOs (Hub spec, vitals contracts, quests scaffold, journeys spec).
- After completion, run FO-Claude-01-Reconcile-MyFi-Reference again to confirm alignment improved.
