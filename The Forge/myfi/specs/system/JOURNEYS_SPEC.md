🔀 JOURNEYS_SPEC.md

```yaml
specId: "journeys-system"
schemaVersion: "1.0"
status: Canonical Spec (H2 Output)
audience: Director, Architect, Executor, Implementers
purpose: Define the Journeys orchestration system for MyFi
```

---

## 1. Purpose

Journeys are **thin orchestration scripts** that coordinate user flows across Surfaces without embedding navigation logic in Parts.

### 1.1 What Journeys Do

| Capability | Description |
|------------|-------------|
| Navigate | Switch between Surfaces (screens) |
| Open modals | Display overlay content |
| Respond to actions | React to Part-emitted events |
| Sequence steps | Execute ordered operations |
| Enable replay | Provide deterministic flows for QA/demos |

### 1.2 What Journeys Are NOT

| Anti-pattern | Rationale |
|--------------|-----------|
| State machines | Keep thin; complex state belongs elsewhere |
| Gameplay engines | Gameplay is a separate system |
| Data providers | Feature Packs provide data |
| Business rule enforcers | Rules enforced upstream |
| Visual renderers | Parts and Surfaces handle rendering |

---

## 2. Architectural Role

```
┌─────────────────────────────────────────────────────────┐
│                     MyFi Runtime                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐    action    ┌──────────────┐             │
│  │  Part   │ ────────────▶│ Action Router │             │
│  └─────────┘              └───────┬──────┘             │
│                                   │                     │
│                                   │ trigger match?      │
│                                   ▼                     │
│                           ┌──────────────┐             │
│                           │   Journey    │             │
│                           │   Runner     │             │
│                           └───────┬──────┘             │
│                                   │                     │
│                                   │ execute steps       │
│                                   ▼                     │
│                           ┌──────────────┐             │
│                           │  Surface /   │             │
│                           │  Modal Mgr   │             │
│                           └──────────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Journeys sit between the **action layer** (Parts emitting events) and the **navigation layer** (Surfaces, modals).

---

## 3. When to Use Journeys

| Scenario | Use Journey? | Rationale |
|----------|--------------|-----------|
| Part needs to navigate to another screen | **Yes** | Part emits action; Journey handles navigation |
| Modal triggered by user action | **Yes** | Journey opens modal, handles dismiss |
| Demo or onboarding flow | **Yes** | Replayable, deterministic sequence |
| QA test sequence | **Yes** | Reproducible flow |
| Simple internal Part state change | **No** | Part handles internally (e.g., toggle) |
| Data fetch | **No** | Feature Pack handles data |
| Business rule enforcement | **No** | Upstream logic handles rules |
| Complex conditional logic | **No** | Use application code, not Journey |

---

## 4. Lifecycle Model

### 4.1 States

```
┌─────────┐     start()     ┌─────────┐
│  IDLE   │ ───────────────▶│ RUNNING │
└─────────┘                 └────┬────┘
     ▲                           │
     │                           │ step complete
     │                           ▼
     │                      ┌─────────┐
     │                      │  STEP   │──▶ (next step)
     │                      └────┬────┘
     │                           │
     │      ┌────────────────────┼────────────────────┐
     │      │                    │                    │
     │      ▼                    ▼                    ▼
┌─────────────┐          ┌─────────────┐      ┌─────────────┐
│  COMPLETED  │          │  CANCELLED  │      │   TIMEOUT   │
└─────────────┘          └─────────────┘      └─────────────┘
```

### 4.2 Lifecycle Events

| Event | Description |
|-------|-------------|
| `journey.start` | Journey begins execution |
| `journey.step` | Step executes (with step index) |
| `journey.complete` | All steps finished successfully |
| `journey.cancel` | Journey cancelled (user or system) |
| `journey.timeout` | Journey exceeded max duration |
| `journey.error` | Step failed (with error info) |

---

## 5. Schema Definition

### 5.1 Journey Object

```typescript
interface Journey {
  id: string;                      // unique identifier
  type: "journey";                 // discriminator
  title?: string;                  // human-readable name (optional)
  trigger?: ActionTrigger;         // auto-bind to action (optional)
  timeout?: number;                // max duration in ms (optional)
  steps: JourneyStep[];            // ordered sequence
}
```

### 5.2 Action Trigger (Auto-Binding)

```typescript
interface ActionTrigger {
  action: string;                  // action name to match
  from?: string;                   // source Part filter (optional)
  params?: Record<string, any>;    // param matching (optional)
}
```

**Decision (LOCKED):** Journeys auto-bind to actions via the `trigger` field. When a Part emits an action matching the trigger, the Journey executes automatically.

### 5.3 Journey Step

```typescript
interface JourneyStep {
  op: JourneyOp;                   // operation type
  [key: string]: any;              // operation-specific params
}

