# Hub Screen Architecture Breakdown

**Date:** 2026-01-28
**Status:** Current Implementation State
**Purpose:** Context document for Architect review of Hub baseline requirements

---

## 1. SYSTEM OVERVIEW

The Hub is the primary gameplay screen for the Badlands experience. It displays player vitals, world position, and manages encounter/battle presentation.

### Technology Stack
- **Framework:** Vanilla JS with ES Modules
- **Styling:** CSS with BEM naming convention
- **State Management:** ActionBus pub/sub pattern
- **Layout:** Flexbox-based slot system

---

## 2. ARCHITECTURAL LAYERS

```
┌─────────────────────────────────────────────────────────────────┐
│                         APP CHROME                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Header: Title + DEV buttons (debug mode only)               │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                    SURFACE HOST                              │ │
│  │  ┌─────────────────────────────────────────────────────┐    │ │
│  │  │ SLOT 1: PlayerHeader (card)                         │    │ │
│  │  │   → Vitals Part                                     │    │ │
│  │  ├─────────────────────────────────────────────────────┤    │ │
│  │  │ SLOT 2: WorldMap (card)                             │    │ │
│  │  │   → Region strip with map visual                    │    │ │
│  │  ├─────────────────────────────────────────────────────┤    │ │
│  │  │ SLOT 3: BadlandsStage (no card, flex:1)             │    │ │
│  │  │   → Cinematic viewport + tab content                │    │ │
│  │  ├─────────────────────────────────────────────────────┤    │ │
│  │  │ SLOT 4: EssenceBar (card)                           │    │ │
│  │  │   → Bottom essence meter                            │    │ │
│  │  └─────────────────────────────────────────────────────┘    │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ Footer: Quests | Compass | Avatar                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  │ Modals: Compass Modal, Dev Config Modal                     │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. SURFACE CONFIGURATION

**File:** `src/surfaces/screens/hub/surface.json`

```json
{
  "id": "hub",
  "type": "screen",
  "background": "cosmic",
  "chrome": { "showHeader": true, "showFooter": true, "title": "Badlands Hub" },
  "slots": [
    { "id": "playerHeader", "card": true, "part": { "kind": "PlayerHeader" } },
    { "id": "worldMap", "card": true, "part": { "kind": "WorldMap" } },
    { "id": "stage", "card": false, "part": { "kind": "BadlandsStage" } },
    { "id": "essenceBar", "card": true, "part": { "kind": "EssenceBar" } }
  ]
}
```

### Slot Properties
| Property | Meaning |
|----------|---------|
| `card: true` | Applies card styling (padding, background, border-radius) |
| `card: false` | Raw slot, part controls all styling |
| `overlay: true` | (Not used on Hub) Renders in overlay layer above base slots |

---

## 4. PARTS DETAIL

### 4.1 PlayerHeader (Vitals)

**File:** `src/parts/prefabs/PlayerHeader/part.js`

**Responsibilities:**
- Display avatar icon and player name/title
- Show Health, Mana, Stamina bars with values
- Show status chips (Pressure, Momentum)

**Data Shape:**
```javascript
{
  playerCore: {
    name: 'Wanderer',
    title: 'of the Badlands',
    pressure: 'ahead' | 'behind' | 'balanced',
    momentum: 'rising' | 'falling' | 'steady',
    effects: []
  },
  vitalsHud: {
    vitals: {
      health: { current: 450, max: 1000, delta: -50 },
      mana: { current: 200, max: 500, delta: 0 },
      stamina: { current: 320, max: 400, delta: -30 }
    }
  }
}
```

**ActionBus Subscriptions:**
- `hub:stateChange` → Re-renders with new vitals

**Emits:**
- `openModeInfo` → When mode button clicked
- `openVitalDetail` → When vital bar clicked

---

### 4.2 WorldMap

**File:** `src/parts/prefabs/WorldMap/part.js`

**Responsibilities:**
- Display region name and contextual subtitle
- Show time-of-day indicator (day/dusk/night)
- Show compact dartboard map visual with avatar position

**Data Shape:**
```javascript
{
  worldMap: {
    regionName: 'Wardwatch',
    subtitle: '— All quiet',
    timeOfDay: 'day',
    avatarX: 0,
    avatarY: 0
  }
}
```

**Contextual Subtitle Logic:**
| Stage Mode | Subtitle |
|------------|----------|
| `world` | "— All quiet" |
| `encounter_autobattler` | "— Something stirs…" |
| `battle_turn_based` | "— Battle engaged" |

**ActionBus Subscriptions:**
- `hub:stateChange` → Updates region, time, subtitle
- `stage:modeChange` → Updates subtitle based on mode

---

### 4.3 BadlandsStage

**File:** `src/parts/prefabs/BadlandsStage/part.js`

**Responsibilities:**
- **Primary viewport** for all gameplay presentation
- Tab-switching between Scenic/Log/Loadout views (world mode)
- Encounter view overlay (encounter mode)
- Battle UI (battle mode - currently parked)
- Event log collection and rendering

**Stage Modes:**
| Mode | Description |
|------|-------------|
| `world` | Idle/patrol state. Shows tab content (scenic/log/loadout) |
| `encounter_autobattler` | Auto-resolving encounter. Shows encounter UI |
| `battle_turn_based` | Manual ATB combat (parked for v1) |

**World Tab System (when mode=world):**
| Tab | Content |
|-----|---------|
| `scenic` | Cinematic background with zone visuals |
| `log` | Scrollable list of recent events |
| `loadout` | Equipped skills display |

**Data Attributes:**
```html
<div class="BadlandsStage__container"
     data-stage-mode="world"
     data-world-tab="scenic">
