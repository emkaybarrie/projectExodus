# Chronicler Contract

Status: Canonical (FCL v2)
Last Updated: 2026-01-29
Scope: Defines the Chronicler cognitive routine for institutional memory

---

## Purpose

The Chronicler is the Forge's **institutional memory**. It records significant events, decisions, and observations to create a durable audit trail that survives device/context changes.

Think of Chronicler as the Forge's hippocampus — the keeper of institutional memory. It is not optional.

---

## Design Principles

1. **Persistent** — Chronicler data survives in-repo, not just localStorage
2. **Append-Only** — New entries are added; existing entries are immutable
3. **Shareable** — Non-repo-aware agents can read Chronicler output
4. **Timestamped** — Every entry has a precise timestamp
5. **Queryable** — Entries can be filtered by type, domain, timeframe

---

## Storage Location

**Canonical Path:** `The Forge/forge/exports/cognition/chronicler.jsonl`

Format: JSON Lines (one JSON object per line, append-friendly)

This file is:
- In the repo (survives device changes)
- In exports/ (consumable by non-repo agents via Share Pack)
- Append-only (immutable history)

---

## ChroniclerEntry Schema (v2.0.0)

```json
{
  "entryType": "ChroniclerEntry",
  "schemaVersion": "2.0.0",
  "id": "unique-entry-id",
  "timestamp": "ISO8601 timestamp",

  "eventType": "heartbeat | sentinel_warning | navigator_guidance | wo_transition | arc_change | risk_detected | manual_note | intent_created | intent_wo_spawned | intent_phase_change | intent_completed | intent_abandoned | gate_blocked",
  "domain": "system | workOrders | observations | risks | genome | agents | fsp | intents | gates",

  "summary": "one-line summary of the event",
  "details": {
    "key": "value pairs with event-specific data"
  },

  "context": {
    "activeArc": "arc at time of event",
    "fspVersion": "FSP version at time of event",
    "healthScore": "health score if available",
    "intentId": "DI-XXX-ID or null (FCL v2)",
    "woId": "FO-XXX-ID or null (FCL v2)",
    "phase": "lifecycle phase or null (FCL v2)"
  },

  "source": "heartbeat | sentinel | navigator | portal | manual | gate",
  "actor": "system | director | executor | agent-name"
}
```

**FCL v2 Context Fields (Additive):**

| Field | Type | Description |
|-------|------|-------------|
| `intentId` | string \| null | Director Intent ID if event relates to an Intent |
| `woId` | string \| null | Work Order ID if event relates to a WO |
| `phase` | string \| null | Lifecycle phase at time of event |

These fields are optional. Entries without them remain valid (backward compatibility).

---

## Event Types

### Core Event Types (v1)

| Event Type | When Recorded | Domain |
|------------|---------------|--------|
| **heartbeat** | Heartbeat completes | system |
| **sentinel_warning** | New warning detected | varies |
| **navigator_guidance** | Guidance generated | system |
| **wo_transition** | WO changes state | workOrders |
| **arc_change** | Active Arc modified | system |
| **risk_detected** | New risk surfaces | risks |
| **manual_note** | Director adds note | varies |

### Intent Event Types (FCL v2)

| Event Type | When Recorded | Domain |
|------------|---------------|--------|
| **intent_created** | New Director Intent created | intents |
| **intent_wo_spawned** | WO created from Intent | intents |
| **intent_phase_change** | Intent advances phase | intents |
| **intent_completed** | Intent marked complete | intents |
| **intent_abandoned** | Intent discontinued | intents |

### Gate Event Types (FCL v2)

| Event Type | When Recorded | Domain |
|------------|---------------|--------|
| **gate_blocked** | Gate check prevented action | gates |
| **gate_observed** | Gate check logged (observe mode) | gates |
| **gate_overridden** | Director override used | gates |

---

## Recording Rules

### What Gets Recorded (v1)

1. **Every Heartbeat run** — Summary of health + next move
2. **New warnings** — When Sentinel detects new issues
3. **Arc changes** — When Director changes Active Arc
4. **Manual notes** — When Director explicitly adds a note

### What Does NOT Get Recorded (v1)

- Every page load (too noisy)
- Every FSP read (too noisy)
- Detailed code changes (that's git's job)

---

## Entry ID Format

`chr-{timestamp}-{random4}`

Example: `chr-1706529600000-a7b2`

---

## Portal Integration

### Chronicler Panel

- Shows recent entries (last 10)
- Filterable by event type
- Expandable entry details
- "Add Note" button for Director

### Entry Display

Each entry shows:
- Timestamp (relative + absolute)
- Event type badge
- Summary text
- Expandable details

---

## Access Patterns

### Reading Chronicler

```javascript
// In Portal (via fetch)
const entries = await fetch(CHRONICLER_URL).then(r => r.text())
  .then(text => text.trim().split('\n').map(JSON.parse));

// Filter recent
const recent = entries.slice(-10);
```

### Writing Chronicler

**Portal cannot directly write to chronicler.jsonl** (no server-side write in v1).

Instead:
1. Portal queues entries in localStorage
2. Generate script or manual process appends to file
3. Future: GitHub Action or agent writes entries

### v1 Write Mechanism

For v1, Chronicler entries are:
1. Generated by Portal (in-memory)
2. Displayed in Portal
3. Queued in localStorage (`CHRONICLER_QUEUE_KEY`)
4. Flushed to file via script: `flush-chronicler.mjs`

This allows Portal to show entries while maintaining the repo-based persistence model.

---

## Flush Script

**Path:** `The Forge/forge/ops/scripts/flush-chronicler.mjs`

```bash
# Flush queued entries to chronicler.jsonl
node "The Forge/forge/ops/scripts/flush-chronicler.mjs"
```

The script:
1. Reads queued entries from a staging file
2. Appends to chronicler.jsonl
3. Clears the staging file

---

## Tone Guidelines

Chronicler entries should be:

### Factual
- "Heartbeat completed: 85/100, At Risk"
- "Navigator guidance: Address missing gates"
- "Arc changed: Reliability → Velocity"

### Not Judgmental
- ❌ "System failed health check"
- ✅ "Health score: 60/100, Warning status"

---

## What Chronicler Does NOT Do

1. **Does NOT create Work Orders** — Records only
2. **Does NOT mutate FSP** — Records FSP state, doesn't change it
3. **Does NOT change Active Arc** — Records arc changes
4. **Does NOT block execution** — Recording is passive
5. **Does NOT delete entries** — Append-only

---

## Retention Policy (v1)

- No automatic deletion
- Manual pruning via script if needed
- Consider archival strategy for v2

---

## Integration Points

- **Heartbeat** records completion entries
- **Sentinel** records new warnings
- **Navigator** records guidance events
- **Portal** displays + queues entries

---

## Cross-References

- [HEARTBEAT_CONTRACT.md](./HEARTBEAT_CONTRACT.md) — Source of heartbeat entries
- [SENTINEL_CONTRACT.md](./SENTINEL_CONTRACT.md) — Source of warning entries
- [NAVIGATOR_CONTRACT.md](./NAVIGATOR_CONTRACT.md) — Source of guidance entries
- [DIRECTOR_INTENT_CONTRACT.md](./DIRECTOR_INTENT_CONTRACT.md) — Source of intent events (FCL v2)

---

End of Contract.
