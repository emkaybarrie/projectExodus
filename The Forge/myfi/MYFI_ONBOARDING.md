# MyFi Onboarding to the Forge

## Purpose
This file defines how the MyFi product domain is registered inside the MyFi Forge as a first-class subject.

MyFi onboarding is considered complete only when:
1) The onboarding artifacts exist in `/myfi/`
2) The Director has validated them
3) A snapshot seal exists (MYFI_SNAPSHOT_SEAL.md)

## Required onboarding artifacts (minimum set)
- PRODUCT_STATE.md
- MYFI_CAPSULE.md
- MYFI_GLOSSARY.md
- MYFI_ARCHITECTURE_MAP.md
- MYFI_STATUS_MATRIX.md
- MYFI_VALIDATION_CHECKLIST.md
- MYFI_MANIFEST.json

## Living rules
- Product truth lives in `/myfi/`
- Institutional truth lives in `/forge/`
- Any agent resuming work must read:
  1) /forge/FORGE_CAPSULE.md
  2) /myfi/MYFI_CAPSULE.md
  3) /myfi/PRODUCT_STATE.md

## Update protocol
When any of the following happen, update PRODUCT_STATE.md and MYFI_STATUS_MATRIX.md:
- a system moves from conceptual → implemented
- a core invariant changes
- architecture changes materially
- demo readiness shifts

## Snapshot sealing
A “sealed snapshot” is created after Director validation:
- MYFI_SNAPSHOT_SEAL.md
This allows agents to know what the Director has explicitly confirmed.

## Next automation vector
Once sealed, a repo-aware Executor (Claude) can reconcile these artifacts against code and raise deltas as Work Orders.
