

<!-- ---FILE: ARCHITECTURE.md -->
# MyFi Forge v1 — Architecture Constitution

## The spine (do not drift)
MyFi is built around:
1) **VM (view model)** — the only source of UI truth.
2) **Surfaces (screens/modals)** — JSON composition only (shell + placements).
3) **Parts** — self-contained UI units (baseline locked + uplift CSS).
4) **Journeys** — thin orchestration (navigate + call actions).

## Rules
- Parts MUST NOT fetch data directly. They read VM slices only.
- Surfaces MUST NOT contain logic. Only declare what part goes in what slot with what slicePath.
- Every Part MUST have:
  - contract.json (hooks required, actions allowed, slots if any)
  - baseline.html (CONTRACT markers)
  - part.js (wiring, reads hooks, calls actions)
  - uplift.css (styling, safe to modify)
- Runtime MUST fail loudly:
  - missing part/surface/contract shows an in-UI error card and console error
- Validator enforces:
  - manifest references real files
  - required hooks exist in baseline
  - snapshots are up-to-date

## Naming
- Part IDs are PascalCase (EmptyCard, HubShell).
- Surface IDs are short lowercase (hub, quests).
- Journey IDs are namespaced (hub.openHub, quests.claimReward).

## Slots
- Shell parts define slots using [data-slot="..."] elements.
- Surface placements target slots by name.

## Pack output convention (v1+)
- All AI-generated packs MUST be delivered as **one file per snippet**.
- Each snippet begins with `---FILE: <path>`.
