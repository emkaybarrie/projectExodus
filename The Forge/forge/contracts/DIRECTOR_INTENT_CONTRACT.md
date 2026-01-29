# Director Intent Contract

Status: Canonical (FCL v2)
Last Updated: 2026-01-29
Scope: Defines the Director Intent entity as the root of the Forge lifecycle

---

## Purpose

A Director Intent is the **first-class representation of a Director's idea**. It is the root entity from which Work Orders spawn and through which the full lifecycle can be traced.

**Without an Intent, there is no strategic context. With an Intent, every WO has a home.**

---

## Design Principles

1. **Root of Truth** — Intent is the origin of all downstream work
2. **Forward-Only** — Intents are created for new work, not backfilled
3. **Phase-Tracked** — Intent moves through lifecycle phases
4. **WO-Spawning** — Intents spawn WOs, not the reverse
5. **Optional Adoption** — WOs may exist without Intent (legacy compatibility)

---

## DirectorIntent Schema (v1.0.0)

```json
{
  "intentType": "DirectorIntent",
  "schemaVersion": "1.0.0",
  "id": "DI-{timestamp}-{random}",
  "createdAt": "ISO8601 timestamp",
  "createdBy": "director",

  "title": "short title (max 80 chars)",
  "narrative": "1-3 paragraphs describing the intent",
  "successSignals": ["bullet points defining success"],
  "riskFlags": ["optional risk indicators"],

  "classification": "feature | refactor | exploration | governance | evolution",
  "status": "active | completed | abandoned",
  "phase": "ideation | requirements | dissonance | design | execution | validation | finalisation | production | reflection",

  "spawnedWOs": ["FO-XXX-ID", "FO-YYY-ID"],

  "metadata": {
    "updatedAt": "ISO8601 timestamp",
    "completedAt": "ISO8601 timestamp | null",
    "abandonedAt": "ISO8601 timestamp | null",
    "abandonReason": "string | null"
  }
}
```

---

## Field Definitions

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | **Yes** | Unique identifier: `DI-{timestamp}-{random4}` |
| `createdAt` | string | **Yes** | ISO 8601 creation timestamp |
| `createdBy` | string | **Yes** | Always `"director"` |
| `title` | string | **Yes** | Short descriptive title |
| `narrative` | string | **Yes** | 1-3 paragraphs of intent description |
| `successSignals` | array | **Yes** | Bullet points defining what success looks like |
| `riskFlags` | array | No | Optional risk indicators |

### Classification

| Value | Description |
|-------|-------------|
| `feature` | New functionality or capability |
| `refactor` | Code restructuring without behavior change |
| `exploration` | Research or investigation |
| `governance` | Process or policy change |
| `evolution` | Forge OS improvement |

### Status

| Status | Description |
|--------|-------------|
| `active` | Intent is being worked on |
| `completed` | All success signals achieved |
| `abandoned` | Intent discontinued (reason required) |

### Phase (Lifecycle Position)

| Phase | Description | Typical Activity |
|-------|-------------|------------------|
| `ideation` | Initial capture | Director drafts narrative |
| `requirements` | WO generation | Architect creates WOs |
| `dissonance` | Conflict detection | System checks for conflicts |
| `design` | Prototyping | Design artifacts created |
| `execution` | Implementation | Executors working on WOs |
| `validation` | Verification | Verifier-Tester reviewing |
| `finalisation` | Documentation | Closure and CC completion |
| `production` | Deployment | Released to production |
| `reflection` | Synthesis | Lessons learned captured |

---

## Intent ID Format

`DI-{timestamp}-{random4}`

- `DI` — Director Intent prefix
- `{timestamp}` — Unix timestamp in milliseconds
- `{random4}` — 4-character random hex string

Example: `DI-1706529600000-a7b2`

---

## Lifecycle Rules

### Creation

1. Director initiates new Intent via Portal
2. Must provide: title, narrative, successSignals
3. Classification defaults to `feature` if not specified
4. Status starts as `active`
5. Phase starts as `ideation`

### Phase Progression

```
ideation → requirements → dissonance → design →
execution → validation → finalisation → production → reflection
```

- Phases can only advance forward (no regression)
- Phase skip requires Director override (M2/M3)
- Phase is determined by most advanced spawned WO

### WO Spawning

1. Intent spawns WOs during `requirements` phase
2. WOs are linked via `intentId` field
3. Intent tracks all spawned WOs in `spawnedWOs` array
4. WO completion advances Intent phase automatically

### Completion

1. All spawned WOs reach `executed` status
2. All success signals have evidence
3. Director marks Intent as `completed`
4. `metadata.completedAt` is set

### Abandonment

1. Director decides to discontinue
2. Must provide `abandonReason`
3. All active WOs should be closed or reassigned
4. `metadata.abandonedAt` is set

---

## Storage

### Canonical Path

`The Forge/forge/exports/cognition/intents.json`

```json
{
  "intentsType": "DirectorIntentIndex",
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO8601",
  "intents": [ /* array of DirectorIntent objects */ ],
  "counts": {
    "total": 0,
    "active": 0,
    "completed": 0,
    "abandoned": 0
  }
}
```

### FSP Integration

FSP includes `intents` section for runtime access:

```json
{
  "intents": [
    {
      "id": "DI-XXX",
      "title": "...",
      "status": "active",
      "phase": "execution",
      "woCount": 3
    }
  ]
}
```

---

## Portal Integration

### Intent Creation Flow

1. Director taps "New Intent" on mobile
2. Fills: title, narrative, success signals
3. Optional: classification, risk flags
4. Submits → Intent created in `ideation` phase

### Intent Dashboard

- List of active Intents
- Phase ribbon showing current position
- Linked WOs with status
- Success signal checklist

### Phase Cockpit

Each phase has a mini-view showing:
- Current phase activities
- Blocking gates (if any)
- Next phase requirements

---

## Chronicler Integration

Intent lifecycle events are recorded:

| Event Type | When Recorded |
|------------|---------------|
| `intent_created` | New Intent created |
| `intent_wo_spawned` | WO created from Intent |
| `intent_phase_change` | Intent advances phase |
| `intent_completed` | Intent marked complete |
| `intent_abandoned` | Intent discontinued |

All Chronicler entries for Intent include `intentId` in context.

---

## Gate Integration

Intents participate in gate checks:

| Gate | Condition |
|------|-----------|
| `canSpawnWO` | Intent must be in `requirements` phase or later |
| `canAdvancePhase` | All WOs in current phase must be complete |
| `canComplete` | All success signals must have evidence |
| `canAbandon` | Director override required |

---

## What Intent Does NOT Do

1. **Does NOT replace WOs** — Intent contains WOs, not replaces them
2. **Does NOT auto-create WOs** — WO creation is explicit
3. **Does NOT enforce phase order on WOs** — WOs have their own lifecycle
4. **Does NOT block legacy WOs** — WOs without Intent remain valid

---

## Cross-References

- [WORK_ORDER_INDEX_CONTRACT.md](./WORK_ORDER_INDEX_CONTRACT.md) — WO `intentId` field
- [WORK_ORDER_LIFECYCLE_CONTRACT.md](./WORK_ORDER_LIFECYCLE_CONTRACT.md) — WO phase definitions
- [CHRONICLER_CONTRACT.md](./CHRONICLER_CONTRACT.md) — Intent event recording
- [FORGE_STATE_PACK_CONTRACT.md](./FORGE_STATE_PACK_CONTRACT.md) — FSP intent section

---

End of Contract.
