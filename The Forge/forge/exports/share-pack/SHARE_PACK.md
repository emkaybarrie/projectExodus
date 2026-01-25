# Forge Share Pack

This folder contains a minimal, always-up-to-date snapshot of Forge + MyFi
for non-repo-aware agents.

---

## Governance Model

**Model 3: Forge as Institutional OS, MyFi as Flagship Entity**

- **Constitutional Layer:** Forante (steward company)
- **Institutional OS:** Forge (SDLC operating system)
- **Flagship Entity:** MyFi (Tier 2 integration, proving ground)

See: [Forante Kernel](../../../Forante/FORANTE_KERNEL.md) for full constitutional governance.

---

## Included files

### Forante Constitutional Layer
- FORANTE_KERNEL.md — Constitutional foundation, Model 3 declaration
- FORANTE_INDEX.md — Governance navigation and entry points
- ENTITY_CHARTER_TEMPLATE.md — Template for new Forge entities

### Forge Core
- FORGE_KERNEL.md — Canonical Forge governance kernel (aligned to Model 3)
- FORGE_CAPSULE.md — Forge summary capsule
- FORGE_STATE.md — Current Forge state, network state, and focus areas
- FORGE_INDEX.md — Forge navigation index
- CLAUDE_SYSTEM_PROMPT.md — Claude onboarding context

### Forge Operations
- OPERATING_MODEL_LANES.md — Parallel development lanes and precedence law
- EXECUTOR_PLAYBOOK.md — AI executor protocol

### MyFi Canonical Truth
- PRODUCT_STATE.md — Current product state and applied WOs
- MYFI_CAPSULE.md — MyFi summary capsule
- MYFI_STATUS_MATRIX.md — Feature/component status matrix
- MIGRATION_PARITY_MATRIX.md — Migration tracking
- MYFI_ARCHITECTURE_MAP.md — Architecture overview
- MYFI_GLOSSARY.md — Term definitions
- MYFI_MANIFEST.json — Product manifest
- MYFI_CHANGELOG.md — Change history
- MYFI_MASTER_REFERENCE.md — Master reference document

### MyFi Reference
- reference/MYFI_REFERENCE_INDEX.json — Reference index

### MyFi Specs
- specs/ — Surface and Parts contracts

### Work Orders
- ops/ — Canonical WO location (active)
- Work Orders/ — Legacy WOs
- work-orders/ — Orphan WOs (pending consolidation)

## Last updated
2026-01-25

## What changed since last update

### Session: Forge OS Role System & Reporter Infrastructure

**Work Orders Executed (this session):**

1. **FO-Forge-G1-ForgeOS-RoleSystem-v1** — Forge OS Role System v1
   - Created `contracts/FORGE_OS_ROLE_SYSTEM.md` (7 canonical roles)
   - Updated FORGE_KERNEL.md Section 2 with expanded role definitions
   - Added Section 2A Operating Modes (M1/M2/M3)
   - Updated FORGE_CAPSULE.md with role system table

2. **FO-Forge-R1-Reporter-Role-Definition** — Reporter Role Definition
   - Expanded FORGE_KERNEL.md Section 2.7 with full Reporter spec
   - Added primary consumers and explicit constraints

3. **FO-Forge-R2-Reporting-Signals-Contract** — Reporting Signals & Metrics Contract
   - Created `contracts/REPORTING_SIGNALS_CONTRACT.md`
   - Defined signal categories, time semantics, phase-aware tracking

4. **FO-Forge-R3-Reporter-Evolution-Feedback-Loop** — Reporter-Evolution Feedback Loop
   - Added FORGE_KERNEL.md Section 12A feedback loop definition
   - Updated FORGE_CAPSULE.md with evidence-driven learning cycle

**Previous Session Work Orders:**
- FO-Forge-P3-WorkOrder-Index-Enrichment — Schema extensions for WO traceability
- FO-Forge-C1-Constitutional-Updates — Added three constitutional laws
- PWA Setup — Forante Portal installable as PWA
- FO-Forge-P2-Portal-WorkOrder-Control-Plane — WO detail modal and agent pack copy
- FO-MyFi-P1-EntityPortal — MyFi entity portal implementation

## Current Governance State

| System | Status |
|--------|--------|
| Forge OS Role System | **7 canonical roles defined** |
| Operating Modes | M1/M2/M3 codified |
| Reporter Role | Fully specified |
| Reporting Signals Contract | Created |
| Reporter-Evolution Loop | Codified |
| Constitutional Laws | 3 laws active (Sections 11-13) |
| Work Order Index | Enrichment schema active |

## New Contracts

| Contract | Purpose |
|----------|---------|
| FORGE_OS_ROLE_SYSTEM.md | Roles, authority, operating modes |
| REPORTING_SIGNALS_CONTRACT.md | Signal categories, time semantics |
| WORK_ORDER_INDEX_CONTRACT.md | WO schema and enrichment rules |

## MyFi Product State (unchanged)

| System | Status |
|--------|--------|
| Hub Surface | Phase 1 complete |
| StatusBar Part | Implemented |
| VitalsHUD Part | Implemented |
| EncounterWindow Part | Implemented (idle placeholder) |
| Journey Runner | Implemented |
| Modal Manager | Implemented |

## How this is maintained
- Repo-aware agents regenerate this after:
  - reference updates
  - architecture changes
  - approved Work Orders