type JourneyOp =
  | "navigate"      // switch surface
  | "openModal"     // open modal overlay
  | "closeModal"    // close current/named modal
  | "wait"          // pause execution
  | "emit"          // emit action to parent
  | "log";          // debug output
```

**Decision (LOCKED):** Phase 1 is purely sequential. No conditional steps (`if`, `branch`).

---

## 6. Supported Operations

### 6.1 navigate

Switch to a different Surface.

```json
{ "op": "navigate", "surfaceId": "hub" }
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `surfaceId` | string | Yes | Target surface ID |
| `params` | object | No | Navigation params passed to surface |

### 6.2 openModal

Open a modal overlay.

```json
{ "op": "openModal", "modalId": "vitalDetail", "data": { "vital": "health" } }
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `modalId` | string | Yes | Modal identifier |
| `data` | object | No | Data passed to modal |

### 6.3 closeModal

Close current or named modal.

```json
{ "op": "closeModal" }
{ "op": "closeModal", "modalId": "vitalDetail" }
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `modalId` | string | No | Specific modal to close (default: current) |

### 6.4 wait

Pause execution.

```json
{ "op": "wait", "ms": 500 }
{ "op": "wait", "event": "modal.dismissed" }
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ms` | number | No | Wait duration in milliseconds |
| `event` | string | No | Wait for named event |

**Note:** Exactly one of `ms` or `event` should be provided.

### 6.5 emit

Emit an action upward.

```json
{ "op": "emit", "action": "startTour", "params": { "section": "vitals" } }
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | Action name to emit |
| `params` | object | No | Action parameters |

### 6.6 log

Debug logging (dev/QA use).

```json
{ "op": "log", "message": "Reached step 3" }
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Log message |
| `level` | string | No | Log level (default: "info") |

---

## 7. Error & Cancel Semantics

**Decision (LOCKED):** Minimal cancel/timeout semantics for Phase 1.

### 7.1 Cancellation

| Trigger | Behaviour |
|---------|-----------|
| User navigates away | Journey cancels; emits `journey.cancel` |
| `cancel()` called | Journey stops; emits `journey.cancel` |
| Surface unmounts | Journey cancels if bound to that surface |

### 7.2 Timeout

| Condition | Behaviour |
|-----------|-----------|
| Journey exceeds `timeout` | Journey stops; emits `journey.timeout` |
| No `timeout` specified | No automatic timeout (use with caution) |
| Recommended default | Implementation may set global default (e.g., 30s) |

### 7.3 Step Errors

| Condition | Behaviour |
|-----------|-----------|
| Step operation fails | Journey stops; emits `journey.error` |
| Invalid step config | Journey stops; emits `journey.error` |
| Unknown operation | Journey stops; emits `journey.error` |

---

## 8. Discovery & Registration

**Decision (LOCKED):** Hybrid discovery (manifest + convention).

### 8.1 Manifest Registration

Journeys may be registered in a manifest:

```json
{
  "journeys": [
    { "id": "hub.open", "path": "./journeys/hub/open.journey.json" },
    { "id": "vitals.openHealthDetail", "path": "./journeys/vitals/healthDetail.journey.json" }
  ]
}
```

### 8.2 Convention Discovery

Journeys may also be discovered by file convention:

```
/src/journeys/**/*.journey.json
```

### 8.3 Resolution Order

1. Check manifest for explicit registration
2. Scan convention paths for `*.journey.json`
3. Merge (manifest takes precedence on ID collision)

---

## 9. Integration with Parts

### 9.1 VitalsHUD Example

From VITALSHUD_CONTRACT.md, the Part emits:
- `setViewMode(mode)` — handled internally or by runtime
- `openVitalDetail(vital)` — triggers Journey

**Journey binding:**

