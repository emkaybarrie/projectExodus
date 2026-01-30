# MyFi Master Reference

**Status:** Canonical (Markdown)
**Last Updated:** 2026-01-30
**Related Docs:** MYFI_CAPSULE.md, MYFI_ARCHITECTURE_MAP.md

---

## 1. Product Overview

MyFi is a gamified behavioural finance system. Real-world spending and budgeting are mapped into RPG-like energy resources and progression.

### Core Resources (Vitals)
- **Health** — survival / emergency buffer
- **Mana** — intentional power spending
- **Stamina** — day-to-day flexible spending
- **Essence** — long-term savings/investment potential (ethical, ring-fenced)

---

## 2. Architecture Summary

MyFi is built using:
- **Surfaces** — screen/modal definitions
- **Slots** — layout regions within surfaces
- **Parts** — reusable UI units
- **Contracts** — locked baseline + controlled uplift zones
- **Journeys** — thin orchestration scripts across surfaces

Canonical implementation: `ProjectMyFi_vLatest/`

---

## 3. Stage Narrative System (Live Comic Timeline)

The **Stage** is a Live Comic Timeline where real-world financial signals trigger **Incident Episodes** that snap the visual narrative into meaningful scenes.

### 3.1 Core Concepts

| Concept       | Description                                                           |
|---------------|-----------------------------------------------------------------------|
| **Signal**    | External/internal trigger (transaction, anomaly, threshold, schedule) |
| **Incident**  | Planned narrative moment with visual tokens and mechanics             |
| **Episode**   | Runtime execution: Setup → Active → Resolution → Aftermath            |
| **Timeline**  | Rolling list of rendered panels representing resolved Episodes        |

### 3.2 Episode Flow

```
Signal → Incident Factory → Episode Runner
                               ↓
                    [Slow-Time Overlay]
                     ↓ player    ↓ timeout
                   Choice    Autopilot
                        ↘    ↙
                      Resolution
                          ↓
                    episode:resolved
```

### 3.3 Renderer-Swappable Design

The narrative data drives multiple renderers:
1. **Layered Diorama Renderer (v1)** — background + actors + props + effects
2. Optional AI-generated panels (future)
3. Real-time engine (future)

### 3.4 Minimal Schemas

**Signal:**
```js
{ id, kind, atMs, sourceRef, payload }
```

**Incident:**
```js
{ id, atMs, kind, requiredTokens, tone, mechanics, taggingPrompt, narrative, renderPlan }
```

**DioramaSpec:**
```js
{ seed, region, state, timeOfDay, background, actors, props, effects, camera }
```

**Episode:**
```js
{ id, incidentId, phase, startedAtMs, resolvedAtMs, resolution }
```

### 3.5 Asset Pipeline

```
assets/art/stage/
  backgrounds/{region}/
  actors/{players|enemies|npcs}/{id}/
  props/{id}/
  effects/{id}/
```

Missing assets render a "veil" placeholder and log a warning.

### 3.6 ActionBus Events

| Event              | Purpose                           |
|--------------------|-----------------------------------|
| `stage:signal`     | Injects a Signal into the Stage   |
| `episode:resolved` | Emits outcome for vitals/tagging  |

**Full specification:** See `forge/ops/reference/STAGE_EPISODES_SPEC_V1.md`

---

## 4. Hub Surface

The Hub is the canonical anchor screen with:
- **PlayerHeader** — avatar, vitals bars, essence
- **BadlandsStage** — live comic timeline / encounter area
- **Footer** — navigation orb and action buttons

---

## 5. Cross-References

| Document                          | Purpose                              |
|-----------------------------------|--------------------------------------|
| `MYFI_CAPSULE.md`                 | Portable product context             |
| `MYFI_ARCHITECTURE_MAP.md`        | Architecture orientation             |
| `STAGE_EPISODES_SPEC_V1.md`       | Full Stage narrative system spec     |
| `specs/surfaces/HUB_SURFACE_SPEC.md` | Hub surface specification         |
| `specs/parts/contracts/*.md`      | Part contracts                       |

---

## 6. Change Log

See `MYFI_CHANGELOG.md` for full history.

| Date       | WO ID                | Summary                                          |
|------------|----------------------|--------------------------------------------------|
| 2026-01-30 | WO-STAGE-EPISODES-V1 | Added Stage Narrative System (Live Comic Timeline) |
| 2026-01-22 | —                    | Initial MyFi Master Reference created            |
