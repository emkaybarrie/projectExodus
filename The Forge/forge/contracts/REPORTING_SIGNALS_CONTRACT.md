# Reporting Signals & Metrics Contract

Status: Canonical
Last Updated: 2026-01-25
Scope: Definition of signals, metrics, and temporal data tracked by Reporter across Forge OS

---

## Purpose

This contract defines the canonical categories of signals, metrics, and temporal data that the Reporter role tracks across Forge OS. It is implementation-agnostic and supports both human and agent consumption.

---

## Design Principles

1. **Implementation-agnostic** — Contract defines what is observed, not how
2. **Dual-format** — All signals support human HUD + agent-consumable formats
3. **Time-aware** — All metrics include temporal context
4. **Phase-aligned** — Signals map to Work Order lifecycle phases

---

## Signal Categories

### 1. Work Order Flow Signals

Track the movement and state of Work Orders through the system.

| Signal | Description | Consumers |
|--------|-------------|-----------|
| `wo.created` | New Work Order entered system | Director, Architect |
| `wo.approved` | Work Order approved for execution | Executor, Evolution |
| `wo.executed` | Work Order execution complete | Verifier–Tester |
| `wo.verified` | Acceptance criteria validated | Director |
| `wo.deployed.dev` | Deployed to dev environment | Reporter |
| `wo.promoted` | Approved for production | Director |
| `wo.deployed.prod` | Deployed to production | Reporter |
| `wo.blocked` | Work Order blocked (dependency/issue) | Director, Evolution |
| `wo.delay` | Work Order exceeds expected phase duration | Evolution |
| `wo.failure` | Work Order failed verification | Evolution, Verifier–Tester |

**Derived Metrics:**
- Throughput: WOs completed per time period
- Lead time: Time from draft to deployed (prod)
- Cycle time: Time from approved to executed
- Block rate: Percentage of WOs blocked at any phase
- Failure rate: Percentage of WOs failing verification

---

### 2. Role Activity Signals

Track load and intervention patterns across roles.

| Signal | Description | Consumers |
|--------|-------------|-----------|
| `role.active` | Role currently engaged on work | Director |
| `role.intervention` | Role intervened to correct process | Evolution |
| `role.handoff` | Work transitioned between roles | Reporter |
| `role.blocked` | Role waiting on dependency | Director |
| `role.override.m2` | Emergency override invoked | Evolution, Director |
| `role.override.m3` | Temporary role assumption invoked | Evolution, Director |

**Derived Metrics:**
- Role load: Active work items per role
- Intervention rate: Process corrections per time period
- Override frequency: M2/M3 invocations per time period
- Handoff efficiency: Time between role transitions

---

### 3. Verification & Testing Signals

Track test execution and quality gates.

| Signal | Description | Consumers |
|--------|-------------|-----------|
| `test.run` | Test suite executed | Verifier–Tester |
| `test.pass` | Test suite passed | Director |
| `test.fail` | Test suite failed | Evolution, Executor |
| `test.regression` | Previously passing test now failing | Evolution |
| `test.coverage.delta` | Coverage changed from baseline | Architect |
| `gate.blocked` | Merge/promotion blocked by test | Director |
| `gate.passed` | Merge/promotion allowed | Reporter |

**Derived Metrics:**
- Pass rate: Percentage of test runs passing
- Regression rate: Regressions per time period
- Gate block rate: Blocked promotions per time period
- Coverage trend: Coverage change over time

---

### 4. Evolution Signals

Track Forge improvement proposals and outcomes.

| Signal | Description | Consumers |
|--------|-------------|-----------|
| `evolution.proposed` | New evolution proposal created | Director |
| `evolution.approved` | Proposal approved for implementation | Executor |
| `evolution.rejected` | Proposal rejected by Director | Evolution |
| `evolution.implemented` | Evolution change deployed | Reporter |
| `evolution.measured` | Post-change impact recorded | Evolution |
| `evolution.success` | Change improved target metric | Director |
| `evolution.neutral` | Change had no measurable impact | Evolution |
| `evolution.regression` | Change worsened target metric | Director, Evolution |

**Derived Metrics:**
- Proposal rate: Evolution proposals per time period
- Approval rate: Percentage of proposals approved
- Success rate: Percentage of evolutions improving metrics
- Learning velocity: Time from proposal to measured outcome

---

## Time Semantics

All signals and metrics include temporal context in one of three modes:

### Snapshot
Point-in-time measurement of current state.

```json
{
  "type": "snapshot",
  "timestamp": "2026-01-25T12:00:00.000Z",
  "value": 42,
  "unit": "count"
}
```

**Use cases:**
- Current WO count by status
- Active roles
- Current test coverage

### Delta
Change between two points in time.

```json
{
  "type": "delta",
  "from": "2026-01-24T00:00:00.000Z",
  "to": "2026-01-25T00:00:00.000Z",
  "value": 5,
  "direction": "increase",
  "unit": "count"
}
```

**Use cases:**
- WOs completed this period
- Coverage change since last deployment
- New regressions since baseline

### Trend
Pattern across multiple time periods.

```json
{
  "type": "trend",
  "periods": [
    {"start": "2026-01-18", "end": "2026-01-24", "value": 8},
    {"start": "2026-01-11", "end": "2026-01-17", "value": 6},
    {"start": "2026-01-04", "end": "2026-01-10", "value": 10}
  ],
  "direction": "stable",
  "unit": "count/week"
}
```

**Use cases:**
- WO throughput trend
- Failure rate trend
- Override frequency pattern

---

## Phase-aware Tracking

Signals map to Work Order lifecycle phases:

| Phase | Primary Signals |
|-------|-----------------|
| Draft | `wo.created` |
| Approved | `wo.approved`, `role.handoff` |
| Executed | `wo.executed`, `role.active` |
| Verified/Tested | `wo.verified`, `test.*`, `gate.*` |
| Deployed (Dev) | `wo.deployed.dev` |
| Promoted | `wo.promoted` |
| Deployed (Prod) | `wo.deployed.prod` |
| Observed | All Reporter signals active |
| Evolved | `evolution.*` |

---

## Output Formats

### Human HUD Format
Readable summary for Director consumption.

```
=== Forge Health (2026-01-25) ===
Work Orders: 17 total | 3 in-flight | 2 blocked
Throughput: 5/week (stable)
Test Pass Rate: 94% (+2% from last week)
Evolution Success: 2/3 proposals improved metrics
```

### Agent-consumable Format
Structured JSON for agent processing.

```json
{
  "timestamp": "2026-01-25T12:00:00.000Z",
  "signals": {
    "wo.total": {"type": "snapshot", "value": 17},
    "wo.inflight": {"type": "snapshot", "value": 3},
    "wo.blocked": {"type": "snapshot", "value": 2},
    "throughput": {"type": "trend", "value": 5, "unit": "count/week", "direction": "stable"}
  }
}
```

---

## Constraints

1. **No execution authority** — Signals are read-only observations
2. **No approval authority** — Reporter cannot approve based on signals
3. **Advisory only** — All outputs are evidence for other roles
4. **Attributable** — All signals must be traceable to source events

---

## Cross-References

- [FORGE_OS_ROLE_SYSTEM.md](./FORGE_OS_ROLE_SYSTEM.md) — Role definitions
- [FORGE_KERNEL.md](../FORGE_KERNEL.md) — Section 2.7 Reporter definition
- [WORK_ORDER_INDEX_CONTRACT.md](./WORK_ORDER_INDEX_CONTRACT.md) — Work Order schema

---

End of Contract.
