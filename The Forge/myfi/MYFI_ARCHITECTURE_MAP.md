# MyFi Architecture Map (High-level)

## Layers
1) **UI Surfaces**
- Screens composed from slots + parts
- Mobile-first navigation; Hub is anchor

2) **Parts & Uplift Guardrails**
- Baseline structure is stable
- Uplift zones allow safe styling/layout iteration

3) **Journeys**
- Thin orchestration scripts for replayable flows and demos
- Prefer journeys for QA and partner demos

4) **Feature Packs / Data**
- Provide view models and actions
- Backend adapters live behind feature APIs (future-proofing)

## Current reference anchors
- Hub/Vitals: canonical baseline for screen loading and UI consistency
- Quests: next reference screen for the production line workflow
