# Agent Onboarding Contract

Status: Canonical
Last Updated: 2026-01-25
Scope: Capability declaration, trust graduation, constitutional binding, and mixed agent compositions

---

## Purpose

This contract codifies how agents (human and non-human) are onboarded into Forge OS. It defines capability declaration, trust graduation, constitutional binding, and support for mixed repo-aware/repo-unaware and single-/multi-model compositions.

---

## Design Principles

1. **Capability-driven** — Agents declare capabilities; roles derive from capabilities
2. **Evidence-based trust** — Trust graduation is observed, not assumed
3. **Constitutional binding** — All agents operate within the Forge Context Envelope
4. **Composition-agnostic** — Supports single-agent, multi-agent, and hybrid compositions

---

## Agent Capability Axes

Agents are declared across five independent axes. Each axis has discrete levels.

### Axis A: Repo Interaction

| Level | Name | Description |
|-------|------|-------------|
| A0 | None | Cannot interact with repository |
| A1 | Read | Can read repository contents |
| A2 | Write | Can branch, commit, and open PRs |

### Axis B: Execution Authority

| Level | Name | Description |
|-------|------|-------------|
| B0 | Non-executing | Cannot execute work |
| B1 | Work Order bound | Executes only via approved Work Orders |
| B2 | Limited autonomous | Future: bounded autonomous execution |

### Axis C: Verification Authority

| Level | Name | Description |
|-------|------|-------------|
| C0 | None | Cannot verify or test |
| C1 | Test runner | Can run test suites |
| C2 | Gate authority | Can block merges/promotions (Verifier–Tester) |

### Axis D: Propositional Authority

| Level | Name | Description |
|-------|------|-------------|
| D0 | None | Cannot propose |
| D1 | Suggestions | Can draft non-binding suggestions |
| D2 | Work Orders | Can draft Work Order proposals |

### Axis E: Observability

| Level | Name | Description |
|-------|------|-------------|
| E0 | Unstructured | Produces unstructured output only |
| E1 | Structured | Produces structured artifacts |
| E2 | Metrics-grade | Produces Reporter-compatible signals |

---

## Role Eligibility Derivation

Roles are NOT manually assigned to agents. Roles are **derived from declared capabilities**.

### Derivation Rules

| Role | Minimum Capability Requirements |
|------|--------------------------------|
| Director | Human + final authority (not agent-derivable) |
| Architect | A1 + D2 + E1 |
| Executor (Builder) | A2 + B1 + E1 |
| Verifier–Tester (Guardian) | A1 + C2 + E1 |
| Evolution Agent | A1 + D2 + E2 |
| Creative Agent | D1 + E0 (minimum) |
| Reporter | A1 + E2 |

### Routing Logic

Forge routes work based on:
1. Work Order phase
2. Required role for that phase
3. Available agents with eligible capability profile

If no eligible agent exists:
- Forge emits a structured Director prompt
- Work Order enters `blocked` state
- Resolution requires Director action or new agent onboarding

---

## Trust Declaration & Graduation

### Initial Declaration

Agents declare initial capabilities at onboarding:
- Capability profile (axes A–E)
- Model identifier (for non-human agents)
- Operational constraints (rate limits, context windows, etc.)

### Performance Observation

Reporter + Verifier–Tester observe agent performance:
- Task completion rate
- Error frequency
- Artifact quality
- Process compliance

### Capability Upgrades

1. Evolution Agent may propose capability upgrades based on Reporter signals
2. Proposal must include evidence (performance metrics, successful outcomes)
3. Director approves or rejects promotion
4. Approved promotions are logged with effective date

### Capability Downgrades

Downgrades may occur automatically on repeated failure:
- 3+ consecutive failures at a capability level triggers review
- Automatic downgrade to previous level pending Director review
- Downgrade events are logged as Reporter signals

---

## Failure Handling

### Automatic Swap

