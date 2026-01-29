# Forge State Pack (FSP) Contract

Status: Canonical (FCL v2)
Last Updated: 2026-01-29
Scope: Defines the authoritative runtime state pack for agent context loading

---

## Purpose

The Forge State Pack (FSP) is the **single source of runtime truth** for Forge OS. All agents (human and AI) must load FSP before operating to understand:

- Current institutional priority (Active Arc)
- Work Order status and health
- Known risks and remediation paths
- Agent binding rules
- Genome classification

---

## Design Principles

1. **Authoritative** — FSP is the canonical runtime state; agent memory is not
2. **Explicit** — Missing data is declared, never inferred
3. **Loadable** — Consumable by repo-aware and non-repo-aware agents
4. **Observable** — Visible in Forge Portal (read-only v1)
5. **Generatable** — Can be refreshed on demand via `generate-fsp.mjs`

---

## Schema (v1.0.0)

```json
{
  "packType": "ForgeStatePack",
  "schemaVersion": "1.0.0",
  "generatedAt": "ISO8601 timestamp",
  "generatedBy": "generator identifier",
  "validUntil": "ISO8601 timestamp or null",
  "refreshTrigger": "description of how to refresh",

  "activeArc": {
    "current": "Reliability | Velocity | Delight",
    "setBy": "Director | System",
    "setAt": "ISO8601 timestamp",
    "expiresAt": "ISO8601 timestamp or null",
    "rationale": "human-readable reason"
  },

  "narrativeAnchors": [
    {
      "id": "anchor-id",
      "name": "Anchor Name",
      "description": "What this anchor prioritizes",
      "weight": 0.0-1.0,
      "active": true,
      "signals": ["signal.names", "that.feed.this.anchor"]
    }
  ],

  "workOrders": {
    "source": "data source path or 'unavailable'",
    "lastRefreshed": "ISO8601 timestamp or null",
    "total": 0,
    "byStatus": {
      "draft": 0,
      "approved": 0,
      "executing": 0,
      "executed": 0
    },
    "missingGates": [],
    "stuckWOs": []
  },

  "observations": {
    "env": "dev | prod",
    "smokePass": true,
    "timestamp": "ISO8601 timestamp",
    "commitShort": "7-char commit hash",
    "checksCount": 0
  },

  "risks": [
    {
      "id": "unique-risk-id",
      "category": "process | compliance | deployment | observability",
      "description": "human-readable description",
      "severity": "low | medium | high | critical",
      "detectedAt": "ISO8601 timestamp",
      "remediation": "suggested fix",
      "status": "detected | acknowledged | mitigated | resolved"
    }
  ],

  "genome": {
    "stable": ["list of stable artifact paths"],
    "experimental": ["list of experimental artifact paths"],
    "graduationPending": ["list of artifacts awaiting graduation"]
  },

  "intents": [
    {
      "id": "DI-XXX-ID",
      "title": "Intent title",
      "status": "active | completed | abandoned",
      "phase": "ideation | requirements | dissonance | design | execution | validation | finalisation | production | reflection",
      "classification": "feature | refactor | exploration | governance | evolution",
      "woCount": 0,
      "createdAt": "ISO8601 timestamp"
    }
  ],

  "agentBindingRules": [
    {
      "id": "rule-id",
      "rule": "Rule Name",
      "description": "What the rule requires",
      "enforcement": "mandatory | advisory"
    }
  ],

  "sourceRefs": {
    "sharePack": "path or null",
    "workOrders": "path or null",
    "observations": "path or null"
  }
}
```

---

## Active Arc

The Active Arc determines the current institutional priority bias.

### Arc Options

| Arc | Description | Signals |
|-----|-------------|---------|
| **Reliability** | Correctness, stability, process adherence | test.pass, gate.passed, smoke.pass |
| **Velocity** | Throughput, reduced ceremony where safe | wo.executed, cycle_time |
| **Delight** | UX polish, user-facing improvements | user.feedback, ux.improvement |

### Arc Behavior

- Default: **Reliability** (stabilization phase)
- Set by: Director only
- Duration: Until Director changes or expiry (if set)
- Effect: Guides Navigator prioritization and Sentinel thresholds

---

## Narrative Anchors

Anchors provide bounded steering for agent decisions. All three are always active but weighted differently based on Active Arc.

