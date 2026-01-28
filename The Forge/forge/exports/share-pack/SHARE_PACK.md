# Forge Share Pack

This folder contains a minimal, always-up-to-date snapshot of Forge + MyFi
for non-repo-aware agents.

---

## Governance Model

**Model 3: Forge as Institutional OS, MyFi as Flagship Entity**

- **Constitutional Layer:** Forante (steward company)
- **Institutional OS:** Forge (SDLC operating system)
- **Flagship Entity:** MyFi (Tier 2 integration, proving ground)

See: [Forante Kernel](../../../Forante/FORANTE_KERNEL.md) for full constitutional governance.

---

## Included files

### Forante Constitutional Layer
- FORANTE_KERNEL.md — Constitutional foundation, Model 3 declaration
- FORANTE_INDEX.md — Governance navigation and entry points
- ENTITY_CHARTER_TEMPLATE.md — Template for new Forge entities

### Forge Core
- FORGE_KERNEL.md — Canonical Forge governance kernel (aligned to Model 3)
- FORGE_CAPSULE.md — Forge summary capsule
- FORGE_STATE.md — Current Forge state, network state, and focus areas
- FORGE_INDEX.md — Forge navigation index
- CLAUDE_SYSTEM_PROMPT.md — Claude onboarding context

### Forge Operations
- OPERATING_MODEL_LANES.md — Parallel development lanes and precedence law
- EXECUTOR_PLAYBOOK.md — AI executor protocol

### MyFi Canonical Truth
- PRODUCT_STATE.md — Current product state and applied WOs
- MYFI_CAPSULE.md — MyFi summary capsule
- MYFI_STATUS_MATRIX.md — Feature/component status matrix
- MIGRATION_PARITY_MATRIX.md — Migration tracking
- MYFI_ARCHITECTURE_MAP.md — Architecture overview
- MYFI_GLOSSARY.md — Term definitions
- MYFI_MANIFEST.json — Product manifest
- MYFI_CHANGELOG.md — Change history
- MYFI_MASTER_REFERENCE.md — Master reference document

### MyFi Reference
- reference/MYFI_REFERENCE_INDEX.json — Reference index

### MyFi Specs
- specs/ — Surface and Parts contracts

### Work Orders
- ops/ — Canonical WO location (active)
- Work Orders/ — Legacy WOs
- work-orders/ — Orphan WOs (pending consolidation)

## Last updated
2026-01-28

## What changed since last update

### Session: Hub v1 Baseline Rebuild — 3-Slot Architecture, Turn-Based Combat

**Commit:** `1ce1ce0` — `FO-Forge-HUB/v1: Hub Baseline Rebuild — 3-Slot Architecture, Autobattler, Turn-Based Combat`

**Work Orders Implemented:**
- **HUB-04**: Autobattler — Encounter Resolution (spawn, resolve, vitals impact)
- **HUB-E2**: Compass Navigation Modal
- **HUB-E4**: Hub Surface viewport-filling layout (Vitals/Map/Stage slots)
- **HUB-D4/G5**: Dev Controls & Config Modal (spawn button, encounter rate, damage multiplier, god mode)
- **HUB-07/HUB-11**: Overlay Slot Support

**Key Features Implemented:**
1. **BadlandsStage** — 3-tab system (Current Event, Recent Events, Loadout) with turn-based combat simulation
   - Turn-based combat rounds (2.5s intervals) with skills, equipment, and vitals integration
   - Wardwatch scenic SVG background for idle state
   - Enemy HP tracking with discrete combat ticks
2. **PlayerHeader** — Integrated EssenceBar with avatar portrait
3. **WorldMap** — Dartboard-style radial navigation with event subscriptions
4. **Dev Config Integration** — Runtime settings (encounterDuration, encounterRate, damageMultiplier, godMode)

**ActionBus Events Added:**
- `autobattler:spawn` — Encounter spawned
- `autobattler:resolve` — Encounter resolved
- `combat:tick` — Combat round executed with vitals impact

**Files Changed (73 total):**

| Category | Files |
|----------|-------|
| Core | actionBus.js, app.js, chrome.js, router.js, styleLoader.js, surfaceCompositor.js, tokens.css |
| New Parts | BadlandsStage, PlayerHeader, WorldMap, DevControlPanel, EscalationOverlay, EventLog, PlayerCore, SpatialNav, ViewportZone, Wardwatch |
| New Primitives | EssenceBar, ReturnToHub |
| New Systems | autobattler.js, hubController.js |
| New Surfaces | avatar, badlands, guidance, quests |
| Docs | HUB_ARCHITECTURE_BREAKDOWN.md, HUB_DEV_TEST_RUNBOOK.md, HUB_IMPLEMENTATION_DOSSIER.md |

**CSS Layout Updates:**
- 3-slot architecture: Vitals (fixed) + Map (fixed) + Stage (flex fill)
- Viewport-filling layout prevents scroll on Hub surface
- Stage slot fills remaining vertical space

---

### Previous Session: MyFi Hub Baseline v1 Executed

**Work Orders Executed (HUB-01 → HUB-06):**

