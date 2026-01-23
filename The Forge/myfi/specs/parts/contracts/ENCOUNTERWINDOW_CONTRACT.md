📄 ENCOUNTERWINDOW_CONTRACT.md

```yaml
partId: "EncounterWindow"
schemaVersion: "1.0"
status: Canonical Contract (C3c Output)
audience: Director, Architect, Executor, Implementers
purpose: Define the formal interface between EncounterWindow Part and runtime/view model
```

---

## 1. Part Identity

| Property | Value |
|----------|-------|
| Part ID | `EncounterWindow` |
| Category | `prefab` (composite Part) |
| Slot | `encounterWindow` |
| Phase 1 | Placeholder acceptable |

---

## 2. Architectural Context

The EncounterWindow sits at the **observation/engagement boundary** in the Hub's interaction depth model:

```
┌─────────────────────────────────────────────────────────────┐
│  HUD (passive)        │  VitalsHUD displays state          │
├─────────────────────────────────────────────────────────────┤
│  Autobattler          │  EncounterWindow shows ambient     │ ← THIS PART
│  (observation)        │  activity; player watches          │
├─────────────────────────────────────────────────────────────┤
│  Turn-based           │  Player engages; tactical choices  │ ← ESCALATION TARGET
│  (engagement)         │  (modal or separate surface)       │   (not this Part)
├─────────────────────────────────────────────────────────────┤
│  Badlands             │  Full action gameplay              │ ← FUTURE
│  (action layer)       │  (separate surface)                │   (not this Part)
└─────────────────────────────────────────────────────────────┘
```

**The EncounterWindow Part owns observation. It does NOT own engagement.**

---

## 3. Input Data Shape

The EncounterWindow Part receives the following data structure from its parent:

```typescript
interface EncounterWindowInput {
  displayState: 'idle' | 'available' | 'observing';
  encounter?: EncounterStub | null;
}

interface EncounterStub {
  id: string;                    // unique encounter identifier
  type?: string;                 // encounter category (e.g., "spending", "saving", "challenge")
  summary?: string;              // human-readable description for display
  severity?: 'minor' | 'moderate' | 'major';  // visual intensity hint (optional)
}
```

### 3.1 Display State Semantics

| State | Meaning | Visual Expectation |
|-------|---------|-------------------|
| `idle` | No encounters active or pending | Calm/empty zone; placeholder content acceptable |
| `available` | Encounter ready for observation | Indicator that activity is available |
| `observing` | Autobattler running; player watching | Ambient activity visible; no input required |

### 3.2 Field Notes

| Field | Required | Notes |
|-------|----------|-------|
| `displayState` | Yes | Current observation state |
| `encounter` | No | Active encounter data (null when idle) |
| `encounter.id` | Yes (if encounter) | Used for action targeting |
| `encounter.type` | No | Category hint for visual treatment |
| `encounter.summary` | No | Display text for encounter |
| `encounter.severity` | No | Visual intensity hint |

### 3.3 Stub Boundary

The `EncounterStub` type is intentionally minimal. It defines **only what the Part needs for display**, not gameplay mechanics.

| In Scope (this contract) | Out of Scope (future specs) |
|--------------------------|-----------------------------|
| Display identifier (`id`) | Combat stats, HP, damage |
| Category hint (`type`) | Resolution rules |
| Summary text | RNG mechanics |
| Severity hint | Reward calculations |
| | Queue management |
| | Encounter generation |

---

## 4. Allowed Actions

| Action | Signature | Description | Phase 1 |
|--------|-----------|-------------|---------|
| `engage` | `(encounterId: string) => void` | Request escalation to turn-based mode | Optional |

### 4.1 Action Semantics

| Property | Description |
|----------|-------------|
| Direction | Part → Parent (event emitted upward) |
| Handling | Parent surface/runtime or Journey handles escalation |
| Navigation | Part does NOT navigate directly; emits intent only |
| Trigger | User taps/clicks encounter when in `available` or `observing` state |
| Parameter | `encounterId` identifies which encounter to engage |

### 4.2 Escalation Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                   EncounterWindow Part                       │
│                                                              │
│   User taps encounter                                        │
│          │                                                   │
│          ▼                                                   │
│   Part emits: engage(encounterId)                           │
│          │                                                   │
└──────────┼──────────────────────────────────────────────────┘
           │
           ▼  (boundary — Part responsibility ends here)
┌─────────────────────────────────────────────────────────────┐
│              Parent / Journey / Runtime                      │
│                                                              │
│   • Receives engage action                                   │
│   • Determines escalation target (modal vs surface)          │
│   • Navigates to turn-based experience                       │
│   • Manages encounter resolution lifecycle                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Critical:** The Part's job is to emit `engage`. Everything after that — navigation, combat, resolution — is handled elsewhere.

### 4.3 Omitted Actions (Phase 1)

| Action | Status | Rationale |
|--------|--------|-----------|
| `dismiss` | Omitted | Requires gameplay rules; deferred to future spec |

---

## 5. Constraints

The EncounterWindow Part must NOT:

