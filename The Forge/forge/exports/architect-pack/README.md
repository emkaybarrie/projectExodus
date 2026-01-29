# Architect Pack — Mobile-Native Forge Workflow
**Generated:** 2026-01-28
**Purpose:** Context files for Director refinement session

---

## HOW TO USE THIS PACK

### Step 1: Start with the Session Prompt
Open `FO-Forge-M3-Director-Session-Prompt.md` — this contains:
- 10 structured decision menus
- Recommendations for each option
- Post-refinement action checklist

### Step 2: Reference the Full WO Pack
Open `FO-Forge-M3-Mobile-Workflow-Pack.md` for detailed specifications of all 12 proposed Work Orders.

### Step 3: Consult Context Files as Needed
Use the supporting files below when the Director needs context on existing systems.

---

## FILE MANIFEST

### Primary Session Files
| File | Description |
|------|-------------|
| `FO-Forge-M3-Director-Session-Prompt.md` | **START HERE** — Director refinement menus |
| `FO-Forge-M3-Mobile-Workflow-Pack.md` | Full WO pack with 12 work orders |

### Governance & Contracts
| File | Description |
|------|-------------|
| `FORGE_KERNEL.md` | Forge constitutional law |
| `E2E_WORKFLOW_PLAYBOOK.md` | 9-phase E2E workflow model |
| `WORK_ORDER_LIFECYCLE_CONTRACT.md` | WO state machine definition |
| `EXECUTOR_PLAYBOOK.md` | Agent execution protocol |

### Current Implementation
| File | Description |
|------|-------------|
| `portal-app.js` | Current Forante Portal implementation |
| `SHARE_PACK.md` | Current share pack manifest |
| `work-orders.index.json` | WO index schema (26 WOs tracked) |
| `environments.json` | Dev/Prod environment configuration |

### Workflows
| File | Description |
|------|-------------|
| `forge-pages-deploy.yml` | GitHub Pages deployment workflow |
| `forge-wo-execute.yml` | WO execution trigger workflow |
| `forge_work_order.yml` | GitHub Issue template for WOs |

---

## QUICK START PROMPT

Copy this to initiate the Architect session:

```
I need you to act as Architect for a Director refinement session.

Please review these files from the attached pack:
1. FO-Forge-M3-Director-Session-Prompt.md (session guide)
2. FO-Forge-M3-Mobile-Workflow-Pack.md (full WO pack)

Reference the other files for context on existing systems as needed.

Then guide me (Director) through the 10 decision menus to refine the
Mobile-Native Forge Workflow implementation plan.

Start with Menu 1: Scope Confirmation.
```

---

## DECISION SUMMARY (10 Menus)

1. **Scope** — Which phases to include
2. **Authentication** — PAT vs OAuth vs Copy-only
3. **Agent Integration** — Depth of non-repo agent support
4. **Observations** — Ephemeral vs persisted
5. **WO Form** — Minimal vs standard vs enhanced
6. **Deployment** — View-only vs full triggers
7. **Evolution** — Include or defer
8. **Priority** — Execution order
9. **Testing** — Required gates before prod
10. **Rollout** — All-at-once vs incremental

---

## EXPECTED OUTPUT

After completing all menus, the Architect should produce:
1. Refined WO pack with Director selections applied
2. Execution order with dependencies
3. Deferred WO list for follow-up
4. Executor handoff prompt
