# Baseline Mode (WO-BASELINE-COHERENCE)

**Implementation:**
- [`src/systems/distanceDriver.js`](../src/systems/distanceDriver.js)
- [`src/systems/scenePacer.js`](../src/systems/scenePacer.js)
- [`src/systems/episodeRunner.js`](../src/systems/episodeRunner.js) (baselineAutoResolveMode)
- [`src/core/app.js`](../src/core/app.js) (system wiring)

---

## Overview

Baseline Mode provides a coherent, hands-off experience where the stage operates autonomously. This mode is designed for:

1. **Passive observation** - Watch avatar progress without interaction
2. **Demo/showcase** - Demonstrate the system without requiring user input
3. **Background operation** - Let the game run while focusing elsewhere
4. **Testing** - Validate episode flow without manual intervention

---

## Core Systems

### 1. Distance Driver (`distanceDriver.js`)

A single numeric driver that controls map progression using a hybrid model.

#### distance01 (0..1)

The canonical progression value derived from (WO-HYBRID-ROUTING):
- **Base schedule** - Time-of-day S-curve from episodeClock
- **Pressure modifier** - EMA-smoothed spend pressure
- **Spike impulse** - Immediate spike effect (fast decay)
- **Aftershock** - Lingering spike effect (slow decay)
- **Activity bias** - Activity state distance modifier
- **Small jitter** - Avoids predictable, robotic movement

```javascript
// Access via debug console
window.__MYFI_DEBUG__.distanceDriver.distance01      // Current value (0..1)
window.__MYFI_DEBUG__.distanceDriver.dayT            // Current time-of-day (0..1)
window.__MYFI_DEBUG__.distanceDriver.baseSchedule    // Base schedule value
window.__MYFI_DEBUG__.distanceDriver.pressureModifier // EMA-smoothed pressure
window.__MYFI_DEBUG__.distanceDriver.spikeImpulse    // Current spike effect
window.__MYFI_DEBUG__.distanceDriver.aftershock      // Lingering spike effect
window.__MYFI_DEBUG__.distanceDriver.distanceBand    // Current distance band
window.__MYFI_DEBUG__.distanceDriver.triggerSpike(100) // Manual spike test
```

#### Configuration

Override via `window.__MYFI_DEV_CONFIG__.distanceDriver`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `distanceCurveSteepness` | `2.0` | S-curve steepness (higher = faster mid-day) |
| `spendPressureScalar` | `0.01` | How much each $ affects pressure ($100 = 1.0) |
| `pressureDecayRate` | `0.02` | Pressure decay per second |
| `maxPressure` | `2.0` | Maximum pressure cap |
| `pressureEmaAlpha` | `0.1` | EMA smoothing (0.05-0.15) |
| `spikeThreshold` | `50` | $ threshold for spike detection |
| `spikeImpulseScale` | `0.001` | Distance per $ of spike |
| `maxSpikeImpulse` | `0.15` | Maximum impulse cap |
| `aftershockRatio` | `0.3` | Portion of impulse → aftershock |
| `aftershockDecayRate` | `0.01` | Aftershock decay per second |
| `jitterRange` | `0.005` | Random variance (±0.5%) |
| `updateIntervalMs` | `1000` | Update tick interval |
| `demoMode` | `true` | Simulate spend signals automatically |
| `demoSpendIntervalMs` | `15000` | Demo spend signal interval |
| `demoSpikeChance` | `0.15` | Probability demo signal is spike |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `distance:updated` | `{ distance01, dayT, baseSchedule, pressureModifier, spikeImpulse, aftershock, distanceBand, delta }` | Every update tick |
| `distance:spike` | `{ amount, impulse, aftershockAdded }` | Spike detected |
| `distance:pressureOverride` | `{ reason, threshold, currentPressure }` | Override triggered |
| `distance:reset` | `{ reason }` | Day boundary or manual reset |

---

### 2. Scene Pacer (`scenePacer.js`)

Controls incident timing and budget allocation.

#### Pacing Controls

- **Daily budget** - Maximum incidents per day
- **Cooldown** - Minimum time between incidents
- **Threshold** - Distance required before incidents start
- **Pacing curve** - How distance affects frequency

