# Navigator Contract

Status: Canonical (FCL v1)
Last Updated: 2026-01-29
Scope: Defines the Navigator cognitive routine for prioritization guidance

---

## Purpose

The Navigator is the Forge's **prioritization routine**. It synthesizes signals from FSP, Sentinel, and Work Orders to recommend where attention should flow next.

Think of Navigator as the Forge's prefrontal cortex — weighing options, suggesting direction, never commanding.

---

## Design Principles

1. **Synthesizing** — Navigator combines multiple signal sources
2. **Derived** — Output is computed on demand, not stored
3. **Transparent** — Shows inputs used to reach guidance
4. **Arc-Aligned** — Recommendations respect Active Arc bias
5. **Single Focus** — One primary recommendation, alternatives noted

---

## Trigger Model (v1)

| Trigger | Mode |
|---------|------|
| On Heartbeat run | Navigator produces Next Move |
| Manual request | User clicks "Get Guidance" in Navigator panel |
| Session start | Navigator summary shown on Portal load |

Navigator is **derived on demand** — no persistent storage required.

---

## NavigatorGuidance Schema (v1.0.0)

```json
{
  "guidanceType": "NavigatorGuidance",
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO8601 timestamp",

  "inputsUsed": {
    "fspVersion": "FSP schema version",
    "fspGeneratedAt": "FSP timestamp",
    "activeArc": "current arc",
    "sentinelWarnings": 0,
    "approvedWOs": 0,
    "stuckWOs": 0,
    "activeRisks": 0
  },

  "primaryRecommendation": {
    "action": "recommended action phrase",
    "rationale": "why this is recommended",
    "arc_alignment": "how this aligns with Active Arc",
    "priority": "immediate | soon | when_available",
    "confidence": "high | medium | low"
  },

  "alternativesConsidered": [
    {
      "action": "alternative action",
      "reason_not_primary": "why this ranked lower"
    }
  ],

  "workOrderSuggestions": [
    {
      "type": "repair | enhancement | investigation",
      "title": "suggested WO title",
      "rationale": "why this WO might help",
      "draft": false
    }
  ],

  "arcContext": {
    "current": "Reliability | Velocity | Delight",
    "influence": "how arc influenced this guidance"
  },

  "tone": "advisory framing"
}
```

---

## Input Sources

| Source | What Navigator Reads |
|--------|---------------------|
| **FSP** | Active Arc, WO status, risks, genome |
| **Sentinel** | Current warnings and status |
| **Work Orders** | Approved queue, stuck items |
| **Observations** | Deployment health |

Navigator explicitly shows `inputsUsed` so guidance is traceable.

---

## Priority Determination

Navigator ranks candidates using:

1. **Severity** — Degraded > At Risk > Healthy
2. **Arc Alignment** — Higher weight for arc-matching domains
3. **Recency** — Recent issues prioritized
4. **Dependency** — Blocking issues prioritized

### Arc Influence on Prioritization

| Arc | Emphasis |
|-----|----------|
| **Reliability** | Process compliance, test health, risk mitigation |
| **Velocity** | WO throughput, unblocking, reduced ceremony |
| **Delight** | UX improvements, polish, user-facing items |

---

## Confidence Levels

| Level | Meaning |
|-------|---------|
| **high** | Clear signal, strong recommendation |
| **medium** | Multiple factors, reasonable recommendation |
| **low** | Ambiguous signals, tentative suggestion |

---

## Work Order Suggestions

Navigator may suggest (but never create) Work Orders:

| Type | Purpose |
|------|---------|
| **repair** | Fix detected issues |
| **enhancement** | Improve based on observations |
| **investigation** | Explore unclear situations |

These are **structured suggestions**, not drafts. They require Director approval to become actual WOs.

---

## Tone Guidelines

Navigator language must be:

### Use These Phrases
- "Consider focusing on..."
- "Based on current signals..."
- "Under [Arc], this aligns with..."
- "The following may benefit from attention..."
- "Guidance suggests..."

### Avoid These Phrases
- "You must..."
- "Required..."
- "Blocked until..."
- "Failed..."
- "Invalid..."

---

## What Navigator Does NOT Do

1. **Does NOT create Work Orders** — Suggests only
2. **Does NOT mutate FSP** — Read-only
3. **Does NOT change Active Arc** — Read-only
4. **Does NOT block execution** — Advisory only
5. **Does NOT persist** — Derived on demand

---

## Integration Points

- **Heartbeat** uses Navigator for Next Move
- **Sentinel** provides health signals to Navigator
- **Portal** displays Navigator guidance panel

---

## Cross-References

- [HEARTBEAT_CONTRACT.md](./HEARTBEAT_CONTRACT.md) — Uses Navigator output
- [SENTINEL_CONTRACT.md](./SENTINEL_CONTRACT.md) — Provides input signals
- [FORGE_STATE_PACK_CONTRACT.md](./FORGE_STATE_PACK_CONTRACT.md) — Primary data source

---

End of Contract.
