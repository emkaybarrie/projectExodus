# Stage Engine

## Core Concept

**The Stage is the beating heart of MyFi.**

It is NOT a UI surface—it is a **real-time narrative renderer** simulating the core Badlands game loop in spectator mode, driven by financial data and player influence.

The player observes a living world. They may intervene, or simply watch the story unfold.

---

## Spectator-Mode Simulation Model

The Stage renders derived modes (NOT a state machine—behavior is controlled elsewhere):

```
┌─────────────────┐     ┌───────────────────┐     ┌───────────────┐
│  IDLE_TRAVEL    │────►│ INCIDENT_OVERLAY  │────►│ COMBAT_ACTIVE │
│                 │     │   (or choice tag) │     │               │
│ World cycling:  │     │                   │     │ Autobattler   │
│ rest→patrol→    │◄────│ Slow-time, player │◄────│ ticks, enemy  │
│ explore→return→ │     │ can tag or skip   │     │ HP, damage    │
│ city (loop)     │     │                   │     │               │
└─────────────────┘     └───────────────────┘     └───────────────┘
       ▲                                                  │
       └────────────────── RESOLUTION ◄───────────────────┘
```

### STAGE_MODES Enum (WO-S1)

**Location:** `src/core/stageSchemas.js`

| Mode | Description | Trigger |
|------|-------------|---------|
| `IDLE_TRAVEL` | Avatar wandering, world state cycling | Default / episode resolved |
| `INCIDENT_OVERLAY` | Slow-time overlay, tagging prompt | Episode active + choice mode |
| `COMBAT_ACTIVE` | Autobattler running, enemy visible | Encounter spawned |
| `RESOLUTION` | Outcome display | Episode resolving/after phase |

**Key Principle:** Stage SHOWS mode, it does NOT control behavior.
- Combat logic → `autobattler.js`
- Episode logic → `episodeRunner.js`
- World state → `BadlandsStage/part.js` internal timer

### deriveStageMode(state)

Helper function to derive current mode from state:

```javascript
import { deriveStageMode, STAGE_MODES } from '../core/stageSchemas.js';

const mode = deriveStageMode(stageState);
// Returns: 'idle_travel' | 'incident_overlay' | 'combat_active' | 'resolution'
```

### Mode Details

#### 1. IDLE_TRAVEL
- **World State Cycling:** rest → patrol → explore → return → city (loop)
- Avatar wanders the world, background transitions every 30-90 seconds
- No active incident, peaceful observation
- **Visual:** Scenic backgrounds, ambient motion

#### 2. INCIDENT_OVERLAY
- **Triggered by:** Financial signal (transaction, anomaly, etc.)
- Slow-time effect, tagging prompt appears
- Player can tag spend (choice mode) or skip to autopilot
- **Visual:** Stage dims, overlay panel slides in

#### 3. COMBAT_ACTIVE
- Combat simulation runs (autobattler ticks every 2.5s)
- Enemy sprite visible, HP bar, damage numbers
- **Visual:** Combat background, enemy, timer countdown

#### 4. RESOLUTION
- Resolution display, vitals impact shown
- Return to idle travel after aftermath
- **Visual:** Outcome text, brief pause before world resumes

---

## Signal → Incident → Episode Pipeline

```
Financial Data
     ↓
  [Signal]           ← stageSignals.ingest(signal)
     ↓
  [Incident]         ← incidentFactory.createIncidentFromSignal()
     ↓
  [Episode]          ← episodeRunner.startFromIncident()
     ↓
  Phases: SETUP → ACTIVE → RESOLVING → AFTER
     ↓
  Resolution + Vitals Delta
```

### Signal Kinds
| Kind | Source | Example |
|------|--------|---------|
| `transaction` | Bank sync, manual entry | $45 at grocery store |
| `anomaly` | Pattern detection | Unusual large spend |
| `schedule` | Time-based trigger | Weekly summary |
| `threshold` | Limit crossed | Budget exceeded |
| `ambient` | System tick | Random encounter |

### Incident Kinds (Taxonomy)
| Kind | Trigger | Mechanic Mode |
|------|---------|---------------|
| `combat` | discretionary spend | autobattler |
| `traversal` | essential spend | autobattler |
| `social` | subscription spend | choice (tagging) |
| `anomaly` | pattern break | choice (tagging) |

---

## Episode Phases

```
SETUP (1s)
   │  Caption displayed, background graded darker
   ▼
ACTIVE (variable)
   │  Player can intervene (tag) or let autopilot handle
   │  Combat episodes: autobattler ticks run
   │  Choice episodes: tagging overlay shown
   ▼
RESOLVING (2s)
   │  Resolution displayed, vitals delta calculated
   ▼
AFTER (1.5s)
   │  Aftermath fade, add to Recent Events timeline
   ▼
COMPLETE
   │  Episode archived, world state resumes
```

---

## Data Schemas

