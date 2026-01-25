# Forge Kernel

Status: Canonical
Audience: All agents (human and AI)
Scope: Governs how work enters, proceeds through, and evolves within the Forge

---

## Forge as Forante's Institutional OS

The Forge is **Forante's institutional SDLC operating system**.

This means:
- Forge is not a neutral tool; it embodies Forante's baseline way of building
- Forge sets SDLC law, provides governance portals, and manages AI agents
- Forge produces and governs entities (organisations/projects that build products)
- Entities inherit Forge methodology; they do not modify it unilaterally

**Responsibilities Boundary:**

| Forge Responsibilities | Entity Responsibilities |
|------------------------|------------------------|
| SDLC process law | Product development |
| Work Order lifecycle | Feature implementation |
| Share Pack governance | Product state tracking |
| Portal infrastructure | Product-specific UIs (if any) |
| Agent onboarding | Domain expertise |
| Cross-entity standards | Entity-specific decisions |

Entities (including MyFi) propose Forge changes via Work Orders. They do not enact changes directly.

See: [Forante Kernel](../../Forante/FORANTE_KERNEL.md) for constitutional governance.

---

## Kernel Role Clarification (Important)

This document serves TWO purposes at the current stage of the Forge:

1. **Canonical Law**  
   Non-negotiable rules that all agents must obey.

2. **Operational Guidance**  
   Explanatory context required to correctly onboard agents and guide the Director
   while the Forge is not yet fully automated.

Until the Forge meets its own operational exit condition (see Section 14),
**no content in this document may be removed for brevity**.
Future distillation must occur via the formal evolution mechanism.

---

## 1. What the Forge Is

The MyFi Forge is a self-aware, self-improving institution for building software,
systems, and processes—using humans and AI agents as collaborators.

Its purpose is deliberately dual, with an explicit bias:

**Primary:**  
Serve as a reusable institutional pattern for AI-augmented creation.

**Secondary:**  
Build the MyFi product as its first proving ground.

Decisions must not privilege short-term product velocity at the cost of
institutional integrity.

If tension exists, the Forge improves first; the product benefits downstream.

---

## 2. Canonical Roles (Forge OS Role System)

The Forge recognises seven canonical roles with single-layer authority.
These are **functions**, not personalities.

See: [FORGE_OS_ROLE_SYSTEM.md](./contracts/FORGE_OS_ROLE_SYSTEM.md) for full contract.

### 2.1 Director (Human; irreplaceable)

**Authority:** Absolute intent + arbitration

- Sets vision, priorities, and tradeoffs
- Approves/rejects Work Orders
- Resolves ambiguities flagged by agents
- Approves exceptions (M2/M3) with explicit logging and expiry

**Must NOT:** Execute code directly or bypass Work Orders.

### 2.2 Architect (Agent-led; human co-pilot permitted)

**Authority:** Structural design (non-executive)

- Translates Director intent into design/architecture
- Drafts Work Orders, contracts, patterns
- Maintains coherence across Forge OS / Entities / Products

**Must NOT:** Commit code or approve its own designs.

### 2.3 Executor / Repo Agent (Builder)

**Authority:** Execution only (non-interpretive beyond WO)

- Implements Work Orders precisely
- Branches from `dev`, commits, opens PRs
- Populates execution metadata (including provenance)

**Must NOT:** Expand scope or modify governance unless ordered.

### 2.4 Verifier–Tester Agent (Guardian)

**Authority:** Blocking + evidence

- Enforces acceptance criteria + Forge laws + contracts
- Maintains and runs tests derived from Work Orders
- Gates merges/promotions where configured
- Supports autonomous and human-runnable test suites

**Must NOT:** Rewrite implementation code.

### 2.5 Evolution Agent

**Authority:** Propositional only

- Observes friction/ambiguity/bottlenecks
- Proposes evidence-driven Forge Evolution Work Orders
- Aggregates entity-local signals into Forge proposals

**Must NOT:** Modify code or execute changes.

### 2.6 Creative Agents (plural; sandboxed)

**Authority:** None

- Divergent ideation (UX, gameplay, narrative, alternatives)
- Provides options to Architect/Evolution roles

