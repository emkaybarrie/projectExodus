# Delta Report: Diorama Compositor System

**Date:** 2026-01-31
**Scope:** Narrative Stage Asset System — From Single Images → Layered Plates with Auto-Fallback

---

## Executive Summary

The current asset routing system is **folder-based with static fallback chains**. It lacks recipe-based selection, layering, tag/weight constraints, and auto-resolution. To achieve the target "procedural diorama compositor" model, we need to evolve the manifest schema, implement a smart resolver, and add optional layering support — all while maintaining 100% backward compatibility.

---

## Part A: Delta Assessment

### 1. Capability Gap

| Capability | Current State | Target State | Gap |
|------------|---------------|--------------|-----|
| **Selection Model** | Folder-based + random pick | Recipe-based with constraints | 🔴 Major |
| **Tags/Weights** | None | Per-asset metadata for filtering | 🔴 Major |
| **Constraints** | None | Disqualifiers, must-have, intensity scaling | 🔴 Major |
| **Layering** | Single background image only | Background + hero + enemy + VFX + grade | 🔴 Major |
| **Grade Profiles** | Not supported | Ambient color grading, overlays | 🟡 Medium |
| **Repetition Avoidance** | None (pure random) | LRU cache, cooldown tracking | 🟡 Medium |
| **Deterministic Replay** | Logs exist but no seed/hash | Seeded selection + replay buffer | 🟡 Medium |

**Current Selection Logic (BadlandsStage/part.js:191-233):**
```javascript
// Purely folder-based: tries paths in order until manifest found
for (let i = 0; i < paths.length; i++) {
  const backgrounds = await loadRoutedManifest(paths[i], baseUrl);
  if (backgrounds && backgrounds.length > 0) {
    const randomIndex = Math.floor(Math.random() * backgrounds.length);
    return { url: backgrounds[randomIndex], ... };
  }
}
```

**What's Missing:**
- No recipe input (tags, mood, intensity)
- No scoring/ranking of candidates
- No constraint filtering
- No layer composition
- Selection cannot be replayed (no seed)

---

### 2. Fallback Gap

| Aspect | Current | Target | Gap |
|--------|---------|--------|-----|
| **Path Chain** | Static array (4 levels max) | Dynamic probe-and-score | 🟡 Medium |
| **Manifest Requirement** | Required at each level | Auto-search available assets | 🔴 Major |
| **Single → Plates** | Not supported | Graceful degradation | 🔴 Major |
| **Global Default** | Hardcoded per beat type | Single global manifest fallback | 🟢 Minor |
| **Caching** | Per-path manifest cache | Availability index + scoring cache | 🟡 Medium |

**Current Fallback Chain (assetRoutingSchema.js:153-184):**
```
1. {beatType}/{phase}/{region}/  → e.g., combat/focus/center/
2. {beatType}/{phase}/           → e.g., combat/focus/
3. {beatType}/                   → e.g., combat/
4. idle/                         → ultimate fallback
5. legacy folders                → patrol/, explore/, etc.
```

**Problem:** Requires manifest.json at each level to be considered valid. If `combat/focus/center/manifest.json` doesn't exist, it's skipped entirely — no partial matching.

**Target Behavior:**
- Probe what's available (cache availability)
- Score candidates by dimension match (beatType=10, phase=5, region=2)
- Select best available, not just first found
- Fall back to layers → single image → global default

---

### 3. File/Schema Gap

**Current Manifest (simple array):**
```json
{
  "backgrounds": ["wardwatch-combat-01.png", "wardwatch-combat-02.png"]
}
```

**Target Manifest (extended, backwards compatible):**
```json
{
  "version": 2,
  "backgrounds": ["legacy-bg-01.png"],
  "items": [
    {
      "id": "combat-intense-01",
      "filename": "wardwatch-combat-01.png",
      "tags": ["dark", "intense", "forest"],
      "weight": 2,
      "constraints": {
        "minIntensity": 3,
        "timeBuckets": ["night", "dusk"],
        "excludeWith": ["calm"]
      }
    }
  ],
  "layers": {
    "background": ["bg-forest-01.png", "bg-mountain-01.png"],
    "hero": ["hero-warrior-idle.png", "hero-warrior-combat.png"],
    "enemy": ["enemy-goblin.png", "enemy-troll.png"],
    "vfx": ["vfx-dust.png", "vfx-embers.png"],
    "foreground": ["fg-grass-01.png"],
    "grade": ["grade-warm.json", "grade-cold.json"]
  },
  "defaults": {
    "timeBucket": "day",
    "intensity": 2
  }
}
```

