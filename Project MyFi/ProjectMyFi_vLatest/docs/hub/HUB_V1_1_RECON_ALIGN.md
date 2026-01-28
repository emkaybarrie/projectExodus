# HUB v1.1 RECON REPORT — Spatial Contract Alignment

**Date:** 2026-01-28
**Executor:** Claude Code
**Status:** RECON COMPLETE — Ready for Implementation

---

## 1) Current Hub Surface Slot Order

**Source:** `src/surfaces/screens/hub/surface.json`

| Order | Slot ID | Part Kind | Card? | What It Renders |
|-------|---------|-----------|-------|-----------------|
| 1 | `playerHeader` | `PlayerHeader` | ✅ | Avatar, Name, Title, Vitals (H/M/S), Status Chips |
| 2 | `stage` | `BadlandsStage` | ❌ | WorldMap (embedded) + Stage Section (scenic/encounter) |
| 3 | `essenceBar` | `EssenceBar` | ✅ | Essence bar with icon, label, progress, value |

**Current slot count:** 3 slots
**Target slot count:** 4 slots (Vitals, WorldMap, Stage, Essence)

---

## 2) WorldMap Location Analysis

**CONFIRMED:** WorldMap is **EMBEDDED INSIDE BadlandsStage**, not separate.

### Evidence

**File:** `src/parts/prefabs/BadlandsStage/baseline.html:23-65`
```html
<!-- HUB-H1: WORLD MAP SECTION — Top-down dartboard with zone title overlay -->
<div class="BadlandsStage__worldMap" data-time="day">
  <!-- Dartboard zone grid -->
  <div class="BadlandsStage__mapGrid">
    ...
  </div>
  <!-- Zone labels, city hub, avatar, scan effect -->
  ...
  <!-- HUB-H1: Zone title overlay at bottom of map -->
  <div class="BadlandsStage__mapTitleOverlay">
    <div class="BadlandsStage__mapTitle">Wardwatch</div>
    <div class="BadlandsStage__mapSubtitle">— All quiet</div>
  </div>
</div>
```

**CSS:** `src/parts/prefabs/BadlandsStage/uplift.css:135-146`
```css
.BadlandsStage__worldMap {
  position: relative;
  width: 100%;
  height: 140px; /* Fixed compact height */
  flex-shrink: 0;
  ...
}
```

---

## 3) Layout Dead Space Root Causes

### Primary Cause: **Stage fills ALL remaining space**

**File:** `src/parts/prefabs/BadlandsStage/uplift.css:441-446`
```css
.BadlandsStage__stageSection {
  position: relative;
  flex: 1; /* Fill remaining space */
  min-height: 120px;
  overflow: hidden;
}
```

### Secondary Cause: **Tabs/Log area hidden**

**File:** `src/parts/prefabs/BadlandsStage/uplift.css:730-741`
```css
.BadlandsStage__worldLayer,
.BadlandsStage__encounterLayer,
.BadlandsStage__battleLayer,
.BadlandsStage__eventsLayer,
.BadlandsStage__loadoutLayer {
  display: none !important; /* HUB-H: Hidden */
}

.BadlandsStage__bottomBar {
  display: none !important;
}
```

### Result
- WorldMap (140px) + StageSection (flex:1) + no log = Stage swallows screen
- Events layer exists but is hidden (`display:none !important`)
- Bottom bar with tabs hidden

---

## 4) Event Source Analysis

### Where Events Are Collected

**File:** `src/parts/prefabs/BadlandsStage/part.js`

| Function | Line | Purpose |
|----------|------|---------|
| `addEvent(event)` | 828-834 | Adds event to `state.events[]`, caps at `MAX_EVENTS` (5) |
| `createEncounterEvent(outcome)` | 839-854 | Creates event object for encounter resolution |
| `createEscalationEvent(data, type)` | 859-885 | Creates event for escalation victory/exit |
| `renderEventsTab(root, state)` | 890-910 | Renders events to `[data-bind="eventsList"]` |

### Event Shape
```javascript
{
  id: `event-${Date.now()}`,
  type: 'encounter' | 'escalation',
  text: 'Victory secured against Wolf Pack',
  icon: '&#9989;',           // HTML entity
  sentiment: 'positive' | 'neutral',
  timestamp: Date.now()
}
```

