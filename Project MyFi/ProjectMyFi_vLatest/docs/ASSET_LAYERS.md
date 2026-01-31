# Asset Layers & Grade Profiles (WO-S4)

**Implementation:** Feature-flagged visual grading system for stage environments.

## Overview

The Asset Layers system provides:
1. **Grade Profiles** - Visual theming (darkness, tint, saturation, contrast, vignette)
2. **Asset Organization** - Structured folder/manifest patterns for backgrounds
3. **Feature Flags** - Backward-compatible rollout

---

## Grade Profile System

**File:** [`src/systems/gradeProfileRegistry.js`](../src/systems/gradeProfileRegistry.js)

### Feature Flag

```javascript
window.__MYFI_DEV_CONFIG__ = {
  enableGradeProfiles: true  // Enable grade profile system
};
```

### Available Profiles

| Profile ID | Theme | Use Case |
|------------|-------|----------|
| `none` | No grading | Default, unchanged rendering |
| `cave_dark` | Dark + blue tones | Underground environments |
| `twilight` | Warm orange-pink | Evening/dusk scenes |
| `night` | Cool blue + dark | Moonlit night sequences |
| `storm` | Dark + desaturated | Severe weather/danger |
| `void` | Purple otherworldly | Corruption/anomalies |
| `danger` | Red-tinted | Combat readiness/high alert |
| `sanctuary` | Warm golden | Safe zones, rest areas |

### Profile Parameters

```javascript
{
  darkness: 0-1,        // Dark overlay amount
  tint: 'rgba(...)',    // Color blend overlay
  saturation: 0-2,      // Color saturation (1 = normal)
  contrast: 0-2,        // Contrast multiplier (1 = normal)
  blur: number,         // Background blur in px
  vignette: 0-1         // Edge darkening intensity
}
```

---

## API Reference

### Get Profile

```javascript
import { getGradeProfile } from '../systems/gradeProfileRegistry.js';

const profile = getGradeProfile('twilight');
// Returns: { id, label, description, params }
```

### Get CSS Values

```javascript
import { getGradeFilterCSS, getGradeOverlayCSS } from '../systems/gradeProfileRegistry.js';

// For CSS filter property
const filter = getGradeFilterCSS('night');  // 'saturate(0.7)'

// For overlay element background
const overlay = getGradeOverlayCSS('night');  // 'background: radial-gradient(...)'
```

### Apply to DOM

```javascript
import { applyGradeProfile, removeGradeProfile } from '../systems/gradeProfileRegistry.js';

// Apply profile to container
applyGradeProfile(containerEl, 'void');

// Remove profile
removeGradeProfile(containerEl);
```

### System Status

```javascript
import { getSystemStatus, getAllProfiles } from '../systems/gradeProfileRegistry.js';

getSystemStatus();
// { enabled, version, featureFlag, profileCount, note }

getAllProfiles();
// Array of all profile definitions
```

---

## Asset Organization

### Folder Structure

```
assets/art/stages/
├── city/
│   ├── manifest.json
│   └── wardwatch-city-01.png
├── combat/
│   ├── manifest.json
│   └── wardwatch-combat-{01-05}.png
├── explore/
│   ├── manifest.json
│   └── wardwatch-explore-{01-04}.png
├── patrol/
│   ├── manifest.json
│   └── wardwatch-patrol-01.png
├── rest/
│   ├── manifest.json
│   └── wardwatch-rest-01.png
└── return/
    ├── manifest.json
    └── wardwatch-return-01.png
```

### Manifest Format

```json
{
  "backgrounds": [
    "wardwatch-combat-01.png",
    "wardwatch-combat-02.png",
    "wardwatch-combat-03.png"
  ],
  "gradeProfile": "danger"  // Optional: applies grade profile
}
```

### Naming Conventions

- Format: `wardwatch-{stageName}-{number}.png`
- Numbers are zero-padded: `01`, `02`, etc.
- Stage names match folder: `city`, `combat`, `explore`, `patrol`, `rest`, `return`

---

## Integration with BadlandsStage

### Loading Manifests

Backgrounds are loaded from manifests in `part.js`:

```javascript
const manifestUrl = new URL(
  `../../../../assets/art/stages/${stateName}/manifest.json`,
  import.meta.url
).href;
const manifest = await fetchJSON(manifestUrl);
```

### Applying Grade Profiles

When a manifest includes `gradeProfile`:

```javascript
import { applyGradeProfile } from '../../../systems/gradeProfileRegistry.js';

// After loading manifest
if (manifest.gradeProfile) {
  applyGradeProfile(container, manifest.gradeProfile);
}
```

---

## World State → Grade Profile Mapping

Suggested grade profiles by world state:

| World State | Suggested Profile | Rationale |
|-------------|------------------|-----------|
| `city` | `sanctuary` | Safe, warm atmosphere |
| `patrol` | `none` | Default, neutral |
| `explore` | `twilight` | Adventure, unknown |
| `return` | `night` | Journey home, tired |
| `rest` | `sanctuary` | Recovery, peace |
| `combat` | `danger` | High alert, threat |

---

## Design Principles

1. **Feature-Flagged** - Disabled by default, no impact on existing code
2. **Backward Compatible** - Existing manifests work unchanged
3. **CSS-Based** - No new assets required for grading effects
4. **Declarative** - Profiles defined in registry, applied via ID
5. **Layered** - Grade overlay sits between background and content

---

## Key Files

| File | Purpose |
|------|---------|
| [`src/systems/gradeProfileRegistry.js`](../src/systems/gradeProfileRegistry.js) | Profile definitions and API |
| [`assets/art/stages/{state}/manifest.json`](../assets/art/stages/) | Per-state background manifests |
| [`src/parts/prefabs/BadlandsStage/part.js`](../src/parts/prefabs/BadlandsStage/part.js) | Manifest loading |

---

## Regression Harness

- [x] Stage idle cycle unchanged
- [x] Combat overlay timing unchanged
- [x] Vitals ticking unchanged
- [x] Map movement unchanged
- [x] Nav modal/hub routing unchanged

**Flags OFF = identical to pre-WO**
