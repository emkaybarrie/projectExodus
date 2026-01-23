📋 WORK ORDER

Task ID: FO-MyFi-I2-JourneyRunner-Phase1
Task Type: implementation
Status: APPROVED
Approved by: Director
Date: 2026-01-23

Intent Statement:
Implement a Phase 1 Journey Runner that conforms to JOURNEYS_SPEC.md, orchestrating
navigation, modals, and sequenced operations in response to Part-emitted actions.

Scope of Work:
- Journey Runner core (discovery, execution, lifecycle)
- Trigger auto-binding to ActionBus
- Sequential step execution with timeout/cancel
- All 6 operations: navigate, openModal, closeModal, wait, emit, log
- Modal manager (minimal overlay for Phase 1)
- Smoke journey for end-to-end verification

Director Decisions (LOCKED):
1. Global timeout default: 30s if journey has no timeout specified
2. Convention discovery: src/journeys/**/*.journey.json only (plus manifest)
3. Modal implementation: Minimal overlay div with placeholder content

Architect Addendum (MUST COMPLY):
- Prevent self-trigger loops: ignore actions where source === 'journey'
- Keep runner thin; ops remain in src/journeys/ops/

Allowed Files / Artifacts:

NEW FILES:
- src/journeys/journeyRunner.js
- src/journeys/manifest.json
- src/journeys/ops/index.js
- src/journeys/ops/navigate.js
- src/journeys/ops/openModal.js
- src/journeys/ops/closeModal.js
- src/journeys/ops/wait.js
- src/journeys/ops/emit.js
- src/journeys/ops/log.js
- src/journeys/smoke.journey.json
- src/journeys/hub/viewModeToggle.journey.json
- src/core/modalManager.js

MODIFIED FILES:
- src/core/app.js
- src/core/chrome.js

References:
- /The Forge/myfi/specs/system/JOURNEYS_SPEC.md
- /The Forge/myfi/specs/surfaces/HUB_SURFACE_SPEC.md
- /The Forge/myfi/specs/parts/contracts/VITALSHUD_CONTRACT.md

Success Criteria:
- Journey runner loads from manifest + convention
- Auto-bind triggers work (ignoring source === 'journey')
- All 6 ops execute correctly
- Lifecycle events emit
- Timeout/cancel work
- Smoke journey executes end-to-end
- Deterministic logging

Forbidden Changes:
- Conditional/branching ops
- Gameplay logic
- Data fetching
- Business rules
- Part contract changes
- Spec file changes

Agent Ownership:
- Director: Approval authority (done)
- Architect: Implementation review
- Executor (Claude): Implementation