```json
{
  "id": "vitals.openHealthDetail",
  "type": "journey",
  "trigger": {
    "action": "openVitalDetail",
    "params": { "vital": "health" }
  },
  "steps": [
    { "op": "openModal", "modalId": "vitalDetail", "data": { "vital": "health" } }
  ]
}
```

### 9.2 Hub Navigation Example

```json
{
  "id": "nav.toHub",
  "type": "journey",
  "trigger": { "action": "navigateToHub" },
  "steps": [
    { "op": "navigate", "surfaceId": "hub" }
  ]
}
```

---

## 10. Constraints

The Journeys system must NOT:

| Constraint | Rationale |
|------------|-----------|
| Fetch data | Data is Feature Pack responsibility |
| Enforce business rules | Rules are upstream |
| Modify Part state directly | Parts own their internal state |
| Define visual rendering | Surfaces/Parts handle rendering |
| Implement gameplay | Gameplay is separate system |
| Assume router implementation | Schema is router-agnostic |
| Block indefinitely | Must complete, cancel, or timeout |
| Include conditionals (Phase 1) | Keep sequential for simplicity |

---

## 11. Example Journeys

### 11.1 Simple Navigation

```json
{
  "id": "hub.open",
  "type": "journey",
  "title": "Open Hub",
  "steps": [
    { "op": "navigate", "surfaceId": "hub" }
  ]
}
```

### 11.2 Action-Triggered Modal

```json
{
  "id": "vitals.openManaDetail",
  "type": "journey",
  "title": "Mana Detail Modal",
  "trigger": {
    "action": "openVitalDetail",
    "params": { "vital": "mana" }
  },
  "steps": [
    { "op": "openModal", "modalId": "vitalDetail", "data": { "vital": "mana" } }
  ]
}
```

### 11.3 Onboarding Sequence

```json
{
  "id": "onboarding.welcome",
  "type": "journey",
  "title": "Welcome Flow",
  "timeout": 60000,
  "steps": [
    { "op": "openModal", "modalId": "welcome" },
    { "op": "wait", "event": "modal.dismissed" },
    { "op": "navigate", "surfaceId": "hub" },
    { "op": "wait", "ms": 500 },
    { "op": "emit", "action": "startTour" }
  ]
}
```

### 11.4 QA Replay

```json
{
  "id": "qa.hubVitalsFlow",
  "type": "journey",
  "title": "QA: Hub Vitals Check",
  "timeout": 30000,
  "steps": [
    { "op": "navigate", "surfaceId": "hub" },
    { "op": "wait", "ms": 1000 },
    { "op": "log", "message": "Hub loaded" },
    { "op": "emit", "action": "setViewMode", "params": { "mode": "weekly" } },
    { "op": "wait", "ms": 500 },
    { "op": "emit", "action": "setViewMode", "params": { "mode": "daily" } },
    { "op": "log", "message": "View mode toggle verified" }
  ]
}
```

---

## 12. Validation Checklist

An implementation satisfies this spec when:

- [ ] Journey runner loads journeys from manifest and convention
- [ ] Journeys auto-bind to actions via `trigger` field
- [ ] All operations (`navigate`, `openModal`, `closeModal`, `wait`, `emit`, `log`) work
- [ ] Lifecycle events emit correctly (`start`, `step`, `complete`, `cancel`, `timeout`, `error`)
- [ ] Cancellation stops execution cleanly
- [ ] Timeout stops execution after specified duration
- [ ] Journeys do NOT fetch data or enforce business rules
- [ ] Journeys are purely sequential (no conditionals)

---

## 13. Phase 1 Acceptance

| Element | Phase 1 Status |
|---------|----------------|
| Basic operations (navigate, openModal, wait) | Required |
| Auto-trigger binding | Required |
| Timeout support | Required |
| Cancel support | Required |
| Manifest registration | Required |
| Convention discovery | Optional (recommended) |
| `emit` operation | Optional |
| `log` operation | Optional |
| `closeModal` operation | Optional |

---

## 14. Related Artifacts

| Artifact | Relationship |
|----------|--------------|
| HUB_SURFACE_SPEC.md | Hub is canonical anchor for navigation |
| VITALSHUD_CONTRACT.md | Part actions that trigger Journeys |
| MYFI_GLOSSARY.md | Journey definition |
| MIGRATION_PARITY_MATRIX.md | "Journeys orchestration = MUST KEEP" |

---

End of Journeys Spec.
