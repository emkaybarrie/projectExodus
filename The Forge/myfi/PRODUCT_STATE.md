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

a shared “where we are” marker

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

stabilising the Hub / Vitals screen as the canonical centre

designing a workflow that allows AI-assisted development without regressions

There has been deliberate slowdown on feature expansion to:

avoid compounding architectural debt

establish a repeatable, AI-safe production line

and prepare for partner-facing demos and pilots

MyFi is intentionally in a foundational refactor phase, not a polish phase.

3. System Decomposition & Status
3.1 Core Runtime & Architecture
System	Description	Status
Surfaces / Slots / Parts DSL	UI composition model	In Progress
Part Contracts & Uplift Guardrails	AI-safe UI iteration	Defined / Partial
Screen Loader & Router	Mobile-first navigation	Operational (Hub proven)
Manifest / Registry	Deterministic loading	Operational

Notes:
Hub screen is the known-good reference. Other screens are migrating toward this pattern.

3.2 Hub / Vitals (Canonical Screen)
Aspect	Status
Vitals model (Health, Mana, Stamina, Essence)	Defined & Locked
HUD rendering & animation	Operational
Shield / Emberward concepts	Defined / Partial
Verified vs Unverified modes	Defined / Partial

Notes:
Hub is the architectural and conceptual anchor. Other systems must align to it.

3.3 Quests & Journeys
Aspect	Status
Quest concept & narrative role	Defined
Journey orchestration pattern	Defined
Quests screen implementation	Planned / Incomplete
Quest ↔ Vitals linkage	Conceptual

Notes:
Quests is the intended reference implementation for the new screen workflow.

3.4 Game Layer / Badlands
Aspect	Status
Battle metaphors for spending	Conceptual
Avatar progression linkage	Defined
Gameplay implementation	Deferred

Notes:
Game layer is not required for MVP or early pilots. It remains a Phase-2+ system.

3.5 Data & Backend
Aspect	Status
Demo data mode	Operational
Real data adapters (e.g. Firestore)	Abstracted / Planned
Backend migration readiness	Designed, not executed
4. Stability Boundaries
Considered Stable (Safe to Build On)

Vitals philosophy and semantics

Hub-centric UX model

Dual-currency ethics (Essence vs premium)

Narrative framing of financial behaviour

Considered In Flux (Handle Carefully)

UI DSL exact shape

Screen composition APIs

Quest implementation details

Automation / CI hooks

Agents must flag assumptions when touching in-flux areas.

5. Known Friction & Risks

Regressions when iterating UI loading

Over-abstracting parts too early

Losing continuity across AI sessions

Conflating demo needs with long-term architecture

If these appear, agents must pause and surface them.

6. Definition of “Continue MyFi Work”

To “continue MyFi work” means:

operate within the boundaries above

prioritise Hub and Quests as reference implementations

avoid expanding scope without specs

treat architectural clarity as a deliverable

Agents must challenge any request that violates this.

7. Relationship to the Forge

This file is the product-level equivalent of FORGE_STATE.md

It is updated when:

major systems change state

focus shifts materially

onboarding new agents or partners

It is the single source of truth for MyFi’s current reality.

End of Product State