📦 HUB_PARTS_INDEX.md

Status: Canonical Spec (C2 Output)
Audience: Director, Architect, Executor, Implementers
Purpose: List required Parts for Hub surface slots with data hooks and actions

---

## 1. Overview

This document indexes the Parts required to populate the Hub surface.

Each Part entry defines:
- **Purpose**: What the Part does
- **Slot**: Where it mounts
- **Data Hooks**: What data it receives from the view model
- **Actions**: What user interactions it may trigger
- **Phase 1 Status**: Whether a placeholder is acceptable

Detailed Part contracts (baseline HTML, uplift zones, full hook schemas) are defined in separate contract files under C3.

---

## 2. Required Parts

### 2.1 VitalsHUD

| Property | Value |
|----------|-------|
| **Part ID** | `VitalsHUD` |
| **Purpose** | Display financial health readout (H/M/S/Essence bars) |
| **Slot** | `vitalsHud` |
| **Category** | `prefab` (composite Part) |
| **Phase 1** | Required — must render bars |

#### Data Hooks

| Hook | Type | Description |
|------|------|-------------|
| `vitals.health` | `{ current: number, max: number, delta?: number }` | Health pool state |
| `vitals.mana` | `{ current: number, max: number, delta?: number }` | Mana pool state |
| `vitals.stamina` | `{ current: number, max: number, delta?: number }` | Stamina pool state |
| `vitals.essence` | `{ current: number, softCap?: number, accrual?: number }` | Essence accumulation |
| `viewMode` | `'daily' \| 'weekly'` | Current display period |
| `payCycle.anchor` | `number` (timestamp) | Pay cycle start reference |

#### Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| `setViewMode` | User toggles view | Switch between daily/weekly |
| `openVitalDetail` | User taps a bar | Open detail modal for that Vital (optional) |

#### Notes

- Bars must be visually distinct (colour-coded)
- View mode toggle must be accessible
- Responsive to data updates (real-time refresh)

---

### 2.2 StatusBar

| Property | Value |
|----------|-------|
| **Part ID** | `StatusBar` |
| **Purpose** | Display player state (Verified/Unverified, pay cycle) |
| **Slot** | `statusBar` |
| **Category** | `primitive` |
| **Phase 1** | Required — must show mode indicator |

#### Data Hooks

| Hook | Type | Description |
|------|------|-------------|
| `mode` | `'verified' \| 'unverified'` | Current player mode |
| `payCycle.dayOfCycle` | `number` (optional) | Current day in cycle |
| `payCycle.daysRemaining` | `number` (optional) | Days until cycle reset |

#### Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| `openModeInfo` | User taps mode indicator | Show info about current mode (optional) |

#### Notes

- Verified mode: indicate real data connection
- Unverified mode: indicate demo/manual mode with guardrail hint
- Pay cycle display is optional for Phase 1

---

### 2.3 EncounterWindow

| Property | Value |
|----------|-------|
| **Part ID** | `EncounterWindow` |
| **Purpose** | Display autobattler zone / ambient encounters |
| **Slot** | `encounterWindow` |
| **Category** | `prefab` (composite Part) |
| **Phase 1** | Placeholder acceptable |

#### Data Hooks (Phase 2+)

| Hook | Type | Description |
|------|------|-------------|
| `encounter.active` | `Encounter \| null` | Currently displayed encounter |
| `encounter.queue` | `Encounter[]` | Upcoming encounters |
| `encounter.state` | `'idle' \| 'active' \| 'resolved'` | Encounter lifecycle |

#### Actions (Phase 2+)

| Action | Trigger | Effect |
|--------|---------|--------|
| `engage` | User taps encounter | Escalate to turn-based mode |
| `dismiss` | User swipes/ignores | Mark encounter as passed (if applicable) |

#### Phase 1 Acceptance

For Phase 1, this Part may:
- Render a placeholder card ("Encounters coming soon")
- Display a static visual representing the concept
- Accept no data hooks (hardcoded placeholder)

**Constraint:** The Part must be structurally mountable. The slot must exist in the surface.

#### Notes

- Autobattler runs without player input (ambient)
- Engagement escalates to turn-based (separate surface/modal)
- Gameplay mechanics are NOT defined in this spec

---

## 3. Optional/Future Parts

These Parts are not required for Phase 1 but may be added later:

| Part ID | Purpose | Slot | Status |
|---------|---------|------|--------|
| `QuickActions` | Shortcut buttons (add spend, view log) | `chrome:footer` or inline | Deferred |
| `AvatarBadge` | Player identity indicator | `chrome:header` | Deferred |
| `NotificationTray` | Alerts and reminders | TBD | Deferred |

---

## 4. Part Contract Structure (Reference)

Each Part in the canonical rebuild follows this contract structure:

```
/src/parts/{PartName}/
├── contract.json      # Hooks, slots, actions, notes
├── baseline.html      # Locked structure (CONTRACT:BASELINE)
├── uplift.css         # Allowed styling zone
├── part.js            # Mount/unmount logic
└── prompt.md          # AI guidance for uplift (optional)
```

Detailed contracts are defined in Work Order C3 (Vitals Parts Contracts).

---

## 5. Data Flow Summary

```
┌─────────────────┐
│   View Model    │  ← Feature Pack provides data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Hub Surface   │  ← Surface wires data to slots
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
┌────────┐ ┌────────┐ ┌────────────┐
│StatusBar│ │VitalsHUD│ │EncounterWindow│
└────────┘ └────────┘ └────────────┘
    │         │            │
    ▼         ▼            ▼
  Render    Render       Render
```

---

## 6. Success Criteria

Parts implementation satisfies this index when:

- [ ] VitalsHUD Part exists and mounts to `vitalsHud` slot
- [ ] VitalsHUD renders H/M/S/Essence bars
- [ ] VitalsHUD responds to viewMode changes
- [ ] StatusBar Part exists and mounts to `statusBar` slot
- [ ] StatusBar shows Verified/Unverified indicator
- [ ] EncounterWindow Part exists and mounts to `encounterWindow` slot
- [ ] EncounterWindow renders (placeholder acceptable Phase 1)
- [ ] All Parts have contract.json files

---

## 7. Related Artifacts

| Artifact | Relationship |
|----------|--------------|
| HUB_SURFACE_SPEC.md | Defines slot layout this index populates |
| MYFI_GLOSSARY.md | Defines Vitals semantics (H/M/S/Essence) |
| C3 Work Order | Creates detailed Part contracts |
| MIGRATION_PARITY_MATRIX.md | Validates required capabilities |

---

End of Hub Parts Index.
