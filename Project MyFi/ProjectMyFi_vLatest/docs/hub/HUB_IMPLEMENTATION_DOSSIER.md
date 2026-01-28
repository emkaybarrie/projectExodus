# Hub Implementation Dossier

**Generated:** 2026-01-27
**Last Updated:** 2026-01-27 (HUB-B1..B10 Baseline Refresh)
**Purpose:** Comprehensive baseline analysis for Architect-led requirements session
**Scope:** Hub v3 Post HUB-B10 (Badlands Stage Baseline v1 Complete)

---

## BASELINE REFRESH: HUB-B1 through HUB-B10

### What Changed

| Work Order | Summary | Status |
|------------|---------|--------|
| **HUB-B1** | Deprecated Wardwatch, EncounterWindow, ViewportZone, EscalationOverlay; removed dead hubController refs | ✅ Complete |
| **HUB-B2** | Stage Mode Contract: stageMode driven purely by hubController, setStageMode() removed | ✅ Complete |
| **HUB-B3** | World Mode: patrol animation, parallax motion, time-of-day visual shifts | ✅ Complete |
| **HUB-B4** | Encounter Mode: tension overlay with urgency-based visual escalation | ✅ Complete |
| **HUB-B5** | Battle Mode: inline ATB UI (already implemented, documented) | ✅ Complete |
| **HUB-B6** | Vitals Rendering Contract: documented data flow and anti-patterns | ✅ Complete |
| **HUB-B7** | Skill buttons now data-driven from BATTLE_SKILLS object | ✅ Complete |
| **HUB-B8** | Timer authority moved to hubController, BadlandsStage receives hub:timerTick | ✅ Complete |
| **HUB-B9** | Mobile breakpoints hardened for ≤320px viewports | ✅ Complete |
| **HUB-B10** | Documentation updated, baseline locked | ✅ Complete |

### New Events Added

| Event | Emitter | Consumer | Payload |
|-------|---------|----------|---------|
| `hub:timerTick` | hubController | BadlandsStage | `{ remainingMs, totalMs, percent }` |

### Removed APIs

| API | Reason |
|-----|--------|
| `BadlandsStage.setStageMode()` | Violates HUB-B2 contract; mode must come from hubController |
| `hubController.setWardwatchRef()` | Dead code; Wardwatch deprecated |
| `hubController.setEscalationOverlayRef()` | Dead code; EscalationOverlay deprecated |

### Deprecated Parts (Do Not Mount)

| Part | Deprecation Note |
|------|------------------|
| `Wardwatch` | HUB-B1: World view now inline in BadlandsStage |
| `EncounterWindow` | HUB-B1: Encounter UI now inline in BadlandsStage |
| `ViewportZone` | HUB-22: Use BadlandsStage |
| `EscalationOverlay` | HUB-24: Battle UI now inline in BadlandsStage |

---

---

## 1) Executive Snapshot

### What the Hub Currently Does (End-to-End in 30 Seconds)

1. User opens Hub (`#hub`) after auth
2. Sees compact **PlayerHeader** with avatar, identity, status chips, and animated vitals bars
3. Sees **BadlandsStage** showing autonomous patrol (world layer) with time-of-day effects
4. In DEV mode, a purple "DEV: Spawn" button floats at top of stage
5. Clicking spawn creates an encounter - banner appears with "View Encounter" CTA
6. Tapping CTA switches to encounter layer (timer, enemy, vitals trends)
7. Tapping "Aid Avatar" enters inline battle (battlefield, skill buttons, Exit Battle)
8. Exiting battle returns to encounter layer; "Exit to World" returns to world view
9. Encounter auto-resolves at 60s; EventLog captures outcome
10. SpatialNav at bottom provides directional navigation to other screens

### What is "Canonical" Right Now