When an agent fails during execution:
1. Forge attempts automatic swap to another eligible agent
2. Swap preserves context and partial artifacts
3. Swap event is logged as Reporter signal

### Director Escalation

If no eligible agent is available for swap:
1. Work Order enters `blocked` state
2. Director receives escalation with:
   - Full context of failure
   - Partial artifacts produced
   - Recommended resolution path
3. All escalations are logged for institutional learning

### Failure Logging

All failures are recorded as Reporter signals:
- `agent.failure` — Agent failed during execution
- `agent.swap` — Agent was swapped mid-execution
- `agent.escalation` — Failure escalated to Director

---

## Human Participation Model

Humans are treated as agents with special constraints.

### Default Mode (M1)

Humans collaborate WITH agents at role/phase level:
- Humans provide intent, context, and decisions
- Agents execute, verify, and report
- Clear handoffs between human and agent contributions

### Human-as-Agent Mode

When humans act AS agents (performing agent-typical tasks):
- Action must be flagged (E2 observability)
- Must produce structured artifacts (not informal changes)
- Triggers post-hoc normalization Work Order

### Emergency Modes (M2/M3)

Per FORGE_OS_ROLE_SYSTEM.md:
- M2: Emergency override with logging + expiry
- M3: Temporary role assumption with guardrails
- Both modes MUST decay back to M1 within specified timeframes

---

## Agent Discovery

### Phase 1: Config + Heartbeat (Current)

- Agents registered via configuration
- Heartbeat mechanism confirms availability
- Capability profile stored in registry

### Phase 2: Self-Registration (Future)

Transition path to self-registration:
- Agent presents capability declaration
- Validation against constitutional requirements
- Provisional onboarding pending trust graduation

### Discovery Constraints

- Discovery MUST NOT require changes to governance or workflows
- New agents inherit existing process law
- Constitutional binding is verified before activation

---

## Constitutional Binding (Critical)

**All onboarded agents MUST operate within a Forge Context Envelope.**

### Envelope Contents

The Forge Context Envelope binds:
1. **Forge Kernel** — Canonical process law
2. **Role System** — Capability-to-role mapping
3. **Active Laws** — Acceptance Criteria Supremacy, Forge Evolution, Agent Provenance
4. **Reporting Requirements** — Structured output expectations
5. **Provenance Requirements** — Agent attribution on all executed work

### Model-Native Convention Wrapping

Different agent types use different conventions:
- System prompts (LLMs)
- Init files (IDE agents)
- Configuration (automation tools)
- Memory/context (persistent agents)

**All conventions MUST be wrapped by the Forge Context Envelope.**

The envelope takes precedence over model-native defaults.

### Violation Handling

Failure to respect constitutional binding:
- Is a Verifier–Tester violation
- Blocks artifact acceptance
- Triggers Director escalation
- Is logged as `agent.constitutional.violation` signal

---

## Mixed Compositions

### Repo-aware + Repo-unaware

Forge supports mixed compositions:
- Repo-aware agents (A1/A2): Direct artifact interaction
- Repo-unaware agents (A0): Operate via intermediaries

Intermediary pattern:
- Repo-unaware agent produces structured output
- Repo-aware agent commits on behalf
- Provenance records both contributors

### Single-Model + Multi-Model

Forge supports:
- Single-model execution (one agent per phase)
- Multi-model execution (multiple agents collaborate within phase)
- Handoff-based (sequential agents across phases)

Multi-model coordination:
- Primary agent holds phase ownership
- Secondary agents contribute via structured handoffs
- Provenance records all contributors

---

## Cross-References

- [FORGE_OS_ROLE_SYSTEM.md](./FORGE_OS_ROLE_SYSTEM.md) — Role definitions
- [REPORTING_SIGNALS_CONTRACT.md](./REPORTING_SIGNALS_CONTRACT.md) — Reporter signals
- [FORGE_KERNEL.md](../FORGE_KERNEL.md) — Canonical law

---

End of Contract.