```javascript
// Access via debug console
window.__MYFI_DEBUG__.scenePacer.isReady        // Can trigger now?
window.__MYFI_DEBUG__.scenePacer.sceneCount     // Incidents today
window.__MYFI_DEBUG__.scenePacer.budgetRemaining // Remaining budget
```

#### Configuration

Override via `window.__MYFI_DEV_CONFIG__.scenePacer`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dailyBudget` | `12` | Maximum incidents per day |
| `minCooldownMs` | `30000` | Minimum cooldown (30s) |
| `maxCooldownMs` | `180000` | Maximum cooldown (3min) |
| `incidentThreshold` | `0.05` | Distance before incidents start |
| `pacingCurve` | `'even'` | `linear` / `front-loaded` / `back-loaded` / `even` |
| `pacingMultiplier` | `1.5` | Probability multiplier at distance=1 |
| `quietZoneFraction` | `0.1` | Early day quiet period |
| `quietZoneReduction` | `0.5` | Probability reduction in quiet zone |
| `checkIntervalMs` | `5000` | Ready state check interval |

#### Pacing Curves

| Curve | Behavior |
|-------|----------|
| `linear` | Probability increases linearly with distance |
| `front-loaded` | More incidents early in day |
| `back-loaded` | More incidents later in day (exponential) |
| `even` | Uniform distribution regardless of distance |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `scenePacer:ready` | `{ canTrigger, reason, cooldownRemaining }` | Ready state changes |
| `scenePacer:triggered` | `{ sceneCount, budgetRemaining }` | Incident triggered |
| `scenePacer:budgetExhausted` | `{ sceneCount }` | Daily budget spent |

---

### 3. Episode Runner: Baseline Auto-Resolve

When enabled, incidents resolve immediately without player interaction.

#### Enable Baseline Mode

```javascript
// Via debug console
window.__MYFI_DEBUG__.episodeRunner.setBaselineMode(true);

