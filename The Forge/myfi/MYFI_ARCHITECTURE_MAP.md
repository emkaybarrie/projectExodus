🧭 MYFI_ARCHITECTURE_MAP.md

Status: Canonical · Architecture Orientation Map
Audience: Director and all agents
Purpose: Provide a shared architectural understanding, and prevent drift between intent and implementation

1. Canonical Location (C1 — LOCKED)

Canonical MyFi implementation lives in:

✅ ProjectMyFi_vLatest/

All architecture described here refers to this canonical rebuild unless stated otherwise.

2. Architecture Concept (Normative)

MyFi is built using:

- Surfaces (screen/modal definitions)
- Slots (layout regions within surfaces)
- Parts (reusable UI units)
- Contracts (locked baseline + controlled uplift zones)
- Journeys (thin orchestration scripts across surfaces)

This model is the intended foundation for AI-safe iteration.

3. Non-Canonical Folders (Documented Status)

3.1 Legacy Implementation

Folder: Project MyFi/ (root)

Status: Legacy · Operational reference only

Purpose:
- validate behaviours that must be preserved
- supply "parity requirements" for rebuild

3.2 Experimental

Folder: ProjectMyFi_vExperimental/

Status: Experimental · Idea quarry only

Purpose:
- extract useful patterns for canonical specs
- inform journeys/contracts layouts

4. Canonical Rebuild Focus Areas

The rebuild proceeds by "truth scaffolding" first:

- Hub rebuild spec (surface composition + slots)
- Vitals parts contracts (VitalsHUD, bars, essence meter)
- Journeys baseline spec (schema + runtime decision)
- Quests surface spec (as reference implementation)

Implementation follows approved Work Orders only.

5. Alignment Rule

If repo reality differs from this map:

- repo-aware agents must raise a Work Order to reconcile
- do not silently adjust architecture without updating canon artifacts

End of Architecture Map.
