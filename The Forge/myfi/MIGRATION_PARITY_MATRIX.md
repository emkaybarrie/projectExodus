📊 MIGRATION_PARITY_MATRIX.md

Status: Canonical (C1 Output)
Audience: Director and all agents
Purpose: Prevent loss of required capability during rebuild-from-scratch

Legend:
- MUST KEEP: Required for current vision / reference / demo readiness
- NICE TO KEEP: Valuable but non-blocking
- REJECT: Contradicts intent, ethics, or architecture
- UNDECIDED: Needs Director call

| Capability | Classification | Source(s) | Notes / Acceptance Signal |
|---|---|---|---|
| Vitals semantics (Health/Mana/Stamina/Essence) | MUST KEEP | Reference doc + legacy | Canonical HUD reflects these accurately |
| Hub as HUD (financial health readout) | MUST KEEP | Reference doc + legacy | Bars render, readable, responsive |
| Hub encounter window (autobattler default → turn-based on engage) | MUST KEEP | Reference doc + design notes | Spec exists; minimal encounter placeholder acceptable initially |
| Interaction depth continuum (HUD→autobattler→turn-based→Badlands) | MUST KEEP | Reference doc | Visible in docs; mechanics can be staged |
| Surfaces/Slots/Parts workflow | MUST KEEP | Forge + vLatest | Hub + Quests prove workflow works |
| Contracts + uplift guardrails | MUST KEEP | Forge | Parts have contract zones + uplift surfaces |
| Journeys orchestration | MUST KEEP | Reference + experimental | Minimal journey runner opens Hub/Quests |
| Quests surface as reference implementation | MUST KEEP | PRODUCT_STATE | Quests built using canonical workflow |
| Auth (login entry) | NICE TO KEEP | legacy/vLatest | Can be stubbed for Phase 1 |
| Transaction ingestion (manual + TrueLayer) | NICE TO KEEP (Phase 1), MUST KEEP (Pitch) | legacy + TL work | Phase gate per readiness map |
| Events log / history | NICE TO KEEP | legacy | Can be deferred |
| Avatar/Profile screen | NICE TO KEEP | legacy | Can be deferred |
| Badlands action layer | UNDECIDED (Phase 2) | design intent | Depends on demo scope |
| Any "new feature" not in reference | REJECT (for now) | n/a | Must go through Work Order + parity classification |

Notes:
- This matrix must be updated as features are discovered in legacy/experimental.
- Repo-aware agents should propose additions as Work Orders, not silently extend it.

End of Parity Matrix.
