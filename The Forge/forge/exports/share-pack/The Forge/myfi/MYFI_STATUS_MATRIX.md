# MyFi Status Matrix

Statuses:
- Absent
- Defined
- Implementing
- Operational
- Enforced
- Demo-ready

## Core product systems

| System | Description | Status | Notes |
|---|---|---|---|
| Runtime (no-build ESM) | Deterministic app runtime | Operational | Hub proven |
| Router / Navigation | Mobile-first navigation | Operational | Hub stable; others migrating |
| Surfaces · Slots · Parts | UI composition model | Operational | 3-slot Hub architecture proven |
| Uplift Guardrails | AI-safe UI iteration | Defined / Partial | Needs consolidation |
| Hub / Vitals Screen | Canonical anchor | Operational | **HUB v1.1 — 3-slot layout** |
| Vitals Semantics | H/M/S/Essence meaning | Enforced | Locked |
| Quests Screen | Reference implementation | Defined / Incomplete | Next major focus |
| Journeys | Replayable orchestration | Defined / Partial | Default approach chosen |
| Demo Data Mode | Stubbed consistency | Operational | Used for iteration |
| Real Data Adapters | Firestore/TrueLayer etc | Planned | Behind feature APIs |

## Hub Parts (HUB v1.1)

| Part | Type | Status | Notes |
|---|---|---|---|
| BadlandsStage | Prefab | Operational | 3-tab stage, turn-based combat |
| PlayerHeader | Prefab | Operational | Integrated EssenceBar |
| WorldMap | Prefab | Operational | Dartboard radial navigation |
| PlayerCore | Prefab | Operational | Avatar & status indicators |
| Wardwatch | Prefab | Operational | Autonomous viewport simulation |
| EscalationOverlay | Prefab | Operational | Turn-based combat UI |
| EventLog | Prefab | Operational | Recent history & narrative |
| SpatialNav | Prefab | Operational | Compass navigation |
| DevControlPanel | Prefab | Operational | Runtime config controls |
| EssenceBar | Primitive | Operational | Essence progress indicator |
| VitalsHUD | Prefab | Operational | H/M/S/Essence bars |
| StatusBar | Primitive | Operational | Mode indicator |
| EncounterWindow | Prefab | Operational | idle/available/observing states |

## Hub Systems

| System | Description | Status | Notes |
|---|---|---|---|
| Autobattler | Encounter spawn & resolution | Operational | 5 encounter types, dev config |
| HubController | Systems orchestration | Operational | Vitals, encounters, events |
| ActionBus | Part ↔ Parent events | Operational | combat:tick, autobattler:* |

## Automation vectors (product side)

| Vector | Meaning | Status | Next step |
|---|---|---|---|
| Spec ↔ Code Sync | Reduce drift | Defined | Needs repo-aware reconciliation later |
| Screen fabrication workflow | Repeatable UI generation | Defined | Quests as proving ground |
| Deterministic validation | Detect missing parts/contracts | Absent | Candidate CI hook |
