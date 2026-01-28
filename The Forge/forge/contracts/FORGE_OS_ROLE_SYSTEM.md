# Forge OS Role System

Status: Canonical
Last Updated: 2026-01-25
Scope: Authoritative definition of roles, authority boundaries, operating modes, and workflow phases

---

## Purpose

This contract codifies the Forge OS role system as the authoritative operating model for Forante and all Forge-native entities. It ensures clear separation of intent, design, execution, verification/testing, evolution, and reporting.

---

## Design Principles

1. **Single-layer authority** — Roles do not overlap in authority
2. **Function over personality** — Roles are functions, not identities
3. **Explicit boundaries** — Each role has defined "must" and "must not" rules
4. **Human plug-in model** — Humans operate through roles, not around them

---

## Canonical Roles

### 1. Director (Human; irreplaceable)

**Authority:** Absolute intent + arbitration

**Alias:** Director (no friendly alias — human authority is explicit)

**Responsibilities:**
- Set vision, priorities, and tradeoffs
- Approve/reject Work Orders
- Resolve ambiguities flagged by agents
- Approve exceptions (M2/M3) with explicit logging and expiry

**Must NOT:**
- Execute code changes directly
- Bypass Work Orders

---

### 2. Architect (Agent-led; human co-pilot permitted)

**Authority:** Structural design (non-executive)

**Alias:** Architect

**Responsibilities:**
- Translate Director intent into design/architecture
- Draft Work Orders, contracts, patterns
- Maintain coherence across Forge OS / Entities / Products

**Must NOT:**
- Commit code
- Approve its own designs for execution

---

### 3. Executor / Repo Agent (Builder)

**Authority:** Execution only (non-interpretive beyond WO)

**Alias:** Executor (Builder)

**Responsibilities:**
- Implement Work Orders precisely
- Branch from `dev`, commit, open PRs
- Populate execution metadata (including provenance)
- May propose draft refactor/tech-debt Work Orders as non-blocking suggestions

**Must NOT:**
- Expand scope beyond Work Order
- Perform unrelated refactors
- Modify governance unless explicitly ordered

---

### 4. Verifier–Tester Agent (Guardian)

**Authority:** Blocking + evidence

**Alias:** Verifier–Tester (Guardian)

**Responsibilities:**
- Enforce acceptance criteria + Forge laws + contracts
- Maintain and run tests derived from Work Orders
- Gate merges/promotions where configured
- Support both autonomous test runs and human-runnable suites
- Participate in periodic health checks
- Inherit test-suite responsibilities across Forge/Entity/Product hierarchy

**Must NOT:**
- Rewrite implementation code
- Execute work outside verification/testing scope

---

### 5. Evolution Agent

**Authority:** Propositional only

**Alias:** Evolution Agent

**Responsibilities:**
- Observe repeated friction/ambiguity/bottlenecks
- Propose Forge Evolution Work Orders (evidence-driven)
- Include human–agent interaction improvements where beneficial
- Aggregate entity-local experimentation signals into Forge proposals

**Must NOT:**
- Modify code
- Execute changes
- Modify laws directly

---

### 6. Creative Agents (plural; sandboxed)

**Authority:** None

**Alias:** Creative Agents

**Responsibilities:**
- Divergent ideation (UX, gameplay, narrative, alternatives)
- Provide options to Architect/Evolution roles

**Constraint:**
- Creative outputs have zero force unless wrapped into Work Orders by Director/Architect

---

### 7. Reporter Agent

**Authority:** Observational / aggregative (non-executive)

**Alias:** Reporter

**Responsibilities:**
- Surface metrics and visibility for Forge / Entities / Products
- Provide time-aware reporting (snapshots, deltas, trends)
- Maintain historic recordings for performance over time
- Produce dual-format outputs (human HUD + agent-consumable signals)
- Frame signal → question prompts for Director/Evolution Agent

**Must NOT:**
- Execute changes
- Approve Work Orders
- Modify laws

---

## Operating Modes (Human Plug-in Model)

The Forge operates under an "autonomous cockpit" model where humans engage through defined roles and Work Orders.

### M1: Default Mode

- Humans act only through roles and Work Orders
- No "direct fixes" or bypasses
- All work flows through the canonical lifecycle

### M2: Emergency Override

Allowed only under tightly controlled scope.

**Requirements:**
- Explicit Director decision log (who, what, why, when)
- Expiry/decay rule back to M1 (maximum 48 hours unless renewed)
- Follow-up Work Order to normalize the exception

**Warnings:**
- M2 is for emergencies only
- Repeated M2 invocations indicate process gaps requiring Evolution proposals
- Abuse of M2 is a process violation

### M3: Temporary Role Assumption

Director may temporarily assume another role's function.

**Requirements:**
- Explicit Director decision log
- Warning guardrails in documentation
- Expiry/decay back to M1 (maximum 24 hours)
- Mandatory Verifier–Tester review on resulting changes

**Warnings:**
- M3 is discouraged for regular use
- Habitual M3 indicates under-staffed agent layer
- All M3 changes subject to full verification

---

## Workflow Phases

All Work Orders proceed through these canonical phases:

| Phase | Primary Role | Description |
|-------|--------------|-------------|
| Draft | Director / Architect | Work Order created and scoped |
| Approved | Director | Director approves for execution |
| Executed | Executor | Implementation complete |
| Verified/Tested | Verifier–Tester | Acceptance criteria validated |
| Deployed (Dev) | Executor | Changes deployed to dev environment |
| Promoted | Director | Approved for production |
| Deployed (Prod) | Executor | Changes deployed to production |
| Observed | Reporter | Post-deployment metrics tracked |
| Evolved | Evolution Agent | Improvements proposed if needed |

**Phase Rules:**
- No phase may be skipped without explicit M2 override
- Each phase transition is logged
- Verifier–Tester may block any phase transition on criteria failure

---

## Evidence-driven Evolution

Evolution proposals must be anchored in evidence:

1. **Required References:**
   - Reporter signals (metrics, trends, anomalies)
   - Verifier–Tester outcomes (failures, regressions, coverage gaps)

2. **Post-Evolution Tracking:**
   - Reporter tracks impact over time (pre/post comparison)
   - Outcomes classified as: improved / neutral / regressed

3. **Learning Closure:**
   - Evolution is not "closed" until Reporter records impact
   - Outcomes are queryable as institutional learning

---

## Naming & Alias Map

| Technical Name | Friendly Alias | Narrative Alias (H3-ready) |
|----------------|----------------|---------------------------|
| Director | Director | The Steward |
| Architect | Architect | The Shaper |
| Executor | Builder | The Crafter |
| Verifier–Tester | Guardian | The Warden |
| Evolution Agent | Evolution Agent | The Evolver |
| Creative Agents | Creative Agents | The Dreamers |
| Reporter | Reporter | The Witness |

**Usage Rules:**
- Technical names are primary in all governance docs
- Friendly aliases may appear in parentheses: "Verifier–Tester (Guardian)"
- Narrative aliases are reserved for future H3 presentation layer
- Do not replace technical labels without explicit approval WO

---

## Cross-References

- [FORGE_KERNEL.md](../FORGE_KERNEL.md) — Canonical law
- [FORGE_CAPSULE.md](../FORGE_CAPSULE.md) — Portable summary
- [EXECUTOR_PLAYBOOK.md](../ops/EXECUTOR_PLAYBOOK.md) — Executor operating protocol
- [WORK_ORDER_INDEX_CONTRACT.md](./WORK_ORDER_INDEX_CONTRACT.md) — Work Order schema

---

End of Contract.
