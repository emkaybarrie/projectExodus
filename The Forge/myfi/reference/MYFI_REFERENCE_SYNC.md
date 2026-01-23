# MyFi Reference Sync Contract

## Purpose
This document defines the two-way synchronisation rules between:
- the human-authored MyFi Master Reference (Word)
- the MyFi codebase
- the Forge automation layer

The goal is continuous alignment, not documentation.

---

## Source of Truth Rules

### Human Intent
- Authoritative source: MYFI_MASTER_REFERENCE.docx
- Applies to:
  - mission
  - ethics
  - behavioural intent
  - product direction
  - design tone
  - exploratory ideas

### Architectural Reality
- Authoritative source: the repo
- Applies to:
  - folder structure
  - runtime architecture
  - UI system mechanics
  - data flow
  - implemented constraints

If a conflict exists:
- Intent wins for *future work*
- Repo wins for *current state description*

Conflicts must be reconciled explicitly.

---

## Section Classification

Each section in the Master Reference is classified as one of:

- **Normative**
  - Must match implemented or agreed reality
  - Triggers reconciliation if out of sync

- **Descriptive**
  - Explains current reality
  - Must be kept up to date with repo

- **Exploratory**
  - Inspiration only
  - Never binding

This classification lives in MYFI_REFERENCE_INDEX.json.

---

## Change Detection & Response

### When the Word doc changes
Repo-aware agents must:
1. Update MYFI_REFERENCE_INDEX.json
2. Determine which sections changed
3. For each changed section:
   - Normative → emit Work Order (spec-sync or design delta)
   - Descriptive → check against repo and update wording if stale
   - Exploratory → optionally emit ideation Work Order

### When the repo changes materially
Repo-aware agents must:
1. Detect architectural drift
2. Update descriptive sections in the Word doc
3. Log the update in MYFI_CHANGELOG.md
4. If intent is violated, raise a conflict Work Order

---

## Automation Readiness

This contract is intentionally written so that future automation may:
- diff Word doc exports
- diff repo structure
- auto-generate reconciliation Work Orders
- surface design/code discrepancies

No automation may directly edit code based on the reference without a Work Order and approval.

---

## Director Override

The Director may:
- reclassify sections
- accept temporary divergence
- mark sections as intentionally aspirational

Such decisions must be recorded in MYFI_CHANGELOG.md.
