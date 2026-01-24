# Work Order: FO-Forge-P2-Portal-WorkOrder-Control-Plane

## Title
Portal Work Order Control Plane (Read-Only + Triggers)

## Status
`executed`

## Lane
Forge

## Type
P2 — Portal Implementation (medium, bounded)

## Priority
High

## Summary
Extended the existing phone-native portal scaffolding to add a read-only Work Order control plane for both the Forante Portal and Entity Portals, enabling Directors and operators to view, understand, and initiate work without direct mutation of truth in the UI.

---

## Deliverables Completed

### D1: Work Order Data Integration
- Reads from `work-orders.index.json` (existing Share Pack export)
- No GitHub API calls introduced
- Index treated as authoritative read model

**Fields Used:**
- `id` — Work Order identifier
- `title` — Display title
- `status` — Current status (draft, pending-approval, approved, executed)
- `lastUpdated` — ISO timestamp
- `filePath` — Repo path to WO document
- `repoUrl` — GitHub URL to view document

### D2: Forante Portal — Work Orders View
- ✓ Lists all Work Orders across lanes
- ✓ Filtering by Lane (Forge, MyFi, etc.)
- ✓ Filtering by Status (All, Approved, Executed)
- ✓ WO cards display: ID, title, status badge, lane indicator, date
- ✓ Actions: Details, Copy Pack, Execute (if approved)
- ✓ Click card to open detail modal

### D3: Work Order Detail View
- ✓ Modal with WO ID, title, lane, status, last updated
- ✓ Link to open WO document
- ✓ Copy Agent Pack action
- ✓ Execute action (if approved)

### D4: Entity Portal (MyFi) — Derived View
- ✓ Shows only MyFi-scoped Work Orders (filtered by `-MyFi-` in ID)
- ✓ Reuses same card + detail components
- ✓ Trigger: "Propose MyFi Work" → GitHub Issue template
- ✓ Trigger: "Propose Forge Evolution" → GitHub Issue template

### D5: Navigation & UX
- ✓ Phone-first design
- ✓ Cards over tables
- ✓ Status visible at a glance
- ✓ Touch-friendly targets

---

## Files Changed

### Forante Portal
| File | Change |
|------|--------|
| `portal/app.js` | Added detail modal, copyAgentPack, showWoDetail, enhanced WO cards |
| `portal/styles.css` | Added modal overlay, WO detail styles, button variants |

### MyFi Entity Portal
| File | Change |
|------|--------|
| `portal/entity/myfi/myfi-app.js` | Added detail/agent pack functions, trigger buttons, enhanced Work tab |
| `portal/entity/myfi/myfi-styles.css` | Added trigger panel, status summary, toast, clickable card styles |

---

## Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| Director can see all current work from phone | ✓ |
| Director can understand what is in progress or blocked | ✓ |
| Director can navigate to Issues / PRs / Dev / Prod | ✓ (via WO doc links) |
| MyFi operator can see only MyFi work | ✓ |
| MyFi operator can propose new MyFi work | ✓ |
| MyFi operator can escalate Forge evolution requests | ✓ |
| No existing portal functionality broken | ✓ |

---

## Technical Notes

### Agent Pack Format
```markdown
# Agent Pack: {WO_ID}

## Work Order
- **ID:** {id}
- **Title:** {title}
- **Lane:** {lane}
- **Status:** {status}
- **Last Updated:** {lastUpdated}

## Source
- **Document:** {repoUrl}

## Instructions
Read the full Work Order at the source URL above for:
- Purpose / Intent
- Scope
- Acceptance Criteria
- Technical Notes

Execute according to EXECUTOR_PLAYBOOK.md protocol.
```

### Trigger URLs
- MyFi Work: `{REPO}/issues/new?template=forge_work_order.yml&title=[WO]+FO-MyFi-`
- Forge Evolution: `{REPO}/issues/new?template=forge_work_order.yml&title=[WO]+FO-Forge-`

---

## Non-Goals (Verified Not Implemented)
- No in-portal editing of Work Orders
- No approval buttons or permission system
- No GitHub authentication or API usage
- No change to Work Order execution flow

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-24 | WO created and executed |

---

End of Work Order.
