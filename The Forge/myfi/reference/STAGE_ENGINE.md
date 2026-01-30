# Stage Engine Reference (WO-S3)

## Overview

The Stage Engine manages incident lifecycles, episodes, and rendering states.
This document covers the Stage Mode system added in WO-S3.

---

## Canonical Auto-Resolve Incident Model (Combat Reference)

> Combat encounters define the baseline incident lifecycle.
> All non-engaged incidents must conform to this model.
> Future systems must extend, NOT replace, this model.

### Definition

An **auto-resolve incident** is defined as an incident that:
1. Is active on the Stage
2. Visibly ticks toward resolution (timer/progress bar)
3. Updates vitals during resolution
4. Does **NOT** require player input

### Player Options

The player may:
- **Ignore it entirely** — Auto-resolve completes automatically
- **Engage at any time** — Transition to interactive mode

### Key Principle

Engagement is a **mode transition**, not a different incident:
- Does NOT create a new incident
- Does NOT reset timing (unless explicitly designed to)
- Simply transitions rendering + input handling

### Implementation

This model is implemented in `episodeRunner.js` and must NOT be duplicated.

---

## Stage Modes (WO-S3)

**Feature Flag:** `__MYFI_DEV_CONFIG__.enableStageModes`

### Purpose

Makes Stage rendering modes **explicit but derived** (not authoritative).
This is a clarification layer, NOT a rewrite.

### Mode Enum

```javascript
STAGE_MODES = {
  TRAVEL: 'travel',           // Default: No incident
  INCIDENT_OVERLAY: 'incident_overlay',  // Auto-resolve in progress
  INTERACTIVE: 'interactive'  // Player engaged
}
```

### Critical Constraints

1. **Modes are DERIVED, not CONTROLLING**
   - They reflect existing state
   - They do NOT drive transitions

2. **Modes never gate logic**
   - STAGE_MODE must never prevent existing behaviour
   - It's for observation/debugging only

3. **No side effects**
   - `deriveStageMode()` is a pure function
   - Reading mode never changes state

### Derivation Logic

```javascript
function deriveStageMode({ hasActiveScene, isPlayerEngaged }) {
  if (!hasActiveScene) return TRAVEL;
  if (isPlayerEngaged) return INTERACTIVE;
  return INCIDENT_OVERLAY;
}
```

---

## Episode Phases

Existing phases (unchanged):

| Phase     | Description                    |
|-----------|--------------------------------|
| setup     | Incident entry, prepare visuals|
| active    | Overlay shown, timer running   |
| resolving | Resolution display             |
| after     | Aftermath, cleanup             |

---

## Mechanic Modes

Existing modes (unchanged):

| Mode       | Description                    |
|------------|--------------------------------|
| autobattler| Combat handled by autobattler  |
| choice     | Player tagging/categorization  |
| turn       | Turn-based interaction         |
| timing     | QTE-style timing challenges    |

---

## Files

- `src/systems/stageModeSystem.js` — Mode derivation (WO-S3)
- `src/systems/episodeRunner.js` — Episode lifecycle (existing)
- `src/systems/stageSignals.js` — Signal ingestion (existing)
- `src/core/stageSchemas.js` — Data schemas (existing)

---

## Guardrails

Per WO-S3 specification:

1. **Existing logic UNCHANGED**
   - Incident spawn logic
   - Overlay rendering
   - CTA behaviour
   - Vitals ticking

2. **Combat encounters remain canonical**
   - There must NOT be:
     - A new auto-resolve engine
     - A second ticking system
     - A parallel overlay renderer

3. **Modes are read-only**
   - Never drive transitions
   - Never gate rendering
   - Pure observation layer

---

*Last Updated: WO-S3 Implementation*