| Constraint | Rationale |
|------------|-----------|
| Generate encounters | Encounter generation is upstream system responsibility |
| Manage encounter queue | Queue logic is runtime/Feature Pack responsibility |
| Resolve combat | Combat resolution is turn-based system (out-of-Hub) |
| Apply damage/healing | Gameplay mechanics are not UI Part responsibility |
| Determine RNG outcomes | Randomization is gameplay layer, not presentation |
| Navigate directly | Part emits `engage`; parent/Journey handles navigation |
| Fetch data | Data is provided via input; Part is purely presentational |
| Persist state | Display state managed by caller |
| Define encounter rules | Rules belong in gameplay specs, not Part contract |
| Implement Badlands mechanics | Badlands is separate surface (Phase 2+) |

---

## 6. Contract Boundary Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  EncounterWindow Part                        │
├─────────────────────────────────────────────────────────────┤
│  INPUTS (provided by parent):                                │
│    • displayState: 'idle' | 'available' | 'observing'        │
│    • encounter?: { id, type?, summary?, severity? }          │
├─────────────────────────────────────────────────────────────┤
│  OUTPUTS (events emitted to parent):                         │
│    • engage(encounterId) [optional Phase 1]                  │
├─────────────────────────────────────────────────────────────┤
│  INTERNAL (Part owns, not contracted):                       │
│    • Render logic                                            │
│    • Animation / ambient effects                             │
│    • Placeholder content (Phase 1)                           │
│    • Accessibility attributes                                │
│    • Visual treatment of severity                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Phase 1 Acceptance

### 7.1 Minimum Viable Part

For Phase 1, the EncounterWindow Part may:

| Approach | Acceptable |
|----------|------------|
| Static placeholder | Yes — "Encounters coming soon" or equivalent |
| Hardcoded idle state | Yes — always display `idle` visuals |
| Ignore input data | Yes — placeholder may not consume inputs |
| Omit `engage` action | Yes — no interactivity required |

### 7.2 Structural Requirement

**Constraint:** The Part MUST be structurally mountable. The slot MUST exist in the Hub surface.

Even as a placeholder, the Part must:
- Export a valid Part module
- Mount to the `encounterWindow` slot without error
- Render something (even if static)

### 7.3 Phase 1 vs Phase 2+ Matrix

| Element | Phase 1 Status | Phase 2+ Status |
|---------|----------------|-----------------|
| Part exists and mounts | Required | Required |
| Renders content | Required (placeholder OK) | Required (functional) |
| Accepts `displayState` | Optional | Required |
| Accepts `encounter` data | Optional | Required |
| Emits `engage` action | Optional | Required |
| Shows state transitions | Optional | Required |
| Ambient observation visuals | Optional | Expected |

---

## 8. Journey Integration

The `engage` action integrates with the Journeys system:

### 8.1 Example Journey Binding

```json
{
  "id": "encounter.escalate",
  "type": "journey",
  "trigger": {
    "action": "engage",
    "from": "EncounterWindow"
  },
  "steps": [
    { "op": "openModal", "modalId": "turnBasedEncounter", "data": { "encounterId": "$params.encounterId" } }
  ]
}
```

### 8.2 Binding Notes

| Property | Description |
|----------|-------------|
| Trigger source | `EncounterWindow` Part |
| Action name | `engage` |
| Parameter passing | `encounterId` passed to modal/surface |
| Escalation target | Implementation-defined (modal or surface) |

---

## 9. Validation Checklist

An implementation satisfies this contract when:

- [ ] Part exists and exports valid Part module
- [ ] Part mounts to `encounterWindow` slot without error
- [ ] Part renders content (placeholder acceptable Phase 1)
- [ ] Part accepts `EncounterWindowInput` shape without error (Phase 2+)
- [ ] Part displays appropriate visual for each `displayState` (Phase 2+)
- [ ] Part emits `engage(encounterId)` when user interacts (Phase 2+)
- [ ] Part does NOT generate encounters
- [ ] Part does NOT resolve combat
- [ ] Part does NOT navigate directly
- [ ] Part does NOT fetch data

---

## 10. Related Artifacts

| Artifact | Relationship |
|----------|--------------|
| HUB_SURFACE_SPEC.md | Defines slot this Part mounts to; interaction depth model |
| HUB_PARTS_INDEX.md | Lists this Part with summary hooks |
| JOURNEYS_SPEC.md | Defines how `engage` action triggers escalation |
| VITALSHUD_CONTRACT.md | Sibling contract (same surface) |
| STATUSBAR_CONTRACT.md | Sibling contract (same surface) |
| MYFI_GLOSSARY.md | Defines Journey, Surface, Part |

---

## 11. Future Considerations (Non-Normative)

These items are noted for future specs but are explicitly **out of scope** for this contract:

| Topic | Future Spec |
|-------|-------------|
| Encounter generation rules | Gameplay/Encounters spec |
| Combat resolution mechanics | Turn-based spec |
| Damage/healing calculations | Vitals-Encounter integration spec |
| Queue management | Runtime/Feature Pack spec |
| Badlands integration | Badlands surface spec |
| `dismiss` action | Gameplay spec (when defined) |

---

End of EncounterWindow Contract.
