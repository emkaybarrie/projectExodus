🎯 HUB_SURFACE_SPEC.md

Status: Canonical Spec (C2 Output)
Audience: Director, Architect, Executor, Implementers
Purpose: Define the Hub surface composition under Surfaces/Slots/Parts architecture

---

## 1. Hub Purpose Statement

The Hub is the **Spirit Hub** — the heart of the MyFi player experience.

It serves as:
- The primary **financial health readout** (Vitals HUD)
- The **home screen** players return to between activities
- The entry point to the **interaction depth continuum**
- A persistent anchor for player identity and state awareness

The Hub is NOT:
- A gameplay surface (no combat mechanics defined here)
- A transaction entry screen (that's a modal or separate flow)
- The Badlands (action layer is a separate surface)

---

## 2. Interaction Depth Model (Hub Boundary)

MyFi uses a layered interaction model:

```
┌─────────────────────────────────────────────────────────┐
│  HUD (passive)     │  Player observes financial state  │ ← Hub: vitalsHud slot
├─────────────────────────────────────────────────────────┤
│  Autobattler       │  Ambient encounters run; player   │ ← Hub: encounterWindow slot
│  (ambient)         │  watches but doesn't control      │
├─────────────────────────────────────────────────────────┤
│  Turn-based        │  Player engages; tactical choices │ ← Escalation (modal/surface)
│  (engaged)         │                                   │
├─────────────────────────────────────────────────────────┤
│  Badlands          │  Full action gameplay             │ ← Separate surface (Phase 2+)
│  (action layer)    │                                   │
└─────────────────────────────────────────────────────────┘
```

**Hub owns the first two levels:**
- HUD: Always visible; bars show Health, Mana, Stamina, Essence
- Autobattler: Encounter window shows ambient activity; player observes

**Escalation boundary:**
- When player engages an encounter, control transfers to turn-based (modal or separate surface)
- Hub spec does NOT define turn-based or Badlands mechanics

---

## 3. Slot Layout

The Hub surface is composed of the following slots:

### 3.1 Chrome Boundaries (Shell-Provided)

These regions are provided by the runtime chrome system but are documented here as boundaries:

| Boundary | Provider | Content |
|----------|----------|---------|
| `chrome:header` | Runtime | Screen title, mode indicator, action buttons |
| `chrome:footer` | Runtime | Navigation bar, quick actions |

### 3.2 Hub-Owned Slots (Surface-Defined)

These slots are defined by the Hub surface and must be populated by Parts:

| Slot ID | Purpose | Required | Notes |
|---------|---------|----------|-------|
| `vitalsHud` | Financial health readout | Yes | Displays H/M/S/Essence bars |
| `statusBar` | Player state indicator | Yes | Shows Verified/Unverified mode, pay-cycle info |
| `encounterWindow` | Autobattler / engagement zone | Yes | Ambient encounters; placeholder acceptable Phase 1 |

### 3.3 Visual Hierarchy (Top to Bottom)

```
┌────────────────────────────────────┐
│         chrome:header              │  ← Runtime-provided
├────────────────────────────────────┤
│         statusBar                  │  ← Verified/Unverified + cycle info
├────────────────────────────────────┤
│                                    │
│         vitalsHud                  │  ← H/M/S/Essence bars
│                                    │
├────────────────────────────────────┤
│                                    │
│         encounterWindow            │  ← Autobattler zone
│                                    │
├────────────────────────────────────┤
│         chrome:footer              │  ← Runtime-provided
└────────────────────────────────────┘
```

---

## 4. Vitals HUD Requirements

The `vitalsHud` slot displays the four Vitals:

| Vital | Meaning | Visual Requirement |
|-------|---------|-------------------|
| **Health** | Emergency buffer / survival energy | Bar with current/max; distinct colour |
| **Mana** | Intentional / power spending pool | Bar with current/max; distinct colour |
| **Stamina** | Day-to-day flexible spending pool | Bar with current/max; distinct colour |
| **Essence** | Long-term savings potential | Bar or meter; ethically constrained display |

### 4.1 View Modes (Required)

The Vitals HUD must support view modes:

| Mode | Display Period | Use Case |
|------|----------------|----------|
| `daily` | Current day spend/regen | Granular awareness |
| `weekly` | 7-day rolling view | Trend visibility |

**Implementation note:** Exact UX (toggle, swipe, button) is implementation-defined. The spec requires the capability to exist.

### 4.2 Data Hooks Required

The VitalsHUD part must receive:
- `vitals.health` (current, max, delta)
- `vitals.mana` (current, max, delta)
- `vitals.stamina` (current, max, delta)
- `vitals.essence` (current, softCap, accrual)
- `viewMode` (daily | weekly)
- `payCycle.anchor` (cycle start reference)

---

## 5. Status Bar Requirements

The `statusBar` slot displays player state:

| State | Display Requirement |
|-------|---------------------|
| **Verified** | Tied to real financial data; indicator visible |
| **Unverified** | Demo/manual mode; indicator visible with guardrail hint |
| **Pay Cycle** | Current cycle position (optional: days remaining) |

### 5.1 Data Hooks Required

The StatusBar part must receive:
- `mode` (verified | unverified)
- `payCycle.dayOfCycle` (optional)
- `payCycle.daysRemaining` (optional)

---

## 6. Encounter Window Requirements

The `encounterWindow` slot is the autobattler boundary:

### 6.1 Intent (Normative)

- Displays ambient encounters that run without player input
- Reflects financial behaviour metaphorically (spending = damage, saving = healing)
- Provides visual feedback on player's financial "battle"

### 6.2 Phase 1 Acceptance (Placeholder)

For Phase 1, the encounter window may be:
- A placeholder card with "Encounters coming soon" or equivalent
- A static visual representing the concept
- Structurally present in the slot layout

**Constraint:** The slot MUST exist. The Part MUST be mountable. Gameplay logic is NOT required for Phase 1.

### 6.3 Escalation Trigger (Intent)

When the encounter window supports engagement:
- Tapping/clicking an encounter escalates to turn-based mode
- Escalation is a navigation action (modal or surface switch)
- Hub does not define turn-based mechanics

### 6.4 Data Hooks Required (Phase 2+)

The EncounterWindow part will eventually receive:
- `encounter.active` (current encounter data)
- `encounter.queue` (upcoming encounters)
- `actions.engage` (escalation trigger)

---

## 7. Surface Definition (Abstract)

The Hub surface.json (when implemented) should follow this structure:

```json
{
  "id": "hub",
  "type": "screen",
  "chrome": {
    "header": true,
    "footer": true,
    "title": "Hub"
  },
  "slots": [
    { "id": "statusBar", "part": "StatusBar" },
    { "id": "vitalsHud", "part": "VitalsHUD" },
    { "id": "encounterWindow", "part": "EncounterWindow" }
  ]
}
```

**Note:** This is illustrative. Exact schema follows canonical surface.json conventions in vLatest.

---

## 8. What This Spec Does NOT Define

Per Director constraint, this spec explicitly excludes:

- Gameplay/combat rules
- Badlands mechanics
- Turn-based encounter logic
- Transaction tagging flows
- Essence allocation rules
- Partner/commercial integrations

These belong in separate specs or are deferred to implementation Work Orders.

---

## 9. Success Criteria for Implementation

An implementation satisfies this spec when:

- [ ] Hub surface loads in canonical runtime
- [ ] Three slots are mountable: statusBar, vitalsHud, encounterWindow
- [ ] VitalsHUD displays H/M/S/Essence bars
- [ ] View mode toggle exists (daily/weekly)
- [ ] StatusBar shows Verified/Unverified state
- [ ] EncounterWindow slot is present (placeholder acceptable Phase 1)
- [ ] Chrome header/footer render correctly
- [ ] No gameplay logic is required to pass Phase 1

---

## 10. Related Artifacts

| Artifact | Relationship |
|----------|--------------|
| HUB_PARTS_INDEX.md | Lists required Parts for Hub slots |
| MIGRATION_PARITY_MATRIX.md | Defines MUST KEEP capabilities |
| MYFI_GLOSSARY.md | Defines Vitals semantics |
| C3 Work Order | Defines Part contracts (follows this spec) |

---

End of Hub Surface Spec.
