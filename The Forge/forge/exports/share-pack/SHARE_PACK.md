# Forge Share Pack

This folder contains a minimal, always-up-to-date snapshot of Forge + MyFi
for non-repo-aware agents.

## Included files
- FORGE_CAPSULE.md
- MYFI_CAPSULE.md
- PRODUCT_STATE.md
- MYFI_STATUS_MATRIX.md
- MYFI_REFERENCE_INDEX.json
- ARCH_SNAPSHOT.md

## Last updated
2026-01-23

## What changed since last update

### Work Order: FO-MyFi-I2-JourneyRunner-Phase1 (COMPLETED)

Journey Runner implementation complete. Action → Journey → Op pipeline now functional:

**New Files Created:**
- `journeyRunner.js` — Core runner (discovery, execution, lifecycle)
- `modalManager.js` — Minimal modal overlay manager
- `modal.css` — Modal styling
- Op executors: `navigate.js`, `openModal.js`, `closeModal.js`, `wait.js`, `emit.js`, `log.js`
- `ops/index.js` — Op executor registry
- `manifest.json` — Journey registry
- `smoke.journey.json` — Smoke test journey
- `hub/viewModeToggle.journey.json` — Demo journey

**Files Modified:**
- `app.js` — Journey runner and modal manager integration
- `chrome.js` — Modal host element added
- `index.html` — Modal CSS included

**Key Features:**
- Hybrid discovery (manifest + convention paths)
- Trigger auto-binding to ActionBus
- Self-trigger loop prevention (ignores source === 'journey')
- 30s default timeout
- All 6 ops: navigate, openModal, closeModal, wait, emit, log
- Lifecycle events: start, step, complete, cancel, timeout, error
- Debug exposure via `window.__MYFI_DEBUG__`

### Work Order: FO-MyFi-I1-Hub-Phase1-Scaffold (COMPLETED)

Hub screen scaffolded with StatusBar, VitalsHUD, EncounterWindow Parts.

### Previous Work Orders (this session)
- FO-MyFi-C3c-EncounterWindow-Contract — EncounterWindow contract spec
- FO-MyFi-C3b-StatusBar-Contract — StatusBar contract spec
- FO-MyFi-H2-Journeys-System-Spec — Journeys orchestration spec
- FO-MyFi-C3-Vitals-Parts-Contracts — VitalsHUD contract spec
- FO-MyFi-C2-Hub-Rebuild-Spec — Hub surface spec
- FO-MyFi-C1-Resolve-Codebase-Fragmentation — Canonical codebase declaration

## Current State Summary

| System | Status |
|--------|--------|
| Hub Surface | Phase 1 complete |
| StatusBar Part | Implemented |
| VitalsHUD Part | Implemented |
| EncounterWindow Part | Implemented (idle placeholder) |
| ActionBus | Implemented |
| Demo VM | Implemented |
| Journey Runner | **Implemented** |
| Modal Manager | **Implemented** |
| Real Data Integration | Not yet (demo data only) |

## Verification

**Smoke Test:**
```javascript
// In browser console:
window.__MYFI_DEBUG__.actionBus.emit('smoke.test', {}, 'manual');
// Observe: journey.start → journey.step (×5) → journey.complete
```

**VitalsHUD Toggle Test:**
```javascript
// Click view mode toggle in VitalsHUD
// Observe: setViewMode action triggers hub.viewModeToggle journey
```

## How this is maintained
- Repo-aware agents regenerate this after:
  - reference updates
  - architecture changes
  - approved Work Orders