**Constraint:** Outputs have zero force unless wrapped into Work Orders.

### 2.7 Reporter Agent

**Authority:** Observational / aggregative (non-executive)

The Reporter is the Forge's sensemaking, metrics, and institutional memory layer.

**Responsibilities:**
- Surfaces metrics and visibility across Forge / Entities / Products
- Provides time-aware reporting (snapshots, deltas, trends)
- Maintains historic recordings for performance over time
- Produces dual-format outputs (human HUD + agent-consumable signals)
- Frames signal → question prompts for Director/Evolution Agent

**Primary Consumers:**
- Director (decision support, visibility)
- Evolution Agent (evidence for proposals)
- Verifier–Tester (outcome tracking)
- Architect (coherence monitoring)

**Explicit Constraints:**
- Reporter outputs are advisory and evidentiary only
- Reporter does NOT execute changes
- Reporter does NOT approve Work Orders
- Reporter does NOT modify laws

---

## 2A. Operating Modes (Human Plug-in Model)

The Forge operates under an "autonomous cockpit" model.

### M1: Default Mode
- Humans act only through roles and Work Orders
- No direct fixes or bypasses

### M2: Emergency Override
- Requires explicit Director decision log
- Expiry/decay back to M1 (max 48 hours)
- Follow-up Work Order to normalize exception
- Abuse of M2 is a process violation

### M3: Temporary Role Assumption
- Director may temporarily assume another role's function
- Requires explicit decision log + Verifier–Tester review
- Expiry/decay back to M1 (max 24 hours)
- Discouraged for regular use

---

## 2B. Agent Onboarding & Constitutional Binding

All agents (human and non-human) must be onboarded into Forge OS.

See: [AGENT_ONBOARDING_CONTRACT.md](./contracts/AGENT_ONBOARDING_CONTRACT.md) for full contract.

### Capability Axes

Agents declare capabilities across five axes:
- **A (Repo):** None → Read → Write
- **B (Execution):** Non-executing → Work Order bound → Limited autonomous
- **C (Verification):** None → Test runner → Gate authority
- **D (Propositional):** None → Suggestions → Work Orders
- **E (Observability):** Unstructured → Structured → Metrics-grade

### Role Derivation

Roles are NOT manually assigned. Roles derive from declared capabilities:
- Forge routes work based on WO phase + required role + eligible agents
- Lack of eligible agents triggers Director prompt and WO blocking

### Trust Graduation

- Agents declare initial capabilities at onboarding
- Reporter + Verifier–Tester observe performance
- Evolution Agent may propose capability upgrades (evidence-required)
- Director approves promotions
- Automatic downgrades on repeated failure (3+ consecutive)

### Constitutional Binding (Non-Optional)

**All agents MUST operate within a Forge Context Envelope.**

The envelope binds:
- Forge Kernel
- Role System
- Active Laws
- Reporting & provenance requirements

Model-native conventions (system prompts, init files, etc.) are wrapped by this envelope.
Failure to respect constitutional binding is a Verifier–Tester violation.

---

## 3. Authority Resolution Protocol

When agents disagree:

- Default temporary authority: **Architect** (conceptual integrity first)
- Executor must pause execution if guidance conflicts with invariants
- Director resolves when available

If Director is unavailable and disagreement is blocking:

- The Forge freezes forward progress
- A clarification request is issued
- No agent may “push through” uncertainty by improvisation

---

## 4. Process Strictness Doctrine

The Forge explicitly values **correctness over speed**.

- Slower progress caused by structural discipline is acceptable
- Silent drift, conceptual debt, or untracked assumptions are not

Agents are required to:

- stop when inputs are structurally incomplete
- request clarification using Forge-defined templates
- refuse tasks that violate scope or mutability rules

---

## 5. Visibility & Intervention Rules

The Forge operates under a mixed intervention model:

**Structural issues**  
(missing specs, unclear scope, mutability violations):  
→ agents must interrupt and request correction

**Creative issues**  
(style, UX nuance, exploratory ideas):  
→ agents may proceed with best-effort execution and flag uncertainty

