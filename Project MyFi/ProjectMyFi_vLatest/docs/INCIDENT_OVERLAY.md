# Incident Overlay System (WO-S3)

**Implementation:** Unified incident overlay for all incident types.

## Overview

The Incident Overlay is a unified presentation layer that shows for ALL incident types (combat, traversal, social, anomaly). It provides consistent Engage/Skip interaction patterns while rendering mode-specific visuals.

---

## Core Principle

> **One overlay for all modes. Mode-specific visuals passed as config, not separate UI branches.**

- **Engage** = Player chooses to interact (enters slow-time, sees tagging options)
- **Skip** = Player defers to autopilot (immediate auto-resolution)

---

## Flow Diagram

```
Signal → Incident → Episode
                      │
                   SETUP (1s)
                      │
                   ACTIVE
                      │
            ┌─────────┴─────────┐
            │                   │
    [Unified Overlay]    [Timer counting]
            │                   │
      ┌─────┴─────┐            │
      │           │            │
   ENGAGE      SKIP         TIMEOUT
      │           │            │
      ▼           ▼            ▼
  Slow-Time    Autopilot   Autopilot
  + Tagging    Resolve     Resolve
      │           │            │
      └─────┬─────┴────────────┘
            │
        RESOLVING (2s)
            │
         AFTER (1.5s)
            │
        COMPLETE
```

---

## Overlay Configuration

**File:** [`src/systems/incidentFactory.js`](../src/systems/incidentFactory.js)

Each incident kind has a unique overlay configuration:

| Kind | Theme | Icon | Engage Label | Skip Label |
|------|-------|------|--------------|------------|
| `combat` | combat | ⚔️ | Engage | Auto-resolve |
| `traversal` | traversal | 👣 | Review | Continue |
| `social` | social | 💰 | Evaluate | Accept |
| `anomaly` | anomaly | ❓ | Investigate | Dismiss |

### Configuration Structure

```javascript
const OVERLAY_CONFIG = {
  combat: {
    theme: 'combat',           // CSS theme class
    icon: '&#9876;',           // Display icon
    title: 'Encounter',        // Header title
    subtitle: 'A challenger approaches',
    engageLabel: 'Engage',     // Primary action button
    engageHint: 'Watch the battle',
    skipLabel: 'Auto-resolve', // Secondary action button
    skipHint: 'Let autopilot handle it',
  },
  // ... other incident kinds
};
```

---

## Episode Runner Integration

**File:** [`src/systems/episodeRunner.js`](../src/systems/episodeRunner.js)

### New State

```javascript
isPlayerEngaged: false  // Tracks whether player has engaged
```

### New Methods

```javascript
playerEngage()  // Called when player clicks Engage
playerSkip()    // Called when player clicks Skip
```

### New Events

| Event | Payload | When |
|-------|---------|------|
| `episode:engage` | - | Player clicks Engage button |
| `episode:skip` | - | Player clicks Skip button |
| `episode:engaged` | episode, incident, taggingPrompt | After engagement processed |

### Active Phase Flow

1. Episode enters `active` phase
2. `episode:active` emitted with `awaitingEngagement: true`
3. Overlay shows Engage/Skip buttons
4. Timer starts counting down
5. Player action or timeout:
   - **Engage**: `episode:engaged` emitted, slow-time enabled
   - **Skip/Timeout**: Autopilot resolves immediately

---

## Stage Component

**File:** [`src/parts/prefabs/BadlandsStage/part.js`](../src/parts/prefabs/BadlandsStage/part.js)

### State Additions

```javascript
state.awaitingEngagement = false;  // Shows Engage/Skip buttons
state.isPlayerEngaged = false;     // Shows tagging options
state.overlayConfig = null;        // Mode-specific visuals
```

### Rendering Logic

```javascript
if (state.awaitingEngagement && !state.isPlayerEngaged) {
  // Render Engage/Skip buttons
} else if (state.isPlayerEngaged) {
  // Render tagging options
}
```

---

## CSS Theming

**File:** [`src/parts/prefabs/BadlandsStage/uplift.css`](../src/parts/prefabs/BadlandsStage/uplift.css)

### Theme Classes

```css
.BadlandsStage__slowTime[data-theme="combat"]    /* Red-tinted */
.BadlandsStage__slowTime[data-theme="traversal"] /* Blue-tinted */
.BadlandsStage__slowTime[data-theme="social"]    /* Purple-tinted */
.BadlandsStage__slowTime[data-theme="anomaly"]   /* Gold-tinted */
```

### Key Selectors

| Selector | Purpose |
|----------|---------|
| `.BadlandsStage__incidentHeader` | Icon + title container |
| `.BadlandsStage__incidentIcon` | Large incident icon |
| `.BadlandsStage__incidentTitle` | Incident type label |
| `.BadlandsStage__overlayActions` | Button/options container |
| `.BadlandsStage__overlayBtn--engage` | Primary engage button |
| `.BadlandsStage__overlayBtn--skip` | Secondary skip button |

---

## Integration with Combat

When a combat incident is engaged:

1. `episode:engage` event fires
2. Episode runner sets `isPlayerEngaged = true`
3. Episode runner emits `autobattler:spawn`
4. Combat begins with autobattler
5. Tagging options remain visible
6. Player can tag during combat or let timer expire

---

## Key Files

| File | Purpose |
|------|---------|
| [`src/systems/incidentFactory.js`](../src/systems/incidentFactory.js) | OVERLAY_CONFIG definitions |
| [`src/systems/episodeRunner.js`](../src/systems/episodeRunner.js) | Engage/Skip flow logic |
| [`src/parts/prefabs/BadlandsStage/part.js`](../src/parts/prefabs/BadlandsStage/part.js) | Overlay rendering |
| [`src/parts/prefabs/BadlandsStage/baseline.html`](../src/parts/prefabs/BadlandsStage/baseline.html) | Overlay HTML structure |
| [`src/parts/prefabs/BadlandsStage/uplift.css`](../src/parts/prefabs/BadlandsStage/uplift.css) | Overlay styles |

---

## Regression Harness

- [x] Stage idle cycle unchanged
- [x] Combat overlay timing unchanged
- [x] Vitals ticking unchanged
- [x] Map movement unchanged
- [x] Nav modal/hub routing unchanged

**Flags OFF = identical to pre-WO**
