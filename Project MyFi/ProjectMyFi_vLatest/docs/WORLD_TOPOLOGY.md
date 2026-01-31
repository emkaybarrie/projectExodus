# World Topology

## Overview

MyFi's world is organized around a central **Hub City** with four directional **Sectors**, each containing progressively dangerous **Areas** that lead outward into the **Badlands**.

This topology supports:
- Narrative geography (where is the avatar?)
- Risk scaling (distance = difficulty)
- Future endless runner coordinates
- Map zoom derived from position

---

## World Structure

```
                    ┌─────────┐
                    │  NORTH  │
                    │ Sector  │
                    └────┬────┘
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐
│   WEST    │      │  HUB CITY │      │   EAST    │
│  Sector   │◄────►│  (center) │◄────►│  Sector   │
└───────────┘      └─────┬─────┘      └───────────┘
                         │
                         │
                    ┌────┴────┐
                    │  SOUTH  │
                    │ Sector  │
                    └─────────┘
```

---

## Position Schema

```typescript
WorldPosition = {
  sector: 'north' | 'south' | 'east' | 'west' | 'center',
  areaIndex: number,      // 0 = city, 1+ = distance from center
  zoneId: string          // Specific zone within area
}
```

### Examples
```javascript
// In the city
{ sector: 'center', areaIndex: 0, zoneId: 'hub-plaza' }

// Just outside city (east side)
{ sector: 'east', areaIndex: 1, zoneId: 'frontier-gate' }

// Deep in the Badlands
{ sector: 'east', areaIndex: 4, zoneId: 'void-threshold' }
```

---

## Risk Bands (Area Index)

| Area Index | Name | Risk Level | Examples |
|------------|------|------------|----------|
| 0 | City Center | Safe | Hub Plaza, Market District |
| 1 | City Edge | Low | Frontier Gates, Outer Walls |
| 2 | Frontier | Medium | Trading Posts, Outposts |
| 3 | Badlands | High | Ruins, Contested Zones |
| 4+ | Deep Badlands / Void | Extreme | Void Threshold, The Wastes |

---

## Regions

Each sector contains themed regions that affect encounter types and visuals.

### Sector Themes
| Sector | Theme | Aesthetic | Enemy Types |
|--------|-------|-----------|-------------|
| North | Frozen | Ice, snow, cold | Frost creatures |
| South | Volcanic | Lava, heat, ash | Fire elementals |
| East | Corrupted | Void, decay | Shadow beings |
| West | Overgrown | Jungle, nature | Beast creatures |

### Region Structure
```javascript
Region = {
  id: 'east-frontier',
  sector: 'east',
  areaRange: [1, 2],        // Which area indices this region covers
  theme: 'corrupted',
  backgrounds: ['corruption-*.png'],
  encounterTypes: ['shadow_ambush', 'void_rift'],
  music: 'corrupted-theme.mp3'
}
```

---

## Map Zoom Derivation

Map zoom level is derived from `areaIndex`:

```javascript
function getMapZoom(position) {
  // areaIndex 0-1: zoomed in (city detail)
  // areaIndex 2-3: medium zoom (frontier overview)
  // areaIndex 4+: zoomed out (world view)

  const { areaIndex } = position;

  if (areaIndex <= 1) return 'detail';      // City-level
  if (areaIndex <= 3) return 'region';      // Regional view
  return 'world';                            // Full world map
}
```

---

## Position Weighting

The avatar's current position is influenced by:

### 1. Player Preferences
- Spending patterns suggest areas of interest
- Engagement history weights familiar zones

### 2. Financial Pressure
- High essential spending → safer zones (patrol, return)
- Discretionary spending → riskier zones (explore, deep)

### 3. Randomness
- Some variance to prevent predictability
- Weighted random selection from valid zones

```javascript
function selectNextZone(playerState, currentPosition) {
  const validZones = getAdjacentZones(currentPosition);
  const weights = validZones.map(zone => {
    let weight = 1;

    // Player preference
    if (playerState.preferredRegions.includes(zone.region)) {
      weight *= 1.5;
    }

    // Financial pressure (high stress → stay safe)
    if (playerState.financialStress > 0.7 && zone.areaIndex > 2) {
      weight *= 0.3;
    }

    // Randomness
    weight *= 0.5 + Math.random();

    return weight;
  });

  return weightedRandomSelect(validZones, weights);
}
```

---

## State Cycle Mapping

World states from Stage Engine map to position transitions:

| World State | Movement | Description |
|-------------|----------|-------------|
| `rest` | Stay | Avatar resting at current position |
| `patrol` | Local | Small movements within current area |
| `explore` | Outward | Moving toward higher areaIndex |
| `return` | Inward | Moving toward lower areaIndex |
| `city` | Center | Back at Hub City (areaIndex 0) |

---

## Endless Runner Coordinates

For future Badland_P integration, positions map to runner distance:

```javascript
function positionToRunnerCoords(position) {
  const { areaIndex, sector } = position;

  // Distance from center in game units
  const baseDistance = areaIndex * 1000;  // 1000 units per area

  // Sector offset (cosmetic, affects parallax)
  const sectorAngles = {
    north: 0,
    east: 90,
    south: 180,
    west: 270,
    center: null
  };

  return {
    distance: baseDistance,
    angle: sectorAngles[sector],
    region: getRegionAt(position)
  };
}
```

---

## Zone Examples

### Hub City (areaIndex: 0)
- `hub-plaza` - Central gathering area
- `market-district` - Shopping, vendors
- `guild-hall` - Player progression
- `sanctuary` - Rest, recovery

### Frontier (areaIndex: 1-2)
- `frontier-gate-east` - Eastern exit from city
- `trading-post` - NPC encounters
- `watchtower` - Observation point
- `outpost-ruins` - Abandoned structure

### Badlands (areaIndex: 3-4)
- `corrupted-wastes` - Void-touched terrain
- `beast-dens` - Creature spawns
- `ancient-ruins` - Discovery zones
- `void-threshold` - Edge of known world

---

## Key Constraints

1. **No rendering changes yet** - Schema only, visuals unchanged
2. **No new assets required** - Uses existing background system
3. **Maps to endless runner** - Coordinate system compatible
4. **Supports future escalation** - Deep badlands = higher stakes

---

## Future Extensions

1. **WO-S2 Implementation**
   - Lock schema in code
   - Add position tracking to episode runner
   - Derive map zoom from avatar position

2. **Endless Runner Integration**
   - Position determines starting zone in Badland_P
   - Runner distance maps back to world position
   - Shared progression between experiences

3. **Dynamic World Events**
   - Region-specific incidents
   - Sector corruption mechanics
   - Position-based narrative triggers
