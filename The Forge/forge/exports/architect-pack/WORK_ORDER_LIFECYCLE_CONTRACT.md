# Work Order Lifecycle Contract

Status: Canonical
Last Updated: 2026-01-25
Scope: Work Order state machine, role triggers, artifact handoffs, and auto-adaptation rules

---

## Purpose

This contract formalises the Forge OS "factory–conveyor belt" model, defining how Work Orders automatically traverse roles, produce artifacts, and culminate in execution, verification, reporting, and evolution.

---

## Design Principles

1. **Phase-driven** — Each phase has defined role(s), artifacts, and blocking authority
2. **Capability-routed** — Work Orders specify required capabilities, not specific agents
3. **Artifact-continuous** — Each phase emits artifacts consumable by downstream roles
4. **Evolution-ready** — All phases feed into Reporter for evidence-based improvement

---

## Canonical Work Order State Machine

Work Orders traverse these states in sequence:

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌────────────────┐
│  Draft  │───▶│ Approved │───▶│ Executing │───▶│ Verified/Tested│
└─────────┘    └──────────┘    └───────────┘    └────────────────┘
                                                         │
     ┌───────────────────────────────────────────────────┘
     ▼
┌──────────────┐    ┌──────────┐    ┌───────────────┐    ┌──────────┐
│ Deployed Dev │───▶│ Promoted │───▶│ Deployed Prod │───▶│ Observed │
└──────────────┘    └──────────┘    └───────────────┘    └──────────┘
                                                                │
                                                                ▼
                                                         ┌─────────┐
                                                         │ Evolved │
                                                         │(optional)│
                                                         └─────────┘
```

### State Definitions

| State | Description | Exit Condition |
|-------|-------------|----------------|
| Draft | Work Order created, not yet approved | Director approval |
| Approved | Ready for execution | Executor claims and begins |
| Executing | Implementation in progress | Executor declares complete |
| Verified/Tested | Acceptance criteria validated | Verifier–Tester passes |
| Deployed (Dev) | Changes deployed to dev environment | Successful deployment |
| Promoted | Approved for production | Director approval |
| Deployed (Prod) | Changes deployed to production | Successful deployment |
| Observed | Post-deployment metrics tracked | Reporter captures baseline |
| Evolved | Improvement proposed (optional) | Evolution Agent proposes or skipped |

### Blocked State

Work Orders may enter `Blocked` from any active state:
- Dependency not met
- No eligible agent available
- Verification failure
- Director intervention required

Exit from Blocked requires Director action or dependency resolution.

---

## Role Triggers by Phase

Each phase has assigned role(s), expected artifacts, and optional blocking authority.

### Draft Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Director / Architect |
| Expected Artifacts | Work Order document, acceptance criteria |
| Blocking Authority | None (pre-approval) |
| Transition Trigger | Director marks "Approved" |

### Approved Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Forge (routing) |
| Expected Artifacts | Agent assignment, execution plan |
| Blocking Authority | None |
| Transition Trigger | Eligible Executor claims WO |

### Executing Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Executor (Builder) |
| Expected Artifacts | Code changes, commits, PR |
| Blocking Authority | Executor may request clarification (blocks until resolved) |
| Transition Trigger | Executor declares execution complete |

### Verified/Tested Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Verifier–Tester (Guardian) |
| Expected Artifacts | Test results, acceptance criteria checklist |
| Blocking Authority | **Yes** — Can reject and return to Executing |
| Transition Trigger | All acceptance criteria pass |

### Deployed (Dev) Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Executor / Automation |
| Expected Artifacts | Deployment logs, dev URL |
| Blocking Authority | Deployment failure blocks |
| Transition Trigger | Successful deployment to dev |

### Promoted Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Director |
| Expected Artifacts | Promotion decision, any conditions |
| Blocking Authority | Director may hold |
| Transition Trigger | Director approves production deployment |

### Deployed (Prod) Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Executor / Automation |
| Expected Artifacts | Deployment logs, prod URL |
| Blocking Authority | Deployment failure blocks |
| Transition Trigger | Successful deployment to production |

### Observed Phase

| Attribute | Value |
|-----------|-------|
| Primary Role | Reporter |
| Expected Artifacts | Baseline metrics, initial observations |
| Blocking Authority | None (observation is passive) |
| Transition Trigger | Reporter captures sufficient baseline (time-based) |

### Evolved Phase (Optional)

| Attribute | Value |
|-----------|-------|
| Primary Role | Evolution Agent |
| Expected Artifacts | Evolution proposal (if warranted) |
| Blocking Authority | None |
| Transition Trigger | Proposal submitted or phase skipped |

---

## Artifact Handoffs

Each phase emits artifacts consumable by downstream roles.

### Artifact Flow

```
Draft ──────────▶ WO Document + Criteria
                        │
