# Dev Simulation Guide (WO-TRANSACTION-MODAL-V1)

**Implementation:**
- [`src/parts/prefabs/TransactionModal/part.js`](../src/parts/prefabs/TransactionModal/part.js)
- [`src/core/chrome.js`](../src/core/chrome.js) (Transaction Events section)
- [`src/core/app.js`](../src/core/app.js) (modal integration)

---

## Overview

This guide covers tools for manually simulating financial activity during development. These tools let you:

1. **Test narrative triggers** - Emit transactions that spawn episodes
2. **Validate episode routing** - See how categories map to episode types
3. **Inspect render chain** - Watch signals flow through the system
4. **Debug asset loading** - Identify missing backgrounds/sprites

---

## Transaction Modal

The Transaction Modal provides a full-featured form for creating custom transaction events.

### Opening the Modal

1. Click **⚙️** button in chrome header (dev mode only)
2. Scroll to **💳 Transaction Events** section
3. Click **📝 New Transaction Event...**

Or programmatically:
```javascript
window.__MYFI_DEBUG__.transactionModal?.show()
```

### Form Fields

| Field | Description | Notes |
|-------|-------------|-------|
| **Type** | Spend or Income | Toggle buttons |
| **Amount** | Transaction value | Quick buttons: $5, $15, $25, $50, $100, $250 |
| **Merchant** | Origin/payee name | Optional, defaults to "Demo Purchase" |
| **Category** | Transaction category | Determines episode type (see below) |
| **Frequency** | One-time or Recurring | For future pattern detection |
| **Note** | Additional context | Optional |

### Category → Episode Type Mapping

| Category | Episode Type | Encounter Mode |
|----------|-------------|----------------|
| Discretionary | Combat | Autobattler |
| Essential | Traversal | Autobattler |
| Subscription | Social | Choice-based |
| Food & Dining | Various | Mixed |
| Transport | Traversal | Autobattler |
| Bills & Utilities | Essential | Autobattler |
| Transfer | Neutral | Minimal |
| Other | Variable | Mixed |

### Context Display

The modal shows current simulation state:
- **Activity State** - Current time-of-day activity (WAKE, EXPLORE, FOCUS, etc.)
- **Time** - Simulated clock time and segment
- **Distance** - Current distance01 percentage and band

### Submission

Click **⚡ Emit Event** (or `Ctrl+Enter`) to:
1. Create transaction signal
2. Ingest via stageSignals pipeline
3. Trigger incident factory → episode runner
4. Record in render inspector timeline
5. Close modal with success feedback

---

## Quick Emit Shortcuts

For rapid testing, use the Quick Emit buttons in the Dev Config modal:

| Button | Amount | Category | Use Case |
|--------|--------|----------|----------|
| **Small $25** | $25 | Discretionary | Regular combat |
| **Med $50** | $50 | Discretionary | Medium combat |
| **Large $100** | $100 | Discretionary | Spike trigger |

These bypass the modal and emit directly to the signal pipeline.

### Programmatic Quick Emit

```javascript
// Via debug helper
window.__MYFI_DEBUG__.emitDemoSignal(amount, merchant, category)

// Examples
__MYFI_DEBUG__.emitDemoSignal(25, 'Coffee Shop', 'discretionary')
__MYFI_DEBUG__.emitDemoSignal(100, 'Electronics Store', 'discretionary') // Spike!
__MYFI_DEBUG__.emitDemoSignal(15, 'Netflix', 'subscription') // Choice episode
```

---

## Workflow: Simulating Narrative Scenes

### 1. Setup Demo Mode

1. Open Dev Config (⚙️)
2. Enable **Demo Mode** via header toggle or checkbox
3. Set **Time Scale** (5x-60x recommended for testing)
4. Optionally enable **Auto-Transaction Frequency** (30%)

### 2. Observe Baseline Behavior