1. **MYFI-HUB-01-Hub-Shell-and-Spatial-Navigation** — Badlands Hub Shell & Spatial Navigation
   - Created [SpatialNav](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/prefabs/SpatialNav/) part (compass navigation)
   - Created [ReturnToHub](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/primitives/ReturnToHub/) part
   - Created stub surfaces: quests, avatar, guidance, badlands

2. **MYFI-HUB-02-Player-Core-Vitals-and-Avatar** — Player Core — Vitals & Avatar
   - Created [PlayerCore](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/prefabs/PlayerCore/) part (avatar portrait, status indicators)
   - Added vitals simulation loop with regen/decay to [hub-demo-vm.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/vm/hub-demo-vm.js)

3. **MYFI-HUB-03-Badlands-Viewport-and-Simulation** — Wardwatch — Badlands Viewport & Simulation
   - Created [Wardwatch](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/prefabs/Wardwatch/) part (autonomous simulation viewport)
   - Autonomous avatar movement, time progression (day/dusk/night), world state messaging

4. **MYFI-HUB-04-Autobattler-Encounter-Resolution** — Autobattler — Encounter Resolution
   - Created [autobattler.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/systems/autobattler.js) (5 encounter types, auto-resolution)
   - Created [hubController.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/systems/hubController.js) (orchestrates Hub systems)
   - Integrated autobattler with vitals impact in [app.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/core/app.js)

5. **MYFI-HUB-05-Turn-Based-Escalation-Layer** — Turn-Based Escalation Layer
   - Created [EscalationOverlay](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/prefabs/EscalationOverlay/) part (turn-based combat UI)
   - Actions: Strike, Channel, Brace, Retreat with resource costs
   - Time pause during escalation, seamless exit to autobattler

6. **MYFI-HUB-06-Event-Log-and-Temporal-Memory** — Event Log & Temporal Memory
   - Created [EventLog](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/prefabs/EventLog/) part (recent history with narrative framing)
   - Real-time event updates, reassuring empty state

**Files Changed:**

| File | Change |
|------|--------|
| [manifest.json](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/manifest.json) | Added 6 new parts |
| [hub/surface.json](../../../Project%20MyFi/ProjectMyFi_vLatest/src/surfaces/screens/hub/surface.json) | Added 6 new slots |
| [hub-demo-vm.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/vm/hub-demo-vm.js) | Added simulation data |
| [app.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/core/app.js) | Integrated HubController |
| [EncounterWindow/part.js](../../../Project%20MyFi/ProjectMyFi_vLatest/src/parts/prefabs/EncounterWindow/part.js) | Added escalation trigger |

**New Directories Created:**
- `src/parts/prefabs/SpatialNav/`
- `src/parts/prefabs/PlayerCore/`
- `src/parts/prefabs/Wardwatch/`
- `src/parts/prefabs/EscalationOverlay/`
- `src/parts/prefabs/EventLog/`
- `src/parts/primitives/ReturnToHub/`
- `src/systems/`
- `src/surfaces/screens/quests/`
- `src/surfaces/screens/avatar/`
- `src/surfaces/screens/guidance/`
- `src/surfaces/screens/badlands/`

**Commit:** Pending — changes staged for commit
**PR:** N/A (direct to dev branch)

---

### Session: Constitutional, E2E Workflow, Reconciliation

**Work Orders Executed (this session):**

1. **FO-Forge-C2-NonRegression-Principle** — Non-Regression Principle
   - Added FORGE_KERNEL.md Section 9A (constitutional safeguard)
   - Added FORGE_CAPSULE.md Non-Regression summary
   - Added FORANTE_KERNEL.md Section 7 (Forge Constitutional Protections)

2. **FO-Forge-P4-Director-E2E-Workflow-Guidance** — E2E Workflow Playbook
   - Created `ops/E2E_WORKFLOW_PLAYBOOK.md` (phase checklist)
   - Added FORGE_KERNEL.md Section 6B (playbook pointer)
   - Updated FORGE_INDEX.md with playbook link
   - Added E2E panel to Forante Portal (phase selector + copy agent pack)
   - Added E2E panel to MyFi Entity Portal

3. **FO-Forge-RC1-Repo-Reconciliation-and-Gap-Harvest** — Reconciliation Audit
   - Created `audits/RECONCILIATION_REPORT_2026-01-25.md`
   - Created `audits/RECONCILIATION_GAPS_2026-01-25.md`
   - Updated FORGE_STATE.md with reconciliation status
   - **Verdict:** Ready with Conditions for MyFi Hub baseline

### Previous Session: Agent Onboarding & Work Order Lifecycle

**Work Orders Executed:**

1. **FO-Forge-A1-Agent-Onboarding-Strategy-v1** — Agent Onboarding Strategy v1
   - Created `contracts/AGENT_ONBOARDING_CONTRACT.md`
   - Defined 5 capability axes (A–E) with discrete levels
   - Established role eligibility derivation rules
   - Codified trust graduation mechanics
   - Added constitutional binding requirements
   - Added FORGE_KERNEL.md Section 2B
   - Updated FORGE_CAPSULE.md Section 3A

