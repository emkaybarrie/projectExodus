# Labels Required for Forge Automation

## Status
**Canonical** — Keep this file updated as the single source of truth for Forge labels.

---

## Label Lifecycle

```
┌─────────────────┐     ┌──────────┐     ┌────────────────────┐
│ pending-approval│ ──► │ approved │ ──► │ ready-for-executor │
└─────────────────┘     └──────────┘     └────────────────────┘
                                                   │
                                                   ▼
                              ┌───────────┐   ┌───────────┐
                              │ executing │ ──│ executed  │
                              └───────────┘   └───────────┘
                                   │
                                   ▼ (if blocked)
                              ┌─────────┐
                              │ blocked │
                              └─────────┘
```

---

## Required Labels

### Core Workflow Labels

| Label | Color | Description | Applied By |
|-------|-------|-------------|------------|
| `work-order` | `#7057ff` (purple) | Forge Work Order | Issue template (auto) |
| `pending-approval` | `#fbca04` (yellow) | Awaiting Director approval | Issue template (auto) |
| `approved` | `#0e8a16` (green) | Work Order approved for execution | Director (manual) |

### Execution Queue Labels

| Label | Color | Description | Applied By |
|-------|-------|-------------|------------|
| `ready-for-executor` | `#1d76db` (blue) | Queued for Claude execution | `/execute` workflow |
| `executing` | `#5319e7` (violet) | Currently being executed | Claude agent |
| `executed` | `#0e8a16` (green) | Execution complete, PR created | Claude agent |
| `blocked` | `#d93f0b` (red) | Execution blocked, needs attention | Claude agent |

---

## How to Create Labels

1. Go to: https://github.com/emkaybarrie/projectExodus/labels
2. Click "New label"
3. Enter name, description, and color
4. Click "Create label"

**Quick Create (gh CLI):**
```bash
gh label create "ready-for-executor" --color "1d76db" --description "Queued for Claude execution"
gh label create "executing" --color "5319e7" --description "Currently being executed"
gh label create "executed" --color "0e8a16" --description "Execution complete, PR created"
gh label create "blocked" --color "d93f0b" --description "Execution blocked, needs attention"
```

---

## Workflow States

### 1. Creation → Approval
1. Director creates Work Order via Issue Form
2. Auto-labeled: `work-order` + `pending-approval`
3. Director reviews → removes `pending-approval`, adds `approved`

### 2. Execution Trigger
1. Director comments `/execute` on approved WO
2. Workflow validates: has `approved`, no `pending-approval`
3. Workflow applies `ready-for-executor` label
4. Workflow posts **EXECUTION PACK** comment

### 3. Claude Execution
1. Claude picks up WO from executor queue (filter: `ready-for-executor`)
2. Claude applies `executing`, removes `ready-for-executor`
3. Claude executes Work Order per spec
4. On success: applies `executed`, removes `executing`
5. On block: applies `blocked`, keeps `executing` for visibility

### 4. Executor Queue View
Filter URL: `is:issue is:open label:ready-for-executor`

---

## Portal Integration

The Forge Portal displays status chips based on labels:
- 🟡 `pending-approval` → Yellow chip
- 🟢 `approved` → Green chip
- 🔵 `ready-for-executor` → Blue chip
- 🟣 `executing` → Violet chip
- ✅ `executed` → Green check chip
- 🔴 `blocked` → Red chip

---

**Created by**: FO-Forge-S3-Execute-Loop-Mobile-Repo-Agent
**Updated**: 2026-01-24