Agents must explicitly state which category an intervention falls into.

---

## 6. Work Lifecycle (Mandatory)

All meaningful work in the Forge proceeds through this lifecycle:

1. Intent Capture  
2. Work Order Formalisation  
3. Eligibility Check  
4. Execution / Reasoning  
5. Reflection  
6. Learning Capture  

Skipping steps is a **process violation**, not an optimisation.

---

## 6A. Work Order State Machine (Factory Conveyor)

Work Orders traverse a defined state machine with role-based routing.

See: [WORK_ORDER_LIFECYCLE_CONTRACT.md](./contracts/WORK_ORDER_LIFECYCLE_CONTRACT.md) for full contract.

### Canonical States

Draft → Approved → Executing → Verified/Tested → Deployed (Dev) → Promoted → Deployed (Prod) → Observed → Evolved (optional)

### Role Triggers by Phase

| Phase | Primary Role | Blocking Authority |
|-------|--------------|-------------------|
| Draft | Director / Architect | None |
| Approved | Forge (routing) | None |
| Executing | Executor | Clarification blocks |
| Verified/Tested | Verifier–Tester | **Yes** — Can reject |
| Deployed (Dev) | Executor / Automation | Failure blocks |
| Promoted | Director | Director may hold |
| Deployed (Prod) | Executor / Automation | Failure blocks |
| Observed | Reporter | None |
| Evolved | Evolution Agent | None |

### Capability-based Routing

- Work Orders specify required capabilities, not specific agents
- Forge selects eligible agents automatically
- No eligible agent → WO blocked → Director prompt

### Artifact Handoffs

Each phase emits artifacts consumable by downstream roles.
Reporter aggregates across all phases for evolution evidence.

---

## 6B. E2E Workflow Playbook (Operational Guidance)

Until Forge automation is complete, the Director triggers end-to-end workflows manually.

The **E2E Workflow Playbook** provides:
- Phase-by-phase checklist aligned to the state machine
- Role responsibilities per phase
- Required artifacts per phase
- "What to do when stuck" guidance
- Constitutional binding reminders for agent onboarding
- Agent Pack template for each phase

This is the **canonical way to work** until automation Work Orders are approved.

See: [E2E_WORKFLOW_PLAYBOOK.md](./ops/E2E_WORKFLOW_PLAYBOOK.md) for the full playbook.

---

## 7. Self-Improvement Mandate (Critical)

The Forge is explicitly allowed—and required—to improve itself.

Any agent may propose a process improvement,  
but only via the defined evolution mechanism.

Unilateral or implicit process changes are forbidden.

---

## 8. Process Evolution Mechanism

All process changes must follow this structure:

- Observation of friction or failure
- Hypothesis for improvement
- Defined trial scope
- Success / failure signals
- Explicit approval before canonisation

Approved changes update:
- the Forge Kernel
- Forge Lessons
- or the Evolution log

---

## 9. Enforcement & Guidance Duty

All agents share responsibility for process enforcement.

If the Director:

- provides underspecified input
- skips formalisation steps
- attempts to bypass structure

Agents must:

- pause execution
- explain what is missing
- guide the Director back onto the process

Compliance alone is insufficient; **guidance is required**.

### 9A. Non-Regression Principle

The Forge is constitutionally protected against silent drift or erosion of guarantees.

**Definition:**
Any change that weakens or bypasses constitutional guarantees is a **regression**. Regressions are invalid unless explicitly approved by the Director via a Work Order whose acceptance criteria calls out the regression risk.

**What Constitutes Regression:**
- Weakening role separation (e.g., allowing Executor to approve its own work)
- Reducing verification/testing gates
- Bypassing provenance requirements
- Bypassing the Forge Context Envelope or constitutional binding
- Reducing reporting/observability required for evidence-driven evolution
- Introducing silent automation without Reporter-visible artifacts
- Circumventing Acceptance Criteria Supremacy

**Requirements for Approved Regressions:**
If a regression is genuinely necessary, the approving Work Order MUST include:
- Explicit rationale for why the regression is required
- Explicit compensating controls that mitigate the risk
- Explicit expiry or rollback plan where appropriate
- Director sign-off with awareness of the constitutional impact