| Component | Path | Status |
|-----------|------|--------|
| **BadlandsStage** | `src/parts/prefabs/BadlandsStage/` | Canonical unified stage (HUB-22) |
| **PlayerHeader** | `src/parts/prefabs/PlayerHeader/` | Canonical merged header (HUB-18) |
| **hubController** | `src/systems/hubController.js` | Single authority for encounter state (HUB-15/23) |
| **surface.json** | `src/surfaces/screens/hub/surface.json` | 4 slots (no DevControlPanel post HUB-27) |
| **HUB_RECONCILIATION_REPORT.md** | `docs/hub/` | Reference doc (mostly current) |
| **HUB_DEV_TEST_RUNBOOK.md** | `docs/hub/` | Manual test script (updated for HUB-27) |

### Top 10 Known Gaps / Rough Edges (Post HUB-B10)

1. **No tabs in Hub shell** — EventLog and other sections below stage are visible but no tab organization
2. **PlayerHeader vitals sometimes show stale initial values** — First tick may not render correctly
3. ~~**Battle HUD still cramped on very narrow screens**~~ — **FIXED in HUB-B9**: ≤320px breakpoints hardened
4. **No visual feedback when spawn button is pressed** — Button just disables
5. **Enemy health bar resets when exiting/re-entering battle** — State not persisted properly
6. **ATB bar is cosmetic only** — Always shows 100%, no real timing mechanic
7. **Locked skill slots serve no purpose** — Just placeholder UI (now data-driven per HUB-B7)
8. **EventLog narrative templates are limited** — Same phrases repeat frequently
9. **SpatialNav targets don't exist** — Routes to guidance/quests/avatar/badlands return 404
10. **World simulation is simplistic** — Avatar just wanders, no actual patrol logic (parallax motion added in HUB-B3)

---

## 2) Current Hub Surface Map

### Exact `hub/surface.json` Content (Post HUB-27)

```json
{
  "id": "hub",
  "type": "screen",
  "background": "cosmic",
  "chrome": { "showHeader": true, "showFooter": true, "title": "Badlands Hub" },
  "slots": [
    { "id": "playerHeader", "card": true, "part": { "kind": "PlayerHeader" } },
    { "id": "stage", "card": true, "part": { "kind": "BadlandsStage" } },
    { "id": "eventLog", "card": true, "part": { "kind": "EventLog" } },
    { "id": "spatialNav", "card": true, "part": { "kind": "SpatialNav" } }
  ]
}
```

**Source:** `src/surfaces/screens/hub/surface.json:1-12`

### Slot-by-Slot Breakdown

| Slot ID | Part Kind | Card | Overlay | Expected Height | Primary Purpose |
|---------|-----------|------|---------|-----------------|-----------------|
| `playerHeader` | PlayerHeader | true | false | ~80px (compact) | Avatar + identity + vitals in single row |
| `stage` | BadlandsStage | true | false | 200-420px (flex) | Central viewport: world/encounter/battle |
| `eventLog` | EventLog | true | false | Auto (~120px) | Recent encounter outcomes with narrative |
| `spatialNav` | SpatialNav | true | false | ~100px | Directional navigation compass |

**Note:** DevControlPanel was removed from surface.json in HUB-27; spawn functionality moved inline to BadlandsStage.

---

## 3) Parts Inventory (Hub-Related)

### PlayerHeader

| Attribute | Value |
|-----------|-------|
| **Path** | `src/parts/prefabs/PlayerHeader/part.js` |
| **Purpose** | Compact merged header (StatusBar + PlayerCore + VitalsHUD) |

**Lifecycle:**
- `mount()`: Loads CSS, baseline HTML, binds interactions, subscribes to `hub:stateChange`
- `update(newData)`: Re-renders all sections (status line, identity, vitals)
- `unmount()`: Unsubscribes from ActionBus, removes root element