With zero manual input, observe:
- Time progresses through day segments
- Activity states cycle (WAKE → EXPLORE → FOCUS → WIND_DOWN → REST)
- Distance progresses via time-based S-curve
- Random demo transactions (if enabled) trigger episodes

### 3. Manual Episode Triggers

To trigger specific episode types:

#### Combat Episode (Autobattler)
```javascript
__MYFI_DEBUG__.emitDemoSignal(50, 'Random Purchase', 'discretionary')
```
or use modal with "Discretionary" category.

#### Choice Episode (Social)
```javascript
__MYFI_DEBUG__.emitDemoSignal(25, 'Streaming Service', 'subscription')
```
or use modal with "Subscription" category.

#### Traversal Episode
```javascript
__MYFI_DEBUG__.emitDemoSignal(30, 'Transit', 'transport')
```
or use modal with "Transport" or "Essential" category.

### 4. Spike Testing

Spikes trigger immediate distance jumps and potential pressure overrides:

```javascript
// Quick spike via button
__MYFI_DEBUG__.distanceDriver.triggerSpike(100)

// Or emit large transaction
__MYFI_DEBUG__.emitDemoSignal(150, 'Big Purchase', 'discretionary')
```

Watch for:
- `distance:spike` event in console
- Sudden distance increase
- Possible EXPLORE override if in WAKE/REST
- Aftershock lingering effect

### 5. Pressure Override Testing

Force pressure overrides to test activity state changes:

```javascript
// Build pressure over time
__MYFI_DEBUG__.distanceDriver.addPressure(1.0)

// Or emit multiple transactions
for (let i = 0; i < 5; i++) {
  __MYFI_DEBUG__.emitDemoSignal(30, `Purchase ${i}`, 'discretionary')
}

// Check override state
__MYFI_DEBUG__.episodeRouter.isOverridden
__MYFI_DEBUG__.episodeRouter.currentState

// Clear override
__MYFI_DEBUG__.episodeRouter.clearOverride()
```

---

## Workflow: Testing Episode Flow

### End-to-End Flow

```
[Transaction Modal] → [Signal Created] → [StageSignals.ingest()]
                                                  ↓
                                        [Incident Factory]
                                                  ↓
                                        [Episode Runner]
                                                  ↓
                              ┌─────────────────┼─────────────────┐
                              ↓                 ↓                 ↓
                        AUTOBATTLER         CHOICE          TRAVERSAL
                              ↓                 ↓                 ↓
                        Combat UI          Choice UI        Progress UI
                              ↓                 ↓                 ↓
                              └─────────────────┼─────────────────┘
                                                ↓
                                        [Resolution]
                                                ↓
                                        [Scene Beat Log]
```

### Verification Points

| Step | Console Log | What to Check |
|------|-------------|---------------|
| Signal created | `[TransactionModal] Signal ingested` | Signal has correct category |
| Incident spawned | `[IncidentFactory] Created incident` | Incident type matches category |
| Episode started | `[EpisodeRunner] Episode phase: spawn` | Episode ID logged |
| Scene shown | `[BadlandsStage] Showing encounter` | Stage displays overlay |
| Resolution | `[EpisodeRunner] Episode complete` | Vitals delta applied |

---

## Workflow: Asset Testing

### Missing Asset Detection

1. Enable asset preflight:
```javascript
window.__MYFI_DEV_CONFIG__.devAssetPreflightEnabled = true
```

2. Trigger world state that references missing background
3. Observe placeholder panel with fix instructions
4. Check missing assets:
```javascript
__MYFI_DEBUG__.renderInspector.getMissingAssets()
```

### Manual Pool Testing

Force specific world states to test asset pools:

```javascript
// Get current state
__MYFI_DEBUG__.distanceDriver.distanceBand

// Force distance to trigger specific states
__MYFI_DEBUG__.distanceDriver.setDistance(0.5) // explore/mid band
__MYFI_DEBUG__.distanceDriver.setDistance(0.9) // return/deep band
```

---

## Console Reference

### Transaction Testing

