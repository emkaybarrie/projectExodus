# WO Pack: Diorama Compositor System

**Pack ID:** WO-DIORAMA-V1
**Date:** 2026-01-31
**Status:** PLANNED (Awaiting Approval)

---

## Overview

This WO pack evolves the asset routing system into a "procedural diorama compositor" with:
- Best-available-match resolution (no more required manifests at every level)
- Extended manifest schema (backwards compatible)
- Optional tags/weights for smarter selection
- Repetition avoidance
- Progressive enhancement path to layered composition

---

## WO-DIORAMA-01: Extended Manifest Schema + Version Detection

### Objective
Create a backwards-compatible manifest schema that supports simple backgrounds (V1), tagged items (V2), and layered plates (V3), with automatic version detection.

### Scope
- Define TypeScript-style schema types
- Implement manifest loader with version detection
- Ensure V1 manifests work unchanged

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/systems/dioramaManifest.js` | **CREATE** — Manifest loader + types |
| `src/systems/assetRoutingSchema.js` | **MODIFY** — Add schema type exports |

### Acceptance Criteria
- [ ] V1 manifest (`{ backgrounds: [] }`) loads correctly
- [ ] V2 manifest (`{ version: 2, items: [] }`) loads correctly
- [ ] V3 manifest (`{ version: 3, layers: {} }`) loads correctly
- [ ] Unknown versions default to V1 behavior
- [ ] Console warning for unrecognized manifest structure

### Schema Definitions

```javascript
// V1: Legacy (current)
{
  "backgrounds": ["file1.png", "file2.png"]
}

// V2: Tagged Items
{
  "version": 2,
  "backgrounds": ["legacy-fallback.png"],  // Optional V1 fallback
  "items": [
    {
      "id": "combat-intense-01",
      "filename": "wardwatch-combat-01.png",
      "tags": ["dark", "intense"],
      "weight": 2,
      "constraints": {
        "minIntensity": 3,
        "maxIntensity": 5,
        "timeBuckets": ["night", "dusk"],
        "excludeTags": ["calm"]
      }
    }
  ]
}

// V3: Layered Plates (Future)
{
  "version": 3,
  "items": [...],
  "layers": {
    "background": ["bg-01.png"],
    "hero": ["hero-idle.png"],
    "enemy": ["enemy-goblin.png"],
    "vfx": ["vfx-dust.png"],
    "foreground": ["fg-grass.png"],
    "grade": ["grade-warm.json"]
  }
}
```

### Feature Flag
```javascript
window.__MYFI_DEV_CONFIG__.enableDioramaV2 = true; // Default: false
```

### Regression Checks
- [ ] Existing combat/patrol/explore manifests still work
- [ ] `selectBackgroundForState()` unchanged behavior
- [ ] No console errors with current asset structure

---

## WO-DIORAMA-02: Best-Available-Match Resolver

### Objective
Replace static folder-chain fallback with a smart resolver that probes availability and scores candidates to find the best match.

### Scope
- Build availability index at startup (cached)
- Implement scoring algorithm
- Replace `selectBackgroundWithRouting()` with resolver call
- Graceful degradation without crash

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/systems/dioramaResolver.js` | **CREATE** — Core resolver |
| `src/parts/prefabs/BadlandsStage/part.js` | **MODIFY** — Use resolver |
| `src/systems/assetRoutingSchema.js` | **MODIFY** — Add scoring weights |

### Acceptance Criteria
- [ ] With only `idle/manifest.json`, all contexts resolve successfully
- [ ] With `combat/manifest.json`, combat beats prefer that over idle
- [ ] Missing manifests don't cause errors (graceful skip)
- [ ] Resolver logs decision path to console (dev mode)
- [ ] Performance: <50ms for cold resolution, <5ms for cached

### Scoring Algorithm

```javascript
// Dimension weights (configurable)
const DIMENSION_WEIGHTS = {
  beatType: 100,      // Primary importance
  activityPhase: 30,  // Secondary
  region: 10,         // Tertiary
  timeBucket: 5,      // Nice to have
};

// Score calculation
function scoreCandidate(candidate, recipe) {
  let score = 0;
  if (candidate.beatType === recipe.beatType) score += DIMENSION_WEIGHTS.beatType;
  if (candidate.activityPhase === recipe.activityPhase) score += DIMENSION_WEIGHTS.activityPhase;
  if (candidate.region === recipe.region) score += DIMENSION_WEIGHTS.region;
  if (candidate.timeBucket === recipe.timeBucket) score += DIMENSION_WEIGHTS.timeBucket;
  return score;
}

// Resolution flow
function resolve(recipe) {
  const candidates = getAvailableManifests(); // From index
  const scored = candidates
    .map(c => ({ ...c, score: scoreCandidate(c, recipe) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return getGlobalDefault(); // idle/manifest.json
  }

  return scored[0]; // Best match
}
```