**Data Inputs Consumed:**
- `data.mode` — "verified" or "unverified" (from StatusBar contract)
- `data.payCycle` — { dayOfCycle, daysRemaining }
- `data.playerCore` — { name, title, pressure, momentum }
- `data.vitalsHud.vitals` — { health, mana, stamina, essence } each with { current, max, delta }

**ActionBus Events:**
- **Subscribed:** `hub:stateChange` — re-renders with new hub state
- **Emitted:** `openModeInfo` (on mode button click), `openVitalDetail` (on vital click)

**Timers/Loops:** None

**Known Issues:** Initial render may show placeholder values until first `hub:stateChange` arrives (~3s delay)

---

### BadlandsStage

| Attribute | Value |
|-----------|-------|
| **Path** | `src/parts/prefabs/BadlandsStage/part.js` |
| **Purpose** | Canonical unified stage with three visual layers |

**Lifecycle:**
- `mount()`: Loads CSS/HTML, binds interactions, starts world simulation, subscribes to 6+ events
- `update(newData)`: Merges vitals and encounter data, re-renders
- `unmount()`: Stops simulation, clears timers, unsubscribes all handlers

**Data Inputs Consumed:**
- `data.vitalsHud.vitals` — Vitals for all three modes
- `data.encounterWindow.encounter` — Current encounter object

**ActionBus Events:**
- **Subscribed:** `hub:stageModeChanged`, `autobattler:spawn`, `autobattler:resolve`, `hub:encounterCleared`, `hub:stateChange`, `autobattler:tick`
- **Emitted:** `stage:requestMode` (intent), `encounter:escalate`, `escalation:exit`, `escalation:action`, `escalation:victory`, `wardwatch:tick`

**Timers/Loops:**
- `createWorldSimulation()` — 2s tick for avatar patrol, time progression
- `startEncounterTimer()` — 1s tick for 60s countdown, auto-resolve trigger

**State Machine (internal):**
- `state.stageMode`: "world" | "encounter_autobattler" | "battle_turn_based"
- Controlled by `hub:stageModeChanged` from hubController

**Known Issues:**
- Enemy health resets when switching layers
- ATB bar is purely visual (always 100%)
- Battle log can overflow on long messages

---

### DevControlPanel (Deprecated from surface)

| Attribute | Value |
|-----------|-------|
| **Path** | `src/parts/prefabs/DevControlPanel/part.js` |
| **Purpose** | DEV-only encounter flow control |

**Status:** Removed from surface.json in HUB-27. Spawn button moved inline to BadlandsStage. Part still exists in manifest for potential standalone use.

**Gate:** `window.__MYFI_DEBUG__` must be truthy

**Known Issues:** N/A (no longer mounted in Hub)

---

### EventLog

| Attribute | Value |
|-----------|-------|
| **Path** | `src/parts/prefabs/EventLog/part.js` |
| **Purpose** | Recent history with narrative framing |

**Lifecycle:**
- `mount()`: Loads CSS/HTML, subscribes to resolve/victory/exit events
- `update(newData)`: Replaces events array
- `unmount()`: Unsubscribes, removes root

**Data Inputs Consumed:**
- `data.events` — Array of event objects (optional initial)
- `data.maxEvents` — Max events to display (default 5)

**ActionBus Events:**
- **Subscribed:** `autobattler:resolve`, `escalation:victory`, `escalation:exit`, `hub:stateChange`
- **Emitted:** None

**Timers/Loops:** None

**Known Issues:**
- `hub:stateChange` subscription exists but handler is empty (line 76-78)
- Limited narrative templates cause repetition

---

### SpatialNav

| Attribute | Value |
|-----------|-------|
| **Path** | `src/parts/prefabs/SpatialNav/part.js` |
| **Purpose** | Directional compass navigation |

**Lifecycle:**
- `mount()`: Loads CSS/HTML, binds click and keyboard handlers
- `update()`: No-op (static UI)
- `unmount()`: Removes root (no subscriptions to clean)

**Data Inputs Consumed:** None

