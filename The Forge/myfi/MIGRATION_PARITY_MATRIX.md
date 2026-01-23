📊 MIGRATION_PARITY_MATRIX.md

Status: Canonical (C1 Output)
Audience: Director and all agents
Purpose: Prevent loss of required capability during rebuild-from-scratch

Legend:
- MUST KEEP: Required for current vision / reference / demo readiness
- NICE TO KEEP: Valuable but non-blocking
- REJECT: Contradicts intent, ethics, or architecture
- UNDECIDED: Needs Director call

| Capability | Classification | Source(s) | Notes / Acceptance Signal | Implementation |
|---|---|---|---|---|
| Vitals semantics (Health/Mana/Stamina/Essence) | MUST KEEP | Reference doc + legacy | Canonical HUD reflects these accurately | ✅ I1 (VitalsHUD Part) |
| Hub as HUD (financial health readout) | MUST KEEP | Reference doc + legacy | Bars render, readable, responsive | ✅ I1 (Hub Surface) |
| Hub encounter window (autobattler default → turn-based on engage) | MUST KEEP | Reference doc + design notes | Spec exists; minimal encounter placeholder acceptable initially | ✅ I1 (EncounterWindow Part) |
| Interaction depth continuum (HUD→autobattler→turn-based→Badlands) | MUST KEEP | Reference doc | Visible in docs; mechanics can be staged | ⏳ Partial (idle/available/observing) |
| Surfaces/Slots/Parts workflow | MUST KEEP | Forge + vLatest | Hub + Quests prove workflow works | ✅ I1 (Hub proves workflow) |
| Contracts + uplift guardrails | MUST KEEP | Forge | Parts have contract zones + uplift surfaces | ✅ I1 (3 Part contracts) |
| Journeys orchestration | MUST KEEP | Reference + experimental | Minimal journey runner opens Hub/Quests | ✅ I2 (JourneyRunner) |
| Quests surface as reference implementation | MUST KEEP | PRODUCT_STATE | Quests built using canonical workflow | ⏳ Pending |
| Auth (login entry) | NICE TO KEEP | legacy/vLatest | Can be stubbed for Phase 1 | ⏳ Stubbed (session.js) |
| Transaction ingestion (manual + TrueLayer) | NICE TO KEEP (Phase 1), MUST KEEP (Pitch) | legacy + TL work | Phase gate per readiness map | ⏳ Pending |
| Events log / history | NICE TO KEEP | legacy | Can be deferred | ⏳ Pending |
| Avatar/Profile screen | NICE TO KEEP | legacy | Can be deferred | ⏳ Pending |
| Badlands action layer | UNDECIDED (Phase 2) | design intent | Depends on demo scope | ⏳ Pending |
| Any "new feature" not in reference | REJECT (for now) | n/a | Must go through Work Order + parity classification | — |

Notes:
- This matrix must be updated as features are discovered in legacy/experimental.
- Repo-aware agents should propose additions as Work Orders, not silently extend it.
- Implementation column added via S1 to track progress against parity requirements.

---

**Last Updated:** 2026-01-23
**Work Orders Applied:** C1, I1, I2, S1

End of Parity Matrix.
