# Hub Reconciliation Report

**Generated:** 2026-01-27
**Work Orders:** HUB-01 through HUB-26
**Status:** Hub v3 Complete — BadlandsStage Canonical + Inline Battle

---

## Table of Contents

1. [File Map](#1-file-map)
2. [Data Flow Narrative](#2-data-flow-narrative)
3. [Event Catalog](#3-event-catalog)
4. [Encounter State Machine](#4-encounter-state-machine)
5. [Stage Modes (HUB-22/23)](#5-stage-modes-hub-2223)
6. [Overlay Behavior](#6-overlay-behavior)
7. [Known Risks / TODOs](#7-known-risks--todos)
8. [Non-Regression Anchors](#8-non-regression-anchors)
9. [Architect Intake Summary](#9-architect-intake-summary)
10. [Canonical Stage Definition (HUB-26)](#10-canonical-stage-definition-hub-26)
11. [Real-Time Vitals Contract (HUB-25)](#11-real-time-vitals-contract-hub-25)
12. [Deprecated Concepts](#12-deprecated-concepts)

---

## 1. File Map

### Surfaces

| File | Purpose |
|------|---------|
| `src/surfaces/screens/hub/surface.json` | Hub surface slot configuration (6 slots post HUB-19) |
| `src/surfaces/screens/hub/styles.css` | Hub-specific styles |

### Parts — Canonical Prefabs (HUB-18/22)

| File | Purpose |
|------|---------|
| `src/parts/prefabs/PlayerHeader/` | Compact merged header (StatusBar + PlayerCore + VitalsHUD) |
| `src/parts/prefabs/BadlandsStage/` | **CANONICAL** Unified stage (world, encounter, battle) — HUB-22 |

### Parts — Deprecated Prefabs (HUB-22/24)

| File | Purpose | Replacement |
|------|---------|-------------|
| `src/parts/prefabs/ViewportZone/` | Unified viewport (HUB-19) | BadlandsStage |
| `src/parts/prefabs/EscalationOverlay/` | Turn-based overlay (HUB-05) | BadlandsStage inline battle |
| `src/parts/prefabs/Wardwatch/` | World patrol | BadlandsStage world layer |
| `src/parts/prefabs/EncounterWindow/` | Encounter display | BadlandsStage encounter layer |

### Parts — Original Prefabs (still exist, reused internally or standalone)

| File | Purpose |
|------|---------|
| `src/parts/prefabs/PlayerCore/part.js` | Avatar portrait + status indicators (legacy, can be used standalone) |
| `src/parts/prefabs/Wardwatch/part.js` | Autonomous simulation viewport (logic reused in ViewportZone) |
| `src/parts/prefabs/VitalsHUD/part.js` | Health/mana/stamina/essence display (legacy) |
| `src/parts/prefabs/EncounterWindow/part.js` | Encounter display (logic reused in ViewportZone) |
| `src/parts/prefabs/EscalationOverlay/part.js` | Turn-based combat UI overlay |
| `src/parts/prefabs/EventLog/part.js` | Recent history + narrative framing |
| `src/parts/prefabs/SpatialNav/part.js` | Directional compass navigation |
| `src/parts/prefabs/DevControlPanel/part.js` | DEV-only flow control (HUB-14) |

### Parts — Primitives

| File | Purpose |
|------|---------|
| `src/parts/primitives/StatusBar/part.js` | Top status bar (legacy, merged into PlayerHeader) |
| `src/parts/primitives/ReturnToHub/part.js` | Return-to-hub navigation |
| `src/parts/primitives/ErrorCard/part.js` | Error fallback display |

### Systems

| File | Purpose |
|------|---------|
| `src/systems/hubController.js` | Hub orchestration, state machine (HUB-15) |
| `src/systems/autobattler.js` | Encounter spawning + auto-resolution |

### Core Runtime

| File | Purpose |
|------|---------|
| `src/core/actionBus.js` | Event bus + lifecycle tracking (HUB-08-R) |
| `src/core/surfaceCompositor.js` | Slot mounting + overlay support (HUB-07) |
| `src/core/surfaceRuntime.js` | Surface resolution + VM binding |
| `src/core/app.js` | App bootstrap + controller wiring |
| `src/core/router.js` | Hash-based navigation |
| `src/core/chrome.js` | Shell chrome (header/footer) |
| `src/core/modalManager.js` | Modal management |
| `src/core/styleLoader.js` | CSS loading utilities |
| `src/core/tokens.css` | Design tokens + overlay CSS (HUB-07/HUB-11) |

### VM / Demo Data

| File | Purpose |
|------|---------|
| `src/vm/hub-demo-vm.js` | Demo vitals simulation + initial state |

### Manifest

| File | Purpose |
|------|---------|
| `src/parts/manifest.json` | Part registry (17 parts) |

---

## 2. Data Flow Narrative

### State Storage

1. **hubController** — Central state coordinator
   - `currentState`: Full hub state (vitalsHud, encounterWindow, encounterState)
   - `encounterState`: State machine state (idle/active_autobattler/active_turn_based/resolved)
   - `currentEncounter`: Active encounter object

2. **ViewportZone** — UI-only viewport mode (HUB-20)
   - `viewportMode`: "world" | "encounter" (controls which layer is visible)
   - `encounterRemainingMs`: Countdown timer for 60s auto-resolve

3. **Parts** — Each part maintains internal UI state
   - ViewportZone: world simulation + encounter display + timer
   - EscalationOverlay: `state` (active, encounter, turn, vitals)
   - EventLog: `state` (events array)
   - DevControlPanel: `state` (mirrors hubController encounterState)

### Data Flow

```
┌─────────────────┐     init      ┌──────────────────┐
│   app.js        │──────────────▶│  hubController   │
└─────────────────┘               └──────────────────┘
                                          │
                   onStateChange          │ start()
                          ▼               ▼
┌─────────────────┐     ┌──────────────────────────────┐
│ surfaceRuntime  │◀────│     autobattler.start()      │
│ (VM provider)   │     │     vitalsSimulation.start() │
└─────────────────┘     └──────────────────────────────┘
        │                         │
        │ slot data               │ spawn/resolve
        ▼                         ▼
┌─────────────────┐     ┌──────────────────┐
│   Parts         │◀────│    actionBus     │
│ (mount/update)  │────▶│    (events)      │
└─────────────────┘     └──────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  ViewportZone (manages viewportMode)    │
│  - world layer (patrol/simulation)      │
│  - encounter layer (focused encounter)  │
│  - 60s encounter timer                  │
└─────────────────────────────────────────┘
```

### Update Propagation

1. **Controller → Parts**: Via `onStateChange` callback → surfaceRuntime VM provider → part `update()` calls
2. **Autobattler → Controller**: Via callbacks (`onEncounterSpawn`, `onEncounterResolve`, `onVitalsImpact`)
3. **Parts → Controller**: Via ActionBus events (`encounter:escalate`, etc.)
4. **Parts → Parts**: Via ActionBus subscriptions (e.g., EventLog listens to `autobattler:resolve`)
5. **ViewportZone → User**: Manages viewport mode locally, emits `viewport:modeChange` for logging

---

## 3. Event Catalog

### ActionBus Events Used by Hub

| Event | Producer | Consumer(s) | Purpose |
|-------|----------|-------------|---------|
| `autobattler:spawn` | autobattler | ViewportZone, DevControlPanel, EventLog | Encounter spawned |
| `autobattler:resolve` | autobattler | ViewportZone, DevControlPanel, EventLog, hubController | Encounter resolved |
| `encounter:escalate` | ViewportZone, DevControlPanel | hubController | Request escalation |
| `escalation:start` | EscalationOverlay | (logging) | Escalation UI opened |
| `escalation:action` | EscalationOverlay | hubController | Turn-based action taken |
| `escalation:victory` | EscalationOverlay | hubController, EventLog | Manual victory |
| `escalation:exit` | EscalationOverlay | hubController, ViewportZone, DevControlPanel | Escalation ended |
| `hub:escalated` | hubController | ViewportZone, DevControlPanel | State: turn-based entered |
| `hub:deescalated` | hubController | ViewportZone, DevControlPanel | State: returned to autobattler |
| `hub:encounterCleared` | hubController | ViewportZone, DevControlPanel | State: returned to idle |
| `hub:stateChange` | app.js (via hubController) | EventLog | General state update |
| `wardwatch:tick` | ViewportZone | hubController | Simulation tick |
| `viewport:modeChange` | ViewportZone | (logging) | UI viewport mode changed |
| `surface:mounted` | surfaceRuntime | app.js | Surface ready |
| `surface:unmounted` | surfaceRuntime | app.js | Surface cleanup |
| `dev:setWorldState` | DevControlPanel | (optional handler) | DEV world state toggle |

---

## 4. Encounter State Machine

### States (HUB-15)

| State | Description |
|-------|-------------|
| `idle` | No active encounter, autobattler may spawn |
| `active_autobattler` | Encounter active, auto-resolution in progress (60s timer) |
| `active_turn_based` | Escalated to manual combat (EscalationOverlay open) |
| `resolved` | Encounter completed, transitioning to idle |

### Transitions

```
          spawn
  idle ──────────▶ active_autobattler ◀─────┐
    ▲                    │    ▲             │
    │                    │    │             │
    │              escalate   exit          │ (60s timeout)
    │                    ▼    │             │
    │              active_turn_based        │
    │                    │                  │
    │   clear            │ victory/resolve  │
    └────────────────────┴──────▶ resolved ─┘
                                   │
                         (1.5s)    │
                                   ▼
                                 idle
```

### Triggers

| Transition | Trigger Event | Handler |
|------------|---------------|---------|
| idle → active_autobattler | `autobattler:spawn` | `handleEncounterSpawn` |
| active_autobattler → active_turn_based | `encounter:escalate` | `handleEscalate` |
| active_turn_based → active_autobattler | `escalation:exit` | `handleDeescalate` |
| active_* → resolved | `autobattler:resolve` OR 60s timeout | `handleEncounterResolve` |
| resolved → idle | Auto (1.5s timeout) | Automatic |
| any → idle | `hub:encounterCleared` (DEV) | `clearEncounter()` |

### Code Location

- State enum: `src/systems/hubController.js` → `ENCOUNTER_STATES`
- State variable: `src/systems/hubController.js` → `encounterState`
- Transition handlers: `src/systems/hubController.js` → `handle*` functions
- Debug access: `window.__MYFI_DEBUG__.hubController.getEncounterState()`

---

## 5. Stage Modes (HUB-22/23)

### Concept

**BadlandsStage** is the canonical unified stage viewport (HUB-22). It owns ALL visual presentation with a single `stageMode` that controls what the user sees. Stage mode is derived from encounter state by hubController (HUB-23).

| Stage Mode | Encounter State | Description |
|------------|-----------------|-------------|
| `world` | `idle`, `resolved` | Patrol/world scan (default). When encounter active, shows banner with "View Encounter" CTA |
| `encounter_autobattler` | `active_autobattler` | Focused encounter view with timer, vitals trends, "Aid Avatar" and "Exit to World" buttons |
| `battle_turn_based` | `active_turn_based` | Inline battle UI with battlefield, vitals bars, ATB, skill buttons (HUB-24) |

### State → Mode Mapping (HUB-23)

```javascript
function deriveStageMode(encounterState) {
  switch (encounterState) {
    case 'idle':
    case 'resolved':
      return 'world';
    case 'active_autobattler':
      return 'encounter_autobattler';
    case 'active_turn_based':
      return 'battle_turn_based';
    default:
      return 'world';
  }
}
```

### Mode Transitions

```
                  spawn                         escalate
  world ──────────────────▶ encounter_autobattler ──────────────▶ battle_turn_based
    ▲                            │    ▲                                │
    │                            │    │                                │
    │     resolve/clear          │    │ exit battle                    │
    └────────────────────────────┘    └────────────────────────────────┘
```

**Key events:**
- `hub:stageModeChanged` — emitted by hubController when stage mode changes
- `stage:requestMode` — emitted by BadlandsStage to request mode change (intent only)
- `encounter:escalate` — emitted to request battle mode
- `escalation:exit` — emitted to exit battle mode

### 60-Second Timer

- **Location**: `BadlandsStage/part.js` → `startEncounterTimer()`
- **Constant**: `ENCOUNTER_DURATION_MS = 60000`
- **Behavior**: When encounter spawns, timer starts. If timer reaches 0 and state is still `encounter_autobattler`, auto-resolve is triggered.
- **Display**: Timer bar in banner (world mode), numeric countdown in encounter view, not shown in battle.

### Code Location

- stageMode state: `BadlandsStage/part.js` → `state.stageMode`
- Mode derivation: `hubController.js` → `deriveStageMode()`
- Stage mode change: `hubController.js` → `emitStageModeChangeIfNeeded()`
- Stage mode API: `hubController.getStageMode()`

---

## 6. Overlay Behavior

### Overlay Slot Mounting (HUB-07)

1. `surfaceCompositor.js` separates slots into base and overlay categories
2. Base slots render in `.surface-root` container
3. Overlay slots render in `.surface-overlay-root` container (fixed positioning, z-index: 100)
4. Overlay slots get `.slot-overlay` class with `pointer-events: none` by default

### Why `Mounted 1 overlay slot(s)` Appears

This log message appears on Hub load because:
- `escalationOverlay` slot in surface.json has `"overlay": true`
- surfaceCompositor mounts all overlay slots during surface mounting
- This is **expected behavior** — the slot is mounted but the overlay part is hidden

### Overlay Show/Hide (HUB-11)

- **Backdrop/input capture is managed by overlay PARTS, not slots**
- EscalationOverlay has internal `data-state="hidden/active"` attribute
- When hidden: `opacity: 0`, `pointer-events: none` — no dimming or input capture
- When active: `opacity: 1`, `pointer-events: auto` — visible with backdrop
- **CRITICAL**: Backdrop element only has `pointer-events: auto` when container is `[data-state="active"]`

### EscalationOverlay Activation

EscalationOverlay only becomes visible when:
1. User taps "Enter Turn-Based" in ViewportZone (encounter mode)
2. Which emits `encounter:escalate`
3. Which triggers `hubController.handleEscalate()`
4. Which sets `encounterState = ACTIVE_TURN_BASED`
5. Which calls `escalationOverlayRef.escalate()`
6. Which sets `state.active = true` internally
7. Which renders with `data-state="active"`

This ONLY happens when `encounterState === ACTIVE_AUTOBATTLER` (HUB-15 guard).

---

## 7. Known Risks / TODOs

### Lifecycle Leak Risks

- **Mitigated (HUB-08-R)**: ActionBus now tracks subscriptions in dev mode
- **Detection**: `checkForLeaks()` called on surface unmount
- **Remaining risk**: Parts that don't properly unsubscribe will trigger dev warnings
- **Recommended**: All new parts should use `ctx.emitter.subscribe()` pattern

### Overlay/Backdrop Issues

- **Fixed (HUB-11)**: Removed automatic backdrop from tokens.css
- **Fixed (Bug)**: Backdrop only captures pointer events when overlay is active
- **Remaining risk**: None — each overlay part manages its own backdrop

### State Drift

- **Mitigated (HUB-15)**: Centralized state machine in hubController
- **Remaining risk**: If parts maintain separate state that diverges
- **Recommended**: Parts should subscribe to ActionBus events, not maintain parallel state

### Source Attribution

- **Fixed (HUB-13)**: All parts now use scoped emitters
- **Remaining risk**: New code using raw `actionBus.emit()` without source
- **Recommended**: Always use `ctx.emitter.emit()` in parts

### DEV Panel Visibility

- **By Design (HUB-14)**: DevControlPanel only mounts when `window.__MYFI_DEBUG__` exists
- **Risk**: None for production — DEV gate is reliable

### Composite Parts

- **PlayerHeader** and **ViewportZone** are new composite parts
- They don't embed original parts as sub-mounts; they re-render minimal UI using same VM fields
- Original parts (PlayerCore, VitalsHUD, Wardwatch, EncounterWindow) still exist for standalone use

---

## 8. Non-Regression Anchors

These behaviors MUST remain stable:

1. **Player Header Visible**: Hub loads with avatar + chips + vitals in one compact header card
2. **Single Viewport**: Hub shows ONE viewport card (not separate wardwatch + encounter cards)
3. **Overlay Default Hidden**: Hub loads without dimming — EscalationOverlay is hidden by default
4. **Backdrop Pass-Through**: When overlay hidden, backdrop has `pointer-events: none`
5. **Escalation Gate**: EscalationOverlay only opens from `active_autobattler` state via "Enter Turn-Based"
6. **Exit Returns to Autobattler**: Exiting turn-based returns to autobattler, not idle
7. **60s Timer**: Encounters auto-resolve at 60s if not escalated
8. **Subscription Cleanup**: All parts unsubscribe from ActionBus on unmount
9. **Scoped Emitters**: All parts emit via `ctx.emitter.emit()` with proper source
10. **State Inspectability**: `hubController.getEncounterState()` returns current state
11. **DEV Panel Isolation**: DevControlPanel invisible in production
12. **No Console Errors**: Full flow cycle completes without errors

---

## 9. Architect Intake Summary

### Current Surface Slot List (Post HUB-22..26)

```json
{
  "slots": [
    { "id": "playerHeader", "card": true, "part": { "kind": "PlayerHeader" } },
    { "id": "devControlPanel", "card": true, "part": { "kind": "DevControlPanel" } },
    { "id": "stage", "card": true, "part": { "kind": "BadlandsStage" } },
    { "id": "eventLog", "card": true, "part": { "kind": "EventLog" } },
    { "id": "spatialNav", "card": true, "part": { "kind": "SpatialNav" } }
  ]
}
```

**Note:** No overlay slots — battle UI is now inline in BadlandsStage (HUB-24).

### Canonical Parts

| Part | Contains | Notes |
|------|----------|-------|
| `PlayerHeader` | StatusBar + PlayerCore + VitalsHUD | Compact grid layout: avatar left, identity+chips center, vitals right |
| `BadlandsStage` | World + Encounter + Battle | **CANONICAL** stage viewport. Three layers managed by stageMode |

### Encounter Flow UX (HUB-22..24)

1. **Idle**: Patrol world (stageMode="world")
2. **Spawn**: Encounter appears, banner shows with "View Encounter" CTA
3. **View Encounter**: User taps CTA → stageMode="encounter_autobattler"
4. **Aid Avatar**: User taps button → stageMode="battle_turn_based" (inline battle)
5. **Exit Battle**: User exits → returns to encounter_autobattler (autobattler continues)
6. **Exit to World**: User taps → returns to stageMode="world"
7. **Resolve**: 60s timer expires OR dev resolve → returns to idle

### Battle UI (Inline — HUB-24)

- Battle replaces stage content entirely (no overlay)
- Battle HUD includes: avatar portrait, vitals bars (HP/MP/ST/Shield), ATB bar, skill buttons
- Skill buttons: Endure (5 ST), Channel (25 MP), 2 reserved slots
- Exit button returns to encounter_autobattler if encounter still active

---

## 10. Canonical Stage Definition (HUB-26)

**BadlandsStage** is the single authoritative Stage implementation for the Hub.

### Definition

```
BadlandsStage
├── World Layer (stageMode="world")
│   ├── Parallax background
│   ├── Autonomous avatar patrol
│   ├── Time-of-day effects
│   ├── Activity indicators
│   └── Subtle vitals dots
│
├── Encounter Layer (stageMode="encounter_autobattler")
│   ├── Encounter header (icon, name, type)
│   ├── Enemy sprite + health bar
│   ├── Autobattler status indicator
│   ├── Vitals trend indicators
│   ├── 60s countdown timer
│   └── Action buttons (Aid Avatar, Exit to World)
│
└── Battle Layer (stageMode="battle_turn_based")
    ├── Battlefield viewport
    │   ├── Battle background
    │   ├── Enemy display (sprite, name, health)
    │   ├── Turn indicator
    │   └── Combat log
    │
    └── Battle HUD
        ├── Avatar portrait
        ├── Vitals bars (Health, Mana, Stamina, Shield)
        ├── ATB bar
        ├── Skill buttons (Endure, Channel, reserved×2)
        └── Exit battle button
```

### Constraints

1. **Single Owner**: BadlandsStage is the ONLY owner of the large central viewport area
2. **No Overlays for Battle**: Battle UI replaces stage content entirely (no overlay)
3. **Controller-Driven Modes**: Stage mode is always derived from hubController's encounter state
4. **Intent-Only Actions**: User actions emit intents; hubController resolves state changes

### Anti-Drift Rules

- **DO NOT** create new viewport/stage parts — extend BadlandsStage instead
- **DO NOT** use overlays for battle UI — keep it inline
- **DO NOT** manage stage mode in parts — let hubController derive it
- **DO NOT** duplicate vitals state — use hub:stateChange for synchronization

---

## 11. Real-Time Vitals Contract (HUB-25)

### Data Flow

```
┌───────────────────┐       tick       ┌────────────────────┐
│ vitalsSimulation  │─────────────────▶│    hubController   │
└───────────────────┘                  │  (currentState)    │
                                       └────────────────────┘
                                              │
                           onStateChange      │
                                              ▼
                                       ┌────────────────────┐
                                       │   hub:stateChange  │
                                       └────────────────────┘
                                              │
                                              ▼
                                       ┌────────────────────┐
                                       │   BadlandsStage    │
                                       │  (local vitals)    │
                                       └────────────────────┘
                                              │
                       ┌──────────────────────┴───────────────────────┐
                       │                      │                       │
                       ▼                      ▼                       ▼
              World Mode             Encounter Mode           Battle Mode
              (subtle dots)        (trend indicators)     (explicit bars)
```

### Display Rules by Mode

| Mode | Vitals Display | Update Source |
|------|----------------|---------------|
| `world` | Subtle dots (opacity based on %) | hub:stateChange |
| `encounter_autobattler` | Mini bars with trend icons (▲/▼/—) | hub:stateChange |
| `battle_turn_based` | Full bars with numeric values | Local + hub:stateChange sync |

### Battle Vitals Flow

1. **Player action** → BadlandsStage modifies local vitals immediately (instant feedback)
2. **Emit `escalation:action`** with vitalsImpact including costs and damage
3. **hubController.handleEscalationAction()** → `handleVitalsImpact()` → `onStateChange()`
4. **hub:stateChange** → BadlandsStage merges canonical vitals (sync correction)

### Contract Rules

- **No polling** — use event-driven updates only
- **No duplicate calculations** — vitals math in hubController only
- **No lag** — local state for immediate feedback, sync via events
- **No stale values** — always merge incoming hub:stateChange data

---

## 12. Deprecated Concepts

The following patterns are **superseded** and should not be used for new development.

### Deprecated Parts

| Part | Status | Replacement | Notes |
|------|--------|-------------|-------|
| `ViewportZone` | Deprecated (HUB-22) | BadlandsStage | Was unified viewport, now replaced by canonical stage |
| `EscalationOverlay` | Deprecated (HUB-24) | BadlandsStage battle layer | Battle UI is now inline, not overlay |
| `Wardwatch` | Deprecated (HUB-22) | BadlandsStage world layer | World patrol is now in BadlandsStage |
| `EncounterWindow` | Deprecated (HUB-22) | BadlandsStage encounter layer | Encounter display now in BadlandsStage |

### Deprecated Patterns

| Pattern | Status | Replacement |
|---------|--------|-------------|
| `viewportMode` (UI-only state) | Superseded | `stageMode` derived from hubController |
| Overlay for battle UI | Superseded | Inline battle layer in BadlandsStage |
| Multiple viewport slots | Superseded | Single `stage` slot with BadlandsStage |
| `escalationOverlayRef.escalate()` | Removed | Stage mode change via hub:stageModeChanged |

### Historical Reference

These patterns are documented here for historical context only. They should NOT be used as implementation references for new features.

---

## Appendix: Quick Debug Commands

```javascript
// Get current encounter state
window.__MYFI_DEBUG__.hubController.getEncounterState()

// HUB-23: Get current stage mode
window.__MYFI_DEBUG__.hubController.getStageMode()

// Get full debug state
window.__MYFI_DEBUG__.hubController.getEncounterDebugState()

// Force spawn an encounter
window.__MYFI_DEBUG__.hubController.forceEncounter()

// Clear encounter to idle
window.__MYFI_DEBUG__.hubController.clearEncounter()

// List active ActionBus subscriptions
window.__MYFI_DEBUG__.actionBus.debugSubscriptions()

// Get subscription count
window.__MYFI_DEBUG__.actionBus.getActiveSubscriptionCount()
```

---

## Appendix: Code Tour (HUB-26)

### Stage Mode Control (Canonical)

- **File**: `src/parts/prefabs/BadlandsStage/part.js`
- **State**: `state.stageMode` (derived from hubController)
- **Container**: `.BadlandsStage__container[data-stage-mode]`
- **Layers**: `[data-layer="world"]`, `[data-layer="encounter"]`, `[data-layer="battle"]`

### Stage Mode Derivation

- **File**: `src/systems/hubController.js`
- **Function**: `deriveStageMode(encounterState)`
- **Event**: `hub:stageModeChanged` emitted on transitions
- **API**: `hubController.getStageMode()`

### Encounter State Machine

- **File**: `src/systems/hubController.js`
- **State enum**: `ENCOUNTER_STATES`
- **Stage enum**: `STAGE_MODES`
- **Transitions**: `handleEncounterSpawn()`, `handleEscalate()`, `handleDeescalate()`, `handleEncounterResolve()`

### Encounter Timeout (60s)

- **File**: `src/parts/prefabs/BadlandsStage/part.js`
- **Constant**: `ENCOUNTER_DURATION_MS = 60000`
- **Timer start**: `startEncounterTimer()` function
- **Auto-resolve**: When timer reaches 0, calls `autobattler.forceResolve()`

### Battle UI (Inline)

- **File**: `src/parts/prefabs/BadlandsStage/part.js`
- **Skills**: `BATTLE_SKILLS` object (endure, channel)
- **Execution**: `executeBattleSkill()` function
- **Vitals sync**: `escalation:action` event emitted with vitalsImpact

### CTA Buttons in Stage

- **File**: `src/parts/prefabs/BadlandsStage/baseline.html`
- **"View Encounter"**: `[data-action="viewEncounter"]`
- **"Aid Avatar"**: `[data-action="aidAvatar"]`
- **"Exit to World"**: `[data-action="exitToWorld"]`
- **"Exit Battle"**: `[data-action="exitBattle"]`
- **Skill buttons**: `[data-action="endure"]`, `[data-action="channel"]`