When Active Arc = X, anchor X gets weight 1.0; others get reduced weight (0.4-0.6).

---

## Work Order Status

FSP aggregates WO status from `work-orders.index.json`:

- **Total count** by status
- **Missing gates** — executed WOs without Continuation Contract
- **Stuck WOs** — WOs in same state > 7 days

This enables Sentinel to detect health issues without scanning individual WO files.

---

## Risks

Risks are automatically detected during FSP generation:

| Risk Type | Detection | Severity |
|-----------|-----------|----------|
| Stuck WOs | WO unchanged > 7 days | Medium/High |
| Missing gates | Executed WO lacks Continuation Contract | Medium |
| Stale observations | Observations > 48h old | Low |
| Smoke failures | Latest smokePass = false | High |

### Risk Lifecycle

1. **Detected** — Automatically found during FSP generation
2. **Acknowledged** — Director has seen and noted
3. **Mitigated** — Compensating action taken
4. **Resolved** — Root cause fixed, risk closed

---

## Genome Classification

### Stable Artifacts

Constitutional artifacts that have graduated to production stability:

- FORGE_KERNEL.md
- FORGE_STATE.md
- All contracts in `/contracts/`
- Core playbooks in `/ops/`

Changes to stable artifacts require Work Order with regression review.

### Experimental Artifacts

New features under observation (< 30 days or pending graduation):

- M3/M4 portal features
- New workflows
- FCL v1 cognition layer

Changes to experimental artifacts still require Work Order but have lighter review.

### Graduation

See [GENOME_CONTRACT.md](./GENOME_CONTRACT.md) for promotion process.

---

## Director Intents (FCL v2)

FSP includes active Director Intents for lifecycle visibility:

### Intent Summary Fields

| Field | Description |
|-------|-------------|
| `id` | Unique Intent identifier (DI-XXX format) |
| `title` | Short descriptive title |
| `status` | Current status (active/completed/abandoned) |
| `phase` | Current lifecycle phase |
| `classification` | Intent type (feature/refactor/etc.) |
| `woCount` | Number of spawned Work Orders |
| `createdAt` | When Intent was created |

### Inclusion Rules

FSP includes:
- All `active` Intents
- `completed` Intents from last 7 days
- `abandoned` Intents from last 7 days (for audit trail)

Full Intent details are in `intents.json`. FSP carries summary for runtime access.

### Default Behavior

If `intents` array is missing or empty:
- Portal renders normally (backward compatible)
- Navigator skips Intent-based prioritization
- Chronicler records events without `intentId` context

---

## Agent Binding Rules

All agents operating under Forge OS MUST follow these rules:

| Rule | Description | Enforcement |
|------|-------------|-------------|
| WIP Harvest | Surface all WIP before new work | Mandatory |
| No Implicit Context | Load from packs, not memory | Mandatory |
| Pack-Missing Stop | Stop and request if pack unavailable | Mandatory |
| Constitutional Binding | Forge Kernel is authoritative | Mandatory |
| Heartbeat Participation | Respond to Heartbeat requests | Mandatory |

Violation of mandatory rules is a process error surfaced by Reflex Rules.

---

## Generation

FSP is generated by `The Forge/forge/ops/scripts/generate-fsp.mjs`:

```bash
# From repo root
node "The Forge/forge/ops/scripts/generate-fsp.mjs"
```

Output: `The Forge/forge/exports/cognition/forge-state-pack.json`

### Generation Triggers

- **Manual:** Director request or session start
- **Heartbeat:** Part of Heartbeat routine (FCL-2)
- **Deploy:** Future: auto-generate on deploy

---

## Portal Visibility

FSP is displayed in Forge Portal:

- **Location:** Forge OS → FCL State Pack (new panel)
- **Mode:** Read-only (v1)
- **Refresh:** Manual button triggers re-fetch

---

## Cross-References

- [FORGE_KERNEL.md](../FORGE_KERNEL.md) — Constitutional law
- [WORK_ORDER_LIFECYCLE_CONTRACT.md](./WORK_ORDER_LIFECYCLE_CONTRACT.md) — WO state machine
- [REPORTING_SIGNALS_CONTRACT.md](./REPORTING_SIGNALS_CONTRACT.md) — Signal definitions

---

End of Contract.