### Signal
```javascript
{
  id: 'sig-xxx',
  kind: 'transaction' | 'anomaly' | 'schedule' | 'threshold' | 'ambient',
  atMs: 1700000000000,
  sourceRef: 'bank-sync',
  payload: { amount: 45, merchant: 'Grocery Store', category: 'essential' }
}
```

### Incident
```javascript
{
  id: 'inc-xxx',
  atMs: 1700000000000,
  kind: 'combat' | 'traversal' | 'social' | 'anomaly',
  requiredTokens: [],
  tone: { mood: 'tense', intensity: 2 },
  mechanics: { mode: 'autobattler' | 'choice', difficulty: 1, durationS: 30 },
  taggingPrompt: { question: '...', options: [...] },
  narrative: { captionIn: '...', captionOut: '...' },
  renderPlan: { /* DioramaSpec */ }
}
```

### Episode
```javascript
{
  id: 'ep-xxx',
  incidentId: 'inc-xxx',
  phase: 'setup' | 'active' | 'resolving' | 'after',
  startedAtMs: 1700000000000,
  resolvedAtMs: null | 1700000030000,
  resolution: {
    mode: 'player' | 'auto',
    choiceId: 'health' | 'mana' | 'stamina' | 'unknown',
    confidence: 0.6-1.0,
    vitalsDelta: { health: -10, stamina: -5 },
    notes: 'Tagged as essential'
  }
}
```

---

## World State System

### State Cycle
```
rest → patrol → explore → return → city → (loop)
```

### Transition Rules
- Random delay: 30-90 seconds between states (configurable)
- Paused during combat/incident
- Background randomized per state (from manifest.json)

### Background Loading
```
assets/art/stages/
├── combat/
│   ├── manifest.json
│   └── wardwatch-combat-*.png
├── patrol/
├── explore/
├── rest/
├── return/
└── city/
```

---

## ActionBus Events

### Emitted by Episode Runner
| Event | Payload | When |
|-------|---------|------|
| `episode:started` | episode, incident | Episode begins |
| `episode:phaseChange` | episode, incident, previousPhase, newPhase | Phase transitions |
| `episode:setup` | episode, incident, narrative | Setup phase |
| `episode:active` | episode, incident, taggingPrompt, slowTimeActive | Active phase |
| `episode:timerTick` | remainingMs, totalMs, percent | Timer updates |
| `episode:playerChoice` | episode, incident, choiceId, vitalsDelta | Player tagged |
| `episode:resolving` | episode, incident, resolution | Resolution phase |
| `episode:aftermath` | episode, incident, narrative | Aftermath phase |
| `episode:resolved` | episode, incident, resolution, vitalsDelta | Episode complete |

### Listened by Episode Runner
| Event | Action |
|-------|--------|
| `stage:signal` | Start episode from signal |
| `episode:submitChoice` | Player makes tagging choice |
| `autobattler:resolve` | Combat episode resolution |

### Combat Events
| Event | Payload | When |
|-------|---------|------|
| `autobattler:spawn` | encounter | Combat starts |
| `autobattler:resolve` | result, isVictory, summary | Combat ends |
| `combat:tick` | round, damageDealt, damageTaken, vitalsImpact | Per combat round |

---

## Scene Beat Log (Future: WO-S5)

Each resolved episode generates a Scene Beat:

```javascript
{
  time: 1700000030000,
  location: { sector: 'east', areaIndex: 2, zoneId: 'frontier-outpost' },
  incidentType: 'combat',
  resolvedBy: 'auto' | 'engaged',
  vitalsDelta: { health: -15, essence: +5 },
  narrativeTag: 'discretionary_encounter'
}
```

Timeline stored in `episodeRunner.getTimeline()` (last 50 episodes).

---

## Configuration

### Dev Config (window.__MYFI_DEV_CONFIG__)
```javascript
{
  encounterDuration: 30,        // Combat duration in seconds
  damageMultiplier: 100,        // Damage scale (100 = normal)
  godMode: false,               // Invincibility
  worldStateMinTime: 30,        // Min seconds between state transitions
  worldStateMaxTime: 90,        // Max seconds between state transitions
  worldStateRandomizeBg: true,  // Randomize background per state
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/systems/episodeRunner.js` | Episode lifecycle management |
| `src/systems/stageSignals.js` | Signal ingestion and queue |
| `src/systems/incidentFactory.js` | Signal → Incident conversion |
| `src/core/stageSchemas.js` | Data schema definitions |
| `src/parts/prefabs/BadlandsStage/part.js` | Stage UI component |
| `src/systems/autobattler.js` | Combat simulation |

---

## Design Principles

1. **Stage is spectator mode** - Player watches, optionally intervenes
2. **Financial data drives narrative** - Transactions become story beats
3. **Combat is canonical** - Autobattler is the reference mechanic
4. **Incidents differ only by presentation** - Same pipeline, different visuals
5. **No forced engagement** - Autopilot handles inaction gracefully
