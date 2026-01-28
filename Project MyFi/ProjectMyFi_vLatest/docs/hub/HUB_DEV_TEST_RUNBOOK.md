# Hub Dev Test Runbook

**Purpose:** Step-by-step manual test script to validate Hub encounter flow.
**Target:** Local development environment (desktop or mobile browser)
**Prerequisites:** `window.__MYFI_DEBUG__` must be available (set by app.js)
**Version:** Post HUB-B10 (Badlands Stage Baseline v1)
**Last Updated:** 2026-01-27

## What's New in HUB-B1..B10

- **HUB-B2:** Stage mode is now purely driven by hubController (no setStageMode API)
- **HUB-B4:** Encounter mode has tension overlay (visual escalation as timer runs low)
- **HUB-B7:** Skill buttons are data-driven from BATTLE_SKILLS object
- **HUB-B8:** Timer authority moved to hubController (emits hub:timerTick events)
- **HUB-B9:** Mobile breakpoints hardened for ≤320px viewports

---

## Table of Contents

1. [Setup](#1-setup)
2. [Test Script: Initial Load Verification](#2-test-script-initial-load-verification)
3. [Test Script: Full Flow UX Cycle](#3-test-script-full-flow-ux-cycle)
4. [Expected Console Signatures](#4-expected-console-signatures)
5. [Acceptable vs Unacceptable Warnings](#5-acceptable-vs-unacceptable-warnings)
6. [Repeat Loop Validation](#6-repeat-loop-validation)

---

## 1. Setup

### Start Local Server

```bash
cd "Project MyFi/ProjectMyFi_vLatest"
# Use any local server (e.g., Live Server, http-server, Python)
python -m http.server 8080
# Or: npx http-server -p 8080
```

### Open Hub

1. Open browser to `http://localhost:8080/index.html`
2. If on auth screen, complete auth flow to reach Hub
3. Verify Hub loads with URL hash `#hub`

### Verify DEV Mode Active

Open browser console and run:
```javascript
!!window.__MYFI_DEBUG__
// Expected: true
```

If `false`, check app.js is loading correctly.

---

## 2. Test Script: Initial Load Verification

### Step 1: Verify Player Header (HUB-18)

**Action:** Look at Hub UI after initial load

**Expected UI:**
- Player Header shows at top with:
  - Avatar portrait (left)
  - Name + title + status chips (center)
  - Vitals bars (right, slim stacked bars)
- Status line shows "Demo Mode" indicator

**Console Check:**
```javascript
// Should see vitals data
window.__MYFI_DEBUG__.hubController.getState()?.vitalsHud?.vitals
```

---

### Step 2: Verify BadlandsStage (HUB-22)

**Action:** Observe the stage area

**Expected UI:**
- Single stage card (BadlandsStage — not ViewportZone)
- Shows world layer (avatar wandering, scan line effect)
- Time indicator (Day/Dusk/Night)
- Activity text updating periodically
- Subtle vitals dots in top-right
- No encounter banner visible (idle state)

**Console Check:**
```javascript
window.__MYFI_DEBUG__.hubController.getStageMode()
// Expected: "world"
```

---

### Step 3: Verify DEV Spawn Button (HUB-27)

**Action:** Look for floating purple spawn button at top center of BadlandsStage

**Expected UI:**
- Purple "DEV: Spawn" button visible at top center of stage
- Button enabled when no encounter active
- Button disabled during active encounter

**Note:** The DevControlPanel has been removed from surface.json. The spawn button is now inline in BadlandsStage (visible only in DEV mode).

---

### Step 4: Verify No Dimming

**Action:** Observe overall Hub appearance

**Expected:**
- No background dimming or overlay visible
- All cards fully interactive
- No pointer-events blocking

**Console Check:**
```javascript
window.__MYFI_DEBUG__.hubController.getEncounterState()
// Expected: "idle"
```

---

## 3. Test Script: Full Flow UX Cycle

This tests the complete encounter flow from idle through all states.

### Step 1: Spawn Encounter

**Action:** Tap the purple **DEV: Spawn** button at top of BadlandsStage

**Expected UI:**
- DEV Spawn button becomes disabled
- Stage shows encounter banner with "View Encounter" CTA
- Timer bar shows 60s countdown
- World patrol animation continues behind banner

**Console Output:**
```
[BadlandsStage] DEV: Spawned encounter
[HubController] Encounter spawned: <label>
[HubController] Stage mode changed: encounter_autobattler
[ActionBus] autobattler → autobattler:spawn {...}
```

**Console Check:**
```javascript
window.__MYFI_DEBUG__.hubController.getEncounterState()
// Expected: "active_autobattler"

window.__MYFI_DEBUG__.hubController.getStageMode()
// Expected: "encounter_autobattler"
```

---

### Step 2: View Encounter (Stage Mode Change)

**Action:** Tap **"View Encounter"** button in stage banner

**Expected UI:**
- Stage switches from world layer to encounter layer
- Shows encounter icon, name, type
- Shows large countdown timer
- Shows vitals trend indicators (HP/MP/ST with mini bars)
- Shows "Aid Avatar" button (replaces "Enter Turn-Based")
- Shows "Exit to World" button
- Autobattler status indicator shows green pulse

---

### Step 3: Exit Encounter View (Back to World)

**Action:** Tap **"Exit to World"** button

**Expected UI:**
- Stage switches back to world layer
- Encounter banner still visible (encounter still active)
- Timer still counting down
- Can tap "View Encounter" again

---

### Step 4: Re-enter Encounter View and Enter Battle

**Action:**
1. Tap "View Encounter" again
2. Tap **"Aid Avatar"** button

**Expected UI (HUB-24 Inline Battle):**
- Stage switches to battle layer (NO overlay)
- Shows battlefield with enemy sprite and health bar
- Shows turn indicator
- Bottom HUD shows:
  - Avatar portrait
  - Vitals bars (Health, Mana, Stamina, Shield)
  - ATB bar (shows READY)
  - Skill buttons: Endure (5 ST), Channel (25 MP), 2 locked slots
  - Exit Battle button
- Hub tabs remain visible (not hidden)

**Console Output:**
```
[ActionBus] BadlandsStage → encounter:escalate {...}
[HubController] Escalating encounter: {...}
[HubController] Stage mode changed: battle_turn_based
```

**Console Check:**
```javascript
window.__MYFI_DEBUG__.hubController.getEncounterState()
// Expected: "active_turn_based"

window.__MYFI_DEBUG__.hubController.getStageMode()
// Expected: "battle_turn_based"
```

---

### Step 5: Take Battle Actions (Optional)

**Action:** Tap **Endure** or **Channel** button in battle HUD

**Expected UI:**
- Battle log shows outcome (damage dealt, enemy counter-attack)
- Turn counter increments
- Vitals bars update immediately (mana/stamina decrease)
- Enemy health bar decreases if damage dealt
- If enemy defeated, victory message appears

---

### Step 6: Exit Battle

**Action:** Tap **Exit Battle** button

**Expected UI:**
- Stage returns to encounter layer (stageMode="encounter_autobattler")
- Encounter still active, timer continues
- Can re-enter battle via "Aid Avatar"

**Console Output:**
```
[ActionBus] BadlandsStage → escalation:exit {...}
[HubController] De-escalating, resuming autobattler
[HubController] Stage mode changed: encounter_autobattler
```

**Console Check:**
```javascript
window.__MYFI_DEBUG__.hubController.getEncounterState()
// Expected: "active_autobattler"

window.__MYFI_DEBUG__.hubController.getStageMode()
// Expected: "encounter_autobattler"
```

---

### Step 7: Exit to World

**Action:** Tap **"Exit to World"** button

**Expected UI:**
- Returns to world layer
- Encounter banner still visible with CTA
- Timer still counting

---

### Step 8: Wait for Auto-Resolve OR Force Resolve

**Option A: Wait for 60s timer**
- Watch timer count down to 0
- Encounter auto-resolves

**Option B: Use Console Command**
- Run: `window.__MYFI_DEBUG__.hubController.getAutobattler().forceResolve()`

**Expected UI:**
- Encounter banner disappears
- After ~1.5s, state returns to idle
- Viewport shows normal world patrol
- DEV Spawn button becomes enabled again

**Console Output:**
```
[HubController] Encounter resolved: <summary>
[ActionBus] autobattler → autobattler:resolve {...}
```

---

### Step 9: Verify Clean Idle State

**Action:** Observe final state

**Expected UI:**
- DEV Spawn button enabled (visible at top of stage)
- No encounter banner visible
- Stage shows world layer only (patrol, scan line)
- Subtle vitals dots visible
- PlayerHeader vitals bars animating (vitals simulation running)

**Console Check:**
```javascript
window.__MYFI_DEBUG__.hubController.getEncounterState()
// Expected: "idle"

window.__MYFI_DEBUG__.hubController.getStageMode()
// Expected: "world"

window.__MYFI_DEBUG__.hubController.getCurrentEncounter()
// Expected: null
```

---

## 4. Expected Console Signatures

### Successful Spawn
```
[BadlandsStage] DEV: Spawned encounter
[HubController] Encounter spawned: <encounter_label>
[HubController] Stage mode changed: encounter_autobattler
[ActionBus] autobattler → autobattler:spawn {...}
```

### Successful Escalation (Enter Battle)
```
[ActionBus] BadlandsStage → encounter:escalate {...}
[HubController] Escalating encounter: {...}
[HubController] Stage mode changed: battle_turn_based
```

### Successful Exit (Battle)
```
[ActionBus] BadlandsStage → escalation:exit {...}
[HubController] De-escalating, resuming autobattler
[HubController] Stage mode changed: encounter_autobattler
```

### Successful Resolve
```
[HubController] Encounter resolved: <summary>
[HubController] Stage mode changed: world
[ActionBus] autobattler → autobattler:resolve {...}
```

### Successful Clear (Console Command)
```
[HubController] Encounter cleared, returned to idle
[HubController] Stage mode changed: world
```

---

## 5. Acceptable vs Unacceptable Warnings

### ACCEPTABLE

| Warning | Meaning |
|---------|---------|
| `[HubController] Stage mode changed: ...` | Normal — stage mode transitions |
| `[BadlandsStage] ...` simulation logs | Normal simulation activity |
| `[ActionBus] ... → wardwatch:tick` | Normal simulation tick events |
| `[ActionBus] ... → hub:stageModeChanged` | Normal stage mode change |

### UNACCEPTABLE

| Warning/Error | Problem |
|---------------|---------|
| `TypeError: actionBus.on is not a function` | Using wrong API (should be `subscribe`) |
| `[ActionBus] unknown → ...` | Missing source attribution |
| `[ActionBus] LEAK DETECTED...` | Subscription not cleaned up on unmount |
| `Cannot escalate: not in active_autobattler state` | State machine violation |
| `Uncaught TypeError...` | Runtime error — investigate |
| `Part Error: ...` | Part failed to mount |
| `[SurfaceCompositor] Mounted ... overlay slot(s)` | Overlay slots should not exist (HUB-24) |

---

## 6. Repeat Loop Validation

### Test: Complete Two Full Cycles

Perform the full flow (Steps 1-9) **twice** to verify:
- No state drift between cycles
- No memory leaks (subscriptions grow)
- No stuck states
- Timer resets properly

### Between Cycles Check

After completing first cycle, verify:
```javascript
window.__MYFI_DEBUG__.hubController.getEncounterState()
// Expected: "idle"

window.__MYFI_DEBUG__.hubController.getCurrentEncounter()
// Expected: null
```

Then repeat all steps.

### After Second Cycle Check

```javascript
// State should be clean
window.__MYFI_DEBUG__.hubController.getEncounterDebugState()
// Expected: { encounterState: "idle", currentEncounter: null, isEscalated: false, ... }

// Subscription count should be stable (not growing)
window.__MYFI_DEBUG__.actionBus.getActiveSubscriptionCount()
// Note the number — should be consistent across cycles
```

---

## Quick Smoke Test (60 seconds)

For rapid validation:

1. Open Hub (`#hub`)
2. Verify Player Header shows avatar + vitals (vitals bars animating)
3. Verify single stage card (BadlandsStage) with floating purple "DEV: Spawn" button
4. Tap "DEV: Spawn" button (or run: `window.__MYFI_DEBUG__.hubController.forceEncounter()`)
5. Verify encounter banner appears with "View Encounter"
6. Tap "View Encounter" → verify encounter layer shows (vitals trends, timer)
7. Tap "Aid Avatar" → verify battle layer shows inline (NO overlay)
8. Verify battle HUD: vitals bars, skill buttons, Exit Battle button visible
9. Tap "Exit Battle" → verify returns to encounter layer
10. Tap "Exit to World" → verify world layer shows
11. Run: `window.__MYFI_DEBUG__.hubController.clearEncounter()`
12. Verify idle state restored, stageMode="world", DEV Spawn button re-enabled

**Pass criteria:** No console errors, UI responds correctly at each step, no overlays used, vitals sync between PlayerHeader and stage.

---

## Mobile Testing Notes

- Player Header is compact and responsive (fits mobile screens)
- BadlandsStage adapts to available height (min-height: 200px, max-height: 420px)
- Encounter banner is touch-friendly (44px+ tap targets)
- Battle HUD skill buttons are sized for mobile (touch-friendly)
- All three stage layers (world, encounter, battle) responsive
- Test on both portrait and landscape orientations
- **HUB-B9:** Breakpoints hardened for ≤320px (ultra-narrow) viewports:
  - Encounter actions stack vertically
  - Autobattler status label hidden
  - Battle vitals use smaller fonts
  - Skill buttons more compact
