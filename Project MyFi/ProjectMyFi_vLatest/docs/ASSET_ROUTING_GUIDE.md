# Asset Routing Guide

## Overview

The Stage Engine uses a multi-dimensional routing system to select appropriate background images based on:

1. **Beat Type** - The type of story beat (combat, traversal, social, anomaly, idle)
2. **Activity Phase** - The current time-of-day activity (wake, explore, focus, wind_down, rest)
3. **Region** - The spatial region in the game world (north, east, south, west, center)

The system uses a **fallback chain**, trying the most specific path first and falling back to more general paths until assets are found.

---

## Folder Structure

### Base Path
```
/assets/art/stages/
```

### Primary Structure (By Beat Type)
```
/assets/art/stages/
├── combat/              # Combat story beats
│   ├── manifest.json    # Required: lists backgrounds in this folder
│   ├── combat-01.png
│   ├── combat-02.png
│   └── ...
├── traversal/           # Movement/travel story beats
│   ├── manifest.json
│   └── ...
├── social/              # Social interaction story beats
│   ├── manifest.json
│   └── ...
├── anomaly/             # Unusual/special story beats
│   ├── manifest.json
│   └── ...
└── idle/                # Default ambient (no active story beat)
    ├── manifest.json
    └── ...
```

### With Activity Phase Subfolders
```
/assets/art/stages/
├── combat/
│   ├── manifest.json          # Fallback for any combat
│   ├── focus/                 # Combat during focus hours
│   │   ├── manifest.json
│   │   └── combat-focus-01.png
│   ├── explore/               # Combat during explore hours
│   │   ├── manifest.json
│   │   └── combat-explore-01.png
│   └── ...
├── idle/
│   ├── manifest.json          # Fallback for idle
│   ├── wake/                  # Morning idle
│   │   └── manifest.json
│   ├── rest/                  # Night idle
│   │   └── manifest.json
│   └── ...
```

### Full Hierarchy (With Region)
```
/assets/art/stages/
├── combat/
│   ├── manifest.json              # Level 2 fallback
│   ├── focus/
│   │   ├── manifest.json          # Level 1 fallback
│   │   ├── center/
│   │   │   ├── manifest.json      # Most specific
│   │   │   └── combat-focus-center-01.png
│   │   ├── north/
│   │   │   ├── manifest.json
│   │   │   └── combat-focus-north-01.png
│   │   └── ...
│   └── ...
└── ...
```

---

## Manifest File Format

Each folder that contains backgrounds must have a `manifest.json` file:

```json
{
  "backgrounds": [
    "image-01.png",
    "image-02.png",
    "image-03.png"
  ]
}
```

The system will randomly select from the available backgrounds in the manifest.

---

## Fallback Chain

When selecting a background, the system tries paths in this order:

| Priority | Path Pattern | Example |
|----------|-------------|---------|
| 1 (Most Specific) | `{beatType}/{phase}/{region}/` | `combat/focus/center/` |
| 2 | `{beatType}/{phase}/` | `combat/focus/` |
| 3 | `{beatType}/` | `combat/` |
| 4 (Fallback) | `idle/` | `idle/` |
| 5 (Legacy) | Legacy state folder | `patrol/` |

**Example:** For a combat beat during focus hours in the center region:
1. Try: `combat/focus/center/manifest.json`
2. If not found, try: `combat/focus/manifest.json`
3. If not found, try: `combat/manifest.json`
4. If not found, try: `idle/manifest.json`
5. If still not found, use legacy `patrol/` fallback

---

## Beat Types

| Beat Type | Description | Typical Use |
|-----------|-------------|-------------|
| `combat` | Direct conflict/challenge | Spending encounters, battles |
| `traversal` | Movement/journey | Essential expenses, travel |
| `social` | Interactions | Subscriptions, social spending |
| `anomaly` | Unusual events | Fraud alerts, unexpected items |
| `idle` | Default state | No active story beat |

---

## Activity Phases

| Phase | Time of Day | Visual Mood |
|-------|-------------|-------------|
| `wake` | Early morning | Warm, fresh, new day |
| `explore` | Mid morning - Afternoon | Bright, energetic |
| `focus` | Peak hours | Intense, clear |
| `wind_down` | Evening | Warm, calming, sunset |
| `rest` | Night | Dark, peaceful |

---

## Regions

| Region | Cardinal | Typical Content |
|--------|----------|-----------------|
| `center` | — | Combat arenas, main encounters |
| `north` | N | Mysterious, anomalies |
| `east` | E | Social areas, settlements |
| `south` | S | Paths, traversal |
| `west` | W | Resources, discoveries |

---

## Quick Start: Adding New Assets

### 1. Create Folder Structure
```bash
# For combat backgrounds during focus hours
mkdir -p assets/art/stages/combat/focus/
```

### 2. Add Images
```bash
cp my-combat-focus-01.png assets/art/stages/combat/focus/
cp my-combat-focus-02.png assets/art/stages/combat/focus/
```

### 3. Create Manifest
```bash
# assets/art/stages/combat/focus/manifest.json
{
  "backgrounds": [
    "my-combat-focus-01.png",
    "my-combat-focus-02.png"
  ]
}
```

### 4. Test
The system will automatically discover and use the new assets when the matching context occurs.

---

## Minimal Setup (Beat Type Only)

If you only want to differentiate by beat type (simplest setup):

```
/assets/art/stages/
├── combat/
│   ├── manifest.json
│   ├── combat-01.png
│   ├── combat-02.png
│   └── combat-03.png
├── traversal/
│   ├── manifest.json
│   └── traversal-01.png
├── social/
│   ├── manifest.json
│   └── social-01.png
├── anomaly/
│   ├── manifest.json
│   └── anomaly-01.png
└── idle/
    ├── manifest.json
    └── idle-01.png
```

---

## Advanced: Combining with Legacy Folders

The existing legacy folders (`patrol/`, `explore/`, `rest/`, etc.) are still supported as fallbacks. The routing system will fall back to these if no routed assets are found:

```
Legacy Mapping:
- patrol/ → Used for idle/traversal fallback
- explore/ → Used for traversal/anomaly fallback
- combat/ → Used for combat fallback
- city/ → Used for social fallback
- rest/ → Used for rest phase fallback
```

---

## Configuration Reference

The routing configuration is defined in:
```
src/systems/assetRoutingSchema.js
```

Key exports:
- `BEAT_TYPES` - Available beat types
- `ACTIVITY_PHASES` - Available activity phases
- `REGIONS` - Available regions
- `buildAssetPathChain(context)` - Builds fallback path array
- `incidentKindToBeatType(kind)` - Maps incident to beat type
- `activityStateToPase(stateId)` - Maps activity state to phase

---

## Debugging

Enable dev render inspector to see which folder was selected:

```javascript
// In browser console
window.__MYFI_DEV_CONFIG__ = { devRenderEnabled: true };
```

Look for console logs:
```
[BadlandsStage] Asset routing: Using combat/focus (fallback level 1)
[BadlandsStage] Loaded 5 backgrounds from combat/focus
```

The `fallback level` indicates:
- 0 = Most specific path used (all dimensions matched)
- 1 = Phase-only path used
- 2 = Beat type-only path used
- 3+ = Using idle or legacy fallback