### Availability Index Structure

```javascript
// Built at startup, cached
availabilityIndex = {
  manifests: [
    { path: 'combat', beatType: 'combat', activityPhase: null, region: null, hasItems: true },
    { path: 'combat/focus', beatType: 'combat', activityPhase: 'focus', region: null, hasItems: true },
    { path: 'idle', beatType: 'idle', activityPhase: null, region: null, hasItems: true },
  ],
  globalDefault: 'idle',
  lastBuilt: timestamp
};
```

### Feature Flag
```javascript
window.__MYFI_DEV_CONFIG__.enableDioramaResolver = true; // Default: false
```

### Regression Checks
- [ ] With flag OFF, current behavior unchanged
- [ ] With flag ON, same assets selected (deterministic test)
- [ ] No performance regression on page load

---

## WO-DIORAMA-03: Recipe Object Contract + Context Threading

### Objective
Define a formal "render recipe" contract and ensure it's threaded from incident creation through to asset selection.

### Scope
- Define RenderRecipe type
- Update incidentFactory to build complete recipe
- Add timeBucket and intensityTier dimensions
- Update DioramaSpec to include recipe

### Files to Modify
| File | Action |
|------|--------|
| `src/core/stageSchemas.js` | **MODIFY** — Add RenderRecipe type |
| `src/systems/incidentFactory.js` | **MODIFY** — Build recipe with new fields |
| `src/systems/assetRoutingSchema.js` | **MODIFY** — Add new dimension mappings |

### Recipe Object Contract

```javascript
// RenderRecipe — input to diorama resolver
{
  // Core dimensions (required)
  beatType: 'combat' | 'traversal' | 'social' | 'anomaly' | 'idle',

  // Secondary dimensions (optional, improves match quality)
  activityPhase: 'wake' | 'explore' | 'focus' | 'wind_down' | 'rest' | null,
  region: 'north' | 'east' | 'south' | 'west' | 'center' | null,

  // New dimensions (WO-DIORAMA-03)
  timeBucket: 'dawn' | 'morning' | 'day' | 'dusk' | 'night' | null,
  intensityTier: 1 | 2 | 3 | 4 | 5 | null,

  // Asset hints (optional, for tagged items)
  desiredTags: string[] | null,
  excludeTags: string[] | null,

  // Actor hints (for V3 layering)
  heroId: string | null,
  enemyId: string | null,

  // Debug/replay
  seed: number | null,  // For deterministic replay
}
```

### Time Bucket Mapping

```javascript
// From episodeClock.js DAY_SEGMENTS
const TIME_BUCKET_MAP = {
  dawn: { start: 0.0, end: 0.125 },
  morning: { start: 0.125, end: 0.333 },
  day: { start: 0.333, end: 0.667 },  // Midday + Afternoon
  dusk: { start: 0.667, end: 0.833 },  // Evening
  night: { start: 0.833, end: 1.0 },
};

function getTimeBucket(dayT) {
  for (const [bucket, range] of Object.entries(TIME_BUCKET_MAP)) {
    if (dayT >= range.start && dayT < range.end) return bucket;
  }
  return 'day'; // Default
}
```

### Intensity Tier Mapping

```javascript
// From incident difficulty (1-5 scale)
function getIntensityTier(difficulty) {
  return Math.max(1, Math.min(5, Math.round(difficulty)));
}
```

### Acceptance Criteria
- [ ] Recipe includes timeBucket derived from episodeClock
- [ ] Recipe includes intensityTier derived from difficulty
- [ ] Recipe passed through to resolver unchanged
- [ ] Missing optional fields default to null (not undefined)

### Regression Checks
- [ ] Existing incidents still create valid recipes
- [ ] No runtime errors from missing fields

---

## WO-DIORAMA-04: Constraint Filtering + Repetition Avoidance

### Objective
Implement constraint-based filtering for V2 manifests and add LRU cache to avoid repeating recent assets.

