# Stage Asset Structure

This document defines where assets should be placed to be correctly rendered on the BadlandsStage based on activity phase and state.

---

## Directory Structure

```
assets/art/stages/
├── city/
│   ├── manifest.json
│   └── wardwatch-city-01.png
│
├── combat/
│   ├── manifest.json
│   ├── wardwatch-combat-01.png
│   ├── wardwatch-combat-02.png
│   ├── wardwatch-combat-03.png
│   ├── wardwatch-combat-04.png
│   └── wardwatch-combat-05.png
│
├── explore/
│   ├── manifest.json
│   ├── wardwatch-explore-01.png
│   ├── wardwatch-explore-02.png
│   ├── wardwatch-explore-03.png
│   └── wardwatch-explore-04.png
│
├── patrol/
│   ├── manifest.json
│   └── wardwatch-patrol-01.png
│
├── rest/
│   ├── manifest.json
│   └── wardwatch-rest-01.png
│
└── return/
    ├── manifest.json
    └── wardwatch-return-01.png
```

---

## World States (Visual Folders)

Each folder corresponds to a **world state** that the stage can display:

| World State | Folder | Description | When Used |
|-------------|--------|-------------|-----------|
| `rest` | `rest/` | Sanctuary, shelter | Night, inactive periods |
| `patrol` | `patrol/` | Wardwatch, light activity | Morning, casual exploration |
| `explore` | `explore/` | The Wilds, active discovery | Active exploration, midday |
| `return` | `return/` | Homeward journey | Evening, winding down |
| `city` | `city/` | Haven's Gate, urban | Safe zones, commerce |
| `combat` | `combat/` | Battle scenes | During active encounters |

---

## Activity States & Visual Pools

Activity states (time-of-day based) determine which visual pools are used:

| Activity State | Time of Day | Visual Pool | World States Available |
|----------------|-------------|-------------|------------------------|
| WAKE | Dawn (6-9am) | `morning` | rest, patrol, city |
| EXPLORE | Morning/Afternoon | `active` | patrol, explore, return |
| FOCUS | Midday (12-3pm) | `intense` | explore, patrol |
| WIND_DOWN | Evening (5-8pm) | `evening` | return, city, rest |
| REST | Night (9pm-6am) | `night` | rest, city |

### Visual Pool → World State Mapping

```javascript
const VISUAL_POOL_STATES = {
  morning: ['rest', 'patrol', 'city'],
  active: ['patrol', 'explore', 'return'],
  intense: ['explore', 'patrol'],
  evening: ['return', 'city', 'rest'],
  night: ['rest', 'city'],
  default: ['rest', 'patrol', 'explore', 'return', 'city'],
};
```

---

## Engagement States

Within any activity phase, the stage has engagement states:

| Engagement State | Description | Visual Behavior |
|------------------|-------------|-----------------|
| `inactive` | No active event | Shows world state from visual pool |
| `pending` | Event triggered, awaiting engagement | Shows event notification capsule |
| `active` | Event in progress (auto-resolving) | Shows event overlay with timer |
| `engaged` | Player engaged with event | Shows full interaction UI |

When **inactive**: Stage cycles through world states from the current visual pool.
When **pending/active/engaged**: Stage shows `combat/` folder backgrounds (or event-specific).

---

## Manifest File Format

Each folder must contain a `manifest.json`:

```json
{
  "backgrounds": [
    "wardwatch-patrol-01.png",
    "wardwatch-patrol-02.png"
  ]
}
```

The system randomly selects from this array when displaying the state.

---

## Adding New Assets

### To add a new background:

1. Create the PNG file following naming convention: `{region}-{state}-{number}.png`
2. Place in the appropriate state folder: `assets/art/stages/{state}/`
3. Add the filename to the folder's `manifest.json`

### Example: Adding a new patrol background

1. Create: `wardwatch-patrol-02.png`
2. Place in: `assets/art/stages/patrol/`
3. Update `patrol/manifest.json`:
```json
{
  "backgrounds": [
    "wardwatch-patrol-01.png",
    "wardwatch-patrol-02.png"
  ]
}
```

---

## File Naming Convention

```
{region}-{state}-{number}.png

region:  Location name (e.g., "wardwatch", "frontier", "void")
state:   World state (rest, patrol, explore, return, city, combat)
number:  Sequential number with leading zero (01, 02, 03...)
```

Examples:
- `wardwatch-patrol-01.png`
- `frontier-combat-03.png`
- `void-explore-02.png`

---

## Live vs Demo Mode Behavior

### Live Mode (Default)
- Time-of-day is **real time**
- Activity state follows actual time
- No random events emitted
- Stage shows backgrounds from current visual pool
- Events only occur via user action (Energy button → Transaction Modal)

### Demo Mode
- Time-of-day is **simulated** (configurable speed: 1x, 5x, 20x, 60x, 300x)
- Random events emitted at configurable frequency
- Stage responds to simulated transactions
- Useful for testing and demonstration

---

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/parts/prefabs/BadlandsStage/part.js` | Stage rendering and state management |
| `src/systems/episodeRouter.js` | Activity state routing |
| `src/systems/episodeClock.js` | Time-of-day tracking |
| `src/systems/assetPreflight.js` | Asset validation |

### Constants in BadlandsStage

```javascript
const BG_FOLDER_BASE = '../../../../assets/art/stages/';

const STATE_FOLDERS = {
  combat: 'combat/',
  rest: 'rest/',
  patrol: 'patrol/',
  explore: 'explore/',
  return: 'return/',
  city: 'city/',
};

const STATE_FALLBACKS = {
  combat: 'wardwatch-combat-01.png',
  rest: 'wardwatch-rest-01.png',
  patrol: 'wardwatch-patrol-01.png',
  explore: 'wardwatch-explore-01.png',
  return: 'wardwatch-return-01.png',
  city: 'wardwatch-city-01.png',
};
```

---

## Troubleshooting

### Asset not appearing

1. Check file exists in correct folder
2. Verify filename is in `manifest.json`
3. Enable asset preflight: `window.__MYFI_DEV_CONFIG__.devAssetPreflightEnabled = true`
4. Check console for missing asset warnings
5. Verify PNG format and reasonable file size (< 3MB)

### Wrong asset pool

1. Check current activity state: `__MYFI_DEBUG__.episodeRouter.currentState`
2. Verify visual pool mapping in `VISUAL_POOL_STATES`
3. Check mode (Live vs Demo): `__MYFI_DEBUG__.gameMode`
