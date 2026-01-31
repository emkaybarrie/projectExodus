# World Topology

**Implementation:** [`src/core/worldTopology.js`](../src/core/worldTopology.js)

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

**Factory:** `createWorldPosition()` in [`worldTopology.js:96`](../src/core/worldTopology.js#L96)

```typescript
WorldPosition = {
  sector: 'north' | 'south' | 'east' | 'west' | 'center',
  areaIndex: number,      // 0 = city, 1+ = distance from center
  zoneId: string          // Specific zone within area
}
```

### Examples
```javascript
import { createWorldPosition, SECTORS } from '../core/worldTopology.js';

// In the city
createWorldPosition({ sector: SECTORS.CENTER, areaIndex: 0, zoneId: 'hub-plaza' })

// Just outside city (east side)
createWorldPosition({ sector: SECTORS.EAST, areaIndex: 1, zoneId: 'frontier-gate' })

// Deep in the Badlands
createWorldPosition({ sector: SECTORS.EAST, areaIndex: 4, zoneId: 'void-threshold' })

// Default position (hub plaza)
getDefaultPosition()  // Returns { sector: 'center', areaIndex: 0, zoneId: 'hub-plaza' }
```

---

## Risk Bands (Area Index)

**Enum:** `RISK_BANDS` in [`worldTopology.js:43`](../src/core/worldTopology.js#L43)
**Helper:** `getRiskBandName(areaIndex)` in [`worldTopology.js:138`](../src/core/worldTopology.js#L138)

| Area Index | Constant | Risk Level | Examples |
|------------|----------|------------|----------|
| 0 | `RISK_BANDS.SAFE` | Safe | Hub Plaza, Market District |
| 1 | `RISK_BANDS.LOW` | Low | Frontier Gates, Outer Walls |
| 2 | `RISK_BANDS.MEDIUM` | Medium | Trading Posts, Outposts |
| 3 | `RISK_BANDS.HIGH` | High | Ruins, Contested Zones |
| 4+ | `RISK_BANDS.EXTREME` | Extreme | Void Threshold, The Wastes |

```javascript
import { RISK_BANDS, getRiskBandName, isInCity, isInBadlands } from '../core/worldTopology.js';

getRiskBandName(0);       // 'Safe'
getRiskBandName(3);       // 'High'
isInCity(position);       // true if center + areaIndex 0
isInBadlands(position);   // true if areaIndex >= 3
```

---

## Regions

Each sector contains themed regions that affect encounter types and visuals.

### Sector Themes

**Enum:** `SECTOR_THEMES` in [`worldTopology.js:63`](../src/core/worldTopology.js#L63)

| Sector | Constant | Theme | Aesthetic |
|--------|----------|-------|-----------|
| Center | `SECTORS.CENTER` | urban | Safe haven, markets, guilds |
| North | `SECTORS.NORTH` | frozen | Ice, snow, cold |
| South | `SECTORS.SOUTH` | volcanic | Lava, heat, ash |
| East | `SECTORS.EAST` | corrupted | Void, decay, shadow |
| West | `SECTORS.WEST` | overgrown | Jungle, nature, beasts |

```javascript
import { SECTORS, SECTOR_THEMES } from '../core/worldTopology.js';

SECTOR_THEMES[SECTORS.EAST];  // { name: 'Corrupted Lands', theme: 'corrupted', aesthetic: '...' }
```

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

**Enum:** `MAP_ZOOM` in [`worldTopology.js:54`](../src/core/worldTopology.js#L54)
**Helper:** `deriveMapZoom(position)` in [`worldTopology.js:125`](../src/core/worldTopology.js#L125)

Map zoom level is derived from `areaIndex`:

```javascript
import { MAP_ZOOM, deriveMapZoom } from '../core/worldTopology.js';

// areaIndex 0-1: zoomed in (city detail)
// areaIndex 2-3: medium zoom (frontier overview)
// areaIndex 4+: zoomed out (world view)

deriveMapZoom({ areaIndex: 0 });  // MAP_ZOOM.DETAIL ('detail')
deriveMapZoom({ areaIndex: 2 });  // MAP_ZOOM.REGION ('region')
deriveMapZoom({ areaIndex: 4 });  // MAP_ZOOM.WORLD ('world')
```

---

## Position Weighting

**Function:** `selectNextZone()` in [`worldTopology.js:195`](../src/core/worldTopology.js#L195)
**Helper:** `getAdjacentZones(position)` in [`worldTopology.js:248`](../src/core/worldTopology.js#L248)

The avatar's current position is influenced by:

### 1. Player Preferences
- Spending patterns suggest areas of interest
- Engagement history weights familiar zones (1.5x boost)

### 2. Financial Pressure
- High stress (>0.7) + deep zones (>2): 0.3x weight
- Medium stress (>0.5) + extreme zones (>3): 0.5x weight

### 3. Randomness
- ±50% variance to prevent predictability
- Weighted random selection from valid zones

```javascript
import { selectNextZone, getAdjacentZones } from '../core/worldTopology.js';

// Get adjacent zones from current position
const adjacent = getAdjacentZones(currentPosition);

// Select next zone with weighting
const nextZone = selectNextZone({
  currentPosition,
  preferredRegions: ['east', 'north'],
  financialStress: 0.3,
  availableZones: adjacent,
});
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

**Function:** `positionToRunnerCoords(position)` in [`worldTopology.js:167`](../src/core/worldTopology.js#L167)

For future Badland_P integration, positions map to runner distance:

```javascript
import { positionToRunnerCoords } from '../core/worldTopology.js';

const coords = positionToRunnerCoords(position);
// Returns: {
//   distance: areaIndex * 1000,  // 1000 units per area
//   angle: 0 | 90 | 180 | 270 | null,  // Sector direction
//   region: 'frozen' | 'volcanic' | 'corrupted' | 'overgrown' | 'urban'
// }

// Sector angles:
// NORTH = 0°, EAST = 90°, SOUTH = 180°, WEST = 270°, CENTER = null
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

## Validation

**Function:** `isValidPosition(position)` in [`worldTopology.js:296`](../src/core/worldTopology.js#L296)

```javascript
import { isValidPosition } from '../core/worldTopology.js';

isValidPosition({ sector: 'east', areaIndex: 2, zoneId: 'outpost' });  // true
isValidPosition({ sector: 'invalid', areaIndex: -1, zoneId: null });   // false
```

---

## Key Files

| File | Purpose |
|------|---------|
| [`src/core/worldTopology.js`](../src/core/worldTopology.js) | Schema definitions, helpers, validation |
| [`docs/WORLD_TOPOLOGY.md`](./WORLD_TOPOLOGY.md) | This documentation |

---

## Implementation Status

- [x] **WO-S2:** Schema locked in code (`worldTopology.js`)
- [x] **WO-S2:** Zone selection helpers implemented
- [x] **WO-S2:** Map zoom derivation implemented
- [ ] **Future:** Position tracking in episode runner
- [ ] **Future:** Endless runner integration (Badland_P)

---

## Future Extensions

1. **Episode Runner Integration**
   - Track avatar position through episodes
   - Position affects incident generation
   - Derive map zoom from avatar position

2. **Endless Runner Integration**
   - Position determines starting zone in Badland_P
   - Runner distance maps back to world position
   - Shared progression between experiences

3. **Dynamic World Events**
   - Region-specific incidents
   - Sector corruption mechanics
   - Position-based narrative triggers
