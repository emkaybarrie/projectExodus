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
| Surfaces · Slots · Parts | UI composition model | Implementing | Pattern stabilising |
| Uplift Guardrails | AI-safe UI iteration | Defined / Partial | Needs consolidation |
| Hub / Vitals Screen | Canonical anchor | Operational | Core reference |
| Vitals Semantics | H/M/S/Essence meaning | Enforced | Locked |
| Quests Screen | Reference implementation | Defined / Incomplete | Next major focus |
| Journeys | Replayable orchestration | Defined / Partial | Default approach chosen |
| Demo Data Mode | Stubbed consistency | Operational | Used for iteration |
| Real Data Adapters | Firestore/TrueLayer etc | Planned | Behind feature APIs |

## Automation vectors (product side)

| Vector | Meaning | Status | Next step |
|---|---|---|---|
| Spec ↔ Code Sync | Reduce drift | Defined | Needs repo-aware reconciliation later |
| Screen fabrication workflow | Repeatable UI generation | Defined | Quests as proving ground |
| Deterministic validation | Detect missing parts/contracts | Absent | Candidate CI hook |
