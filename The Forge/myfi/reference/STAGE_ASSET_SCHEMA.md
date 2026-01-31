# Stage Asset Schema Reference (WO-S4)

## Overview

Defines the schema for Stage background assets and visual grading profiles.
Grade profiles are **optional** — existing assets render unchanged.

**Feature Flag:** `__MYFI_DEV_CONFIG__.enableGradeProfiles`

---

## Background Manifest Schema

```json
{
  "id": "badlands_east",
  "label": "Eastern Badlands",
  "region": "east",
  "variants": ["day", "dusk", "night"],
  "gradeProfile": "twilight"  // OPTIONAL - new in WO-S4
}
```

### Fields

| Field        | Type     | Required | Description                     |
|--------------|----------|----------|---------------------------------|
| id           | string   | Yes      | Unique identifier               |
| label        | string   | Yes      | Display name                    |
| region       | string   | Yes      | World region (north/east/etc)   |
| variants     | string[] | No       | Time-of-day variants            |
| gradeProfile | string   | No       | Visual grading profile ID       |

### gradeProfile (Optional)

If `gradeProfile` is:
- **Missing**: Asset renders exactly as before (no grading)
- **"none"**: Explicitly no grading
- **Valid ID**: Applies specified grade profile

---

## Grade Profiles

Visual overlay/filter effects applied via CSS.
Only active when feature flag is enabled.

### Available Profiles

| ID         | Description                    | Key Effects                |
|------------|--------------------------------|----------------------------|
| none       | No grading (default)           | -                          |
| cave_dark  | Underground environments       | 40% dark, blue tint        |
| twilight   | Warm dusk atmosphere           | Orange tint, +saturation   |
| night      | Cool moonlit night             | 30% dark, blue tint        |
| storm      | Dramatic weather               | Desaturation, contrast     |
| void       | Otherworldly corruption        | Purple tint, vignette      |
| danger     | High alert                     | Red tint, high contrast    |
| sanctuary  | Safe zone                      | Golden tint, warm          |

### Profile Parameters

```javascript
{
  darkness: 0-1,      // Dark overlay opacity
  tint: 'rgba()',     // Color overlay
  saturation: 0-2,    // 1 = normal
  contrast: 0-2,      // 1 = normal
  blur: 0+,           // Background blur (px)
  vignette: 0-1       // Edge darkening
}
```

---

## Application

### Feature Disabled (Default)

- All grade-related CSS is empty
- No overlay elements created
- Existing rendering unchanged

### Feature Enabled

```javascript
import { applyGradeProfile } from './gradeProfileRegistry.js';

// In Stage renderer (feature-flagged)
if (isEnabled()) {
  const gradeId = manifest.gradeProfile || 'none';
  applyGradeProfile(containerEl, gradeId);
}
```

---

## Files

- `src/systems/gradeProfileRegistry.js` — Profile definitions and application

---

## Backwards Compatibility

Existing manifests without `gradeProfile`:
- ✅ Continue to work unchanged
- ✅ No errors or warnings
- ✅ Render identically to before WO-S4

No asset regeneration required.

---

## Guardrails

Per WO-S4 specification:

1. **Existing rendering UNCHANGED**
   - Background loading
   - CSS effects
   - Manifest validation

2. **Optional only**
   - `gradeProfile` is never required
   - Missing = current behaviour

3. **Feature-flagged**
   - Grade application only when enabled
   - Default: disabled (no effect)

---

*Last Updated: WO-S4 Implementation*