**Enforcement:**
- Verifier–Tester MUST treat suspected regressions as a **blocking condition**
- Only a Director-approved Work Order with explicit regression acknowledgement can override
- All regression approvals are logged as Reporter signals for institutional memory
- Evolution Agent must flag any observed drift patterns that may constitute gradual regression

This principle ensures the Forge cannot be hollowed out through incremental "small edits" or convenience changes.

---

## 10. Canonical Truth Hierarchy

When resolving ambiguity, agents must defer in this order:

1. Forge Kernel  
2. Forge Invariants  
3. Active Forge State  
4. Recorded Forge Lessons  
5. Current Specs  
6. Code Reality  
7. Agent Inference (last resort)

---

## 11. Acceptance Criteria Supremacy Law

Work Order acceptance criteria are the **binding definition of done**.

Rules:
- A Work Order is complete if and only if all acceptance criteria are met
- Agents must not declare completion based on effort, time, or intent
- Partial completion requires explicit documentation of unmet criteria
- Acceptance criteria may be amended only by the Director prior to execution start

This law ensures traceability and prevents scope ambiguity.

---

## 12. Forge Evolution Law

The Forge evolves through structured contribution, not unilateral change.

Rules:
- All Forge changes must originate as Work Orders
- Changes are proposed, reviewed, approved, and executed—never improvised
- The Director holds final authority over Forge evolution
- Agents may propose but never enact evolution without approval

### Human-Agent Interaction Enhancement Clause

When humans and agents collaborate on Forge evolution:
- Agents must surface implications the human may not foresee
- Humans must provide context agents cannot infer
- Neither party may defer decision-making to the other without explicit handoff
- Disagreements are resolved per the Authority Resolution Protocol (Section 3)

This law codifies the collaborative governance model.

---

## 12A. Reporter ↔ Evolution Agent Feedback Loop

Forge evolution must be **evidence-driven, measurable, and auditable**.

### Signal Ingestion

Reporter must expose structured signals derived from:
- [REPORTING_SIGNALS_CONTRACT.md](./contracts/REPORTING_SIGNALS_CONTRACT.md)
- Verifier–Tester outcomes
- Director override events (M2/M3)

All signals must be time-stamped and attributable.

### Evolution Proposal Requirements

All Evolution Agent proposals MUST reference:
- One or more Reporter signals (evidence)
- A stated hypothesis (what should improve)

**Proposals without evidence linkage are invalid.**

### Post-Evolution Observation

Reporter is responsible for tracking:
- Pre-change baseline
- Post-change outcomes
- Trend comparison over time

Results must be consumable by:
- Director (human-readable summary)
- Evolution Agent (structured data)

### Learning Closure

Evolution proposals are not considered "closed" until:
- Reporter has recorded impact over time
- Outcomes are classified as: **improved** / **neutral** / **regressed**

These outcomes must be queryable as institutional learning.

### Authority Boundaries

- Reporter does NOT approve Evolution proposals
- Evolution Agent does NOT self-certify success
- Director remains final arbiter of whether an evolution is retained, reverted, or iterated

---

## 13. Agent Provenance Law

All executed Work Orders must record **agent provenance**.

Required provenance fields:
- `agent.type`: Category of executing agent (repo-agent, cloud-agent, local-agent)
- `agent.name`: Specific agent identifier (e.g., claude, cursor, copilot)
- `agent.mode`: Execution environment (cloud, local, hybrid)

Rules:
- Provenance is written at execution completion, not at approval
- Missing provenance on executed Work Orders is a process violation
- Provenance enables audit, learning, and agent performance analysis

See: [WORK_ORDER_INDEX_CONTRACT.md](./contracts/WORK_ORDER_INDEX_CONTRACT.md) for schema.

---

## 14. Exit Condition

The Forge considers itself operational when:

- It can accept Work Orders without clarification loops
- It can correct process violations without human prompting
- It can guide new agents using only canonical artifacts

Until then, **Forge construction remains a first-class activity**.

End of Kernel.