### Storage
- `state.events[]` array inside BadlandsStage
- Max 5 events (`MAX_EVENTS = 5` at line 122)

### Current Render Target
- `[data-bind="eventsList"]` inside `.BadlandsStage__eventsLayer` (HIDDEN)

---

## 5) Loadout/Recent CTAs Location

**File:** `src/parts/prefabs/BadlandsStage/baseline.html:77-81`
```html
<div class="BadlandsStage__sceneActions">
  <button class="BadlandsStage__sceneBtn" data-action="openLoadout">Loadout</button>
  <button class="BadlandsStage__sceneBtn" data-action="openRecent">Recent</button>
</div>
```

### Visibility
- Inside `.BadlandsStage__scenicView` (world mode only)
- CSS rules hide during encounter:

**File:** `src/parts/prefabs/BadlandsStage/uplift.css:484-488`
```css
.BadlandsStage__container[data-stage-mode="encounter_autobattler"] .BadlandsStage__scenicView {
  display: none;
}
```

### Current Behavior
- Buttons visible in world/idle mode ✅
- Buttons hidden during encounter ✅
- **BUT:** Click handlers not wired to switch tabs (tabs are hidden)

---

## 6) Vitals Rendering Location

### Current Owner: **PlayerHeader Part**

**File:** `src/parts/prefabs/PlayerHeader/baseline.html:29-51`
```html
<div class="PlayerHeader__vitals">
  <div class="PlayerHeader__vital PlayerHeader__vital--health" data-vital="health">
    <span class="PlayerHeader__vitalLabel">Health</span>
    <div class="PlayerHeader__barContainer">
      <div class="PlayerHeader__barFill"></div>
    </div>
    <span class="PlayerHeader__vitalValue" data-bind="healthValue"></span>
  </div>
  <!-- mana, stamina similar -->
</div>
```

### Duplicate Vitals Check
- ❌ BadlandsStage does NOT render vitals bars (contract-compliant)
- ❌ No vitals in WorldMap area
- ✅ Vitals only in PlayerHeader

---

## TOP 5 DELTAS TO REACH CONTRACT

| # | Delta | Current | Target |
|---|-------|---------|--------|
| 1 | **WorldMap is embedded** | Inside BadlandsStage | Separate `WorldMap` part |
| 2 | **No visible log panel** | `eventsLayer` hidden | Log visible inside Stage |
| 3 | **Slot count** | 3 slots | 4 slots |
| 4 | **Region label** | "Wardwatch" | Dynamic region name |
| 5 | **Aid Avatar behavior** | Shows message box | Should show toast only |

---

## MINIMAL DIFF PLAN

### Phase 1: Create WorldMap Part (~100 lines)
1. Create `src/parts/prefabs/WorldMap/` with part.js, baseline.html, uplift.css
2. Extract map title/subtitle rendering from BadlandsStage
3. Register in manifest.json

### Phase 2: Update surface.json (~5 lines)
1. Add `worldMap` slot between `playerHeader` and `stage`
2. Keep existing slot order otherwise

### Phase 3: Modify BadlandsStage (~50 lines)
1. Remove embedded worldMap HTML
2. Un-hide events list inside stageSection
3. Wire Loadout/Recent CTAs to show/hide events panel

### Phase 4: Verify & Cleanup (~20 lines)
1. Ensure PlayerHeader = Vitals (already correct, maybe add alias)
2. Ensure DEV spawn still works
3. Ensure EssenceBar still pinned

**Total estimated changes:** ~175 lines across 6-8 files

---

## RISKS

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **WorldMap data coupling** | Medium | WorldMap can use stub defaults; data from hubController optional |
| **Events not rendering** | Low | Data already collected; just need to un-hide target element |
| **Flex layout breaks** | Medium | Test on 360px width; use explicit heights where needed |
| **DEV spawn regression** | Low | DEV spawn is in chrome.js, unaffected by stage changes |
| **Encounter timer breaks** | Low | Timer is in hubController, BadlandsStage is consumer only |

---

## CONCLUSION

**Ready for implementation.** The changes are primarily:
1. Extracting WorldMap visuals into new part
2. Un-hiding existing events list
3. Minor surface.json update

No changes to actionBus, router, or core encounter mechanics required.
