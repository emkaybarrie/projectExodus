# Sentinel Contract

Status: Canonical (FCL v1)
Last Updated: 2026-01-29
Scope: Defines the Sentinel cognitive routine for health monitoring

---

## Purpose

The Sentinel is the Forge's **health monitoring routine**. It continuously watches institutional signals and surfaces warnings when attention is needed.

Think of Sentinel as the Forge's immune system — always scanning, never acting unilaterally.

---

## Design Principles

1. **Observational** — Sentinel watches but does not act
2. **Derived** — Output is computed on demand from FSP + Observations
3. **Advisory** — Warnings are recommendations, not commands
4. **Accessible** — Status communicated via labels + icons, not just color
5. **Non-Blocking** — Sentinel findings do not halt work automatically

---

## Trigger Model (v1)

| Trigger | Mode |
|---------|------|
| On Heartbeat run | Sentinel is invoked as part of Heartbeat |
| On Portal load | Sentinel summary shown in Forge tab |
| Manual refresh | User clicks refresh in Sentinel panel |

Sentinel is **derived on demand** — no persistent storage required.

---

## SentinelReport Schema (v1.0.0)

```json
{
  "reportType": "SentinelReport",
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO8601 timestamp",

  "watchedDomains": [
    {
      "domain": "workOrders | observations | risks | genome | agents | fsp",
      "status": "clear | watching | warning | alert",
      "indicator": "human-readable description",
      "details": "optional additional context",
      "since": "ISO8601 timestamp or null"
    }
  ],

  "activeWarnings": [
    {
      "id": "unique-warning-id",
      "domain": "source domain",
      "level": "info | caution | warning | alert",
      "message": "advisory message",
      "suggestedAction": "what to consider",
      "detectedAt": "ISO8601 timestamp"
    }
  ],

  "overallStatus": "clear | watching | warning | alert",
  "warningCount": 0,
  "tone": "arc-aware contextual note"
}
```

---

## Status Levels

| Status | Meaning | Icon | Label |
|--------|---------|------|-------|
| **clear** | No issues detected | ● | Clear |
| **watching** | Minor items under observation | ◐ | Watching |
| **warning** | Issues detected, attention recommended | ◑ | Warning |
| **alert** | Significant issues, prompt attention needed | ○ | Alert |

Note: Icons + labels ensure accessibility without relying on color alone.

---

## Warning Levels

| Level | Meaning | Urgency |
|-------|---------|---------|
| **info** | Informational note | None |
| **caution** | Something to be aware of | Low |
| **warning** | Should be addressed | Medium |
| **alert** | Needs prompt attention | High |

---

## Watched Domains

| Domain | What Sentinel Monitors |
|--------|------------------------|
| **workOrders** | Stuck WOs, missing gates, flow health |
| **observations** | Smoke status, staleness, deployment health |
| **risks** | Active risks by severity |
| **genome** | Experimental drift, graduation backlog |
| **agents** | Binding rule compliance |
| **fsp** | FSP freshness and availability |

---

## Tone Guidelines

Sentinel language must be:

### Use These Phrases
- "Watching..."
- "Detected..."
- "Consider reviewing..."
- "May benefit from attention..."
- "Under observation..."

### Avoid These Phrases
- "Must fix..."
- "Blocked..."
- "Invalid..."
- "Failed..."
- "Error..."

---

## What Sentinel Does NOT Do

1. **Does NOT create Work Orders** — May suggest, never creates
2. **Does NOT mutate FSP** — Read-only access
3. **Does NOT change Active Arc** — Read-only
4. **Does NOT block execution** — Advisory only
5. **Does NOT persist** — Derived on demand each time

---

## Integration Points

- **Heartbeat** consumes Sentinel for health signals
- **Navigator** uses Sentinel warnings for prioritization input
- **Portal** displays Sentinel status in Forge tab

---

## Cross-References

- [HEARTBEAT_CONTRACT.md](./HEARTBEAT_CONTRACT.md) — Consumes Sentinel output
- [FORGE_STATE_PACK_CONTRACT.md](./FORGE_STATE_PACK_CONTRACT.md) — Primary input source
- [NAVIGATOR_CONTRACT.md](./NAVIGATOR_CONTRACT.md) — Uses Sentinel for prioritization

---

End of Contract.