// Via config (before app init)
window.__MYFI_DEV_CONFIG__ = {
  episodeRunner: {
    baselineAutoResolveMode: true
  }
};
```

#### Configuration

Override via `window.__MYFI_DEV_CONFIG__.episodeRunner`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `baselineAutoResolveMode` | `false` | Enable baseline auto-resolve |
| `baselineResolveDelayMs` | `800` | Delay before resolution |
| `baselineShowEcho` | `true` | Show brief resolution echo |
| `baselineEngageChance` | `0.3` | Simulated engagement probability |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `episode:baselineResolved` | `{ episode, incident, resolution, simulatedEngagement }` | Baseline resolution |

---

## Minimal Asset Contract

Baseline mode operates with zero external asset dependencies:

| Asset Type | Contract |
|------------|----------|
| **Backgrounds** | CSS gradients if images fail to load |
| **Sprites** | Unicode emoji fallbacks |
| **Audio** | Silent operation (no audio required) |
| **Data** | Demo VM provides all values |

---

## Integration with Existing Systems

### World State Cycling

Distance driver integrates with world state:

```
distance01 → World State
0.0 - 0.2  → rest (Sanctuary)
0.2 - 0.4  → patrol (Wardwatch)
0.4 - 0.7  → explore (The Wilds)
0.7 - 0.9  → return (Homeward)
0.9 - 1.0  → city (Haven's Gate)
```

### Episode Flow

```
[Signal] → [StageSignals] → [ScenePacer Check] → [EpisodeRunner]
                                    ↓
                           baselineAutoResolveMode?
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
               [BASELINE]                      [INTERACTIVE]
            No overlay shown                 Show Engage/Skip overlay
            Brief delay (800ms)              Wait for input or timeout
            Auto-resolve                     Player choice or autopilot
                    ↓                               ↓
                    └───────────────┬───────────────┘
                                    ↓
                            [Resolution Echo]
                                    ↓
                            [Scene Beat Log]
```

---

## Debug Console Quick Reference

```javascript
// Distance Driver (WO-HYBRID-ROUTING)
__MYFI_DEBUG__.distanceDriver.distance01      // Get current distance
__MYFI_DEBUG__.distanceDriver.dayT            // Get current dayT
__MYFI_DEBUG__.distanceDriver.baseSchedule    // Get base schedule value
__MYFI_DEBUG__.distanceDriver.pressureModifier // Get EMA-smoothed pressure
__MYFI_DEBUG__.distanceDriver.spikeImpulse    // Get spike impulse
__MYFI_DEBUG__.distanceDriver.aftershock      // Get aftershock
__MYFI_DEBUG__.distanceDriver.distanceBand    // Get current distance band
__MYFI_DEBUG__.distanceDriver.getTotalPressure() // Get total pressure effect
__MYFI_DEBUG__.distanceDriver.setDistance(0.5) // Force set distance
__MYFI_DEBUG__.distanceDriver.addPressure(1.0) // Add pressure
__MYFI_DEBUG__.distanceDriver.triggerSpike(100) // Manual $100 spike
__MYFI_DEBUG__.distanceDriver.reset()          // Reset to 0

// Scene Pacer
__MYFI_DEBUG__.scenePacer.isReady             // Can trigger?
__MYFI_DEBUG__.scenePacer.forceTrigger()      // Bypass pacing
__MYFI_DEBUG__.scenePacer.reset()             // Reset counters

// Episode Router (WO-HYBRID-ROUTING)
__MYFI_DEBUG__.episodeRouter.currentState     // Current activity state
__MYFI_DEBUG__.episodeRouter.scheduledState   // What schedule says (no override)
__MYFI_DEBUG__.episodeRouter.isOverridden     // Is pressure override active?
__MYFI_DEBUG__.episodeRouter.clearOverride()  // Clear pressure override
__MYFI_DEBUG__.episodeRouter.forceState('FOCUS') // Force activity state

// Episode Runner
__MYFI_DEBUG__.episodeRunner.setBaselineMode(true)  // Enable baseline
__MYFI_DEBUG__.episodeRunner.isBaselineMode()       // Check mode

// Episode Clock
__MYFI_DEBUG__.episodeClock.getDayT()         // Current dayT (0..1)
__MYFI_DEBUG__.episodeClock.setTimeScale(60)  // Set 60x speed
__MYFI_DEBUG__.episodeClock.jumpToSegment('midday') // Jump to segment

// Emit test signal
__MYFI_DEBUG__.emitDemoSignal(50, 'Test Merchant', 'discretionary')
```

---

## Tuning Tips

### For Faster Demo

```javascript
window.__MYFI_DEV_CONFIG__ = {
  distanceDriver: {
    demoMode: true,
    demoSpendIntervalMs: 5000,  // Spend every 5s
  },
  scenePacer: {
    minCooldownMs: 10000,       // 10s minimum between incidents
    dailyBudget: 50,            // More incidents allowed
  },
  episodeRunner: {
    baselineAutoResolveMode: true,
    baselineResolveDelayMs: 500, // Faster resolution
  }
};
```

### For Calmer Experience

```javascript
window.__MYFI_DEV_CONFIG__ = {
  distanceDriver: {
    demoMode: false,            // No auto-spend
    jitterRange: 0.001,         // Less movement variance
  },
  scenePacer: {
    dailyBudget: 5,             // Fewer incidents
    minCooldownMs: 120000,      // 2min minimum cooldown
    quietZoneFraction: 0.3,     // Longer quiet period
  }
};
```

---

## Key Files

| File | Purpose |
|------|---------|
| [`src/systems/distanceDriver.js`](../src/systems/distanceDriver.js) | Distance progression |
| [`src/systems/scenePacer.js`](../src/systems/scenePacer.js) | Incident timing |
| [`src/systems/episodeRunner.js`](../src/systems/episodeRunner.js) | Episode lifecycle |
| [`src/systems/episodeClock.js`](../src/systems/episodeClock.js) | Demo Mode time-of-day tracking |
| [`src/systems/episodeRouter.js`](../src/systems/episodeRouter.js) | Activity state routing |
| [`src/core/app.js`](../src/core/app.js) | System wiring |

---

## Demo Mode Episode Routing (WO-WATCH-EPISODE-ROUTING)

Demo Mode adds time-of-day awareness to the baseline experience, routing episodes based on simulated daily rhythm.

### Episode Clock (`episodeClock.js`)

Tracks simulated time-of-day with configurable acceleration.

```javascript
// Access via debug console
window.__MYFI_DEBUG__.episodeClock.getState()     // Full state
window.__MYFI_DEBUG__.episodeClock.getDayT()      // Current dayT (0..1)
window.__MYFI_DEBUG__.episodeClock.setTimeScale(60) // Set 60x speed
window.__MYFI_DEBUG__.episodeClock.jumpToSegment('midday') // Jump to segment
```

#### Time Scales

| Scale | Real Time → Simulated | Use Case |
|-------|----------------------|----------|
| `1` | 1s = 1s | Real-time |
| `5` | 1s = 5s | Default dev |
| `20` | 1s = 20s | Fast exploration |
| `60` | 1s = 1min | Rapid testing |
| `300` | 5s = full day | Demo cycle |

#### Day Segments

| Segment | dayT Range | Label |
|---------|------------|-------|
| DAWN | 0.000 - 0.125 | Dawn |
| MORNING | 0.125 - 0.333 | Morning |
| MIDDAY | 0.333 - 0.500 | Midday |
| AFTERNOON | 0.500 - 0.667 | Afternoon |
| EVENING | 0.667 - 0.833 | Evening |
| NIGHT | 0.833 - 1.000 | Night |

### Episode Router (`episodeRouter.js`)

Maps time-of-day segments to activity states.

#### Activity States

| State | Incident Bias | Visual Pool | Pacing | Distance Bias |
|-------|--------------|-------------|--------|---------------|
| WAKE | low | morning | 0.5x | 0 |
| EXPLORE | medium | active | 1.0x | +0.15 |
| FOCUS | high | intense | 1.5x | +0.25 |
| WIND_DOWN | low | evening | 0.75x | 0 |
| REST | minimal | night | 0.25x | -0.1 |

#### Segment → Activity Mapping (default)

| Segment | Activity State |
|---------|---------------|
| dawn | WAKE |
| morning | EXPLORE |
| midday | FOCUS |
| afternoon | EXPLORE |
| evening | WIND_DOWN |
| night | REST |

### Dev UI Controls

Access via Dev Config modal (⚙️ button):

- **Toggle Demo Mode** - Enable/disable time-based routing
- **Time Scale** - 1x, 5x, 20x, 60x, 300x buttons
- **Pause/Resume** - Control clock
- **Jump to Segment** - Dawn, Morning, Midday, etc.
- **Current State** - Shows time, segment, activity

### Integration Points

#### Visual Pools → World State Bias

Activity states influence which world states the stage cycles through:

```
morning pool → rest, patrol, city (calm)
active pool → patrol, explore, return (movement)
intense pool → explore, patrol (high-energy)
evening pool → return, city, rest (winding down)
night pool → rest, city (shelter)
```

#### Incident Pools → Scene Pacer

Activity state modifies incident probability:

| Bias | Multiplier |
|------|------------|
| minimal | 0.1x |
| low | 0.5x |
| medium | 1.0x |
| high | 1.5x |
| very_high | 2.0x |

#### Distance Driver → Activity Bias

Activity states add distance progression bias:

- EXPLORE: +15% boost
- FOCUS: +25% boost
- REST: -10% (slight regression)

### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `activityState:changed` | `{ from, to, reason }` | Activity state transition |
| `activityState:progress` | `{ state, dayT, segmentProgress }` | Clock tick (for UI updates) |

---

## Hybrid Routing (WO-HYBRID-ROUTING)

Hybrid Routing extends Demo Mode with pressure-based overrides and spike handling. The schedule serves as the "spine" but pressure from spending can override activity states.

### Pressure Model

The distance driver now computes distance01 using a hybrid formula:

```
distance01 = clamp01(baseSchedule + pressureModifier + spikeImpulse + aftershock + activityBias)
```

| Component | Source | Description |
|-----------|--------|-------------|
| `baseSchedule` | dayT curve | Time-of-day S-curve (0..1) |
| `pressureModifier` | EMA-smoothed pressure | Gradual pressure effect |
| `spikeImpulse` | Spike detection | Immediate spike effect (fast decay) |
| `aftershock` | Post-spike lingering | Slower-decaying spike residue |
| `activityBias` | Activity state | EXPLORE +15%, FOCUS +25%, REST -10% |

#### EMA Smoothing

Pressure modifier uses exponential moving average for smooth transitions:

```javascript
pressureModifier = alpha * targetPressure + (1 - alpha) * pressureModifier
```

Configure via `pressureEmaAlpha` (default: 0.1, range: 0.05-0.15).

### Spike Handling

Spikes are large single transactions that trigger immediate effects:

```
if (amount >= spikeThreshold):
    impulse = min(maxSpikeImpulse, amount * spikeImpulseScale)
    aftershock += impulse * aftershockRatio
```

#### Spike Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `spikeThreshold` | `$50` | Amount to trigger spike |
| `spikeImpulseScale` | `0.001` | Distance per dollar ($100 = 0.1) |
| `maxSpikeImpulse` | `0.15` | Cap on immediate impulse |
| `aftershockRatio` | `0.3` | Portion that becomes aftershock |
| `aftershockDecayRate` | `0.01` | Aftershock decay per second |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `distance:spike` | `{ amount, impulse, aftershockAdded }` | Spike detected |

### Pressure Overrides

High pressure can override scheduled activity states:

#### EXPLORE Override
- **Trigger:** `pressureModifier >= exploreOverrideThreshold` (default: 0.5)
- **From states:** WAKE, REST
- **Effect:** Forces EXPLORE state despite schedule

#### WIND_DOWN Override
- **Trigger:** `pressureModifier >= returnOverrideThreshold` (default: 0.8) AND `dayT >= 0.7`
- **From states:** EXPLORE, FOCUS
- **Effect:** Forces WIND_DOWN to return home when pressure is high late in day

#### REST Closure Window
- **Rule:** REST is blocked before `dayT >= 0.8`
- **Effect:** Ensures day has meaningful activity before rest

```javascript
// Access via debug console
window.__MYFI_DEBUG__.distanceDriver.getTotalPressure()  // Check total pressure
window.__MYFI_DEBUG__.distanceDriver.triggerSpike(100)   // Manual $100 spike
window.__MYFI_DEBUG__.episodeRouter.clearOverride()       // Clear pressure override
```

#### Override Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `exploreOverrideThreshold` | `0.5` | Pressure to force EXPLORE |
| `returnOverrideThreshold` | `0.8` | Pressure to force WIND_DOWN |
| `returnOverrideDayT` | `0.7` | dayT after which WIND_DOWN override can trigger |
| `restBlockedBeforeDayT` | `0.8` | dayT before which REST is blocked |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `distance:pressureOverride` | `{ reason, threshold, currentPressure }` | Override activated |

### Distance Bands

Distance bands map distance01 to named regions for sub-pool selection:

| Band | Distance Range | Description |
|------|---------------|-------------|
| City | 0.00 - 0.15 | Safe haven, starting area |
| Inner | 0.15 - 0.35 | Outskirts, light encounters |
| Mid | 0.35 - 0.65 | Balanced exploration zone |
| Outer | 0.65 - 0.85 | Dangerous territory |
| Deep | 0.85 - 1.00 | Most dangerous, epic encounters |

```javascript
// Access via debug console
window.__MYFI_DEBUG__.distanceDriver.distanceBand       // Current band
window.__MYFI_DEBUG__.distanceDriver.getDistanceBand()  // Same, as function
```

### Dev UI Controls

Access via Dev Config modal (⚙️ button) → "Hybrid Routing" section:

- **Enable Hybrid Mode** - Toggle pressure overrides
- **EMA Alpha** - Smoothing factor (0.05-0.20)
- **Spike Threshold** - Dollar amount for spike detection
- **Explore Override Threshold** - Pressure to force EXPLORE
- **Return Override Threshold** - Pressure to force WIND_DOWN
- **Manual Controls:**
  - **Trigger Spike** - Manual $100 spike for testing
  - **Clear Override** - Clear active pressure override
  - **Reset Distance** - Reset all distance/pressure to 0
- **Current Pressure State** - Live display of:
  - Distance and band
  - Base schedule value
  - Pressure modifier
  - Spike impulse
  - Aftershock
  - Active override (if any)

### Integration Flow

```
[Spend Signal] → [distanceDriver.processSpendSignal()]
                          ↓
            ┌─────────────┴─────────────┐
            ↓                           ↓
      amount >= spike?            Add to rawPressure
            ↓                           ↓
      Add spikeImpulse            EMA → pressureModifier
      Add aftershock
            ↓                           ↓
            └─────────────┬─────────────┘
                          ↓
              [update() tick - 1s]
                          ↓
       ┌──────────────────┼──────────────────┐
       ↓                  ↓                  ↓
 Decay impulse      Decay aftershock    Decay rawPressure
       ↓                  ↓                  ↓
       └──────────────────┼──────────────────┘
                          ↓
            Calculate distance01 (hybrid formula)
                          ↓
            Check pressure override thresholds
                          ↓
            Emit distance:updated event
                          ↓
            [episodeRouter listens]
                          ↓
            Override activity state if needed
```

---

## Dev → Render Binding (WO-DEV-RENDER-BINDING)

This system exposes the causal chain from dev controls to stage rendering in real-time.

### Render Inspector Service

File: `src/systems/devRenderInspector.js`

Subscribes to events and maintains:
- Rolling timeline buffer (50 events)
- Current render context snapshot
- Missing assets tracking

```javascript
// Access via debug console
window.__MYFI_DEBUG__.renderInspector.getCurrentRenderContext()
window.__MYFI_DEBUG__.renderInspector.getTimeline(20)
window.__MYFI_DEBUG__.renderInspector.getMissingAssets()
window.__MYFI_DEBUG__.renderInspector.copyContextToClipboard()
```

### Stage Debug Overlay

When `showStageDebugOverlay` is enabled, the BadlandsStage shows a small overlay with:
- DayT, segment, activity state
- Distance01, band, override state
- Current pool folder, background filename
- Active incident type, time remaining

### Map Binding (Demo Mode)

When `enableMapBinding` is enabled, the WorldMap avatar position is driven by:
- `distance01` → radial distance from center (0 = city, 1 = edge)
- `activityState` → movement style (jitter, outward/inward bias)
- `distance:spike` events → immediate outward jump

### Dev UI Controls

Access via Dev Config modal → "Render Inspector" section:

| Control | Description |
|---------|-------------|
| Enable Render Inspector | Track events in timeline buffer |
| Show Stage Debug Overlay | Display debug overlay on stage |
| Enable Map Binding | Bind WorldMap to simulated state |
| Reset Day | Reset clock, distance, scene pacer |
| +1 Hour | Advance simulated time by 1 hour |
| Fast-Fwd Day | Run at turbo speed for 10 seconds |
| Small/Med/Large Tx | Emit test transaction signals |

### Trace Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `stage:poolSelected` | `{ stateId, poolFolder, reason }` | Stage selects visual pool |
| `stage:bgSelected` | `{ poolFolder, filename, manifestPath }` | Background selected |
| `stage:incidentShown` | `{ incidentType, mode, durationMs }` | Incident overlay shown |
| `worldState:changed` | `{ state, regionName }` | World state transitions |
| `map:positionUpdated` | `{ x, y, locationId }` | Map avatar position updates |
| `asset:missing` | `{ type, expectedPath, fixInstructions }` | Asset failed to load |

### Daily Schedule Config

File: `src/systems/dailyScheduleConfig.js`

Defines baseline daily routine that runs with zero spending inputs:

| Segment | Time | Activity State | Visual Pool |
|---------|------|----------------|-------------|
| Prepare | 05:00-08:00 | Wake | morning |
| Patrol | 08:00-12:00 | Explore | active |
| Explore | 12:00-17:00 | Focus | intense |
| Return | 17:00-20:00 | Wind Down | evening |
| Relax | 20:00-23:00 | Wind Down | evening |
| Recover | 23:00-05:00 | Rest | night |

```javascript
// Access schedule boundaries
import { getScheduleSegmentBoundaries } from './systems/dailyScheduleConfig.js';
getScheduleSegmentBoundaries(); // Returns array of { id, label, dayT, activityStateId }
```

---

## Asset Preflight (WO-DEV-ASSET-PREFLIGHT)

Dev-only system for validating asset existence and rendering visible placeholders when backgrounds fail to load.

### Purpose

- **Development feedback** - Instantly see which assets are missing
- **Fix instructions** - Placeholder shows expected path and manifest entry
- **Graceful fallback** - Attempts to find alternate background from same pool
- **Inspector integration** - Missing assets tracked in render inspector

### Enabling

```javascript
window.__MYFI_DEV_CONFIG__ = {
  devAssetPreflightEnabled: true
};
```

Or set in the dev config object before app initialization.

### Implementation

File: `src/systems/assetPreflight.js`

#### Key Functions

```javascript
// Validate background before rendering
const result = await preflightBackground({
  imageUrl: 'assets/bg/patrol/bg_patrol_01.png',
  poolFolder: 'patrol/',
  filename: 'bg_patrol_01.png',
  manifestPath: 'assets/bg/patrol/manifest.json',
  stateName: 'patrol'
});

// Result structure
{
  valid: false,                  // Asset exists?
  url: null,                     // Original URL (null if missing)
  fallbackUrl: 'patrol/bg_patrol_02.png', // Found alternate (or null)
  missingEntry: {                // Missing asset details
    type: 'background',
    poolFolder: 'patrol/',
    filename: 'bg_patrol_01.png',
    manifestPath: 'assets/bg/patrol/manifest.json',
    expectedPath: 'assets/bg/patrol/bg_patrol_01.png',
    stateName: 'patrol',
    timestamp: 1706000000000,
    fixSteps: [
      '1. Create PNG file: bg_patrol_01.png',
      '2. Place at: patrol/bg_patrol_01.png',
      '3. Add "bg_patrol_01.png" to backgrounds array in manifest.json'
    ]
  }
}
```

### Placeholder Panel Behavior

When an asset fails validation:

1. **Fallback attempt** - Searches same pool for valid alternate
2. **If fallback found** - Uses fallback, logs missing asset
3. **If no fallback** - Renders placeholder panel in stage viewport

Placeholder panel displays:
- ⚠️ Missing Asset warning
- File name and expected path
- Manifest path
- Step-by-step fix instructions

### Event Emission

When an asset is missing:

```javascript
// actionBus event
actionBus.emit('asset:missing', {
  type: 'background',
  poolFolder: 'patrol/',
  filename: 'bg_patrol_01.png',
  manifestPath: 'assets/bg/patrol/manifest.json',
  expectedPath: 'assets/bg/patrol/bg_patrol_01.png'
});
```

### Inspector Integration

Missing assets are tracked in the render inspector:

```javascript
// Access via debug console
window.__MYFI_DEBUG__.renderInspector.getMissingAssets()
// Returns array of missing asset entries
```

### Caching

Asset preflight uses two-level caching:

1. **Manifest cache** - `manifestPath → { backgrounds: [], loaded: boolean }`
2. **Asset existence cache** - `imageUrl → { exists: boolean, checked: boolean }`

Caches persist for session lifetime to avoid redundant checks.

### Console Reference

```javascript
// Check if preflight is enabled
window.__MYFI_DEV_CONFIG__?.devAssetPreflightEnabled

// Get all missing assets
window.__MYFI_DEBUG__.renderInspector.getMissingAssets()

// Manually check asset existence
import { checkAssetExists } from './systems/assetPreflight.js';
await checkAssetExists('assets/bg/patrol/bg_missing.png'); // false

// Get cached manifest
import { getCachedManifest } from './systems/assetPreflight.js';
getCachedManifest('assets/bg/patrol/manifest.json');
```

### Integration with BadlandsStage

The BadlandsStage part integrates preflight via:

1. `selectBackgroundForState()` calls `preflightBackground()` before applying
2. If valid: uses original URL
3. If invalid + fallback found: uses fallback, records missing
4. If invalid + no fallback: renders placeholder panel in stage

```javascript
// In BadlandsStage render cycle
const result = await selectBackgroundForState(stateName);
if (result.url) {
  // Apply background
  applyBackground(result.url);
} else if (result.missingEntry) {
  // Render placeholder
  renderMissingAssetPlaceholder(root, result.missingEntry);
}
```

---

## Regression Harness

- [x] Stage idle cycle unchanged when baseline mode OFF
- [x] Episode overlay timing unchanged when baseline mode OFF
- [x] Vitals ticking unchanged
- [x] Map movement unchanged
- [x] Nav modal/hub routing unchanged
- [x] Scene Beat logging works in both modes

**Flags OFF = identical to pre-WO-BASELINE**
