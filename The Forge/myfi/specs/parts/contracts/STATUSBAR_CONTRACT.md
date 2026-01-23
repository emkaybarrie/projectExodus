📄 STATUSBAR_CONTRACT.md

```yaml
partId: "StatusBar"
schemaVersion: "1.0"
status: Canonical Contract (C3b Output)
audience: Director, Architect, Executor, Implementers
purpose: Define the formal interface between StatusBar Part and runtime/view model
```

---

## 1. Part Identity

| Property | Value |
|----------|-------|
| Part ID | `StatusBar` |
| Category | `primitive` |
| Slot | `statusBar` |
| Phase 1 | Required — must show mode indicator |

---

## 2. Input Data Shape

The StatusBar Part receives the following data structure from its parent:

```typescript
interface StatusBarInput {
  mode: 'verified' | 'unverified';
  payCycle?: {
    dayOfCycle?: number;      // 1-based day within cycle
    daysRemaining?: number;   // days until cycle reset
    label?: string;           // optional display label
  };
}
```

### 2.1 Field Notes

| Field | Required | Notes |
|-------|----------|-------|
| `mode` | Yes | Current player mode |
| `payCycle` | No | Pay cycle context (optional Phase 1) |
| `payCycle.dayOfCycle` | No | Current position in cycle (1-based) |
| `payCycle.daysRemaining` | No | Days until reset |
| `payCycle.label` | No | Custom label for display |

### 2.2 Numeric Expectations

| Expectation | Description |
|-------------|-------------|
| Non-negative | `dayOfCycle` and `daysRemaining` are ≥ 0 |
| Integer expected | Cycle days are typically whole numbers |
| Display formatting | Implementation-defined |

---

## 3. Mode Display Semantics

### 3.1 Mode Definitions

| Mode | Meaning | Source |
|------|---------|--------|
| `verified` | Connected to real financial signals; stricter safeguards | MYFI_GLOSSARY |
| `unverified` | Manual/demonstration mode; limits and guardrails | MYFI_GLOSSARY |

### 3.2 Display Requirements

| Mode | Display Requirement |
|------|---------------------|
| `verified` | Indicate real data connection (e.g., "Connected", "Live") |
| `unverified` | Indicate demo/manual mode; **non-shaming** presentation |

### 3.3 Ethical Constraint: Non-Shaming Presentation

The Unverified mode indication **must be non-shaming**.

| Acceptable Examples | Not Acceptable |
|---------------------|----------------|
| "Demo Mode" | "Not Connected" |
| "Manual Entry" | "Unverified (Limited)" |
| "Practice Mode" | "Disconnected" |
| Neutral indicator icon | Warning colours (red/orange) |
| Informative, neutral tone | Punitive or discouraging tone |

**Rationale:** Unverified mode is a valid, supported usage path:
- Privacy-conscious users who don't connect bank data
- Users testing or exploring the app
- Onboarding before verification

The UI must treat both modes as equally valid choices.

---

## 4. Allowed Actions

| Action | Signature | Description | Phase 1 |
|--------|-----------|-------------|---------|
| `openModeInfo` | `() => void` | Request mode info modal | Optional |

### 4.1 Action Semantics

| Property | Description |
|----------|-------------|
| Direction | Part → Parent (event emitted upward) |
| Handling | Parent surface/runtime or Journey handles modal |
| Navigation | Part does NOT open modal directly |
| Trigger | User taps/clicks mode indicator |

---

## 5. Constraints

The StatusBar Part must NOT:

| Constraint | Rationale |
|------------|-----------|
| Determine mode | Mode is provided via input; Part only displays |
| Enforce business rules | Rules are upstream; Part is presentational |
| Fetch data | Data is provided via input |
| Persist state | Caller manages state |
| Define colours/styles | Visual treatment is uplift-layer concern |
| Shame Unverified users | Ethical requirement (see §3.3) |
| Navigate directly | Actions emit events; parent handles routing |

---

## 6. Contract Boundary Diagram

```
┌─────────────────────────────────────────────────────┐
│                  StatusBar Part                     │
├─────────────────────────────────────────────────────┤
│  INPUTS (provided by parent):                       │
│    • mode: 'verified' | 'unverified'                │
│    • payCycle?: { dayOfCycle?, daysRemaining?,      │
│                   label? }                          │
├─────────────────────────────────────────────────────┤
│  OUTPUTS (events emitted to parent):                │
│    • openModeInfo() [optional]                      │
├─────────────────────────────────────────────────────┤
│  INTERNAL (Part owns, not contracted):              │
│    • Render logic                                   │
│    • Accessibility attributes                       │
│    • Non-shaming presentation approach              │
│    • Display formatting                             │
└─────────────────────────────────────────────────────┘
```

---

## 7. Validation Checklist

An implementation satisfies this contract when:

- [ ] Part accepts `StatusBarInput` shape without error
- [ ] Part displays mode indicator (Verified or Unverified)
- [ ] Unverified mode is presented non-shamingly
- [ ] Part responds to mode changes (re-renders)
- [ ] Part emits `openModeInfo` when user interacts (if implemented)
- [ ] Part does NOT fetch data or call external APIs
- [ ] Part does NOT persist state
- [ ] Part does NOT determine or enforce mode

---

## 8. Phase 1 Acceptance

| Element | Phase 1 Status |
|---------|----------------|
| Mode indicator display | Required |
| Non-shaming presentation | Required |
| Pay cycle display | Optional |
| `openModeInfo` action | Optional |
| Custom `payCycle.label` support | Optional |

---

## 9. Related Artifacts

| Artifact | Relationship |
|----------|--------------|
| HUB_SURFACE_SPEC.md | Defines slot this Part mounts to |
| HUB_PARTS_INDEX.md | Lists this Part with summary hooks |
| MYFI_GLOSSARY.md | Defines Verified/Unverified modes |
| VITALSHUD_CONTRACT.md | Sibling contract (same surface) |

---

End of StatusBar Contract.
