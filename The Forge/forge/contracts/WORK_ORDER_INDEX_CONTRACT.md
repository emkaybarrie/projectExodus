# Work Order Index Contract

Status: Canonical
Last Updated: 2026-01-25
Scope: Schema definition for `work-orders.index.json`

---

## Purpose

The Work Order index (`exports/share-pack/work-orders.index.json`) is the **authoritative read model** for Work Order state across the Forge system. This contract defines its schema, enrichment rules, and compatibility requirements.

---

## Design Principles

1. **Portals render what exists** — they do not infer or require fields
2. **Agents populate what happens** — execution metadata is agent-written
3. **All enrichment fields are optional** — backward compatibility is mandatory
4. **No mass rewriting** — historical entries remain valid as-is

---

## Schema Definition

### Root Object

```json
{
  "generated": "ISO 8601 timestamp",
  "commit": "short commit hash",
  "workOrders": [ /* array of Work Order entries */ ],
  "counts": {
    "total": number,
    "draft": number,
    "pendingApproval": number,
    "approved": number,
    "executed": number
  }
}
```

### Work Order Entry

| Field | Type | Required | Populated By | Description |
|-------|------|----------|--------------|-------------|
| `id` | string | **Yes** | Human | Work Order identifier (e.g., `FO-Forge-P3`) |
| `title` | string | **Yes** | Human | Display title |
| `status` | string | **Yes** | Human/Agent | Current status (see Status Values) |
| `lastUpdated` | string | **Yes** | System | ISO 8601 date of last modification |
| `filePath` | string | **Yes** | System | Repo-relative path to WO document |
| `repoUrl` | string | **Yes** | System | GitHub URL to view WO document |
| `lane` | string | No | Human | Lane identifier (Forge, MyFi, Forante) |
| `entity` | string | No | Human | Entity scope (null if cross-entity) |
| `issueUrl` | string | No | Agent | GitHub Issue URL if exists |
| `prUrl` | string | No | Agent | GitHub PR URL if exists |
| `deploy` | object | No | Agent | Deployment URLs (see Deploy Object) |
| `agent` | object | No | Agent | Execution provenance (see Agent Object) |

### Status Values

| Status | Description |
|--------|-------------|
| `draft` | Work Order created, not yet submitted |
| `pending-approval` | Submitted for Director review |
| `approved` | Director approved, ready for execution |
| `executing` | Agent currently working |
| `executed` | Work complete, acceptance criteria met |
| `blocked` | Execution halted due to dependency or issue |

### Deploy Object (Optional)

```json
{
  "dev": "https://...dev URL...",
  "prod": "https://...prod URL..."
}
```

Both fields are optional. Presence indicates deployment relevance.

### Agent Object (Optional)

```json
{
  "type": "repo-agent | cloud-agent | local-agent",
  "name": "agent identifier (e.g., claude, cursor)",
  "mode": "cloud | local | hybrid"
}
```

| Field | Description |
|-------|-------------|
| `type` | Category of agent that executed the WO |
| `name` | Specific agent identifier |
| `mode` | Execution environment |

---

## Example Entry (Enriched)

```json
{
  "id": "FO-Forge-P3-WorkOrder-Index-Enrichment",
  "title": "Work Order Index Enrichment",
  "lane": "Forge",
  "entity": null,
  "status": "executed",
  "lastUpdated": "2026-01-25T00:00:00.000Z",
  "filePath": "The Forge/forge/work-orders/FO-Forge-P3-WorkOrder-Index-Enrichment.md",
  "repoUrl": "https://github.com/emkaybarrie/projectExodus/blob/main/The%20Forge/forge/work-orders/FO-Forge-P3-WorkOrder-Index-Enrichment.md",
  "issueUrl": null,
  "prUrl": null,
  "deploy": {
    "dev": "https://emkaybarrie.github.io/projectExodus/dev/The%20Forge/forge/portal/",
    "prod": "https://emkaybarrie.github.io/projectExodus/The%20Forge/forge/portal/"
  },
  "agent": {
    "type": "cloud-agent",
    "name": "claude",
    "mode": "cloud"
  }
}
```

---

## Example Entry (Minimal / Legacy)

```json
{
  "id": "FO-MyFi-C1-Resolve-Codebase-Fragmentation",
  "title": "FO-MyFi-C1-Resolve-Codebase-Fragmentation",
  "status": "executed",
  "lastUpdated": "2026-01-21T00:00:00.000Z",
  "filePath": "The Forge/forge/Work Orders/FO-MyFi-C1-Resolve-Codebase-Fragmentation.md",
  "repoUrl": "https://github.com/emkaybarrie/projectExodus/blob/main/The%20Forge/forge/Work%20Orders/FO-MyFi-C1-Resolve-Codebase-Fragmentation.md"
}
```

This entry is valid. Missing fields are treated as `undefined`.

---

## Portal Compatibility Rules

Portals **must**:
- Tolerate missing optional fields
- Render links only if URLs are present and non-null
- Not fail if `lane`, `entity`, `deploy`, or `agent` are absent

Portals **must not**:
- Require enrichment fields for basic display
- Assume all entries have GitHub Issue/PR links

---

## Migration Rules

1. **Existing entries remain valid** — no schema-breaking changes
2. **New fields are additive** — portals ignore unknown fields gracefully
3. **No mass rewrite** — historical data is enriched only when touched
4. **Agents enrich on execution** — provenance added when WO is executed

---

## Refresh Script Compatibility

The `refresh-share-pack.mjs` script:
- Preserves all existing fields when regenerating the index
- Does not strip enrichment fields
- Adds system-generated fields (`filePath`, `repoUrl`, `lastUpdated`)

---

## Cross-References

- [FORGE_INDEX.md](../FORGE_INDEX.md) — Forge navigation
- [SHARE_PACK.md](../exports/share-pack/SHARE_PACK.md) — Share Pack specification
- [EXECUTOR_PLAYBOOK.md](../ops/EXECUTOR_PLAYBOOK.md) — Agent execution protocol

---

End of Contract.
