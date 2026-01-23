📋 WORK ORDER

Task ID: FO-MyFi-I1-Hub-Phase1-Scaffold
Task Type: implementation
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Scaffold the Hub screen in the canonical codebase (Project MyFi/ProjectMyFi_vLatest/)
to mount the three contracted Parts — StatusBar, VitalsHUD, and EncounterWindow —
with minimal implementations sufficient for Phase 1 acceptance.

Scope of Work:
- Create Part implementations for StatusBar, VitalsHUD, EncounterWindow
- Update Hub surface.json to compose all three Parts in correct slot layout
- Create demo VM adapter providing contract-compliant mock data
- Implement action emitter pattern for Part → Parent events
- Add error card fallback for missing Part bindings or data
- Update Parts manifest to register new Parts

Director Decisions (LOCKED):
1. Canonical path: Option A — keep at Project MyFi/ProjectMyFi_vLatest/
2. Demo VM location: Option A — src/vm/hub-demo-vm.js
3. Error visibility: Option A — visible error card + console.error

Architect Addendum (MUST COMPLY):
- Part-local contract.json is machine-readable mirror for hooks/selectors only
- Must reference canonical contract spec in /The Forge/myfi/specs/parts/contracts/
- No duplicate semantic truth in contract.json (no business/meaning rules)

Allowed Files / Artifacts:

NEW FILES:
- src/parts/primitives/StatusBar/part.js
- src/parts/primitives/StatusBar/uplift.css
- src/parts/primitives/StatusBar/contract.json
- src/parts/prefabs/VitalsHUD/part.js
- src/parts/prefabs/VitalsHUD/baseline.html
- src/parts/prefabs/VitalsHUD/uplift.css
- src/parts/prefabs/VitalsHUD/contract.json
- src/parts/prefabs/EncounterWindow/part.js
- src/parts/prefabs/EncounterWindow/baseline.html
- src/parts/prefabs/EncounterWindow/uplift.css
- src/parts/prefabs/EncounterWindow/contract.json
- src/vm/hub-demo-vm.js
- src/core/actionBus.js
- src/parts/primitives/ErrorCard/part.js
- src/parts/primitives/ErrorCard/uplift.css

MODIFIED FILES:
- src/surfaces/screens/hub/surface.json
- src/parts/manifest.json
- src/core/surfaceCompositor.js
- src/core/surfaceRuntime.js

References:
- /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md
- /The Forge/myfi/specs/parts/contracts/VITALSHUD_CONTRACT.md
- /The Forge/myfi/specs/parts/contracts/STATUSBAR_CONTRACT.md
- /The Forge/myfi/specs/parts/contracts/ENCOUNTERWINDOW_CONTRACT.md
- /The Forge/myfi/specs/system/JOURNEYS_SPEC.md

Success Criteria:
- Hub surface loads without errors
- Three slots visible: statusBar, vitalsHud, encounterWindow
- StatusBar displays mode indicator (non-shaming for Unverified)
- VitalsHUD displays H/M/S/Essence bars with mock data
- VitalsHUD view mode toggle emits setViewMode action
- EncounterWindow displays idle state placeholder
- Actions emit upward via actionBus (visible in console)
- Missing bindings show visible error card
- All Parts registered in manifest.json
- Demo VM provides contract-compliant data shapes
- No gameplay mechanics implemented

Forbidden Changes:
- Gameplay/combat mechanics
- Encounter generation logic
- Real financial data integration
- Turn-based escalation implementation
- Badlands mechanics
- Journey runner implementation
- Firebase/backend integration
- Changes to spec files

Hygiene & Quarry Plan:
- REPLACE: hub/surface.json (new slot layout)
- KEEP: src/parts/primitives/EmptyCard/ (useful for debugging)
- KEEP: StartCard, AuthCard (used by other surfaces)
- QUARRY: vExperimental/src/vm/demo-vm.js pattern → hub-demo-vm.js

Agent Ownership:
- Director: Approval authority (done)
- Architect: Implementation review
- Executor (Claude): Implementation
