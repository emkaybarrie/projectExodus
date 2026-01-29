# Heartbeat Contract

Status: Canonical (FCL v1)
Last Updated: 2026-01-29
Scope: Defines the Heartbeat routine for institutional health assessment

---

## Purpose

The Heartbeat is the Forge's **periodic health assessment routine**. It reads the current Forge State Pack and produces:

1. **Integrity Report** — Diagnostic summary of system health
2. **Next Move** — Single recommended action based on current state

Heartbeat is **interpretation, not action**. It observes and advises; it does not mutate.

---

## Design Principles

1. **Read-Only** — Heartbeat may read FSP but never writes to it
2. **Advisory** — Output is recommendation, not command
3. **Narrative-Aware** — Framing respects Active Arc context
4. **Single Focus** — One Next Move, not a list of demands
5. **Non-Blocking** — Heartbeat findings do not halt work automatically

---

## Trigger Model (v1)

| Trigger | Mode | Implementation |
|---------|------|----------------|
| Manual | Director clicks "Run Heartbeat" | Portal button |
| Session Start | Agent loads Heartbeat on init | Future (v2) |
| Scheduled | Cron/workflow triggers | Future (v3) |

**v1 is manual-only.** No automated execution.

---

## Integrity Report Schema (v1.0.0)

```json
{
  "reportType": "IntegrityReport",
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO8601 timestamp",
  "fspVersion": "FSP schema version used",
  "fspGeneratedAt": "FSP generation timestamp",

  "activeArc": {
    "current": "Reliability | Velocity | Delight",
    "coherent": true | false,
    "note": "optional contextual note"
  },

  "healthSignals": [
    {
      "domain": "workOrders | observations | risks | genome | agents",
      "status": "healthy | at_risk | degraded",
      "indicator": "human-readable description",
      "details": "optional additional context"
    }
  ],

  "riskSummary": {
    "total": 0,
    "bySeverity": {
      "critical": 0,
      "high": 0,
      "medium": 0,
      "low": 0
    },
    "topRisk": {
      "id": "risk-id or null",
      "description": "risk description or null"
    }
  },

  "overallHealth": "healthy | at_risk | degraded",
  "healthScore": 0-100,
  "tone": "narrative framing based on Active Arc"
}
```

---

## Health Signal Domains

| Domain | What It Assesses | Healthy When |
|--------|------------------|--------------|
| **workOrders** | WO flow and completeness | No stuck WOs, gates present |
| **observations** | Deployment health | Smoke pass, recent timestamp |
| **risks** | Risk backlog | No critical/high unmitigated |
| **genome** | Artifact stability | No unexpected experimental drift |
| **agents** | Agent binding compliance | Rules acknowledged |

---

## Health Status Levels

| Status | Meaning | Portal Color |
|--------|---------|--------------|
| **healthy** | No issues detected | Green |
| **at_risk** | Issues detected, not blocking | Amber |
| **degraded** | Significant issues, attention needed | Red |

---

## Next Move Schema (v1.0.0)

```json
{
  "moveType": "NextMove",
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO8601 timestamp",

  "recommendation": {
    "action": "short action phrase",
    "rationale": "why this is recommended",
    "arc_alignment": "how this aligns with Active Arc",
    "priority": "immediate | soon | when_available"
  },

  "context": {
    "triggeredBy": "signal or condition that surfaced this",
    "alternatives_considered": 0,
    "confidence": "high | medium | low"
  },

  "tone": "advisory framing"
}
```

---

## Next Move Priority Levels

| Priority | Meaning | Suggested Timing |
|----------|---------|------------------|
| **immediate** | Address before other work | Next action |
| **soon** | Address within current session | Before session end |
| **when_available** | Address when convenient | Backlog-worthy |

---

## Tone Guidelines (Critical)

Heartbeat language must be:

### Use These Phrases
- "Detected..."
- "At risk of..."
- "Recommended next move..."
- "Under [Arc], this suggests..."
- "Consider..."
- "May benefit from..."

### Avoid These Phrases
- "Must..."
- "Blocked..."
- "Invalid..."
- "Required..."
- "Failed..."
- "Error..."

### Arc-Aware Framing

| Arc | Tone Emphasis |
|-----|---------------|
| **Reliability** | "Stability suggests...", "To maintain correctness..." |
| **Velocity** | "To reduce friction...", "For faster throughput..." |
| **Delight** | "For improved experience...", "To enhance polish..." |

---

## What Heartbeat Does NOT Do

1. **Does NOT write Work Orders** — It may recommend, Director creates
2. **Does NOT update FSP** — FSP is updated by its own generator
3. **Does NOT change Active Arc** — Only Director sets Arc
4. **Does NOT block execution** — Findings are advisory
5. **Does NOT run automatically (v1)** — Manual trigger only

---

## Portal Integration

### Trigger Location
- Forge tab → "Run Heartbeat" button in FSP panel

### Output Display
- Integrity Report panel (expandable)
- Next Move card (prominent)
- Health score badge
- Signal indicators by domain

### Persistence
- Results stored in `localStorage` for session continuity
- Cleared on page refresh or manual clear
- No server-side storage (v1)

---

## Heartbeat Algorithm (v1)

```
1. Load current FSP
2. If FSP unavailable → return error state

3. Assess health signals:
   a. workOrders: Check stuck WOs, missing gates
   b. observations: Check smoke status, staleness
   c. risks: Count by severity, identify top risk
   d. genome: Check experimental drift
   e. agents: Verify binding rules present

4. Compute overall health:
   - All healthy → "healthy"
   - Any at_risk → "at_risk"
   - Any degraded → "degraded"

5. Compute health score:
   - Start at 100
   - Deduct per signal: degraded=-20, at_risk=-10

6. Generate Next Move:
   a. Rank all detected issues by severity × arc-alignment
   b. Select top candidate
   c. Frame in advisory tone
   d. Include arc context

7. Return IntegrityReport + NextMove
```

---

## Cross-References

- [FORGE_STATE_PACK_CONTRACT.md](./FORGE_STATE_PACK_CONTRACT.md) — Input data source
- [FORGE_KERNEL.md](../FORGE_KERNEL.md) — Constitutional authority
- [REPORTING_SIGNALS_CONTRACT.md](./REPORTING_SIGNALS_CONTRACT.md) — Signal definitions

---

End of Contract.