### Scope
- Parse and apply item constraints
- Filter candidates before scoring
- Add recently-used tracking (5-asset window)
- Weight adjustment for variety

### Files to Modify
| File | Action |
|------|--------|
| `src/systems/dioramaResolver.js` | **MODIFY** — Add filtering + LRU |
| `src/systems/dioramaManifest.js` | **MODIFY** — Parse constraints |

### Constraint Types

```javascript
// Item constraint object
{
  minIntensity: number,      // Only use if recipe.intensityTier >= this
  maxIntensity: number,      // Only use if recipe.intensityTier <= this
  timeBuckets: string[],     // Only use if recipe.timeBucket in this array
  excludeTags: string[],     // Exclude if recipe.desiredTags overlaps
  requireTags: string[],     // Require if recipe.desiredTags must contain
}

// Filtering logic
function filterByConstraints(items, recipe) {
  return items.filter(item => {
    const c = item.constraints || {};

    // Intensity range check
    if (c.minIntensity && recipe.intensityTier < c.minIntensity) return false;
    if (c.maxIntensity && recipe.intensityTier > c.maxIntensity) return false;

    // Time bucket check
    if (c.timeBuckets && !c.timeBuckets.includes(recipe.timeBucket)) return false;

    // Tag exclusion check
    if (c.excludeTags && recipe.desiredTags) {
      const overlap = c.excludeTags.some(t => recipe.desiredTags.includes(t));
      if (overlap) return false;
    }

    // Tag requirement check
    if (c.requireTags && recipe.desiredTags) {
      const hasAll = c.requireTags.every(t => recipe.desiredTags.includes(t));
      if (!hasAll) return false;
    }

    return true;
  });
}
```

### Repetition Avoidance

```javascript
// LRU cache for recently used assets
const recentlyUsed = new Map(); // assetId -> timestamp
const MAX_RECENT = 5;

function selectWithVariety(candidates, recipe) {
  // Sort by weight (higher = more likely)
  let weighted = candidates.map(c => ({
    ...c,
    effectiveWeight: c.weight || 1
  }));

  // Penalize recently used
  weighted = weighted.map(c => {
    if (recentlyUsed.has(c.id)) {
      c.effectiveWeight *= 0.1; // 90% penalty
    }
    return c;
  });

  // Weighted random selection
  const selected = weightedRandomSelect(weighted);

  // Track usage
  trackUsage(selected.id);

  return selected;
}

function trackUsage(assetId) {
  recentlyUsed.set(assetId, Date.now());

  // Prune old entries
  if (recentlyUsed.size > MAX_RECENT) {
    const oldest = [...recentlyUsed.entries()]
      .sort((a, b) => a[1] - b[1])[0][0];
    recentlyUsed.delete(oldest);
  }
}
```

### Acceptance Criteria
- [ ] V2 items with constraints are filtered correctly
- [ ] V1 manifests (no constraints) work unchanged
- [ ] Same asset not selected twice in a row (5-window)
- [ ] Weight influences selection probability
- [ ] Console logs constraint filtering decisions (dev mode)

### Regression Checks
- [ ] V1 manifests unaffected
- [ ] No performance regression

---

## WO-DIORAMA-05: Dev Visibility + Resolver Decision Logging

### Objective
Enhance devRenderInspector to show resolver decision path, missing assets, and selection reasoning.

### Scope
- Log resolver decision events
- Show "why this asset" reasoning
- Track fallback depth metrics
- Integrate with existing timeline

### Files to Modify
| File | Action |
|------|--------|
| `src/systems/devRenderInspector.js` | **MODIFY** — Add resolver events |
| `src/systems/dioramaResolver.js` | **MODIFY** — Emit decision events |

### Events to Add

```javascript
// Resolver decision event
actionBus.emit('diorama:resolved', {
  recipe: { beatType, activityPhase, region, timeBucket, intensityTier },
  candidatesFound: 5,
  candidatesAfterFilter: 3,
  selectedPath: 'combat/focus',
  selectedAsset: 'wardwatch-combat-01.png',
  fallbackDepth: 1,  // 0 = exact match, 1+ = fallback levels
  score: 135,
  reason: 'Best score match (beatType + phase)',
  alternatives: ['combat/manifest.json', 'idle/manifest.json']
});

// Constraint rejection event (dev only)
actionBus.emit('diorama:filtered', {
  assetId: 'combat-intense-01',
  reason: 'intensityTier 2 < minIntensity 3',
  constraint: { minIntensity: 3 }
});

// Repetition avoidance event
actionBus.emit('diorama:varietyApplied', {
  assetId: 'combat-calm-01',
  originalWeight: 2,
  effectiveWeight: 0.2,
  reason: 'Recently used (2 selections ago)'
});
```

