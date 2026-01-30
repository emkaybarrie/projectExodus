# World Topology Reference (WO-S2)

## Overview

World Topology V2 provides a parallel, optional spatial model for the game world.
It does **NOT** replace or modify existing location systems.

**Feature Flag:** `__MYFI_DEV_CONFIG__.enableWorldTopologyV2`

> V2 topology is parallel and not active by default.

---

## Topology Schema

The world is organized in a hierarchical spatial model:

```
SECTOR → REGION → AREA BAND → ZONE
```

### Sectors (Risk Bands)

4 concentric risk bands from safe to dangerous:

| ID        | Label      | Risk | Description                      |
|-----------|------------|------|----------------------------------|
| haven     | Haven      | 0    | Protected starting areas         |
| frontier  | Frontier   | 1    | Settled but contested            |
| badlands  | Badlands   | 2    | Harsh wilderness, high risk      |
| void      | The Void   | 3    | Unknown territory, extreme danger|

### Regions (Cardinal Directions)

5 regions within each sector:

| ID     | Label  | Bearing |
|--------|--------|---------|
| north  | North  | 0°      |
| east   | East   | 90°     |
| south  | South  | 180°    |
| west   | West   | 270°    |
| center | Center | -       |

### Area Bands (Distance)

4 distance bands from region center:

| ID    | Label  | Range    |
|-------|--------|----------|
| core  | Core   | 0-20%    |
| inner | Inner  | 20-50%   |
| outer | Outer  | 50-80%   |
| fringe| Fringe | 80-100%  |

### Zones (Optional Landmarks)

Named POI types:

- settlement, outpost, ruin, shrine, dungeon, waypoint, wild

---

## WorldPosition Object

```javascript
createWorldPos({
  sectorId: 'badlands',    // Sector ID
  regionId: 'east',        // Region ID
  areaIndex: 2,            // Area band (0-3)
  zoneId: 'old_ruins',     // Optional zone
  distance01: 0.65,        // Normalized distance in band
})
```

---

## Adapter (Feature-Flagged)

When `enableWorldTopologyV2 === true`:
- Adapter can derive a `WorldPos` from existing location data
- Provides read-only translation layer

When `enableWorldTopologyV2 === false`:
- Adapter is completely inert
- Returns null for all derivations

---

## Files

- `src/systems/worldTopologyRegistry.js` — Data definitions (pure, no logic)
- `src/systems/worldTopologyAdapter.js` — Feature-flagged adapter

---

## Map Zoom (WO-S5)

**Feature Flag:** `__MYFI_DEV_CONFIG__.enableMapZoom`

> Map zoom is visual only and does not affect world logic.

When enabled, the map applies a CSS transform based on distance01:
- Close to center (distance01 ≈ 0): Zoomed in (2x)
- Far from center (distance01 ≈ 1): Zoomed out (1x)

This is purely visual. It does NOT affect:
- Avatar coordinates
- Region detection
- Location transitions
- Map click logic

### Files

- `src/systems/mapZoomSystem.js` — Zoom derivation and application

---

## Guardrails

Per WO-S2 and WO-S5 specifications:

1. **NO REMOVALS** — Existing registries unchanged
2. **NO BEHAVIOUR CHANGES** — Default path equals current behaviour
3. **ADDITIVE ONLY** — New files, optional features
4. **FEATURE FLAGS REQUIRED** — All new behaviour behind flags (default: false)

---

*Last Updated: WO-S2/S5 Implementation*