```

**Internal State:**
```javascript
{
  stageMode: 'world',         // world | encounter_autobattler | battle_turn_based
  worldTab: 'scenic',         // scenic | log | loadout
  isDead: false,
  avatarPosition: { x: 50, y: 60 },
  timeOfDay: 'day',
  sceneZone: 'haven',         // haven | north | south | east | west
  sceneDistance: 'near',      // near | mid | far
  events: [],                 // Array of event objects (max 5)
  currentEncounter: null,     // Active encounter data
  vitals: { health, mana, stamina, essence }
}
```

**Event Shape:**
```javascript
{
  id: 'event-1706400000000',
  type: 'encounter' | 'escalation',
  text: 'Victory secured against Wolf Pack',
  icon: '&#9989;',
  sentiment: 'positive' | 'neutral',
  timestamp: 1706400000000
}
```

**ActionBus Subscriptions:**
- `hub:stageModeChanged` → Changes stage mode
- `hub:encounterCreated` → Stores encounter, renders
- `hub:encounterResolved` → Creates event, returns to world
- `hub:timerTick` → Updates countdown display
- `hub:stateChange` → Updates vitals, world state

**Emits:**
- `stage:requestMode` → Requests mode change from hubController
- `encounter:escalate` → Intent to escalate to battle (parked)
- `escalation:exit` → Exit battle request

---

### 4.4 EssenceBar

**File:** `src/parts/primitives/EssenceBar/part.js`

**Responsibilities:**
- Display essence as horizontal progress bar
- Show current value and accrual rate
- Bottom-pinned slim bar design

**Data Shape:**
```javascript
{
  vitalsHud: {
    vitals: {
      essence: {
        current: 1250,
        softCap: 5000,
        accrual: 12.5
      }
    }
  }
}
```

**ActionBus Subscriptions:**
- `hub:stateChange` → Updates essence display

---

## 5. DATA FLOW ARCHITECTURE

### 5.1 ActionBus Pattern

**File:** `src/core/actionBus.js`

The ActionBus is a simple pub/sub event system for Part → Parent and Controller → Part communication.

```
┌──────────────────┐    emit()     ┌──────────────────┐
│  hubController   │ ────────────► │    ActionBus     │
│  (state owner)   │               │                  │
└──────────────────┘               └────────┬─────────┘
                                            │
                     subscribe()            │ broadcast
           ┌────────────────────────────────┼────────────────────────────┐
           │                                │                            │
           ▼                                ▼                            ▼
