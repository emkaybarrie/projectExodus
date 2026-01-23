# Director Wizard Checklist — Claude Onboarding

## A) Preconditions
- [ ] /forge exists and contains canonical artifacts + FORGE_MANIFEST.json
- [ ] /myfi exists and contains MYFI_MANIFEST.json + PRODUCT_STATE.md
- [ ] /myfi/reference contains:
  - [ ] MYFI_MASTER_REFERENCE.docx
  - [ ] MYFI_REFERENCE_INDEX.json
  - [ ] MYFI_REFERENCE_SYNC.md
- [ ] /myfi/MYFI_SNAPSHOT_SEAL.md exists

## B) First-run parameters
- [ ] Mode: reconciliation-only
- [ ] Allowed outputs: Work Orders + discrepancy report only
- [ ] Write permissions: none (or only to /forge/work_orders as proposals)

## C) Run + Review
- [ ] Claude completes FIRST_MISSION_WORK_ORDER.md
- [ ] I review each proposed Work Order
- [ ] I approve/reject explicitly
- [ ] Only after approval do we grant implementation permissions