### Inspector UI Updates

```
┌─────────────────────────────────────────────────────────┐
│ DIORAMA RESOLVER                                         │
├─────────────────────────────────────────────────────────┤
│ Recipe: combat + focus + center + night + tier:4        │
│ Candidates: 5 found → 3 after constraints               │
│ Selected: combat/focus/wardwatch-combat-01.png          │
│ Score: 135 (beat:100 + phase:30 + time:5)               │
│ Fallback: Level 1 (no region-specific manifest)         │
├─────────────────────────────────────────────────────────┤
│ Recently Used: [combat-02, combat-03, idle-01]          │
│ Variety: combat-02 penalized (90%)                      │
└─────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Resolver emits decision event for every selection
- [ ] Inspector shows last 10 decisions in timeline
- [ ] Fallback depth tracked and reported
- [ ] Constraint rejections logged (dev only)
- [ ] Copy-to-clipboard includes resolver state

### Regression Checks
- [ ] Inspector still works with flag OFF
- [ ] No performance impact from event emission

---

## Rollback Plan

### Feature Flags (All Default OFF)
```javascript
window.__MYFI_DEV_CONFIG__ = {
  enableDioramaV2: false,        // WO-01: Extended manifest schema
  enableDioramaResolver: false,  // WO-02: Smart resolver
  enableDioramaConstraints: false, // WO-04: Constraint filtering
};
```

### Rollback Procedure
1. Set all flags to `false`
2. System reverts to current folder-chain behavior
3. No manifest changes required
4. Clear resolver cache: `window.__MYFI_DEBUG__.dioramaResolver?.clearCache()`

### Data Migration
- **None required** — V1 manifests remain valid
- V2/V3 manifests are additive; removing flags ignores new fields

---

## Regression Harness Plan

### Test Cases

| Test ID | Description | Expected |
|---------|-------------|----------|
| REG-01 | Load with only `idle/manifest.json` | Stage renders, no errors |
| REG-02 | Load with existing combat/patrol/explore | Same behavior as before |
| REG-03 | V1 manifest loads correctly | Random selection works |
| REG-04 | V2 manifest with constraints | Filtering applied |
| REG-05 | Missing manifest path | Graceful fallback |
| REG-06 | Empty manifest | Falls back to next level |
| REG-07 | Performance: 100 resolutions | <500ms total |

### Automated Checks
```javascript
// Add to test harness
async function testDioramaRegression() {
  const tests = [
    () => testIdleOnlyFallback(),
    () => testExistingManifestsUnchanged(),
    () => testV1ManifestRandom(),
    () => testV2ManifestConstraints(),
    () => testMissingManifestGraceful(),
    () => testEmptyManifestFallback(),
    () => testPerformance100Resolutions(),
  ];

  for (const test of tests) {
    await test();
  }
}
```

---

## Documentation Updates

| Document | Updates |
|----------|---------|
| `ASSET_ROUTING_GUIDE.md` | Add V2/V3 schema examples, resolver explanation |
| `DEV_SIMULATION_GUIDE.md` | Add resolver debugging section |
| `STAGE_ENGINE.md` | Update architecture diagram with resolver |
| **New:** `DIORAMA_COMPOSITOR.md` | Full compositor documentation |

---

## Implementation Order

```
WO-DIORAMA-01 (Schema) ────┐
                           ├──► WO-DIORAMA-03 (Recipe) ──┐
WO-DIORAMA-02 (Resolver) ──┘                             ├──► WO-DIORAMA-05 (DevVis)
                                                         │
WO-DIORAMA-04 (Constraints) ─────────────────────────────┘
```

**Recommended sequence:**
1. WO-01 + WO-02 (parallel) — Foundation
2. WO-03 — Recipe threading
3. WO-04 — Constraints + variety
4. WO-05 — Dev visibility

**Estimated effort:** 2-3 focused sessions

---

## Appendix: Resolver Pseudocode

```javascript
// dioramaResolver.js — High-level logic

