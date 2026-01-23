# Work Order: Claude First Mission — Repo ↔ Reference Reconciliation (Read-Only)

TASK ID: FO-Claude-01-Reconcile-MyFi-Reference
TASK TYPE: audit · spec-sync
INTENT: Detect and report discrepancies between MyFi reference truth and repo reality without changing code.
SCOPE:
- Compare /myfi/reference/MYFI_MASTER_REFERENCE.docx + MYFI_REFERENCE_INDEX.json against repo structure and current implementation.
- Focus on architecture, surfaces/slots/parts/journeys, and Hub mechanics declarations.
- Produce Work Orders only; no edits.

ALLOWED OUTPUTS:
- Discrepancy report (ranked by risk)
- Work Orders with:
  - exact file paths
  - suggested changes
  - success criteria
  - forbidden changes

FORBIDDEN:
- Any code changes
- Any refactors
- Any feature expansion
- Any rewriting normative intent without Director instruction

SUCCESS CRITERIA:
- A ranked discrepancy list exists
- Each discrepancy has a Work Order proposal
- No unauthorized changes were made
