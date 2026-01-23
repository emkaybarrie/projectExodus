📄 VITALSHUD_CONTRACT.md

```yaml
partId: "VitalsHUD"
schemaVersion: "1.0"
status: Canonical Contract (C3 Output)
audience: Director, Architect, Executor, Implementers
purpose: Define the formal interface between VitalsHUD Part and runtime/view model
```

---

## 1. Part Identity

| Property | Value |
|----------|-------|
| Part ID | `VitalsHUD` |
| Category | `prefab` (composite Part) |
| Slot | `vitalsHud` |
| Phase 1 | Required — must render bars |

---

## 2. Input Data Shape

The VitalsHUD Part receives the following data structure from its parent:

```typescript
interface VitalsHUDInput {
  vitals: {
    health: VitalPool;
    mana: VitalPool;
    stamina: VitalPool;
    essence: EssencePool;
  };
  viewMode: 'daily' | 'weekly';
  payCycle: {
    anchor: number;          // timestamp (ms) — pay cycle start
    dayOfCycle?: number;     // 1-based day within cycle (optional)
    daysRemaining?: number;  // days until cycle reset (optional)
  };
}

interface VitalPool {
  current: number;   // current value (0 to max)
  max: number;       // pool capacity
  delta?: number;    // change since last update (optional)
}

interface EssencePool {
  current: number;     // accumulated essence
  softCap?: number;    // advisory display metadata (optional)
  accrual?: number;    // rate of accrual (optional)
}
```

### 2.1 Numeric Expectations

| Expectation | Description |
|-------------|-------------|
| Non-negative | All numeric values are ≥ 0 |
| Non-integer allowed | Values may be floats (e.g., 42.7) |
| Display rounding | Implementation-defined; contract does not prescribe |
| Units | Implementation-defined (e.g., currency, abstract points) |

### 2.2 Field Notes

| Field | Required | Notes |
|-------|----------|-------|
| `vitals.health` | Yes | Emergency buffer pool |
| `vitals.mana` | Yes | Intentional spending pool |
| `vitals.stamina` | Yes | Flexible spending pool |
| `vitals.essence` | Yes | Long-term savings accumulation |
| `vitals.*.delta` | No | Optional change indicator; Phase 1 optional |
| `vitals.essence.softCap` | No | Advisory display metadata only |
| `viewMode` | Yes | Current display period |
| `payCycle.anchor` | Yes | Cycle reference timestamp |
| `payCycle.dayOfCycle` | No | Contextual display info |
| `payCycle.daysRemaining` | No | Contextual display info |

---

## 3. View Mode Contract

| Requirement | Description |
|-------------|-------------|
| Modes supported | `daily`, `weekly` |
| Default mode | Implementation-defined (recommend `daily`) |
| Mode switching | Part must re-render when `viewMode` input changes |
| State persistence | Part does NOT persist mode; caller manages state |
| Mode source | Provided in input; Part does not determine mode |

### 3.1 Mode Semantics

| Mode | Display Period | Typical Use |
|------|----------------|-------------|
| `daily` | Current day | Granular spend/regen awareness |
| `weekly` | 7-day rolling | Trend visibility |

**Note:** The contract defines that modes exist; visual treatment (labels, icons, transitions) is implementation-defined.

---

## 4. Allowed Actions

The Part may emit the following actions to its parent:

| Action | Signature | Description |
|--------|-----------|-------------|
| `setViewMode` | `(mode: 'daily' \| 'weekly') => void` | Request view mode change |
| `openVitalDetail` | `(vital: 'health' \| 'mana' \| 'stamina' \| 'essence') => void` | Request detail modal (optional) |

### 4.1 Action Semantics

| Property | Description |
|----------|-------------|
| Direction | Part → Parent (events emitted upward) |
| Handling | Parent surface/runtime handles action effects |
| Navigation | Part does NOT navigate directly; emits intent |
| Optional actions | `openVitalDetail` may be unimplemented in Phase 1 |

---

## 5. Constraints

The VitalsHUD Part must NOT:

| Constraint | Rationale |
|------------|-----------|
| Fetch data | Data is provided via input; Part is purely presentational |
| Persist state | View mode, preferences, etc. managed by caller |
| Enforce business rules | Spend limits, ethics, caps enforced upstream |
| Assume data source | Works identically with demo data or real data |
| Define colours/styles | Visual treatment is uplift-layer concern |
| Trigger navigation | Actions emit events; parent handles routing |
| Enforce softCap | softCap is advisory display metadata only; Part must not enforce economics or business rules |
| Assume integer values | Numeric values may be non-integers |

---

## 6. Contract Boundary Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    VitalsHUD Part                       │
├─────────────────────────────────────────────────────────┤
│  INPUTS (provided by parent):                           │
│    • vitals: { health, mana, stamina, essence }         │
│    • viewMode: 'daily' | 'weekly'                       │
│    • payCycle: { anchor, dayOfCycle?, daysRemaining? }  │
├─────────────────────────────────────────────────────────┤
│  OUTPUTS (events emitted to parent):                    │
│    • setViewMode(mode)                                  │
│    • openVitalDetail(vital) [optional]                  │
├─────────────────────────────────────────────────────────┤
│  INTERNAL (Part owns, not contracted):                  │
│    • Render logic                                       │
│    • Animation / transitions                            │
│    • Accessibility attributes                           │
│    • Display rounding                                   │
│    • Colour / styling (via uplift)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Validation Checklist

An implementation satisfies this contract when:

- [ ] Part accepts `VitalsHUDInput` shape without error
- [ ] Part renders representation for Health, Mana, Stamina, Essence
- [ ] Part responds to `viewMode` changes (re-renders)
- [ ] Part emits `setViewMode` action when user requests mode change
- [ ] Part does NOT fetch data or call external APIs
- [ ] Part does NOT persist state
- [ ] Part does NOT enforce softCap or business rules
- [ ] Part handles non-integer values gracefully

---

## 8. Phase 1 Acceptance

For Phase 1, the following are acceptable:

| Element | Phase 1 Status |
|---------|----------------|
| H/M/S/Essence bars | Required |
| View mode toggle | Required |
| Delta indicators | Optional |
| `openVitalDetail` action | Optional |
| Pay cycle display | Optional |

---

## 9. Related Artifacts

| Artifact | Relationship |
|----------|--------------|
| HUB_SURFACE_SPEC.md | Defines slot this Part mounts to |
| HUB_PARTS_INDEX.md | Lists this Part with summary hooks |
| MYFI_GLOSSARY.md | Defines Vitals semantics (H/M/S/Essence) |
| MIGRATION_PARITY_MATRIX.md | Validates MUST KEEP requirements |

---

End of VitalsHUD Contract.
