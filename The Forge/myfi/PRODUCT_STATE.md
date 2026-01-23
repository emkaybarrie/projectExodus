📍 PRODUCT_STATE.md

Status: Canonical · Living Product Snapshot
Product: Project MyFi
Audience: Director and all agents
Purpose: Declare the current reality of MyFi in a shared, inspectable form

1. What This Document Is

This file captures the current truth of the MyFi product.

It is not:

a backlog

a pitch

or a speculative roadmap

It is:

a continuity anchor

a safety boundary

a shared "where we are" marker

Any agent resuming MyFi work must read this first.

2. Narrative Snapshot (Director-Oriented)

MyFi is a gamified behavioural finance system built around the metaphor of energy, survival, and progression.

The core loop connects:

real-world spending

intentional tagging

resource depletion / regeneration

narrative and avatar progression

Recent work has focused on:

rebuilding the core runtime and UI architecture (Surfaces · Slots · Parts)

stabilising a repeatable AI-safe production line (contracts + uplift guardrails)

creating a reference-driven truth system (Word doc + JSON index + manifests)

MyFi is intentionally in a foundational rebuild phase, not a polish phase.

3. Canonical Codebase Decision (C1 — LOCKED)

This section is canonical and governs how all agents treat the repo.

3.1 Canonical Codebase Location

The canonical MyFi codebase is:

✅ ProjectMyFi_vLatest/

This is where "truth" is built and maintained going forward.

3.2 Rebuild Strategy (Also Canonical)

Implementation strategy is:

✅ Rebuild-from-scratch inside the canonical codebase

Inputs allowed as reference sources (non-authoritative):

- Legacy folder(s): operational reference only
- Experimental folder(s): idea quarry only
- The MyFi Master Reference doc: canonical product intent

This means:

- we do not "incrementally migrate" legacy code into the new system
- we define specs + contracts first
- we rebuild the desired behaviour cleanly within the Surfaces/Slots/Parts model
- we port only what matches the current vision and ethics

4. Codebase Topology & Status

The repo currently contains multiple MyFi implementations. Their status is:

4.1 Legacy Implementation (Operational Reference)

Folder: Project MyFi/ (root)

Status: Legacy · Operational reference only

Allowed usage:
- verify behaviours and UI outcomes that must be preserved
- extract requirements for parity matrix
- copy small algorithmic ideas into specs (not code lifting as default)

Forbidden:
- new feature work
- architecture work
- being treated as canonical truth

4.2 Canonical Rebuild (Truth Source)

Folder: ProjectMyFi_vLatest/

Status: Canonical · Under active rebuild

Allowed usage:
- all new work
- specs/contracts/parts/surfaces/journeys
- implementation once work orders are approved

4.3 Experimental (Idea Quarry)

Folder: ProjectMyFi_vExperimental/

Status: Experimental · Non-authoritative

Allowed usage:
- extract patterns (e.g., journeys scaffolding, contract structures)
- inform specs and guardrails

Forbidden:
- being treated as canonical truth
- shipping "as-is" without deliberate adoption into canonical

5. System Decomposition & Status

5.1 Core Runtime & Architecture
System	Description	Status
Surfaces / Slots / Parts DSL	UI composition model	In Progress (canonical target)
Part Contracts & Uplift Guardrails	AI-safe UI iteration	Defined / Partial
Screen Loader & Router	Mobile-first screen switching	In Progress
Journeys	Thin orchestration scripts	Planned (spec pending)
Share Pack	Non-repo agent sync	Present (needs cadence enforcement)

5.2 Hub / Vitals (Canonical Anchor in Intent)
System	Description	Status
Vitals semantics (H/M/S/Essence)	Defined in reference	Locked (intent)
Hub surface (Surfaces model)	Target canonical anchor	Placeholder in canonical rebuild
Legacy vitals HUD	Operational reference exists	Present (legacy only)

5.3 Quests
System	Description	Status
Quests surface (canonical rebuild)	Reference implementation target	Missing (spec pending)
Legacy quests UI	Operational reference exists	Present (legacy only)

6. Immediate Next Constraints (Gates)

Until these are completed, no large implementation work should occur:

- C2 Hub rebuild specification
- C3 Vitals parts contracts
- H2 Journeys system decision/spec

These define the "truth scaffolding" needed before coding.

7. Notes for Agents

If you are repo-aware:

- treat ProjectMyFi_vLatest as canonical truth
- treat legacy/experimental as inputs only
- do not perform code changes without an approved Work Order

If you are non-repo-aware:

- rely only on the Share Pack snapshots for truth continuity

End of Product State.