**Backward Compatibility:** If only `backgrounds` exists, treat as V1 (current behavior).

---

### 4. Routing/Rules Gap

**Current Dimensions (3):**
| Dimension | Source | Used For |
|-----------|--------|----------|
| beatType | incidentKindToBeatType() | Primary folder |
| activityPhase | episodeRouter state | Subfolder |
| region | regionMap in buildRenderPlan | Sub-subfolder |

**Proposed Additions (V1 minimal):**
| Dimension | Source | Purpose |
|-----------|--------|---------|
| timeBucket | episodeClock.getState() | dawn/morning/day/dusk/night |
| intensityTier | incident.mechanics.difficulty | 1-5 scale for asset intensity |

**Proposed Future (V2+):**
| Dimension | Source | Purpose |
|-----------|--------|---------|
| biome | worldTopology (if enabled) | forest/desert/mountain/swamp |
| mood | tone.mood from incidentFactory | calm/tense/dire |
| heroId | loadout system | Avatar variant |
| enemyId | incident._enemy.kind | Enemy sprite variant |

**Recommendation:** Add timeBucket + intensityTier in V1; defer biome/mood/hero/enemy to V2+.

---

## Part B: Implementation Waves

### Wave 0: Foundation (Non-Breaking)
- Extend manifest schema (keep backward compatible)
- Add manifest version detection
- Create availability index builder

### Wave 1: Smart Resolver
- Implement "best available match" resolution
- Add scoring algorithm
- Cache availability index
- Emit debug events for resolver decisions

### Wave 2: Progressive Enhancement
- Support `items[]` with tags/weights
- Implement constraint filtering
- Add repetition avoidance (LRU)

### Wave 3: Layered Composition
- Support `layers{}` section
- Implement canvas/CSS composition
- Graceful degradation: layers → items → backgrounds

### Wave 4: Advanced Features (Future)
- Seeded selection for replay
- Biome/mood dimensions
- Hero/enemy plates
- Grade profiles

---

## Recommended V1 Scope

Focus on **Waves 0-2** for V1:
1. Extended manifest schema (backwards compatible)
2. "Best available match" resolver
3. Auto-fallback without requiring all manifests
4. Optional tags/weights
5. Repetition avoidance
6. Dev visibility improvements

Defer **Wave 3 (layering)** to V1.5 or V2 — it requires more significant rendering changes.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Regression in stable build | Feature flag: `enableDioramaV2` |
| Performance impact | Cache availability index at startup |
| Schema migration | Auto-detect version; V1 manifests work unchanged |
| Dev confusion | Clear docs + console warnings for missing assets |

---

## Files to Modify

| File | Changes |
|------|---------|
| `assetRoutingSchema.js` | Add dimensions, scoring weights, schema types |
| `BadlandsStage/part.js` | Replace static resolver with smart resolver |
| `stageSchemas.js` | Extend DioramaSpec with recipe fields |
| `incidentFactory.js` | Add timeBucket, intensityTier to routing context |
| `assetPreflight.js` | Integrate with availability index |
| `devRenderInspector.js` | Add resolver decision logging |
| **New:** `dioramaResolver.js` | Smart resolver implementation |
| **New:** `dioramaManifest.js` | Manifest loading + version detection |

---

## Success Criteria

1. ✅ With only `idle/manifest.json` + 1 png, stage renders and never crashes
2. ✅ With only `combat/manifest.json` + 2 png, combat encounters render correctly
3. ✅ No requirement to create manifests at every specificity level
4. ✅ Current folders/manifests remain valid without modification
5. ✅ Dev inspector shows resolver decision path
6. ✅ Repetition avoided within 5-asset window