2. **FO-Forge-A2-WorkOrder-Conveyor-Orchestration** — Work Order Conveyor Orchestration
   - Created `contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md`
   - Defined factory conveyor belt state machine (9 states)
   - Established role triggers by phase with blocking authority
   - Codified capability-based routing rules
   - Defined artifact handoff patterns
   - Added FORGE_KERNEL.md Section 6A
   - Updated FORGE_CAPSULE.md Section 6A

### Earlier Session: Forge OS Role System & Reporter Infrastructure

**Work Orders Executed:**

1. **FO-Forge-G1-ForgeOS-RoleSystem-v1** — Forge OS Role System v1
   - Created `contracts/FORGE_OS_ROLE_SYSTEM.md` (7 canonical roles)
   - Updated FORGE_KERNEL.md Section 2 with expanded role definitions
   - Added Section 2A Operating Modes (M1/M2/M3)
   - Updated FORGE_CAPSULE.md with role system table

2. **FO-Forge-R1-Reporter-Role-Definition** — Reporter Role Definition
   - Expanded FORGE_KERNEL.md Section 2.7 with full Reporter spec
   - Added primary consumers and explicit constraints

3. **FO-Forge-R2-Reporting-Signals-Contract** — Reporting Signals & Metrics Contract
   - Created `contracts/REPORTING_SIGNALS_CONTRACT.md`
   - Defined signal categories, time semantics, phase-aware tracking

4. **FO-Forge-R3-Reporter-Evolution-Feedback-Loop** — Reporter-Evolution Feedback Loop
   - Added FORGE_KERNEL.md Section 12A feedback loop definition
   - Updated FORGE_CAPSULE.md with evidence-driven learning cycle

**Earlier Session Work Orders:**
- FO-Forge-P3-WorkOrder-Index-Enrichment — Schema extensions for WO traceability
- FO-Forge-C1-Constitutional-Updates — Added three constitutional laws
- PWA Setup — Forante Portal installable as PWA
- FO-Forge-P2-Portal-WorkOrder-Control-Plane — WO detail modal and agent pack copy
- FO-MyFi-P1-EntityPortal — MyFi entity portal implementation

## Current Governance State

| System | Status |
|--------|--------|
| Forge OS Role System | **7 canonical roles defined** |
| Operating Modes | M1/M2/M3 codified |
| Agent Onboarding | **5 capability axes defined** |
| Trust Graduation | Evidence-based promotion codified |
| Constitutional Binding | Forge Context Envelope required |
| Work Order Lifecycle | **Factory conveyor model active** |
| Non-Regression Principle | **Codified (Section 9A)** |
| E2E Workflow Playbook | **Created — Portal UX active** |
| Reporter Role | Fully specified |
| Reporting Signals Contract | Created |
| Reporter-Evolution Loop | Codified |
| Constitutional Laws | 3 laws active (Sections 11-13) |
| Work Order Index | Enrichment schema active |
| Reconciliation Status | **Ready with Conditions** |
| MyFi Hub Baseline | **v1.1 Complete (HUB-04/E2/E4/D4/G5/07/11)** |

## Contracts & Operations

| Document | Purpose |
|----------|---------|
| AGENT_ONBOARDING_CONTRACT.md | Capability axes, trust graduation, constitutional binding |
| WORK_ORDER_LIFECYCLE_CONTRACT.md | State machine, role triggers, artifact handoffs |
| FORGE_OS_ROLE_SYSTEM.md | Roles, authority, operating modes |
| REPORTING_SIGNALS_CONTRACT.md | Signal categories, time semantics |
| E2E_WORKFLOW_PLAYBOOK.md | Director E2E workflow guidance |
| WORK_ORDER_INDEX_CONTRACT.md | WO schema and enrichment rules |

## MyFi Product State

| System | Status |
|--------|--------|
| Hub Surface | **Hub v1.1 Complete — 3-slot architecture** |
| StatusBar Part | Implemented |
| VitalsHUD Part | Implemented |
| EncounterWindow Part | Implemented (with escalation trigger) |
| PlayerCore Part | Implemented — Avatar & status indicators |
| Wardwatch Part | Implemented — Autonomous viewport simulation |
| EscalationOverlay Part | Implemented — Turn-based combat UI |
| EventLog Part | Implemented — Recent history & narrative |
| SpatialNav Part | Implemented — Directional compass navigation |
| **BadlandsStage Part** | **NEW — 3-tab stage with turn-based combat** |
| **PlayerHeader Part** | **NEW — Integrated EssenceBar** |
| **WorldMap Part** | **NEW — Dartboard radial navigation** |
| **DevControlPanel Part** | **NEW — Runtime config controls** |
| **EssenceBar Primitive** | **NEW — Essence progress indicator** |
| Autobattler System | Implemented — Encounter spawning & auto-resolution |
| HubController System | Implemented — Hub systems orchestration |
| Journey Runner | Implemented |
| Modal Manager | Implemented |

## How this is maintained
- Repo-aware agents regenerate this after:
  - reference updates
  - architecture changes
  - approved Work Orders