┌──────────────────┐            ┌──────────────────┐          ┌──────────────────┐
│  PlayerHeader    │            │  BadlandsStage   │          │    WorldMap      │
│  (subscriber)    │            │  (subscriber)    │          │  (subscriber)    │
└──────────────────┘            └──────────────────┘          └──────────────────┘
```

### 5.2 Key Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `hub:stateChange` | Controller → Parts | Broadcast full state snapshot |
| `hub:stageModeChanged` | Controller → Stage | Change stage presentation mode |
| `hub:encounterCreated` | Controller → Stage | New encounter spawned |
| `hub:encounterResolved` | Controller → Stage | Encounter outcome |
| `hub:timerTick` | Controller → Stage | Countdown update |
| `stage:requestMode` | Stage → Controller | Request mode change (intent) |
| `stage:modeChange` | Stage → Parts | Notify mode changed |

### 5.3 State Authority

**hubController** is the canonical state owner. Parts are **presentation-only**.

**Anti-Patterns:**
- Direct mutation: `state.stageMode = 'battle'` ❌
- External API: `part.setStageMode('world')` ❌
- Optimistic updates before controller confirmation ❌

**Correct Pattern:**
1. User clicks button in Part
2. Part emits intent event (e.g., `stage:requestMode`)
3. Controller validates and transitions state
4. Controller emits confirmation event (e.g., `hub:stageModeChanged`)
5. Part receives event and re-renders

---

## 6. SURFACE COMPOSITOR

**File:** `src/core/surfaceCompositor.js`

Mounts surfaces by:
1. Creating `surface-root` container
2. Iterating slots from surface.json
3. For each slot:
   - Creating slot div with classes (`slot`, `slot-card` if card:true)
   - Resolving part factory from manifest
   - Creating scoped emitter via `createPartEmitter()`
   - Calling factory with `(slotEl, { id, kind, props, data, ctx })`
   - Storing returned API for unmount

**Part Factory Signature:**
```javascript
export default async function mount(host, { id, kind, props, data, ctx }) {
  // ... mount logic
  return {
    unmount() { /* cleanup */ },
    update(newData) { /* re-render */ }
  };
}
```

**Context (`ctx`) Contents:**
- `emitter` — Scoped ActionBus emitter for this part
- `actionBus` — Direct ActionBus module reference
- `isOverlay` — Boolean if slot is overlay

---

## 7. APP CHROME

**File:** `src/core/chrome.js`

Chrome provides the persistent app shell:
- **Header:** Title, DEV buttons (hidden by default)
- **Surface Host:** Where surfaces mount
- **Footer:** Navigation buttons (Quests, Compass, Avatar)
- **Modals:** Compass modal, Dev Config modal

### DEV Spawn Button
Location: `chrome.js:14`
- Hidden by default (`display: none`)
- Enabled via `enableDevSpawn()` function
- Triggers encounter spawn via ActionBus

### Navigation
Footer buttons use `data-nav` attribute for routing:
- `quests` → Quests screen
- `hub` → Hub screen
- `avatar` → Avatar screen
- `guidance` → Guidance screen

---

## 8. PART MANIFEST

**File:** `src/parts/manifest.json`

```json
{
  "parts": [
    { "kind": "PlayerHeader", "category": "prefab", "path": "./prefabs/PlayerHeader/part.js" },
    { "kind": "BadlandsStage", "category": "prefab", "path": "./prefabs/BadlandsStage/part.js" },
    { "kind": "WorldMap", "category": "prefab", "path": "./prefabs/WorldMap/part.js" },
    { "kind": "EssenceBar", "category": "primitive", "path": "./primitives/EssenceBar/part.js" }
  ]
}
```

**Categories:**
- `prefab` — Complex parts with multiple concerns
- `primitive` — Simple, single-purpose parts

---

## 9. LAYOUT BEHAVIOR

### 9.1 Flexbox Structure

```css
.surface-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.slot {
  /* Base slot styling */
}

.slot-card {
  /* Card styling: padding, background, border-radius */
}

/* Stage slot takes remaining space */
[data-slot-id="stage"] {
  flex: 1;
  min-height: 0;
}
```

### 9.2 Space Distribution

| Slot | Height Behavior |
|------|-----------------|
| PlayerHeader | Content-based (shrink-to-fit) |
| WorldMap | Content-based (~80-100px) |
| BadlandsStage | `flex: 1` (fills remaining) |
| EssenceBar | Content-based (~40-50px) |

---

## 10. MOBILE RESPONSIVENESS

All parts include responsive breakpoints:

| Breakpoint | Target |
|------------|--------|
| `max-width: 360px` | Small phones |
| `max-height: 500px` | Landscape orientation |

Key adjustments:
- Reduced padding and gaps
- Smaller font sizes
- Hidden labels (icons only)
- Maintained 44px touch targets

---

## 11. CURRENT STATE SUMMARY

### What Works
- 4-slot layout (Vitals → WorldMap → Stage → Essence)
- Tab switching in Stage (Scenic/Log/Loadout)
- ActionBus event flow
- Encounter spawn and display
- Vitals rendering and updates
- Time-of-day display
- Event log collection

### Known Limitations
- Battle mode (turn-based) is parked for v1
- Scenic backgrounds are gradient-only (no illustrations)
- Loadout tab shows static placeholder skills
- hubController not fully implemented (demo uses VM)

### Non-Functional in Current Build
- Full encounter resolution flow (partial)
- Skill execution in battle mode
- Real persistence/save

---

## 12. FILE REFERENCE

| File | Purpose |
|------|---------|
| `surfaces/screens/hub/surface.json` | Hub surface definition |
| `core/surfaceCompositor.js` | Mounts surfaces and slots |
| `core/actionBus.js` | Event pub/sub system |
| `core/chrome.js` | App shell (header/footer/modals) |
| `core/router.js` | Screen navigation |
| `core/styleLoader.js` | CSS loading utility |
| `parts/manifest.json` | Part registry |
| `parts/prefabs/PlayerHeader/*` | Vitals part |
| `parts/prefabs/WorldMap/*` | Region strip part |
| `parts/prefabs/BadlandsStage/*` | Main stage part |
| `parts/primitives/EssenceBar/*` | Essence bar part |
| `vm/hub-demo-vm.js` | Demo data provider |

---

## 13. QUESTIONS FOR ARCHITECT

1. **hubController Integration:** Is the demo VM approach sufficient, or should hubController be fully implemented before Hub v1 sign-off?

2. **Battle Mode:** Confirm battle_turn_based remains parked. Any UI scaffolding needed?

3. **Scenic Backgrounds:** Are gradient backgrounds acceptable, or do we need illustrated assets?

4. **Loadout Tab:** Should this show real equipped skills from player state, or remain placeholder?

5. **Event Persistence:** Should events survive navigation away from Hub?

6. **Encounter Timer:** Currently display-only. Should Stage own timer logic, or remain hubController responsibility?

---

**End of Breakdown**