Approved ───────▶ Agent Assignment
                        │
Executing ──────▶ Code Changes + Commits + PR
                        │
Verified ───────▶ Test Results + Criteria Checklist
                        │
Deployed Dev ───▶ Dev Deployment Logs + URL
                        │
Promoted ───────▶ Promotion Decision
                        │
Deployed Prod ──▶ Prod Deployment Logs + URL
                        │
Observed ───────▶ Baseline Metrics + Observations
                        │
Evolved ────────▶ Evolution Proposal (optional)
```

### Reporter Aggregation

Reporter aggregates artifacts across all phases:
- Collects structured outputs from each phase
- Maintains time-series of WO progression
- Provides evidence base for Evolution proposals

### Evolution Evidence Requirements

Evolution proposals MUST reference:
- Reporter signals (from Observed phase)
- Verifier–Tester outcomes (from Verified phase)
- Any anomalies or friction observed

---

## Auto-Adaptation Rules

Work Orders specify required capabilities, not specific agents.

### Capability-based Routing

```
WO Phase ──▶ Required Role ──▶ Role Eligibility ──▶ Available Agents ──▶ Selection
```

1. Work Order enters phase
2. Forge determines required role for phase
3. Forge queries agents with matching capability profile
4. Eligible agent is selected (or WO blocked if none)

### No Eligible Agent

If no eligible agent is available:
1. Work Order enters `Blocked` state
2. Director receives structured prompt:
   - WO context
   - Required capability profile
   - Recommended resolution (wait, onboard new agent, M2/M3 override)
3. Resolution requires Director action

### Agent Failure Mid-Phase

If agent fails during phase execution:
1. Forge attempts automatic swap to another eligible agent
2. Context and partial artifacts are preserved
3. If no swap available, escalate to Director
4. All failures logged as Reporter signals

---

## Execution Authority Boundaries

No execution authority is granted outside defined roles:

| Action | Permitted Roles |
|--------|-----------------|
| Modify code | Executor only |
| Block/reject artifacts | Verifier–Tester only |
| Approve WO | Director only |
| Propose evolution | Evolution Agent only |
| Record metrics | Reporter only |
| Design/draft | Architect only |

Cross-role execution is a process violation unless M2/M3 is active.

---

## Phase Timing (Non-Prescriptive)

This contract does not specify time limits for phases. Timing is observed, not enforced:
- Reporter tracks phase duration
- Evolution Agent may propose timing-related improvements
- Director may set expectations per-WO

---

## Cross-References

- [AGENT_ONBOARDING_CONTRACT.md](./AGENT_ONBOARDING_CONTRACT.md) — Agent capabilities and routing
- [FORGE_OS_ROLE_SYSTEM.md](./FORGE_OS_ROLE_SYSTEM.md) — Role definitions
- [REPORTING_SIGNALS_CONTRACT.md](./REPORTING_SIGNALS_CONTRACT.md) — Reporter signals
- [WORK_ORDER_INDEX_CONTRACT.md](./WORK_ORDER_INDEX_CONTRACT.md) — WO schema

---

## Future Automation (Gaps Identified)

The following areas are candidates for future automation WOs:
1. Automatic agent selection algorithm
2. Phase transition notifications
3. Blocked state alerting
4. Deployment pipeline integration
5. Reporter dashboard / real-time signals

These are documented for visibility but not implemented by this contract.

---

End of Contract.
