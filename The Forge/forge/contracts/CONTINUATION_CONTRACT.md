# Continuation Contract

Status: Canonical (FCL v1)
Last Updated: 2026-01-29
Scope: Defines mandatory completion metadata for executed Work Orders

---

## Purpose

A Continuation Contract is the **mandatory completion record** attached to every executed Work Order. It captures:

- What was the outcome?
- What follow-up work emerged?
- What was learned?

**Without a Continuation Contract, a Work Order is not considered complete by Forge.**

This is not advisory. This is structural enforcement.

---

## Design Principles

1. **Mandatory** — Every executed WO must have a Continuation Contract
2. **Structural** — Absence triggers Reflex Rule warnings
3. **Minimal** — Captures essential closure, not verbose documentation
4. **Traceable** — Links to follow-up WOs and learnings
5. **Machine-Readable** — Consumable by Sentinel and Navigator

---

## Why This Matters

Work Orders that execute without closure create:
- **Silent gaps** — No one knows what happened
- **Lost learnings** — Insights evaporate
- **Orphaned follow-ups** — Next steps are never captured
- **Audit failures** — No trail of institutional memory

The Continuation Contract prevents these failure modes.

---

## Continuation Contract Schema (v1.0.0)

```json
{
  "contractType": "ContinuationContract",
  "schemaVersion": "1.0.0",
  "woId": "FO-XXX-ID",
  "completedAt": "ISO8601 timestamp",
  "completedBy": "executor identifier",

  "outcome": {
    "status": "success | partial | blocked | abandoned",
    "summary": "one-line outcome description",
    "details": "optional expanded context"
  },

  "followUp": {
    "required": true | false,
    "items": [
      {
        "type": "wo_draft | investigation | monitor | none",
        "title": "follow-up title",
        "rationale": "why this follow-up exists",
        "priority": "immediate | soon | backlog",
        "linked_wo_id": "FO-XXX-ID or null"
      }
    ]
  },

  "learnings": {
    "captured": true | false,
    "items": [
      {
        "type": "process | technical | institutional",
        "insight": "what was learned",
        "action": "how this should influence future work"
      }
    ]
  },

  "verification": {
    "tested": true | false,
    "testMethod": "how verification was done",
    "evidence": "link or description of evidence"
  },

  "metadata": {
    "executionDuration": "optional duration string",
    "blockers_encountered": ["list of blockers if any"],
    "dependencies_discovered": ["list of dependencies if any"]
  }
}
```

---

## Outcome Statuses

| Status | Meaning | Follow-up Required? |
|--------|---------|---------------------|
| **success** | All acceptance criteria met | Optional |
| **partial** | Some criteria met, others blocked | Yes |
| **blocked** | Could not proceed due to blockers | Yes |
| **abandoned** | Deliberately stopped (with reason) | Depends |

---

## Follow-up Types

| Type | Description |
|------|-------------|
| **wo_draft** | A new Work Order should be created |
| **investigation** | Something needs exploration |
| **monitor** | Watch for a condition over time |
| **none** | No follow-up needed |

---

## Learning Types

| Type | Description |
|------|-------------|
| **process** | How we work (Forge/workflow improvement) |
| **technical** | Code/architecture insight |
| **institutional** | Org-level pattern or anti-pattern |

---

## Enforcement Model

### Structural Rule

> A Work Order in `executed` status WITHOUT a Continuation Contract is **incomplete**.

This is not a suggestion. This is a Forge invariant.

### Enforcement Mechanism (v1)

1. **Sentinel Detection** — Sentinel checks executed WOs for CC presence
2. **Reflex Warning** — Missing CC triggers Reflex Rule `RR-CC-MISSING`
3. **Repair Draft** — Reflex Rule generates draft repair WO
4. **Portal Visibility** — WO cards show CC status badge

### Future Enforcement (v2+)

- Block promotion to `observed` without CC
- Auto-prompt Executor for CC at execution end
- CI/CD gate requiring CC for deployment

---

## Attachment Method (v1)

In v1, Continuation Contracts are stored as:

1. **Comment on WO Issue** — For GitHub Issues-based WOs
2. **Section in WO File** — For file-based WOs
3. **Indexed in FSP** — `fsp.workOrders.missingGates` tracks WOs without CC

### Example: WO File Section

```markdown
## Continuation Contract

**Completed:** 2026-01-29T15:00:00Z
**Outcome:** success
**Summary:** All acceptance criteria met. Feature deployed to dev.

### Follow-up
- [ ] Monitor performance for 48h (monitor)

### Learnings
- Process: The E2E playbook step for verification was unclear; consider expanding.

### Verification
- Tested: Yes
- Method: Manual smoke test + automated suite
- Evidence: CI run #1234
```

---

## Minimal Valid Continuation Contract

At minimum, a CC must include:

```json
{
  "contractType": "ContinuationContract",
  "schemaVersion": "1.0.0",
  "woId": "FO-XXX-ID",
  "completedAt": "ISO8601",
  "completedBy": "executor",
  "outcome": {
    "status": "success | partial | blocked | abandoned",
    "summary": "what happened"
  }
}
```

Everything else is optional but encouraged.

---

## Portal Integration

### WO Card Display

Each WO card shows:
- **CC Present:** Green checkmark badge
- **CC Missing:** Amber warning badge + "Missing CC"
- **CC Required:** (for executed WOs) Red indicator

### Reflex Panel

Missing CCs appear in the Reflex Warnings panel with:
- Which WO is missing CC
- Link to add CC
- Repair WO draft available

---

## Cross-References

- [WORK_ORDER_LIFECYCLE_CONTRACT.md](./WORK_ORDER_LIFECYCLE_CONTRACT.md) — WO state machine
- [REFLEX_RULES_CONTRACT.md](./REFLEX_RULES_CONTRACT.md) — Enforcement rules
- [FORGE_STATE_PACK_CONTRACT.md](./FORGE_STATE_PACK_CONTRACT.md) — FSP tracks missing gates

---

End of Contract.