class DioramaResolver {
  constructor(options) {
    this.actionBus = options.actionBus;
    this.availabilityIndex = null;
    this.recentlyUsed = new Map();
    this.cache = new Map();
  }

  async init() {
    // Build availability index by probing all known paths
    this.availabilityIndex = await this.buildAvailabilityIndex();
  }

  async buildAvailabilityIndex() {
    const index = { manifests: [], globalDefault: 'idle' };
    const pathsToProbe = this.generateAllPossiblePaths();

    for (const path of pathsToProbe) {
      const manifest = await this.probeManifest(path);
      if (manifest) {
        index.manifests.push({
          path,
          ...this.extractDimensions(path),
          hasItems: manifest.items?.length > 0,
          hasBackgrounds: manifest.backgrounds?.length > 0,
        });
      }
    }

    return index;
  }

  async resolve(recipe) {
    // Check cache
    const cacheKey = this.buildCacheKey(recipe);
    if (this.cache.has(cacheKey)) {
      return this.selectFromCached(this.cache.get(cacheKey), recipe);
    }

    // Score all available manifests
    const scored = this.availabilityIndex.manifests
      .map(m => ({ ...m, score: this.scoreCandidate(m, recipe) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return this.resolveGlobalDefault(recipe);
    }

    // Load best manifest
    const best = scored[0];
    const manifest = await this.loadManifest(best.path);

    // Cache for future
    this.cache.set(cacheKey, { manifest, path: best.path, score: best.score });

    // Select asset from manifest
    return this.selectAsset(manifest, recipe, best);
  }

  selectAsset(manifest, recipe, manifestMeta) {
    let candidates;

    // Determine source: items (V2) or backgrounds (V1)
    if (manifest.items?.length > 0) {
      candidates = this.filterByConstraints(manifest.items, recipe);
    } else {
      candidates = manifest.backgrounds.map(filename => ({ filename, weight: 1 }));
    }

    if (candidates.length === 0) {
      return this.resolveGlobalDefault(recipe);
    }

    // Apply variety penalty
    candidates = this.applyVarietyPenalty(candidates);

    // Weighted random selection
    const selected = this.weightedRandomSelect(candidates);

    // Track usage
    this.trackUsage(selected.id || selected.filename);

    // Emit decision event
    this.emitDecision(recipe, manifestMeta, selected, candidates);

    return {
      url: this.buildAssetUrl(manifestMeta.path, selected.filename),
      folderUsed: manifestMeta.path,
      fallbackDepth: this.calculateFallbackDepth(recipe, manifestMeta),
      filename: selected.filename,
      score: manifestMeta.score,
    };
  }

  scoreCandidate(candidate, recipe) {
    let score = 0;
    if (candidate.beatType === recipe.beatType) score += 100;
    if (candidate.activityPhase === recipe.activityPhase) score += 30;
    if (candidate.region === recipe.region) score += 10;
    if (candidate.timeBucket === recipe.timeBucket) score += 5;
    return score;
  }

  filterByConstraints(items, recipe) {
    return items.filter(item => {
      const c = item.constraints || {};
      if (c.minIntensity && recipe.intensityTier < c.minIntensity) return false;
      if (c.maxIntensity && recipe.intensityTier > c.maxIntensity) return false;
      if (c.timeBuckets && !c.timeBuckets.includes(recipe.timeBucket)) return false;
      return true;
    });
  }

  applyVarietyPenalty(candidates) {
    return candidates.map(c => {
      const id = c.id || c.filename;
      if (this.recentlyUsed.has(id)) {
        return { ...c, effectiveWeight: (c.weight || 1) * 0.1 };
      }
      return { ...c, effectiveWeight: c.weight || 1 };
    });
  }

  weightedRandomSelect(candidates) {
    const totalWeight = candidates.reduce((sum, c) => sum + c.effectiveWeight, 0);
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
      random -= candidate.effectiveWeight;
      if (random <= 0) return candidate;
    }

    return candidates[0]; // Fallback
  }
}

export function createDioramaResolver(options) {
  return new DioramaResolver(options);
}
```

---

## Approval Checklist

- [ ] Delta Report reviewed and accepted
- [ ] WO scope appropriate for V1
- [ ] Schema examples approved
- [ ] Feature flags acceptable
- [ ] Regression plan sufficient
- [ ] Ready to implement

**Awaiting approval to proceed with implementation.**
