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
Surfaces / Slots / Parts DSL	UI composition model	✅ Implemented (I1)
Part Contracts & Uplift Guardrails	AI-safe UI iteration	✅ Implemented (I1)
Screen Loader & Router	Mobile-first screen switching	✅ Implemented
ActionBus	Part → Parent event emitter	✅ Implemented (I1)
Journey Runner	Thin orchestration engine	✅ Implemented (I2)
Modal Manager	Minimal overlay system	✅ Implemented (I2)
Share Pack	Non-repo agent sync	✅ Auto-refresh on deploy (M2c)

5.2 Hub / Vitals (Canonical Anchor in Intent)
System	Description	Status
Vitals semantics (H/M/S/Essence)	Defined in reference	Locked (intent)
Hub surface (Surfaces model)	Target canonical anchor	✅ Implemented (I1)
VitalsHUD Part	H/M/S/Essence bars + view toggle	✅ Implemented (I1)
StatusBar Part	Mode indicator (Verified/Unverified)	✅ Implemented (I1)
EncounterWindow Part	idle/available/observing states	✅ Implemented (I1)
Legacy vitals HUD	Operational reference exists	Present (legacy only)

5.3 Quests
System	Description	Status
Quests surface (canonical rebuild)	Reference implementation target	Missing (spec pending)
Legacy quests UI	Operational reference exists	Present (legacy only)

6. Implemented Spine (I1 + I2)

The following infrastructure was implemented via Work Orders I1 and I2:

✅ **I1-Hub-Phase1-Scaffold** (Implemented)
- ActionBus (src/core/actionBus.js) — wildcard subscription, Part emitters
- SurfaceCompositor — VM data injection, emitter wiring
- SurfaceRuntime — VM provider registration
- Hub Surface — 3-slot layout (status-bar, vitals-hud, encounter-window)
- StatusBar Part — primitive, mode indicator
- VitalsHUD Part — prefab, H/M/S/Essence bars, emits setViewMode/openVitalDetail
- EncounterWindow Part — prefab, idle/available/observing states, emits engage
- Demo VM (src/vm/hub-demo-vm.js) — contract-compliant mock data
- ErrorCard fallback — visible error for missing Part bindings

✅ **I2-JourneyRunner-Phase1** (Implemented)
- Journey Runner (src/journeys/journeyRunner.js) — discovery, execution, lifecycle
- Modal Manager (src/core/modalManager.js) — open/close/dismissed events
- 6 Op Executors — navigate, openModal, closeModal, wait, emit, log
- Trigger Auto-Binding — journeys with trigger field auto-execute on matching actions
- Self-Trigger Loop Prevention — ignores actions where source === 'journey'
- 30s Default Timeout — per Director decision
- Smoke Journey — demonstrates action → journey → log flow
- Hub ViewModeToggle Journey — bound to setViewMode action

7. Verification Status

Smoke tests passed (console verification):

```
// In browser console:
__MYFI_DEBUG__.actionBus.emit('smoke.test', {}, 'manual');

// Expected output:
[ActionBus] manual → smoke.test {}
[JourneyRunner] Starting journey: smoke.actionToLog
[Journey:smoke.actionToLog] Smoke journey started
[Journey:smoke.actionToLog] Wait completed (100ms)
[ActionBus] journey → smoke.completed { success: true }
[Journey:smoke.actionToLog] Smoke journey finished successfully
[JourneyRunner] Journey completed: smoke.actionToLog
```

8. Immediate Next Constraints (Gates)

**Completed Gates:**
- ✅ C2 Hub rebuild specification
- ✅ C3 Vitals parts contracts (C3a VitalsHUD, C3b StatusBar, C3c EncounterWindow)
- ✅ H2 Journeys system decision/spec

**Completed Forge Infrastructure (supporting MyFi):**
- ✅ M2a Forge Portal scaffold
- ✅ M2b Automation (workflows, Pages deploy)
- ✅ M2c Portal live truth + Issues UX
- ✅ S1/S2/S3 Branch discipline + Execute loop

**Next Planned Work Orders (MyFi Product):**
- I3 Real data integration (replace demo VM)
- I4 Quest surface scaffold
- I5 Vitals deep-dive (spending → depletion)

9. Canonical Runtime Location

The canonical MyFi runtime is located at:

```
Project MyFi/ProjectMyFi_vLatest/
```

Key paths:
- Core: `src/core/` (app.js, router.js, actionBus.js, modalManager.js, etc.)
- Parts: `src/parts/primitives/` and `src/parts/prefabs/`
- Surfaces: `src/surfaces/{surface-id}/surface.json`
- Journeys: `src/journeys/**/*.journey.json`
- Demo VMs: `src/vm/`
- Entry: `public/index.html`

10. Notes for Agents

If you are repo-aware:

- treat Project MyFi/ProjectMyFi_vLatest as canonical truth
- treat legacy/experimental as inputs only
- do not perform code changes without an approved Work Order

If you are non-repo-aware:

- rely only on the Share Pack snapshots for truth continuity

---

**Last Updated:** 2026-01-24
**Work Orders Applied:** C1, C2, C3a, C3b, C3c, H2, I1, I2, S1
**Forge Infrastructure WOs:** M2a, M2b, M2c, S1, S2, S3, W1

End of Product State.
