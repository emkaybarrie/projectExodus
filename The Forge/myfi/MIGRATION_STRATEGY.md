🛠 MIGRATION_STRATEGY.md

Status: Canonical (C1 Output)
Audience: Director and all agents
Purpose: Define how the rebuild-from-scratch proceeds without losing required capability

1. Strategy Summary

We rebuild MyFi inside the canonical codebase:

✅ ProjectMyFi_vLatest/

We do not incrementally migrate legacy code forward.

Legacy and experimental folders are reference sources only.

2. Inputs and Authority

Canonical intent:
- MyFi Master Reference (Word doc)
- Reference Index (JSON)
- MyFi manifests and Product State

Reference inputs (non-authoritative):
- Project MyFi/ (legacy implementation)
- ProjectMyFi_vExperimental/ (experimental patterns)

3. Rebuild Method (Truth Scaffolding)

The rebuild proceeds in this order:

A) Decide and document canonical architecture decisions (C1 done)
B) Specify Hub rebuild composition (slots + parts)
C) Define parts contracts (data hooks + required VM shape)
D) Define Journeys spec and runtime decision
E) Implement minimal Hub (HUD + placeholder encounter window)
F) Implement Quests as the reference surface
G) Only then port secondary capabilities (auth, settings, logs, etc.)

4. Parity Protection

We maintain a MIGRATION_PARITY_MATRIX.

Any feature is classified as:

- MUST KEEP
- NICE TO KEEP
- REJECT
- UNDECIDED

No feature is implemented in canonical without a classification.

5. Anti-Patterns (Forbidden)

- "Copy the old code into the new folder"
- "Quick fix in legacy to keep moving"
- "Adopt experimental as-is"
- "Introduce new features while scaffolding is missing"

6. Completion Signal for Migration Phase 1

Phase 1 is complete when:

- Hub in canonical renders the vitals HUD (H/M/S/Essence) via Parts
- Data contracts exist and are validated
- Journeys exist and can open Hub/Quests deterministically
- Quests surface exists and is built using the canonical workflow

End of Migration Strategy.