```javascript
// Full modal
__MYFI_DEBUG__.transactionModal?.show()

// Quick emit
__MYFI_DEBUG__.emitDemoSignal(amount, merchant, category)
__MYFI_DEBUG__.emitDemoSignal(50, 'Test Store', 'discretionary')

// Check last signal
__MYFI_DEBUG__.stageSignals.getLastSignal()
```

### Episode System

```javascript
// Episode runner state
__MYFI_DEBUG__.episodeRunner.getCurrentEpisode()
__MYFI_DEBUG__.episodeRunner.isBaselineMode()
__MYFI_DEBUG__.episodeRunner.setBaselineMode(true)

// Scene beat log
__MYFI_DEBUG__.sceneBeatLog.getRecentBeats(10)
```

### Distance & Pressure

```javascript
// Current state
__MYFI_DEBUG__.distanceDriver.distance01
__MYFI_DEBUG__.distanceDriver.distanceBand
__MYFI_DEBUG__.distanceDriver.pressureModifier
__MYFI_DEBUG__.distanceDriver.spikeImpulse

// Manual controls
__MYFI_DEBUG__.distanceDriver.setDistance(0.5)
__MYFI_DEBUG__.distanceDriver.addPressure(0.5)
__MYFI_DEBUG__.distanceDriver.triggerSpike(100)
__MYFI_DEBUG__.distanceDriver.reset()
```

### Time & Activity

```javascript
// Episode clock
__MYFI_DEBUG__.episodeClock.getDayT()
__MYFI_DEBUG__.episodeClock.setTimeScale(60)
__MYFI_DEBUG__.episodeClock.jumpToSegment('midday')
__MYFI_DEBUG__.episodeClock.togglePause()

// Episode router
__MYFI_DEBUG__.episodeRouter.currentState
__MYFI_DEBUG__.episodeRouter.isOverridden
__MYFI_DEBUG__.episodeRouter.clearOverride()
```

### Render Inspector

```javascript
// Timeline
__MYFI_DEBUG__.renderInspector.getTimeline(20)

// Current context
__MYFI_DEBUG__.renderInspector.getCurrentRenderContext()

// Missing assets
__MYFI_DEBUG__.renderInspector.getMissingAssets()

// Copy to clipboard
__MYFI_DEBUG__.renderInspector.copyContextToClipboard()
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close modal |
| `Ctrl+Enter` | Submit transaction (in modal) |

---

## Troubleshooting

### Transaction not triggering episode

1. Check console for signal ingestion: `[TransactionModal] Signal ingested`
2. Verify scene pacer is ready: `__MYFI_DEBUG__.scenePacer.isReady`
3. Check cooldown: `__MYFI_DEBUG__.scenePacer.getCooldownRemaining()`
4. Bypass pacing: `__MYFI_DEBUG__.scenePacer.forceTrigger()`

### Episode not rendering correctly

1. Check episode state: `__MYFI_DEBUG__.episodeRunner.getCurrentEpisode()`
2. Verify stage is on hub: `location.hash` should be `#hub`
3. Check BadlandsStage mount: Look for `.Part-BadlandsStage` in DOM

### Wrong episode type

1. Verify category in modal (see Category → Episode Type table)
2. Check incident factory mapping: Look at console log for incident type
3. Try explicit category: `__MYFI_DEBUG__.emitDemoSignal(50, 'Test', 'subscription')`

### Pressure not affecting distance

1. Check hybrid mode enabled: `__MYFI_DEV_CONFIG__?.hybridModeEnabled`
2. View pressure state: `__MYFI_DEBUG__.distanceDriver.pressureModifier`
3. View spike state: `__MYFI_DEBUG__.distanceDriver.spikeImpulse`

---

## Related Documentation

- [BASELINE_MODE.md](./BASELINE_MODE.md) - Baseline mode systems
- Asset Preflight section in BASELINE_MODE.md
- Episode routing (WO-WATCH-EPISODE-ROUTING)
- Hybrid routing (WO-HYBRID-ROUTING)