**ActionBus Events:** None

**Navigation:**
- Uses `ctx.navigate(target)` or fallback `location.hash = #${target}`
- Targets: guidance (up), badlands (down), quests (left), avatar (right)
- Keyboard: Arrow keys mapped to same targets

**Known Issues:**
- All navigation targets return 404 (surfaces don't exist)
- No visual feedback on keyboard navigation

---

## 4) Systems Inventory

### hubController.js

| Attribute | Value |
|-----------|-------|
| **Path** | `src/systems/hubController.js` |
| **Responsibilities** | Central orchestration, encounter state machine, stage mode derivation |

**Public Methods:**

| Method | Purpose |
|--------|---------|
| `init()` | Creates vitals simulation and autobattler, subscribes to events |
| `start()` | Starts vitals simulation and autobattler loops |
| `stop()` | Stops all loops |
| `getState()` | Returns current hub state snapshot |
| `getEncounterState()` | Returns encounter state machine state |
| `getStageMode()` | Returns derived stage mode |
| `getCurrentEncounter()` | Returns active encounter or null |
| `forceEncounter(type?)` | Force spawns encounter (DEV) |
| `clearEncounter()` | Force returns to idle (DEV) |
| `getAutobattler()` | Returns autobattler instance |
| `getEncounterDebugState()` | Returns full debug snapshot |

**Debug Hooks:**
- `window.__MYFI_DEBUG__.hubController` — Full API access

**State Machine (ENCOUNTER_STATES):**

| State | Description |
|-------|-------------|
| `idle` | No encounter, autobattler may spawn |
| `active_autobattler` | Encounter in progress, 60s timer running |
| `active_turn_based` | Player in battle mode (autobattler paused) |
| `resolved` | Encounter complete, transitioning to idle |

**Transitions:**

```
idle ──spawn──▶ active_autobattler ◀──exit──┐
  ▲                    │                     │
  │               escalate                   │
  │                    ▼                     │
  │           active_turn_based ─────────────┘
  │                    │
  │              resolve/victory
  │                    ▼
  └────(1.5s)──── resolved
```

**Stage Mode Derivation:**
- `idle`, `resolved` → `world`
- `active_autobattler` → `encounter_autobattler`
- `active_turn_based` → `battle_turn_based`

**Timing Model:**
- Vitals simulation: 3s tick (configurable via `createVitalsSimulation`)
- Autobattler spawn check: 5s tick, 25% chance per check
- No direct timing for encounters — 60s timer is in BadlandsStage

**Key Event Flows:**

| Flow | Steps |
|------|-------|
| Spawn Encounter | `autobattler.trySpawn()` → `spawnEncounter()` → `onEncounterSpawn()` → `handleEncounterSpawn()` → emit `hub:stageModeChanged` |
| Resolve Encounter | Timer expires OR `forceResolve()` → `resolveEncounter()` → `onEncounterResolve()` → `handleEncounterResolve()` → emit `hub:stageModeChanged` |
| Enter Battle | User taps "Aid Avatar" → emit `encounter:escalate` → `handleEscalate()` → emit `hub:stageModeChanged` |
| Exit Battle | User taps "Exit Battle" → emit `escalation:exit` → `handleDeescalate()` → emit `hub:stageModeChanged` |

---

### autobattler.js

| Attribute | Value |
|-----------|-------|
| **Path** | `src/systems/autobattler.js` |
| **Responsibilities** | Encounter type selection, spawn timing, resolution outcome calculation |

**Public Methods:**

| Method | Purpose |
|--------|---------|
| `start()` | Starts spawn check interval (5s) |
| `stop()` | Stops spawn check interval |
| `getCurrentEncounter()` | Returns active encounter |
| `forceSpawn(type?)` | Force spawns (optionally specific type) |
| `forceResolve()` | Immediately resolves current encounter |
| `getEncounterCount()` | Returns total spawned count |
| `getEncounterTypes()` | Returns available encounter type list |

**Encounter Types (ENCOUNTER_TYPES):**

| Type | Label | Spawn Weight | Difficulty |
|------|-------|--------------|------------|
| `wanderer` | Wandering Spirit | 30 | 1 |
| `storm` | Dust Storm | 25 | 2 |
| `cache` | Hidden Cache | 15 | 0 |
| `beast` | Badlands Beast | 20 | 3 |
| `anomaly` | Essence Anomaly | 10 | 2 |

**Timing Model:**
- `SPAWN_CHECK_MS`: 5000ms (5s check interval)
- `BASE_SPAWN_CHANCE`: 0.25 (25% per check)
- No auto-resolve timer (handled by BadlandsStage)

**Resolution Outcome:**
- `successThreshold = 0.3 + (0.1 * difficulty)`
- Victory: `successRoll > successThreshold`
- Victory → full rewards; Loss → 30% rewards + full risks

---

### Vitals Simulation (in hub-demo-vm.js)

| Attribute | Value |
|-----------|-------|
| **Path** | `src/vm/hub-demo-vm.js` → `createVitalsSimulation()` |
| **Responsibilities** | Periodic vitals fluctuation, pressure/momentum derivation |

**Timing Model:**
- Default interval: 3000ms (3s)
- Per tick: Random deltas for health (-20 to +20), mana (-10 to +20), stamina (-5 to +15)
- Essence: Always positive accrual (10-20 per tick)

**Derived Values:**
- `pressure`: "ahead" if avg vital % > 60%, "behind" if < 40%, else "balanced"
- `momentum`: "rising" if net delta > +10, "falling" if < -10, else "steady"
- `effects`: Conditional status effects (Low Health, Mana Drain, Regen Pulse)

---

## 5) Canonical Event Catalog (ActionBus)

### Hub-Related Events

| Event | Producer(s) | Consumer(s) | Payload | Notes |
|-------|-------------|-------------|---------|-------|
| `hub:stateChange` | hubController (via app.js), hubController.handleVitalsImpact | PlayerHeader, BadlandsStage, EventLog | Full hub state | Primary vitals sync mechanism |
| `hub:stageModeChanged` | hubController.emitStageModeChangeIfNeeded | BadlandsStage | `{ stageMode, previousMode, encounter, vitals }` | Stage layer visibility |
| `hub:escalated` | hubController.handleEscalate | (logging) | `{ encounter, encounterState }` | Deprecated — use stageModeChanged |
| `hub:deescalated` | hubController.handleDeescalate | (logging) | `{ encounterState }` | Deprecated — use stageModeChanged |
| `hub:encounterCleared` | hubController.clearEncounter, handleEncounterResolve | BadlandsStage | `{ encounterState }` | DEV clear or auto-transition |
| `autobattler:spawn` | autobattler.spawnEncounter | BadlandsStage | Encounter object | Encounter starts |
| `autobattler:resolve` | autobattler.resolveEncounter | BadlandsStage, EventLog | Outcome object | Encounter ends |
| `autobattler:tick` | (unused) | BadlandsStage | `{ enemyDamage }` | Reserved for future |
| `encounter:escalate` | BadlandsStage | hubController | `{ encounterId, encounter }` | Request battle mode |
| `escalation:exit` | BadlandsStage | hubController, EventLog | `{ encounter, turn }` | Exit battle |
| `escalation:action` | BadlandsStage | hubController | `{ action, turn, outcome, vitalsImpact }` | Skill used |
| `escalation:victory` | BadlandsStage | hubController, EventLog | `{ encounter, turns }` | Battle won |
| `wardwatch:tick` | BadlandsStage.createWorldSimulation | hubController | `{ tick, worldState, timeOfDay }` | World sim heartbeat |
| `stage:requestMode` | BadlandsStage | (unused) | `{ mode }` | Intent-only, not processed |
| `surface:mounted` | surfaceRuntime | app.js | `{ surfaceId }` | Surface ready |
| `surface:unmounted` | surfaceRuntime | app.js | `{ surfaceId }` | Surface cleanup |

### Naming Inconsistencies

| Issue | Details |
|-------|---------|
| `hub:escalated` vs `encounter:escalate` | Escalate is intent, escalated is confirmation — naming asymmetric |
| `escalation:exit` vs `hub:deescalated` | Dual events for same transition |
| `stage:requestMode` | Emitted but never consumed |
| `autobattler:tick` | Subscribed in BadlandsStage but never emitted |

---

## 6) The "Engagement Continuum" Implementation Status

### World/Idle Mode

| Feature | Status | Evidence |
|---------|--------|----------|
| Patrol visuals (avatar wandering) | **Implemented** | `createWorldSimulation()` moves avatar every 2s |
| Day/Night cycle | **Implemented** | `progressTime()` cycles day→dusk→night every 10 ticks (20s) |
| Parallax backgrounds | **Implemented** | Three layers in CSS (.bgFar/.bgMid/.bgNear) |
| Scan line effect | **Implemented** | CSS animation, purely decorative |
| Activity text updates | **Implemented** | Random phrases from array every ~20% of ticks |
| World state variance (quiet/stirring/active) | **Partially** | State changes but no visual difference |
| Subtle vitals indicators | **Implemented** | Dots with opacity based on vital % |

### Encounter Autobattler Mode

| Feature | Status | Evidence |
|---------|--------|----------|
| 60s countdown timer | **Implemented** | `ENCOUNTER_DURATION_MS = 60000`, displayed in header and bar |
| Enemy visual representation | **Implemented** | Emoji sprite with idle animation |
| Enemy health bar | **Implemented** | Fills based on `enemyHealth / enemyMaxHealth` |
| Vitals trend indicators | **Implemented** | Mini bars with ▲/▼/— icons |
| "Aid Avatar" CTA | **Implemented** | Button emits `encounter:escalate` |
| "Exit to World" CTA | **Implemented** | Button emits `stage:requestMode` |
| Autobattler status indicator | **Implemented** | Green pulse dot when active |
| Auto-resolve at timer expiry | **Implemented** | Calls `autobattler.forceResolve()` |
| Progress feedback (damage dealt) | **Stubbed** | `autobattler:tick` subscribed but never emitted |

### Turn-Based Battle Mode

| Feature | Status | Evidence |
|---------|--------|----------|
| Battlefield viewport | **Implemented** | Background + enemy sprite area |
| Enemy health display | **Implemented** | Bar + numeric text |
| Turn counter | **Implemented** | Increments after each skill use |
| Battle log | **Implemented** | Shows outcome text for each action |
| Avatar portrait in HUD | **Partially** | Hidden on mobile (<400px) |
| Vitals bars (HP/MP/ST/Shield) | **Implemented** | Full bars with numeric values |
| ATB bar | **Stubbed** | Always shows 100% READY, no timing logic |
| Skill: Endure (5 ST) | **Implemented** | Grants shield + damage reduction |
| Skill: Channel (25 MP) | **Implemented** | Deals 50±15 damage |
| Reserved skill slots | **Stubbed** | Disabled buttons with "?" icons |
| Enemy counter-attack | **Implemented** | Automatic after each player action |
| Victory detection | **Implemented** | Triggers when enemy HP ≤ 0 |
| Exit Battle button | **Implemented** | Visible, returns to autobattler |
| Targeting system | **Not Implemented** | Single enemy assumed |
| Multiple enemies | **Not Implemented** | Single enemy only |

---

## 7) UI/UX Reality Check

### Hub Screen Top-to-Bottom (Portrait Mobile)

```
┌──────────────────────────────────────┐
│ [App Chrome Header - "Badlands Hub"] │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ PlayerHeader Card                │ │
│ │ [Avatar] [Name/Title] [HP MP ST] │ │
│ │          [Chips]      [Essence]  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ BadlandsStage Card               │ │
│ │ [DEV: Spawn button]              │ │
│ │                                  │ │
│ │   [World/Encounter/Battle UI]    │ │
│ │                                  │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ EventLog Card                    │ │
│ │ [Recent Events list or empty]    │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ SpatialNav Card                  │ │
│ │ [Navigation compass]             │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [App Chrome Footer - Tab Nav]        │
└──────────────────────────────────────┘
```

### Spacing / Density Issues

| Issue | Location | Severity |
|-------|----------|----------|
| PlayerHeader can overflow on very narrow screens | PlayerHeader | Low |
| Stage max-height 420px may clip on landscape tablets | BadlandsStage | Medium |
| EventLog takes space even when empty | EventLog | Low |
| Battle HUD elements overlap under 320px width | BadlandsStage battle layer | Medium |
| SpatialNav buttons are small touch targets | SpatialNav | Medium |

### Readability Issues

| Issue | Location |
|-------|----------|
| Vital numbers very small (0.55rem in battle) | BadlandsStage |
| Low contrast on disabled buttons | BadlandsStage skill buttons |
| Timer bar color (red/orange gradient) hard to read timer progress | BadlandsStage |

### "Feels Wrong" Issues

| Issue | Description |
|-------|-------------|
| No loading state | Stage appears empty briefly on mount |
| No transition animations between modes | Instant layer switch feels jarring |
| DEV button looks like production UI | Purple color isn't obviously dev-only |
| Enemy floats without ground | No visual grounding in battlefield |
| Vitals don't animate when changing | Instant bar updates lack polish |

---

## 8) Control Surfaces / Debugging / Dev UX

### DEV Mode Gating

| Gate | Location | Mechanism |
|------|----------|-----------|
| `window.__MYFI_DEBUG__` | `src/core/app.js:76-82` | Object assigned before router starts |
| DEV Spawn button visibility | `BadlandsStage/part.js:229-242` | `style.display = 'block'` if DEBUG exists |

### Available Debug Controls

| Control | Location | Action |
|---------|----------|--------|
| "DEV: Spawn" button | BadlandsStage (floating) | Calls `hubController.forceEncounter()` |
| Console: `forceEncounter()` | `__MYFI_DEBUG__.hubController` | Same as button |
| Console: `clearEncounter()` | `__MYFI_DEBUG__.hubController` | Force return to idle |
| Console: `getEncounterState()` | `__MYFI_DEBUG__.hubController` | Returns state machine state |
| Console: `getStageMode()` | `__MYFI_DEBUG__.hubController` | Returns current stage mode |
| Console: `getEncounterDebugState()` | `__MYFI_DEBUG__.hubController` | Full debug snapshot |
| Console: `debugSubscriptions()` | `__MYFI_DEBUG__.actionBus` | Lists active subscriptions |

### Reproducing Major States

| State | Reproduction Steps |
|-------|-------------------|
| Idle (world) | Load Hub fresh, or run `clearEncounter()` |
| Encounter spawned | Click "DEV: Spawn" or run `forceEncounter()` |
| Viewing encounter | Spawn encounter, click "View Encounter" banner |
| In battle | View encounter, click "Aid Avatar" |
| Exiting battle | In battle, click "Exit Battle" |
| Encounter resolved | Wait 60s or run `getAutobattler().forceResolve()` |

### Known Input/Z-Index Issues

| Issue | Status |
|-------|--------|
| Overlay backdrop blocking input when hidden | **Fixed** (HUB-11) — No overlays in current surface |
| Z-index layering conflicts | **Fixed** — Battle is inline, not overlay |
| DEV spawn button over world UI | By design — z-index: 20 |

---

## 9) Docs & Truth Sources

### HUB_RECONCILIATION_REPORT.md

| Path | `docs/hub/HUB_RECONCILIATION_REPORT.md` |
|------|----------------------------------------|

**Claims:**
- 6 slots in surface.json
- DevControlPanel still in slots

**Reality Match:** **Outdated** — Now 4 slots, DevControlPanel removed (HUB-27)

**Accurate Sections:**
- Encounter state machine
- Stage mode mapping
- Event catalog (mostly)
- Code tour references

**Outdated Sections:**
- Surface slot list (Section 9)
- References to DevControlPanel in surface

---

### HUB_DEV_TEST_RUNBOOK.md

| Path | `docs/hub/HUB_DEV_TEST_RUNBOOK.md` |
|------|-----------------------------------|

**Claims:**
- DEV spawn button at top center of stage
- No DevControlPanel card visible
- Console commands for testing

**Reality Match:** **Current** — Updated in HUB-27

**Test Coverage:**
- Initial load verification: Good
- Full flow cycle: Good
- Mobile testing notes: Present
- Repeat loop validation: Present

**Missing Coverage:**
- Battle skill execution tests
- Enemy defeat/victory path
- Vitals sync verification

---

## 10) Non-Regression Anchors (Observed)

These behaviors MUST remain stable:

1. **PlayerHeader renders on load** — Avatar, chips, vitals visible
2. **Vitals animate over time** — Bars change every 3s (simulation tick)
3. **DEV spawn only in debug mode** — Button invisible in production
4. **Spawn creates encounter banner** — Banner appears in world layer with CTA
5. **View Encounter switches layer** — Stage mode changes to encounter_autobattler
6. **Aid Avatar enters battle** — Stage mode changes to battle_turn_based
7. **Exit Battle returns to encounter** — Not idle, encounter still active
8. **60s timer auto-resolves** — Encounter ends when timer hits 0
9. **Skills deduct resources** — MP/ST bars decrease on use
10. **EventLog captures outcomes** — Victory/survival events appear
11. **Subscription cleanup on unmount** — No leak warnings in console
12. **Scoped emitters have source** — All ActionBus events show source in logs
13. **Stage mode derived from controller** — BadlandsStage never sets its own mode
14. **Chrome header/footer visible** — App shell persists across modes

---

## 11) Open Questions / Unknowns

| Question | Likely Location |
|----------|-----------------|
| How are navigation targets (guidance/quests/avatar/badlands) supposed to work? | Missing surface.json files or router configuration |
| Is ATB supposed to be real timing or always-ready? | Design decision — no implementation spec found |
| What determines encounter difficulty scaling? | autobattler.js — currently static types |
| Should vitals simulation pause during battle? | hubController.js — currently continues |
| Is there a plan for locked skill slots? | No spec found |
| What triggers world state changes (quiet→stirring→active)? | Random in simulation — no encounter correlation |
| Should PlayerHeader show encounter-specific info? | Unknown — currently shows general vitals |
| Is there persistence for encounter progress (enemy HP)? | Currently resets on layer switch |

---

## Dossier Confidence Score

**Score: 4 / 5**

**Rationale:**
- Code paths fully traced for all Hub systems
- State machine transitions verified against implementation
- Event flow confirmed with producer/consumer mapping
- UI structure matches surface.json and CSS analysis
- Some design intent unclear (ATB, locked skills, navigation targets)
- Minor doc drift in reconciliation report

## Fastest Path to Validate Unknowns

1. **Navigation targets** — Search for `surface.json` files in `src/surfaces/screens/` for guidance/quests/avatar/badlands
2. **ATB design intent** — Check original work orders or design docs for battle timing spec
3. **Skill slot plans** — Search for "skill" or "ability" in work order history
4. **Vitals persistence** — Test by entering/exiting battle, observe console for state changes
5. **World state triggers** — Add console log to `updateWorldState()`, observe correlation with encounters
